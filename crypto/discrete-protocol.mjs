import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { sha3_256 } from '@noble/hashes/sha3.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

const utf8 = new TextEncoder();
const ZERO_32 = new Uint8Array(32);
const ZERO_12 = new Uint8Array(12);

export const DOMAINS = Object.freeze({
  viewRoot: 'discrete-pq-view-root-v1',
  spendRoot: 'discrete-pq-spend-root-v1',
  inputsHash: 'discrete-pq-inputs-hash-v1',
  outContext: 'discrete-pq-out-context-v1',
  aeadKey: 'discrete-pq-aead-key-v1',
  spendCommit: 'discrete-pq-spend-commit-v1',
  nullifier: 'discrete-pq-nullifier-v1',
  coinbaseRho: 'discrete-coinbase-rho-v1',
});

function concat(...parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function le32(value) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

function le64(value) {
  let remaining = BigInt(value);
  const out = new Uint8Array(8);
  for (let i = 0; i < out.length; ++i) {
    out[i] = Number(remaining & 255n);
    remaining >>= 8n;
  }
  return out;
}

function domain(name) {
  return utf8.encode(name);
}

export function deriveViewSeed(masterSeed) {
  return hkdf(sha3_256, masterSeed, ZERO_32, domain(DOMAINS.viewRoot), 64);
}

export function deriveSpendSeed(masterSeed) {
  return hkdf(sha3_256, masterSeed, ZERO_32, domain(DOMAINS.spendRoot), 32);
}

export function transactionInputsHash(inputs) {
  if (inputs.length === 0) return new Uint8Array(32);
  return sha3_256(concat(domain(DOMAINS.inputsHash), ...inputs.flatMap(input => [input.prevTxid, le32(input.prevOutIndex)])));
}

export function outputContext(inputsHash, kemCiphertext, outputIndex, subaddressIndex = 0n) {
  return sha3_256(concat(domain(DOMAINS.outContext), inputsHash, kemCiphertext,
    le32(outputIndex), le64(subaddressIndex)));
}

export function deriveOutputAeadKey(sharedSecret, context) {
  return hkdf(sha3_256, sharedSecret, ZERO_32,
    concat(domain(DOMAINS.aeadKey), context), 32);
}

export function calculateSpendCommit(spendPublicKey, rho) {
  return sha3_256(concat(domain(DOMAINS.spendCommit), spendPublicKey, rho));
}

export function calculateNullifier(spendPublicKey, rho, transactionHash, outputIndex) {
  return sha3_256(concat(domain(DOMAINS.nullifier), spendPublicKey, rho,
    transactionHash, le32(outputIndex)));
}

export function calculateCoinbaseRho(spendPublicKey, height, outputIndex) {
  return sha3_256(concat(domain(DOMAINS.coinbaseRho), spendPublicKey,
    le32(height), le32(outputIndex)));
}

export function scanPqOutput(output, inputsHash, viewSecretKey, spendPublicKey, subaddressIndex = 0n) {
  try {
    const sharedSecret = ml_kem768.decapsulate(output.kemCiphertext, viewSecretKey);
    const context = outputContext(inputsHash, output.kemCiphertext, output.outputIndex, subaddressIndex);
    const key = deriveOutputAeadKey(sharedSecret, context);
    const aad = concat(context, le64(output.amount));
    const plaintext = chacha20poly1305(key, ZERO_12, aad).decrypt(output.encryptedPayload);
    if (plaintext.length !== 40) return null;
    const rho = plaintext.slice(0, 32);
    const recoveredIndex = new DataView(plaintext.buffer, plaintext.byteOffset + 32, 8).getBigUint64(0, true);
    if (recoveredIndex !== BigInt(subaddressIndex)) return null;
    const commitment = calculateSpendCommit(spendPublicKey, rho);
    if (!commitment.every((byte, index) => byte === output.spendCommit[index])) return null;
    return { amount: BigInt(output.amount), rho, subaddressIndex: recoveredIndex, context };
  } catch (_) {
    return null;
  }
}

export function recognizesCoinbaseOutput(spendCommit, spendPublicKey, height, outputIndex) {
  const rho = calculateCoinbaseRho(spendPublicKey, height, outputIndex);
  const expected = calculateSpendCommit(spendPublicKey, rho);
  return expected.every((byte, index) => byte === spendCommit[index]) ? rho : null;
}
