import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import {
  calculateSpendCommit, deriveOutputAeadKey, deriveSpendSeed, deriveViewSeed,
  legacyOutputContextV1, outputContext, scanPqOutput, scanPqOutputLegacyTWindow,
  transactionInputsHash,
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

// Current (v2): outContext does not depend on T.
const context = outputContext(ih, kemCiphertext, 1);
assert.equal(toHex(context), vectors.out_context.output);
const sharedSecret = pattern(32, 1, 0);
const aeadKey = deriveOutputAeadKey(sharedSecret, context);
assert.equal(toHex(aeadKey), vectors.aead_key.output);

// Legacy (pre-v2): receiver-side fallback formula, always at T=0.
const legacyContext = legacyOutputContextV1(ih, kemCiphertext, 1, 0n);
assert.equal(toHex(legacyContext), vectors.out_context_legacy_v1.output);
const legacyAeadKey = deriveOutputAeadKey(sharedSecret, legacyContext);
assert.equal(toHex(legacyAeadKey), vectors.aead_key_legacy_v1.output);

const spendPublicKey = pattern(1952, 5, 1);
const rho = pattern(32, 3, 9);
assert.equal(toHex(calculateSpendCommit(spendPublicKey, rho)), vectors.spend_commit.output);

const amount = 1000000n;
const plaintext = new Uint8Array(40);
plaintext.set(rho);

const aad = new Uint8Array(40);
aad.set(context);
new DataView(aad.buffer).setBigUint64(32, amount, true);
const encryptedPayload = chacha20poly1305(aeadKey, new Uint8Array(12), aad).encrypt(plaintext);
assert.equal(toHex(encryptedPayload), vectors.pq_output_enc_payload.output);

const legacyAad = new Uint8Array(40);
legacyAad.set(legacyContext);
new DataView(legacyAad.buffer).setBigUint64(32, amount, true);
const legacyEncryptedPayload = chacha20poly1305(legacyAeadKey, new Uint8Array(12), legacyAad).encrypt(plaintext);
assert.equal(toHex(legacyEncryptedPayload), vectors.pq_output_enc_payload_legacy_v1.output);

// scanPqOutput recognizes a v2 output in one shot, no T guessing.
const viewKeys = ml_kem768.keygen(deriveViewSeed(masterSeed));
const encapsulation = ml_kem768.encapsulate(viewKeys.publicKey, pattern(32, 11, 4));
const scanContext = outputContext(new Uint8Array(32), encapsulation.cipherText, 0);
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
assert.equal(owned.subaddressIndex, 0n);
assert.equal(scanPqOutput({
  outputIndex: 0, amount: amount + 1n, kemCiphertext: encapsulation.cipherText,
  encryptedPayload: scanPayload, spendCommit: calculateSpendCommit(spendPublicKey, rho),
}, new Uint8Array(32), viewKeys.secretKey, spendPublicKey), null);

// A v2 output built at a large, non-sequential T is still recognized in one
// shot -- this is the point of outContext-v2: no scan window, any T costs the
// same as T=0.
{
  const bigT = 0xA1B2C3D4E5F60708n;
  const bigTPlaintext = new Uint8Array(40);
  bigTPlaintext.set(rho);
  new DataView(bigTPlaintext.buffer).setBigUint64(32, bigT, true);
  const bigTPayload = chacha20poly1305(scanKey, new Uint8Array(12), scanAad).encrypt(bigTPlaintext);
  const ownedBigT = scanPqOutput({
    outputIndex: 0, amount, kemCiphertext: encapsulation.cipherText,
    encryptedPayload: bigTPayload, spendCommit: calculateSpendCommit(spendPublicKey, rho),
  }, new Uint8Array(32), viewKeys.secretKey, spendPublicKey);
  assert.equal(ownedBigT?.subaddressIndex, bigT);
}

// A legacy (pre-v2), T=0 output is still recognized by the default scan path.
{
  const legacyScanContext = legacyOutputContextV1(new Uint8Array(32), encapsulation.cipherText, 0, 0n);
  const legacyScanKey = deriveOutputAeadKey(encapsulation.sharedSecret, legacyScanContext);
  const legacyScanAad = new Uint8Array(40);
  legacyScanAad.set(legacyScanContext);
  new DataView(legacyScanAad.buffer).setBigUint64(32, amount, true);
  const legacyScanPayload = chacha20poly1305(legacyScanKey, new Uint8Array(12), legacyScanAad).encrypt(plaintext);
  const ownedLegacy = scanPqOutput({
    outputIndex: 0, amount, kemCiphertext: encapsulation.cipherText,
    encryptedPayload: legacyScanPayload, spendCommit: calculateSpendCommit(spendPublicKey, rho),
  }, new Uint8Array(32), viewKeys.secretKey, spendPublicKey);
  assert.equal(ownedLegacy?.subaddressIndex, 0n);
  assert.equal(toHex(ownedLegacy.rho), toHex(rho));

  // A legacy output at nonzero T is invisible to the default path...
  const legacyT = 5n;
  const legacyTContext = legacyOutputContextV1(new Uint8Array(32), encapsulation.cipherText, 0, legacyT);
  const legacyTKey = deriveOutputAeadKey(encapsulation.sharedSecret, legacyTContext);
  const legacyTAad = new Uint8Array(40);
  legacyTAad.set(legacyTContext);
  new DataView(legacyTAad.buffer).setBigUint64(32, amount, true);
  const legacyTPlaintext = new Uint8Array(40);
  legacyTPlaintext.set(rho);
  new DataView(legacyTPlaintext.buffer).setBigUint64(32, legacyT, true);
  const legacyTPayload = chacha20poly1305(legacyTKey, new Uint8Array(12), legacyTAad).encrypt(legacyTPlaintext);
  const legacyTOutput = {
    outputIndex: 0, amount, kemCiphertext: encapsulation.cipherText,
    encryptedPayload: legacyTPayload, spendCommit: calculateSpendCommit(spendPublicKey, rho),
  };
  assert.equal(scanPqOutput(legacyTOutput, new Uint8Array(32), viewKeys.secretKey, spendPublicKey), null);

  // ...but the manual, opt-in legacy T-window fallback finds it.
  const recovered = scanPqOutputLegacyTWindow(legacyTOutput, new Uint8Array(32), viewKeys.secretKey, spendPublicKey, 8);
  assert.equal(recovered?.subaddressIndex, legacyT);
}
