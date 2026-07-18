import { sha3_256 } from '@noble/hashes/sha3.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { deriveSpendSeed, deriveViewSeed } from './discrete-protocol.mjs';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32M = 0x2bc830a3;

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
};
const varint = value => {
  let v = BigInt(value); const out = [];
  while (v >= 128n) { out.push(Number(v & 127n) | 128); v >>= 7n; }
  out.push(Number(v)); return Uint8Array.from(out);
};
const polymod = values => {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let check = 1;
  for (const value of values) {
    const top = check >>> 25;
    check = ((check & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; ++i) if ((top >>> i) & 1) check ^= generators[i];
  }
  return check >>> 0;
};
const hrpExpand = hrp => [...hrp].map(c => c.charCodeAt(0) >>> 5)
  .concat([0], [...hrp].map(c => c.charCodeAt(0) & 31));
const convertBits = (input, from, to, pad) => {
  let accumulator = 0, bits = 0; const result = [], mask = (1 << to) - 1;
  for (const value of input) {
    if (value >>> from) throw new Error('invalid address symbol');
    accumulator = ((accumulator << from) | value) & ((1 << (from + to - 1)) - 1);
    bits += from;
    while (bits >= to) { bits -= to; result.push((accumulator >>> bits) & mask); }
  }
  if (pad && bits) result.push((accumulator << (to - bits)) & mask);
  else if (!pad && (bits >= from || ((accumulator << (to - bits)) & mask))) throw new Error('invalid address padding');
  return Uint8Array.from(result);
};

export function deriveWalletKeys(masterSeed) {
  if (!(masterSeed instanceof Uint8Array) || masterSeed.length !== 32) throw new TypeError('master seed must be 32 bytes');
  const view = ml_kem768.keygen(deriveViewSeed(masterSeed));
  const spend = ml_dsa65.keygen(deriveSpendSeed(masterSeed));
  return { masterSeed: masterSeed.slice(), viewPublicKey: view.publicKey,
    viewSecretKey: view.secretKey, spendPublicKey: spend.publicKey, spendSecretKey: spend.secretKey };
}

export function encodeAddress(viewPublicKey, spendPublicKey, networkPrefix = 0x3445db, testnet = false) {
  const prefix = concat(Uint8Array.of(1), varint(networkPrefix), viewPublicKey, spendPublicKey);
  const payload = concat(prefix, sha3_256(prefix).slice(0, 4));
  const data = Array.from(convertBits(payload, 8, 5, true));
  const hrp = testnet ? 'tdisc' : 'disc';
  const check = polymod(hrpExpand(hrp).concat(data, [0, 0, 0, 0, 0, 0])) ^ BECH32M;
  for (let i = 0; i < 6; ++i) data.push((check >>> (5 * (5 - i))) & 31);
  return `${hrp}1${data.map(value => CHARSET[value]).join('')}`;
}

export function decodeAddress(address, testnet = false) {
  const separator = address.lastIndexOf('1');
  const hrp = testnet ? 'tdisc' : 'disc';
  if (separator <= 0 || address.slice(0, separator) !== hrp) throw new Error('wrong Discrete address network');
  const data = [...address.slice(separator + 1)].map(character => {
    const index = CHARSET.indexOf(character); if (index < 0) throw new Error('invalid Discrete address'); return index;
  });
  if (data.length < 6 || polymod(hrpExpand(hrp).concat(data)) !== BECH32M) throw new Error('invalid Discrete address checksum');
  const payload = convertBits(data.slice(0, -6), 5, 8, false);
  let offset = 1, shift = 0, networkPrefix = 0n;
  while (offset < payload.length) { const byte = payload[offset++]; networkPrefix |= BigInt(byte & 127) << BigInt(shift); if (!(byte & 128)) break; shift += 7; }
  if (payload[0] !== 1 || payload.length - offset !== 1184 + 1952 + 4) throw new Error('invalid Discrete address payload');
  const content = payload.slice(0, -4), checksum = payload.slice(-4), expected = sha3_256(content).slice(0, 4);
  if (!expected.every((byte, index) => byte === checksum[index])) throw new Error('invalid Discrete address payload checksum');
  return { networkPrefix, viewPublicKey: payload.slice(offset, offset + 1184), spendPublicKey: payload.slice(offset + 1184, offset + 3136) };
}

// Account number v2: H-I-A-C / H-I-A-T-C. A is a four-character Crockford
// Base32 fingerprint supplied by the daemon (or derived from the account keys),
// and C is Luhn mod-32 over H, I, A[, T].
const ACCOUNT_NUMBER_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function accountNumberSymbolValue(character) {
  if (character >= '0' && character <= '9') return character.charCodeAt(0) - 48;
  const upper = character.toUpperCase();
  if (upper === 'O') return 0;
  if (upper === 'I' || upper === 'L') return 1;
  return ACCOUNT_NUMBER_ALPHABET.indexOf(upper);
}

function accountNumberCheck(digits) {
  let factor = 2, sum = 0;
  for (let i = digits.length - 1; i >= 0; --i) {
    const codePoint = accountNumberSymbolValue(digits[i]);
    if (codePoint < 0) throw new Error('invalid account-number character');
    let addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / 32) + (addend % 32);
    sum += addend;
  }
  return ACCOUNT_NUMBER_ALPHABET[(32 - (sum % 32)) % 32];
}

function canonicalAccountNumberSymbols(symbols) {
  let canonical = '';
  for (const character of String(symbols)) {
    const value = accountNumberSymbolValue(character);
    if (value < 0) throw new Error('invalid account-number character');
    canonical += ACCOUNT_NUMBER_ALPHABET[value];
  }
  return canonical;
}

export function formatAccountNumber(blockHeight, transactionIndex, fingerprint, subaddressIndex = null) {
  const canonicalFingerprint = canonicalAccountNumberSymbols(fingerprint);
  if (canonicalFingerprint.length !== 4) throw new Error('account-number fingerprint must be 4 characters');
  const numericFields = [blockHeight, transactionIndex];
  if (subaddressIndex !== null) numericFields.push(subaddressIndex);
  for (const field of numericFields) {
    if (!Number.isInteger(field) || field < 0 || field > 0xffffffff) throw new Error('account-number field out of range');
  }
  const fields = [String(blockHeight), String(transactionIndex), canonicalFingerprint];
  if (subaddressIndex !== null) fields.push(String(subaddressIndex));
  return fields.join('-') + '-' + accountNumberCheck(fields.join(''));
}

export function parseAccountNumber(value) {
  const match = String(value).trim().match(/^(\d+)-(\d+)-([0-9A-Za-z]{4})(?:-(\d+))?-([0-9A-Za-z])$/);
  if (!match) throw new Error('invalid account-number format');
  const blockHeight = Number(match[1]);
  const transactionIndex = Number(match[2]);
  const fingerprint = canonicalAccountNumberSymbols(match[3]);
  const hasSubaddress = match[4] !== undefined;
  const subaddressIndex = hasSubaddress ? Number(match[4]) : 0;
  if ([blockHeight, transactionIndex, subaddressIndex].some(
    field => !Number.isSafeInteger(field) || field < 0 || field > 0xffffffff
  )) throw new Error('account-number field out of range');
  // Preserve the numeric spelling when checking C. The native parser permits
  // leading zeroes and calculates the check character over the displayed text.
  const payload = match[1] + match[2] + fingerprint + (hasSubaddress ? match[4] : '');
  const actualCheck = canonicalAccountNumberSymbols(match[5]);
  if (accountNumberCheck(payload) !== actualCheck) throw new Error('invalid account-number checksum');
  return { blockHeight, transactionIndex, subaddressIndex, fingerprint };
}
