import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { accountRegistrationExtra, buildSignedTransaction, transactionSigningDigest,
  transactionSigningDigestV2, signingContextForHeight, GENESIS_BLOCK_IDS } from '../src/crypto/discrete-transaction.mjs';
import { scanPqOutput, transactionInputsHash } from '../src/crypto/discrete-protocol.mjs';

const vectors = JSON.parse(await readFile(new URL('../../discrete/tests/pq/kat_vectors.json', import.meta.url), 'utf8')).vectors;
const pattern = (length, a, b) => Uint8Array.from({ length }, (_, i) => (i * a + b) & 255);
const hex = bytes => Buffer.from(bytes).toString('hex');
const UNSCHEDULED = 0xFFFFFFFF;  // config.transcriptV2Height today
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
  fee: 5n, spendPublicKey: spend.publicKey, spendSecretKey: spend.secretKey, signing: signingContextForHeight(0, false, UNSCHEDULED) });
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
    fee: 5n, spendPublicKey: spend.publicKey, spendSecretKey: spend.secretKey, signing: signingContextForHeight(0, false, UNSCHEDULED) });
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

// Transcript v2 must match the node byte for byte: core pins this vector in
// tests/pq/kat_vectors.json (tx_signing_digest_v2) and PqDerive.TxSigningDigestV2.
{
  const v = vectors.tx_signing_digest_v2;
  const tx = { ...kat, inputs: [kat.inputs[0], { transactionHash: pattern(32, 255, 5), outputIndex: 0x01020304,
    spendPublicKey: pattern(1952, 5, 1), rho: pattern(32, 13, 2) }] };
  const chainId = pattern(32, 11, 4);
  assert.equal(hex(transactionSigningDigestV2(tx, 12345n, chainId, 0)), v.output_input_0);
  assert.equal(hex(transactionSigningDigestV2(tx, 12345n, chainId, 1)), v.output_input_1);
  assert.throws(() => transactionSigningDigestV2(tx, 12345n, chainId, 2), RangeError);
  assert.throws(() => transactionSigningDigestV2(tx, 12345n, chainId.subarray(1), 0));
}

// The activation boundary and the chain identity.
{
  assert.throws(() => signingContextForHeight(0, false), RangeError);  // no default activation height
  assert.equal(signingContextForHeight(5000000, false, UNSCHEDULED).useV2, false);
  assert.equal(signingContextForHeight(39, false, 40).useV2, false);
  assert.equal(signingContextForHeight(40, false, 40).useV2, true);
  assert.equal(hex(signingContextForHeight(0, false, UNSCHEDULED).chainId), GENESIS_BLOCK_IDS.mainnet);
  assert.equal(hex(signingContextForHeight(0, true, UNSCHEDULED).chainId), GENESIS_BLOCK_IDS.testnet);
  assert.throws(() => signingContextForHeight(-1, false, UNSCHEDULED), RangeError);
  assert.throws(() => buildSignedTransaction({ inputs: [], destinations: [], fee: 0n,
    spendPublicKey: spend.publicKey, spendSecretKey: spend.secretKey }), /signing context required/);
}

// A v2 transaction: one signature per input, each valid only at its own index
// and only on its own chain.
{
  const signing = signingContextForHeight(40, true, 40);
  const inputs = [
    { transactionHash: '03'.repeat(32), outputIndex: 0, amount: 20n, rho: pattern(32, 1, 1) },
    { transactionHash: '04'.repeat(32), outputIndex: 1, amount: 20n, rho: pattern(32, 2, 2) }];
  const v2 = buildSignedTransaction({ inputs,
    destinations: [{ viewPublicKey: recipient.publicKey, spendPublicKey: spend.publicKey, amount: 35n }],
    fee: 5n, spendPublicKey: spend.publicKey, spendSecretKey: spend.secretKey, signing });
  const [sig0, sig1] = v2.transaction.signatures;
  const d0 = transactionSigningDigestV2(v2.transaction, 5n, signing.chainId, 0);
  const d1 = transactionSigningDigestV2(v2.transaction, 5n, signing.chainId, 1);
  assert.equal(ml_dsa65.verify(sig0, d0, spend.publicKey), true);
  assert.equal(ml_dsa65.verify(sig1, d1, spend.publicKey), true);
  assert.equal(ml_dsa65.verify(sig0, d1, spend.publicKey), false);  // not movable to another input
  assert.equal(ml_dsa65.verify(sig0, transactionSigningDigest(v2.transaction, 5n), spend.publicKey), false);
  const mainnetChain = signingContextForHeight(40, false, 40).chainId;
  assert.equal(ml_dsa65.verify(sig0, transactionSigningDigestV2(v2.transaction, 5n, mainnetChain, 0), spend.publicKey), false);
  // Wire bytes are unchanged in shape: still one signature per key-carrying input.
  const v1 = buildSignedTransaction({ inputs,
    destinations: [{ viewPublicKey: recipient.publicKey, spendPublicKey: spend.publicKey, amount: 35n }],
    fee: 5n, spendPublicKey: spend.publicKey, spendSecretKey: spend.secretKey, signing: signingContextForHeight(39, true, 40) });
  assert.equal(v1.bytes.length, v2.bytes.length);
}

// The activation heights in config.ts mirror the node's CryptoNoteConfig.h.
{
  const config = await readFile(new URL('../src/config.ts', import.meta.url), 'utf8');
  const node = await readFile(new URL('../../discrete/src/CryptoNoteConfig.h', import.meta.url), 'utf8');
  const nodeValue = node.match(/PQ_TRANSCRIPT_V2_HEIGHT\s*=\s*([A-Z0-9_]+)/)[1];
  const expected = nodeValue === 'UINT32_MAX' ? 4294967295 : Number(nodeValue);
  assert.equal(Number(config.match(/transcriptV2Height:\s*(\d+)/)[1]), expected);
}
