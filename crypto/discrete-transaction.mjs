import { sha3_256 } from '@noble/hashes/sha3.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import {
  calculateSpendCommit, deriveOutputAeadKey, outputContext, transactionInputsHash,
} from './discrete-protocol.mjs';

const utf8 = new TextEncoder();
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const le32 = value => { const out = new Uint8Array(4); new DataView(out.buffer).setUint32(0, value, true); return out; };
const le64 = value => { let v = BigInt(value); const out = new Uint8Array(8); for (let i = 0; i < 8; ++i) { out[i] = Number(v & 255n); v >>= 8n; } return out; };
const varint = value => { let v = BigInt(value); const out = []; while (v >= 128n) { out.push(Number(v & 127n) | 128); v >>= 7n; } out.push(Number(v)); return Uint8Array.from(out); };

export function accountRegistrationExtra(viewPublicKey, spendPublicKey) {
  if (!(viewPublicKey instanceof Uint8Array) || viewPublicKey.length !== 1184) throw new Error('invalid ML-KEM-768 public key');
  if (!(spendPublicKey instanceof Uint8Array) || spendPublicKey.length !== 1952) throw new Error('invalid ML-DSA-65 public key');
  return concat(Uint8Array.of(0x05), viewPublicKey, spendPublicKey);
}

export function buildFreeRegistrationTransaction({ viewPublicKey, spendPublicKey, referenceBlockHash, nonce }) {
  const hash = typeof referenceBlockHash === 'string'
    ? Uint8Array.from(referenceBlockHash.match(/../g) || [], byte => parseInt(byte, 16))
    : referenceBlockHash;
  if (!(hash instanceof Uint8Array) || hash.length !== 32) throw new Error('invalid reference block hash');
  const extra = concat(accountRegistrationExtra(viewPublicKey, spendPublicKey), Uint8Array.of(0x06), hash, le64(nonce));
  const transaction = { txType: 3, inputs: [], outputs: [], extra, signatures: [] };
  return { transaction, bytes: serializeTransaction(transaction) };
}

export function transactionSigningDigest(transaction, fee) {
  const chunks = [utf8.encode('discrete-pq-tx-sign-v1'), Uint8Array.of(1, 1), le64(0), le32(transaction.inputs.length)];
  for (const input of transaction.inputs) chunks.push(input.transactionHash, le32(input.outputIndex), input.spendPublicKey, input.rho);
  chunks.push(le32(transaction.outputs.length));
  for (const output of transaction.outputs) chunks.push(Uint8Array.of(0x10), le64(output.amount), le64(output.unlockHeight),
    output.kemCiphertext, output.encryptedPayload, output.spendCommit);
  chunks.push(le32(transaction.extra.length), transaction.extra, le64(fee));
  return sha3_256(concat(...chunks));
}

export function serializeTransaction(transaction) {
  const chunks = [varint(1), varint(transaction.txType === undefined ? 1 : transaction.txType), varint(0), varint(transaction.inputs.length)];
  for (const input of transaction.inputs) chunks.push(Uint8Array.of(0x10), input.transactionHash,
    varint(input.outputIndex), input.spendPublicKey, input.rho);
  chunks.push(varint(transaction.outputs.length));
  for (const output of transaction.outputs) chunks.push(varint(output.amount), varint(output.unlockHeight), Uint8Array.of(0x10),
    output.kemCiphertext, output.encryptedPayload, output.spendCommit);
  chunks.push(varint(transaction.extra.length), transaction.extra, ...transaction.signatures);
  return concat(...chunks);
}

export function buildSignedTransaction({ inputs, destinations, fee, spendPublicKey, spendSecretKey, extra = new Uint8Array() }) {
  const normalizedInputs = inputs.map(input => ({
    transactionHash: typeof input.transactionHash === 'string' ? Uint8Array.from(input.transactionHash.match(/../g), b => parseInt(b, 16)) : input.transactionHash,
    outputIndex: input.outputIndex, amount: BigInt(input.amount), rho: input.rho, spendPublicKey,
  }));
  const inputTotal = normalizedInputs.reduce((sum, input) => sum + input.amount, 0n);
  const outputTotal = destinations.reduce((sum, destination) => sum + BigInt(destination.amount), 0n);
  if (inputTotal !== outputTotal + BigInt(fee)) throw new Error('input/output/fee balance mismatch');
  const inputsHash = transactionInputsHash(normalizedInputs.map(input => ({ prevTxid: input.transactionHash, prevOutIndex: input.outputIndex })));
  const outputs = destinations.map((destination, outputIndex) => {
    const encapsulated = ml_kem768.encapsulate(destination.viewPublicKey);
    const rho = crypto.getRandomValues(new Uint8Array(32));
    const context = outputContext(inputsHash, encapsulated.cipherText, outputIndex);
    const key = deriveOutputAeadKey(encapsulated.sharedSecret, context);
    const amount = BigInt(destination.amount), unlockHeight = BigInt(destination.unlockHeight || 0);
    const aad = concat(context, le64(amount));
    const plaintext = concat(rho, le64(destination.subaddressIndex || 0));
    const encryptedPayload = chacha20poly1305(key, new Uint8Array(12), aad).encrypt(plaintext);
    return { amount, unlockHeight, kemCiphertext: encapsulated.cipherText, encryptedPayload,
      spendCommit: calculateSpendCommit(destination.spendPublicKey, rho), rho };
  });
  const transaction = { txType: 1, inputs: normalizedInputs, outputs, extra, signatures: [] };
  const digest = transactionSigningDigest(transaction, BigInt(fee));
  transaction.signatures = normalizedInputs.map(() => ml_dsa65.sign(digest, spendSecretKey));
  return { transaction, bytes: serializeTransaction(transaction) };
}
