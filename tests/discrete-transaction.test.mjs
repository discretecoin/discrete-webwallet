import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { accountRegistrationExtra, buildSignedTransaction, transactionSigningDigest } from '../src/crypto/discrete-transaction.mjs';

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
