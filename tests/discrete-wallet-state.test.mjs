import assert from 'node:assert/strict';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import {
  calculateNullifier, calculateSpendCommit, deriveOutputAeadKey, outputContext,
} from '../src/crypto/discrete-protocol.mjs';
import { DiscreteWalletState } from '../src/crypto/discrete-wallet-state.mjs';

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
