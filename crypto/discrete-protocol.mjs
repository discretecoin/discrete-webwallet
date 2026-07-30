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
  // LEGACY: the original outContext formula folded LE64(T) into the hash used
  // to derive the AEAD key, so scanning had to guess T in advance. Every
  // output minted before the outContext-v2 activation used this domain,
  // always at T=0. Retained ONLY as a receiver-side fallback (see
  // legacyOutputContextV1 below) so those outputs stay scannable. Never use
  // this to build a new output.
  outContextLegacyV1: 'discrete-pq-out-context-v1',
  // CURRENT: outContext no longer depends on T. T travels only inside the
  // AEAD-encrypted payload and is read back after a single decrypt, so
  // scanning never needs to enumerate candidate T values.
  outContext: 'discrete-pq-out-context-v2',
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

export function outputContext(inputsHash, kemCiphertext, outputIndex) {
  return sha3_256(concat(domain(DOMAINS.outContext), inputsHash, kemCiphertext,
    le32(outputIndex)));
}

// LEGACY (pre-v2) formula. Receiver-side fallback only — see scanPqOutput.
export function legacyOutputContextV1(inputsHash, kemCiphertext, outputIndex, subaddressIndex) {
  return sha3_256(concat(domain(DOMAINS.outContextLegacyV1), inputsHash, kemCiphertext,
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

// Pure AEAD mechanics under a given, already-computed context: no ownership
// check. Returns the recovered {rho, subaddressIndex} on success, null if the
// tag fails to verify (not ours under this context, or tampered).
function tryDecrypt(sharedSecret, context, output) {
  try {
    const key = deriveOutputAeadKey(sharedSecret, context);
    const aad = concat(context, le64(output.amount));
    const plaintext = chacha20poly1305(key, ZERO_12, aad).decrypt(output.encryptedPayload);
    if (plaintext.length !== 40) return null;
    const rho = plaintext.slice(0, 32);
    const subaddressIndex = new DataView(plaintext.buffer, plaintext.byteOffset + 32, 8).getBigUint64(0, true);
    return { rho, subaddressIndex };
  } catch (_) {
    return null;
  }
}

// Try outContext-v2 first (T is read back from the decrypted payload, never
// enumerated), then fall back once to the legacy pre-v2 derivation at T=0
// (every output minted before the v2 activation used T=0 unconditionally).
// No enumeration of candidate T values is ever needed.
export function scanPqOutput(output, inputsHash, viewSecretKey, spendPublicKey) {
  try {
    const sharedSecret = ml_kem768.decapsulate(output.kemCiphertext, viewSecretKey);

    const contextV2 = outputContext(inputsHash, output.kemCiphertext, output.outputIndex);
    let decrypted = tryDecrypt(sharedSecret, contextV2, output);
    let context = contextV2;

    if (!decrypted) {
      const contextLegacy = legacyOutputContextV1(inputsHash, output.kemCiphertext, output.outputIndex, 0n);
      const legacy = tryDecrypt(sharedSecret, contextLegacy, output);
      // Belt-and-braces: the legacy key was derived at T=0, so the payload's
      // T must also read back as 0.
      if (legacy && legacy.subaddressIndex === 0n) {
        decrypted = legacy;
        context = contextLegacy;
      }
    }
    if (!decrypted) return null;

    const commitment = calculateSpendCommit(spendPublicKey, decrypted.rho);
    if (!commitment.every((byte, index) => byte === output.spendCommit[index])) return null;
    return { amount: BigInt(output.amount), rho: decrypted.rho, subaddressIndex: decrypted.subaddressIndex, context };
  } catch (_) {
    return null;
  }
}

// MANUAL RECOVERY FALLBACK ONLY — not used by scanPqOutput above and not
// called automatically. Brute-forces the legacy (pre-outContext-v2)
// derivation across candidate T values in [0, maxT). Consensus never
// validated outContext, so nothing stops an unupgraded or hand-rolled sender
// from still creating a legacy nonzero-T output (none has ever been observed
// on Discrete's chain). Decapsulates once; each T trial costs one SHA3 + one
// AEAD attempt.
export function scanPqOutputLegacyTWindow(output, inputsHash, viewSecretKey, spendPublicKey, maxT) {
  try {
    const sharedSecret = ml_kem768.decapsulate(output.kemCiphertext, viewSecretKey);
    for (let t = 0n; t < BigInt(maxT); ++t) {
      const context = legacyOutputContextV1(inputsHash, output.kemCiphertext, output.outputIndex, t);
      const decrypted = tryDecrypt(sharedSecret, context, output);
      if (!decrypted || decrypted.subaddressIndex !== t) continue;
      const commitment = calculateSpendCommit(spendPublicKey, decrypted.rho);
      if (!commitment.every((byte, index) => byte === output.spendCommit[index])) continue;
      return { amount: BigInt(output.amount), rho: decrypted.rho, subaddressIndex: decrypted.subaddressIndex, context };
    }
    return null;
  } catch (_) {
    return null;
  }
}

export function recognizesCoinbaseOutput(spendCommit, spendPublicKey, height, outputIndex) {
  const rho = calculateCoinbaseRho(spendPublicKey, height, outputIndex);
  const expected = calculateSpendCommit(spendPublicKey, rho);
  return expected.every((byte, index) => byte === spendCommit[index]) ? rho : null;
}
