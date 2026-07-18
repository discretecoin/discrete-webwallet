import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { buildFreeRegistrationTransaction } from '../src/crypto/discrete-transaction.mjs';
import { FREE_REG_POW_DOMAIN, freeRegistrationPowPrefix } from '../src/crypto/discrete-registration-pow.mjs';

const require = createRequire(import.meta.url);
const createYespowerModule = require('../src/workers/yespower-module.js');
const module = await createYespowerModule();
const vectorPrefix = Uint8Array.from({length: 3195}, (_, index) => (index * 7 + 3) & 255);
const prefixPointer = module._malloc(vectorPrefix.length);
const outputPointer = module._malloc(32);
module.HEAPU8.set(vectorPrefix, prefixPointer);
assert.equal(module._free_reg_hash(prefixPointer, vectorPrefix.length, 9n, outputPointer), 0);
assert.equal(Buffer.from(module.HEAPU8.slice(outputPointer, outputPointer + 32)).toString('hex'),
  '64c62f73269e2c4dd94b962a9ffe19b0b58f4122cb3e2d735f51168c0526b52a');
module._free(prefixPointer);
module._free(outputPointer);

const view = ml_kem768.keygen(new Uint8Array(64));
const spend = ml_dsa65.keygen(new Uint8Array(32));
const referenceHash = Uint8Array.from({length: 32}, (_, index) => index);
const prefix = freeRegistrationPowPrefix(view.publicKey, spend.publicKey, referenceHash);
assert.equal(prefix.length, FREE_REG_POW_DOMAIN.length + 1184 + 1952 + 32);
const built = buildFreeRegistrationTransaction({viewPublicKey: view.publicKey, spendPublicKey: spend.publicKey,
  referenceBlockHash: referenceHash, nonce: 7n});
assert.equal(built.transaction.txType, 3);
assert.equal(built.transaction.inputs.length, 0);
assert.equal(built.transaction.outputs.length, 0);
assert.equal(built.transaction.extra.length, 3178);
assert.deepEqual(built.transaction.extra.slice(-8), Uint8Array.of(7, 0, 0, 0, 0, 0, 0, 0));
assert.equal(built.bytes[0], 1);
assert.equal(built.bytes[1], 3);
