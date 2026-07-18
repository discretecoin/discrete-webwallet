import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

export const DISCRETE_PQ_SIZES = Object.freeze({
  dsaSeed: 32,
  dsaPublicKey: 1952,
  dsaSecretKey: 4032,
  dsaSignature: 3309,
  kemSeed: 64,
  kemPublicKey: 1184,
  kemSecretKey: 2400,
  kemCiphertext: 1088,
  kemSharedSecret: 32,
});

function exactBytes(name, value, length) {
  if (!(value instanceof Uint8Array) || value.length !== length) {
    throw new TypeError(`${name} must be a ${length}-byte Uint8Array`);
  }
  return value;
}

export function mlDsa65Keygen(seed) {
  return ml_dsa65.keygen(exactBytes('ML-DSA seed', seed, DISCRETE_PQ_SIZES.dsaSeed));
}

export function mlDsa65Sign(message, secretKey, randomSeed) {
  exactBytes('ML-DSA secret key', secretKey, DISCRETE_PQ_SIZES.dsaSecretKey);
  if (!(message instanceof Uint8Array)) throw new TypeError('message must be a Uint8Array');
  const opts = randomSeed === undefined ? undefined : {
    extraEntropy: exactBytes('ML-DSA signing randomness', randomSeed, 32),
  };
  return ml_dsa65.sign(message, secretKey, opts);
}

export function mlDsa65Verify(signature, message, publicKey) {
  exactBytes('ML-DSA signature', signature, DISCRETE_PQ_SIZES.dsaSignature);
  exactBytes('ML-DSA public key', publicKey, DISCRETE_PQ_SIZES.dsaPublicKey);
  if (!(message instanceof Uint8Array)) throw new TypeError('message must be a Uint8Array');
  return ml_dsa65.verify(signature, message, publicKey);
}

export function mlKem768Keygen(seed) {
  return ml_kem768.keygen(exactBytes('ML-KEM seed', seed, DISCRETE_PQ_SIZES.kemSeed));
}

export function mlKem768Encapsulate(publicKey, randomSeed) {
  exactBytes('ML-KEM public key', publicKey, DISCRETE_PQ_SIZES.kemPublicKey);
  if (randomSeed !== undefined) exactBytes('ML-KEM encapsulation randomness', randomSeed, 32);
  return ml_kem768.encapsulate(publicKey, randomSeed);
}

export function mlKem768Decapsulate(cipherText, secretKey) {
  exactBytes('ML-KEM ciphertext', cipherText, DISCRETE_PQ_SIZES.kemCiphertext);
  exactBytes('ML-KEM secret key', secretKey, DISCRETE_PQ_SIZES.kemSecretKey);
  return ml_kem768.decapsulate(cipherText, secretKey);
}
