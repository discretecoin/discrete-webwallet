import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import {
  calculateSpendCommit, deriveOutputAeadKey, deriveSpendSeed, deriveViewSeed,
  outputContext, scanPqOutput, transactionInputsHash,
} from '../src/crypto/discrete-protocol.mjs';

const vectors = JSON.parse(await readFile(new URL('../../discrete/tests/pq/kat_vectors.json', import.meta.url), 'utf8')).vectors;
const toHex = value => Buffer.from(value).toString('hex');
const pattern = (length, multiplier, addend) => Uint8Array.from({ length }, (_, i) => (i * multiplier + addend) & 255);

const masterSeed = pattern(32, 1, 0);
assert.equal(toHex(deriveViewSeed(masterSeed)), vectors.view_seed.output);
assert.equal(toHex(deriveSpendSeed(masterSeed)), vectors.spend_seed.output);

const ih = transactionInputsHash([
  { prevTxid: pattern(32, 1, 0), prevOutIndex: 7 },
  { prevTxid: pattern(32, 255, 5), prevOutIndex: 16909060 },
]);
assert.equal(toHex(ih), vectors.inputs_hash.output);

const kemCiphertext = pattern(1088, 7, 3);
const context = outputContext(ih, kemCiphertext, 1, 0n);
assert.equal(toHex(context), vectors.out_context.output);
const sharedSecret = pattern(32, 1, 0);
const aeadKey = deriveOutputAeadKey(sharedSecret, context);
assert.equal(toHex(aeadKey), vectors.aead_key.output);

const spendPublicKey = pattern(1952, 5, 1);
const rho = pattern(32, 3, 9);
assert.equal(toHex(calculateSpendCommit(spendPublicKey, rho)), vectors.spend_commit.output);

const amount = 1000000n;
const aad = new Uint8Array(40);
aad.set(context);
new DataView(aad.buffer).setBigUint64(32, amount, true);
const plaintext = new Uint8Array(40);
plaintext.set(rho);
const encryptedPayload = chacha20poly1305(aeadKey, new Uint8Array(12), aad).encrypt(plaintext);
assert.equal(toHex(encryptedPayload), vectors.pq_output_enc_payload.output);

const viewKeys = ml_kem768.keygen(deriveViewSeed(masterSeed));
const encapsulation = ml_kem768.encapsulate(viewKeys.publicKey, pattern(32, 11, 4));
const scanContext = outputContext(new Uint8Array(32), encapsulation.cipherText, 0, 0n);
const scanKey = deriveOutputAeadKey(encapsulation.sharedSecret, scanContext);
const scanAad = new Uint8Array(40);
scanAad.set(scanContext);
new DataView(scanAad.buffer).setBigUint64(32, amount, true);
const scanPayload = chacha20poly1305(scanKey, new Uint8Array(12), scanAad).encrypt(plaintext);
const owned = scanPqOutput({
  outputIndex: 0, amount, kemCiphertext: encapsulation.cipherText,
  encryptedPayload: scanPayload, spendCommit: calculateSpendCommit(spendPublicKey, rho),
}, new Uint8Array(32), viewKeys.secretKey, spendPublicKey);
assert.equal(owned?.amount, amount);
assert.equal(toHex(owned.rho), toHex(rho));
assert.equal(scanPqOutput({
  outputIndex: 0, amount: amount + 1n, kemCiphertext: encapsulation.cipherText,
  encryptedPayload: scanPayload, spendCommit: calculateSpendCommit(spendPublicKey, rho),
}, new Uint8Array(32), viewKeys.secretKey, spendPublicKey), null);
