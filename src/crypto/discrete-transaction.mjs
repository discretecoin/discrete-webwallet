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

// Genesis block ids, the chain identity the version-2 transcript binds. Pinned
// rather than asked of the node: the node is not trusted to name the network.
export const GENESIS_BLOCK_IDS = Object.freeze({
  mainnet: '06c4df2cd46045b9fbc1664a10f1bdf0355f672c8349bbd29d671bf48e83d7bd',
  testnet: 'fa8828f3f38fa6f91842dec9a837e1ad33d920aa55f989e2baf1d1058d4f4251',
});

// keyRef of an input that carries its own key. This wallet never builds
// key-reference inputs, so every input signs and carries its key.
const NO_KEY_REF = 0xFFFFFFFF;
const fromHex = hex => Uint8Array.from(hex.match(/../g) || [], byte => parseInt(byte, 16));

// The transcript for a transaction built now. `height` is the index of the block
// expected to carry it (tip + 1), the number consensus judges it at.
// `transcriptV2Height` is the activation height (config.transcriptV2Height[Testnet],
// mirroring parameters::PQ_TRANSCRIPT_V2_HEIGHT); there is deliberately no default.
export function signingContextForHeight(height, testnet, transcriptV2Height) {
  if (!Number.isSafeInteger(height) || height < 0) throw new RangeError('invalid signing height');
  if (!Number.isSafeInteger(transcriptV2Height) || transcriptV2Height < 0) throw new RangeError('invalid transcript v2 height');
  return { useV2: height >= transcriptV2Height,
    chainId: fromHex(testnet ? GENESIS_BLOCK_IDS.testnet : GENESIS_BLOCK_IDS.mainnet) };
}

// Everything both transcripts hash after their domain (and v2's chain id).
function signingBody(transaction, fee) {
  const txType = transaction.txType === undefined ? 1 : transaction.txType;
  const chunks = [Uint8Array.of(1, txType), le64(0), le32(transaction.inputs.length)];
  for (const input of transaction.inputs) chunks.push(input.transactionHash, le32(input.outputIndex), input.spendPublicKey, input.rho);
  chunks.push(le32(transaction.outputs.length));
  for (const output of transaction.outputs) chunks.push(Uint8Array.of(0x10), le64(output.amount), le64(output.unlockHeight),
    output.kemCiphertext, output.encryptedPayload, output.spendCommit);
  chunks.push(le32(transaction.extra.length), transaction.extra, le64(fee));
  return chunks;
}

export function transactionSigningDigest(transaction, fee) {
  return sha3_256(concat(utf8.encode('discrete-pq-tx-sign-v1'), ...signingBody(transaction, fee)));
}

// Version 2 binds the chain and the input being authorized, so a signature is
// valid in one position of one transaction on one network.
export function transactionSigningDigestV2(transaction, fee, chainId, inputIndex) {
  if (!(chainId instanceof Uint8Array) || chainId.length !== 32) throw new Error('invalid chain id');
  if (!Number.isInteger(inputIndex) || inputIndex < 0 || inputIndex >= transaction.inputs.length) throw new RangeError('invalid input index');
  return sha3_256(concat(utf8.encode('discrete-pq-tx-sign-v2'), chainId, ...signingBody(transaction, fee),
    ...transaction.inputs.map(() => le32(NO_KEY_REF)), le32(inputIndex)));
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

export function buildSignedTransaction({ inputs, destinations, fee, spendPublicKey, spendSecretKey, extra = new Uint8Array(), signing }) {
  // Required, so no caller can fall back to version 1 past the activation height.
  if (!signing || typeof signing.useV2 !== 'boolean') throw new Error('signing context required (signingContextForHeight)');
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
  if (signing.useV2) {
    transaction.signatures = normalizedInputs.map((_, index) =>
      ml_dsa65.sign(transactionSigningDigestV2(transaction, BigInt(fee), signing.chainId, index), spendSecretKey));
  } else {
    const digest = transactionSigningDigest(transaction, BigInt(fee));
    transaction.signatures = normalizedInputs.map(() => ml_dsa65.sign(digest, spendSecretKey));
  }
  return { transaction, bytes: serializeTransaction(transaction) };
}
