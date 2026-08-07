import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { accountRegistrationExtra, buildSignedTransaction, transactionSigningDigest } from '../src/crypto/discrete-transaction.mjs';
import { scanPqOutput, transactionInputsHash } from '../src/crypto/discrete-protocol.mjs';

const vectors = JSON.parse(await readFile(new URL('../../discrete/tests/pq/kat_vectors.json', import.meta.url), 'utf8')).vectors;
const pattern = (length, a, b) => Uint8Array.from({ length }, (_, i) => (i * a + b) & 255);
const hex = bytes => Buffer.from(bytes).toString('hex');
const kat = { inputs: [{ transactionHash: pattern(32, 1, 0), outputIndex: 7,
  spendPublicKey: pattern(1952, 5, 1), rho: pattern(32, 3, 9) }], outputs: [{
  amount: 1000000n, unlockHeight: 0n, kemCiphertext: pattern(1088, 7, 3),
  encryptedPayload: pattern(56, 2, 1), spendCommit: pattern(32, 0, 0),
}], extra: new Uint8Array(), signatures: [] };
kat.outputs[0].spendCommit = Uint8Array.from(vectors.spend_commit.output.match(/../g), b => parseInt(b, 16));
assert.equal(hex(transactionSigningDigest(kat, 12345n)), vectors.tx_signing_digest.output);

const spend = ml_dsa65.keygen(pattern(32, 3, 8));
const recipient = ml_kem768.keygen(pattern(64, 5, 9));
const built = buildSignedTransaction({ inputs: [{ transactionHash: '01'.repeat(32), outputIndex: 2, amount: 30n, rho: pattern(32, 7, 4) }],
  destinations: [{ viewPublicKey: recipient.publicKey, spendPublicKey: spend.publicKey, amount: 25n }],
  fee: 5n, spendPublicKey: spend.publicKey, spendSecretKey: spend.secretKey });
assert.equal(built.transaction.signatures.length, 1);

const registration = accountRegistrationExtra(recipient.publicKey, spend.publicKey);
assert.equal(registration.length, 3137);
assert.equal(registration[0], 0x05);
assert.equal(ml_dsa65.verify(built.transaction.signatures[0], transactionSigningDigest(built.transaction, 5n), spend.publicKey), true);
assert.equal(built.bytes[0], 1);
assert.equal(built.bytes.length > 6000, true);

// Paying an H-I-A-T-C deposit number: T is carried in the output's AEAD payload
// and must come back out of the receiver's scan unchanged, so the recipient can
// attribute the payment to that deposit. Under outContext-v2 the key no longer
// depends on T, so a wrong T would be silently credited to the wrong deposit
// rather than failing to decrypt -- this asserts the value itself round-trips.
{
  const depositIndex = 7;
  const inputs = [{ transactionHash: '02'.repeat(32), outputIndex: 3, amount: 40n, rho: pattern(32, 9, 2) }];
  const deposit = buildSignedTransaction({ inputs,
    destinations: [{ viewPublicKey: recipient.publicKey, spendPublicKey: spend.publicKey,
      amount: 35n, subaddressIndex: depositIndex }],
    fee: 5n, spendPublicKey: spend.publicKey, spendSecretKey: spend.secretKey });
  const inputsHash = transactionInputsHash(inputs.map(input => ({
    prevTxid: Uint8Array.from(input.transactionHash.match(/../g), b => parseInt(b, 16)),
    prevOutIndex: input.outputIndex })));
  const output = deposit.transaction.outputs[0];
  const scanned = scanPqOutput({ outputIndex: 0, amount: output.amount,
    kemCiphertext: output.kemCiphertext, encryptedPayload: output.encryptedPayload,
    spendCommit: output.spendCommit }, inputsHash, recipient.secretKey, spend.publicKey);
  assert.equal(scanned?.amount, 35n);
  assert.equal(scanned.subaddressIndex, BigInt(depositIndex));
}
