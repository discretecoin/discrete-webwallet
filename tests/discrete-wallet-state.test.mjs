import assert from 'node:assert/strict';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import {
  calculateNullifier, calculateSpendCommit, deriveOutputAeadKey, outputContext,
} from '../src/crypto/discrete-protocol.mjs';
import { DiscreteWalletState } from '../src/crypto/discrete-wallet-state.mjs';
import { buildSignedTransaction } from '../src/crypto/discrete-transaction.mjs';
import { deriveWalletKeys } from '../src/crypto/discrete-wallet-keys.mjs';

const hex = bytes => Buffer.from(bytes).toString('hex');
const pattern = (length, multiplier, addend) => Uint8Array.from({ length }, (_, i) => (i * multiplier + addend) & 255);
const view = ml_kem768.keygen(pattern(64, 3, 1));
const spend = ml_dsa65.keygen(pattern(32, 5, 2));
const keys = { viewSecretKey: view.secretKey, spendPublicKey: spend.publicKey };
const txHash = pattern(32, 7, 3);
const rho = pattern(32, 11, 4);
const encapsulated = ml_kem768.encapsulate(view.publicKey, pattern(32, 13, 5));
const context = outputContext(new Uint8Array(32), encapsulated.cipherText, 0, 0n);
const aeadKey = deriveOutputAeadKey(encapsulated.sharedSecret, context);
const aad = new Uint8Array(40);
aad.set(context);
new DataView(aad.buffer).setBigUint64(32, 25n, true);
const plaintext = new Uint8Array(40);
plaintext.set(rho);
const payload = chacha20poly1305(aeadKey, new Uint8Array(12), aad).encrypt(plaintext);

const receive = {
  coinbase: false,
  hash: hex(txHash),
  transaction: { version: 1, tx_type: 1, vin: [], vout: [{
    amount: 25, unlock_height: 3, target: { type: '10', data: {
      kem_ct: hex(encapsulated.cipherText), enc_payload: hex(payload),
      spend_commit: hex(calculateSpendCommit(spend.publicKey, rho)),
    } },
  }] },
};

const state = new DiscreteWalletState();
state.applyBlock({ height: 0, hash: '00'.repeat(32), previous_hash: '00'.repeat(32), timestamp: 10, transactions: [receive] }, keys);
assert.equal(state.balance(), 25n);
assert.equal(state.spendableBalance(2), 0n);
assert.equal(state.spendableBalance(3), 25n);

const spendNullifier = calculateNullifier(spend.publicKey, rho, txHash, 0);
state.applyBlock({ height: 1, hash: '11'.repeat(32), previous_hash: '00'.repeat(32), timestamp: 20, transactions: [{
  coinbase: false, hash: '22'.repeat(32), transaction: { version: 1, tx_type: 1, vout: [], vin: [{
    type: '10', value: { prev_txid: hex(txHash), prev_out_index: 0,
      auth_pub: hex(spend.publicKey), rho_reveal: hex(rho) },
  }] },
}] }, keys);
assert.equal(hex(spendNullifier), state.outputs[0].nullifier);
assert.equal(state.balance(), 0n);
assert.equal(state.history.length, 2);

state.rollbackToHeight(1);
assert.equal(state.height, 1);
assert.equal(state.balance(), 25n);
assert.equal(state.outputs[0].spent, false);
assert.equal(state.history.length, 1);

const mempool = state.previewMempool([{
  coinbase: false, hash: '22'.repeat(32), transaction: { version: 1, tx_type: 1, vout: [], vin: [{
    type: '10', value: { prev_txid: hex(txHash), prev_out_index: 0,
      auth_pub: hex(spend.publicKey), rho_reveal: hex(rho) },
  }] },
}], keys, 30);
assert.equal(mempool.balance(), 0n);
assert.equal(state.balance(), 25n);

const restored = DiscreteWalletState.fromJSON(JSON.parse(JSON.stringify(state.toJSON())));
assert.equal(restored.balance(), 25n);
assert.equal(restored.outputs[0].amount, 25n);
assert.throws(() => restored.applyBlock({ height: 1, hash: '33'.repeat(32), previous_hash: 'ff'.repeat(32), transactions: [] }, keys), /discontinuity/);

const resetState = DiscreteWalletState.fromJSON(JSON.parse(JSON.stringify(state.toJSON())));
assert.equal(resetState.history.length > 0, true);
assert.equal(resetState.outputs.length > 0, true);
resetState.reset(42);
assert.deepEqual(resetState.toJSON(), {
  height: 42, tipHash: null, outputs: [], history: [], chain: [],
});
assert.equal(resetState.balance(), 0n);
resetState.applyBlock({
  height: 42, hash: '42'.repeat(32), previous_hash: '41'.repeat(32), timestamp: 30, transactions: [],
}, keys);
assert.equal(resetState.height, 43);

// Receiving a payment that was addressed to a deposit index (H-I-A-T-C).
//
// Under outContext-v2 the AEAD key does NOT depend on T -- T rides inside the
// encrypted payload -- so a payment at ANY T decrypts, credits, and stays
// spendable for the holder of the base key pair. That is the property this
// asserts, because getting it wrong would strand real funds: under the old
// pre-v2 derivation T WAS folded into the key, and a receiver that guessed the
// wrong T simply could not open the output at all.
{
  const sender = deriveWalletKeys(pattern(32, 1, 0));
  const recipient = deriveWalletKeys(pattern(32, 1, 128));
  const recipientKeys = { viewSecretKey: recipient.viewSecretKey, spendPublicKey: recipient.spendPublicKey };
  const stranger = deriveWalletKeys(pattern(32, 1, 64));
  const fundingTxid = 'ab'.repeat(32);
  const paymentTxid = 'cd'.repeat(32);

  const asWireTransaction = built => ({ coinbase: false, hash: paymentTxid, transaction: {
    version: 1, tx_type: 1,
    vin: built.transaction.inputs.map(input => ({ type: '10', value: {
      prev_txid: hex(input.transactionHash), prev_out_index: input.outputIndex,
      auth_pub: hex(input.spendPublicKey), rho_reveal: hex(input.rho) } })),
    vout: built.transaction.outputs.map(output => ({ amount: output.amount.toString(), unlock_height: 0,
      target: { type: '10', data: { kem_ct: hex(output.kemCiphertext),
        enc_payload: hex(output.encryptedPayload), spend_commit: hex(output.spendCommit) } } })),
  } });

  // T=0 is the primary address; the daemon reserves it and issues deposits from
  // T=1 up, so cover the boundary and a value past 32 bits.
  for (const depositIndex of [0, 1, 4294967295, 0xA1B2C3D4E5F60708n]) {
    const built = buildSignedTransaction({
      inputs: [{ transactionHash: fundingTxid, outputIndex: 1, amount: 500n, rho: pattern(32, 3, 0) }],
      destinations: [{ viewPublicKey: recipient.viewPublicKey, spendPublicKey: recipient.spendPublicKey,
        amount: 499n, subaddressIndex: depositIndex }],
      fee: 1n, spendPublicKey: sender.spendPublicKey, spendSecretKey: sender.spendSecretKey,
    });

    const received = new DiscreteWalletState(100);
    received.applyBlock({ height: 100, hash: '11'.repeat(32), previous_hash: null, timestamp: 1,
      transactions: [asWireTransaction(built)] }, recipientKeys);
    assert.equal(received.balance(), 499n, `T=${depositIndex}: not credited`);
    assert.equal(received.spendableBalance(100), 499n, `T=${depositIndex}: not spendable`);
    assert.equal(received.history.length, 1, `T=${depositIndex}: no history row`);

    // The recovered rho must reproduce the nullifier consensus recomputes from
    // (auth_pub, rho, txid, index) -- none of which carries T. If it did not,
    // the coins would be credited on screen but unspendable in practice.
    const owned = received.outputs[0];
    assert.equal(hex(calculateNullifier(recipient.spendPublicKey, owned.rho,
      Uint8Array.from(paymentTxid.match(/../g), byte => parseInt(byte, 16)), owned.outputIndex)),
      owned.nullifier, `T=${depositIndex}: nullifier mismatch`);

    // ...and a wallet that is not the recipient still sees nothing.
    const outsider = new DiscreteWalletState(100);
    outsider.applyBlock({ height: 100, hash: '11'.repeat(32), previous_hash: null, timestamp: 1,
      transactions: [asWireTransaction(built)] },
      { viewSecretKey: stranger.viewSecretKey, spendPublicKey: stranger.spendPublicKey });
    assert.equal(outsider.balance(), 0n, `T=${depositIndex}: leaked to a stranger`);
  }
}
