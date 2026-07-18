import assert from 'node:assert/strict';
import { createMLDSA65, createMLKEM768 } from '@oqs/liboqs-js';
import {
  DISCRETE_PQ_SIZES, mlDsa65Keygen, mlDsa65Sign, mlDsa65Verify,
  mlKem768Keygen, mlKem768Encapsulate, mlKem768Decapsulate,
} from '../src/crypto/discrete-pq.mjs';

const dsa = mlDsa65Keygen(new Uint8Array(DISCRETE_PQ_SIZES.dsaSeed));
assert.equal(dsa.publicKey.length, DISCRETE_PQ_SIZES.dsaPublicKey);
assert.equal(dsa.secretKey.length, DISCRETE_PQ_SIZES.dsaSecretKey);
const message = new TextEncoder().encode('Discrete ML-DSA-65 self-test');
const signature = mlDsa65Sign(message, dsa.secretKey, new Uint8Array(32));
assert.equal(signature.length, DISCRETE_PQ_SIZES.dsaSignature);
assert.equal(mlDsa65Verify(signature, message, dsa.publicKey), true);

const kem = mlKem768Keygen(new Uint8Array(DISCRETE_PQ_SIZES.kemSeed));
assert.equal(kem.publicKey.length, DISCRETE_PQ_SIZES.kemPublicKey);
assert.equal(kem.secretKey.length, DISCRETE_PQ_SIZES.kemSecretKey);
const encapsulated = mlKem768Encapsulate(kem.publicKey, new Uint8Array(32));
assert.equal(encapsulated.cipherText.length, DISCRETE_PQ_SIZES.kemCiphertext);
assert.deepEqual(
  mlKem768Decapsulate(encapsulated.cipherText, kem.secretKey),
  encapsulated.sharedSecret,
);

// Differential interoperability checks against Open Quantum Safe's independent
// liboqs/WASM implementation (the same implementation family used by the node).
const oqsDsa = await createMLDSA65();
try {
  const oqsKeys = oqsDsa.generateKeyPair();
  const nobleSignature = mlDsa65Sign(message, oqsKeys.secretKey, new Uint8Array(32));
  assert.equal(oqsDsa.verify(message, nobleSignature, oqsKeys.publicKey), true);
  const oqsSignature = oqsDsa.sign(message, oqsKeys.secretKey);
  assert.equal(mlDsa65Verify(oqsSignature, message, oqsKeys.publicKey), true);
} finally {
  oqsDsa.destroy();
}

const oqsKem = await createMLKEM768();
try {
  const oqsKeys = oqsKem.generateKeyPair();
  const nobleEncapsulation = mlKem768Encapsulate(oqsKeys.publicKey, new Uint8Array(32));
  assert.deepEqual(
    oqsKem.decapsulate(nobleEncapsulation.cipherText, oqsKeys.secretKey),
    nobleEncapsulation.sharedSecret,
  );

  const nobleKeys = mlKem768Keygen(new Uint8Array(DISCRETE_PQ_SIZES.kemSeed));
  const oqsEncapsulation = oqsKem.encapsulate(nobleKeys.publicKey);
  assert.deepEqual(
    mlKem768Decapsulate(oqsEncapsulation.ciphertext, nobleKeys.secretKey),
    oqsEncapsulation.sharedSecret,
  );
} finally {
  oqsKem.destroy();
}
