import assert from 'node:assert/strict';
import { decodeAddress, deriveWalletKeys, encodeAddress, formatAccountNumber, parseAccountNumber } from '../src/crypto/discrete-wallet-keys.mjs';

const seed = Uint8Array.from({ length: 32 }, (_, index) => index);
const first = deriveWalletKeys(seed);
const second = deriveWalletKeys(seed);
assert.deepEqual(first.viewPublicKey, second.viewPublicKey);
assert.deepEqual(first.spendPublicKey, second.spendPublicKey);
const address = encodeAddress(first.viewPublicKey, first.spendPublicKey);
assert.equal(address.startsWith('disc1'), true);
assert.equal(address.length > 5000, true);
const decoded = decodeAddress(address);
assert.equal(decoded.networkPrefix, 0x3445dbn);
assert.deepEqual(decoded.viewPublicKey, first.viewPublicKey);
assert.deepEqual(decoded.spendPublicKey, first.spendPublicKey);
assert.throws(() => decodeAddress(`tdisc${address.slice(4)}`), /network/);
const tampered = `${address.slice(0, -1)}${address.endsWith('q') ? 'p' : 'q'}`;
assert.throws(() => decodeAddress(tampered), /checksum/);

const account = formatAccountNumber(1234567, 42, 'KQ9D');
assert.match(account, /^1234567-42-KQ9D-[0-9A-HJKMNPQRSTVWXYZ]$/);
assert.deepEqual(parseAccountNumber(account), {
  blockHeight: 1234567, transactionIndex: 42, subaddressIndex: 0, fingerprint: 'KQ9D',
});
const deposit = formatAccountNumber(900, 7, 'KQ9D', 5);
assert.deepEqual(parseAccountNumber(deposit), {
  blockHeight: 900, transactionIndex: 7, subaddressIndex: 5, fingerprint: 'KQ9D',
});
assert.throws(() => parseAccountNumber(deposit.slice(0, -1) + (deposit.endsWith('0') ? '1' : '0')));
assert.throws(() => parseAccountNumber('1234567-42-K'));
assert.throws(() => parseAccountNumber(account.replace('KQ9D', 'KQ9E')));
assert.deepEqual(parseAccountNumber(formatAccountNumber(1, 2, 'OIL0')), {
  blockHeight: 1, transactionIndex: 2, subaddressIndex: 0, fingerprint: '0110',
});
