"use strict";
var DiscreteRuntime = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/crypto/discrete-runtime-entry.mjs
  var discrete_runtime_entry_exports = {};
  __export(discrete_runtime_entry_exports, {
    DISCRETE_PQ_SIZES: () => DISCRETE_PQ_SIZES,
    DOMAINS: () => DOMAINS,
    DiscreteWalletState: () => DiscreteWalletState,
    FREE_REG_POW_DOMAIN: () => FREE_REG_POW_DOMAIN,
    FREE_REG_POW_TARGET: () => FREE_REG_POW_TARGET,
    accountRegistrationExtra: () => accountRegistrationExtra,
    buildFreeRegistrationTransaction: () => buildFreeRegistrationTransaction,
    buildSignedTransaction: () => buildSignedTransaction,
    calculateCoinbaseRho: () => calculateCoinbaseRho,
    calculateNullifier: () => calculateNullifier,
    calculateSpendCommit: () => calculateSpendCommit,
    decodeAddress: () => decodeAddress,
    deriveOutputAeadKey: () => deriveOutputAeadKey,
    deriveSpendSeed: () => deriveSpendSeed,
    deriveViewSeed: () => deriveViewSeed,
    deriveWalletKeys: () => deriveWalletKeys,
    encodeAddress: () => encodeAddress,
    formatAccountNumber: () => formatAccountNumber,
    freeRegistrationPowPrefix: () => freeRegistrationPowPrefix,
    grindFreeRegistrationPow: () => grindFreeRegistrationPow,
    legacyOutputContextV1: () => legacyOutputContextV1,
    mlDsa65Keygen: () => mlDsa65Keygen,
    mlDsa65Sign: () => mlDsa65Sign,
    mlDsa65Verify: () => mlDsa65Verify,
    mlKem768Decapsulate: () => mlKem768Decapsulate,
    mlKem768Encapsulate: () => mlKem768Encapsulate,
    mlKem768Keygen: () => mlKem768Keygen,
    outputContext: () => outputContext,
    parseAccountNumber: () => parseAccountNumber,
    recognizesCoinbaseOutput: () => recognizesCoinbaseOutput,
    scanPqOutput: () => scanPqOutput,
    scanPqOutputLegacyTWindow: () => scanPqOutputLegacyTWindow,
    serializeTransaction: () => serializeTransaction,
    transactionInputsHash: () => transactionInputsHash,
    transactionSigningDigest: () => transactionSigningDigest
  });

  // node_modules/@noble/hashes/utils.js
  function isBytes(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
  }
  function anumber(n, title = "") {
    if (typeof n !== "number") {
      const prefix = title && `"${title}" `;
      throw new TypeError(`${prefix}expected number, got ${typeof n}`);
    }
    if (!Number.isSafeInteger(n) || n < 0) {
      const prefix = title && `"${title}" `;
      throw new RangeError(`${prefix}expected integer >= 0, got ${n}`);
    }
  }
  function abytes(value, length, title = "") {
    const bytes = isBytes(value);
    const len = value?.length;
    const needsLen = length !== void 0;
    if (!bytes || needsLen && len !== length) {
      const prefix = title && `"${title}" `;
      const ofLen = needsLen ? ` of length ${length}` : "";
      const got = bytes ? `length=${len}` : `type=${typeof value}`;
      const message = prefix + "expected Uint8Array" + ofLen + ", got " + got;
      if (!bytes)
        throw new TypeError(message);
      throw new RangeError(message);
    }
    return value;
  }
  function ahash(h) {
    if (typeof h !== "function" || typeof h.create !== "function")
      throw new TypeError("Hash must wrapped by utils.createHasher");
    anumber(h.outputLen);
    anumber(h.blockLen);
    if (h.outputLen < 1)
      throw new Error('"outputLen" must be >= 1');
    if (h.blockLen < 1)
      throw new Error('"blockLen" must be >= 1');
  }
  function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("Hash instance has been destroyed");
    if (checkFinished && instance.finished)
      throw new Error("Hash#digest() has already been called");
  }
  function aoutput(out, instance) {
    abytes(out, void 0, "digestInto() output");
    const min = instance.outputLen;
    if (out.length < min) {
      throw new RangeError('"digestInto() output" expected to be of length >=' + min);
    }
  }
  function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
  }
  function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
      arrays[i].fill(0);
    }
  }
  var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
  function byteSwap(word) {
    return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
  }
  function byteSwap32(arr) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = byteSwap(arr[i]);
    }
    return arr;
  }
  var swap32IfBE = isLE ? (u) => u : byteSwap32;
  function concatBytes(...arrays) {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
      const a = arrays[i];
      abytes(a);
      sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
      const a = arrays[i];
      res.set(a, pad);
      pad += a.length;
    }
    return res;
  }
  function createHasher(hashCons, info = {}) {
    const hashC = (msg, opts2) => hashCons(opts2).update(msg).digest();
    const tmp = hashCons(void 0);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.canXOF = tmp.canXOF;
    hashC.create = (opts2) => hashCons(opts2);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
  }
  function randomBytes(bytesLength = 32) {
    anumber(bytesLength, "bytesLength");
    const cr = typeof globalThis === "object" ? globalThis.crypto : null;
    if (typeof cr?.getRandomValues !== "function")
      throw new Error("crypto.getRandomValues must be defined");
    if (bytesLength > 65536)
      throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
    return cr.getRandomValues(new Uint8Array(bytesLength));
  }
  var oidNist = (suffix) => ({
    // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
    // Larger suffix values would need base-128 OID encoding and a different length byte.
    oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
  });

  // node_modules/@noble/curves/utils.js
  function abool(value, title = "") {
    if (typeof value !== "boolean") {
      const prefix = title && `"${title}" `;
      throw new TypeError(prefix + "expected boolean, got type=" + typeof value);
    }
    return value;
  }

  // node_modules/@noble/hashes/_u64.js
  var U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
  var _32n = /* @__PURE__ */ BigInt(32);
  function fromBig(n, le = false) {
    if (le)
      return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
    return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
  }
  function split(lst, le = false) {
    const len = lst.length;
    let Ah = new Uint32Array(len);
    let Al = new Uint32Array(len);
    for (let i = 0; i < len; i++) {
      const { h, l } = fromBig(lst[i], le);
      [Ah[i], Al[i]] = [h, l];
    }
    return [Ah, Al];
  }
  var rotlSH = (h, l, s) => h << s | l >>> 32 - s;
  var rotlSL = (h, l, s) => l << s | h >>> 32 - s;
  var rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
  var rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;

  // node_modules/@noble/hashes/sha3.js
  var _0n = BigInt(0);
  var _1n = BigInt(1);
  var _2n = BigInt(2);
  var _7n = BigInt(7);
  var _256n = BigInt(256);
  var _0x71n = BigInt(113);
  var SHA3_PI = [];
  var SHA3_ROTL = [];
  var _SHA3_IOTA = [];
  for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
    [x, y] = [y, (2 * x + 3 * y) % 5];
    SHA3_PI.push(2 * (5 * y + x));
    SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
    let t = _0n;
    for (let j = 0; j < 7; j++) {
      R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
      if (R & _2n)
        t ^= _1n << (_1n << BigInt(j)) - _1n;
    }
    _SHA3_IOTA.push(t);
  }
  var IOTAS = split(_SHA3_IOTA, true);
  var SHA3_IOTA_H = IOTAS[0];
  var SHA3_IOTA_L = IOTAS[1];
  var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
  var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
  function keccakP(s, rounds = 24) {
    anumber(rounds, "rounds");
    if (rounds < 1 || rounds > 24)
      throw new Error('"rounds" expected integer 1..24');
    const B = new Uint32Array(5 * 2);
    for (let round = 24 - rounds; round < 24; round++) {
      for (let x = 0; x < 10; x++)
        B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
      for (let x = 0; x < 10; x += 2) {
        const idx1 = (x + 8) % 10;
        const idx0 = (x + 2) % 10;
        const B0 = B[idx0];
        const B1 = B[idx0 + 1];
        const Th = rotlH(B0, B1, 1) ^ B[idx1];
        const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
        for (let y = 0; y < 50; y += 10) {
          s[x + y] ^= Th;
          s[x + y + 1] ^= Tl;
        }
      }
      let curH = s[2];
      let curL = s[3];
      for (let t = 0; t < 24; t++) {
        const shift = SHA3_ROTL[t];
        const Th = rotlH(curH, curL, shift);
        const Tl = rotlL(curH, curL, shift);
        const PI = SHA3_PI[t];
        curH = s[PI];
        curL = s[PI + 1];
        s[PI] = Th;
        s[PI + 1] = Tl;
      }
      for (let y = 0; y < 50; y += 10) {
        const b0 = s[y], b1 = s[y + 1], b2 = s[y + 2], b3 = s[y + 3];
        s[y] ^= ~s[y + 2] & s[y + 4];
        s[y + 1] ^= ~s[y + 3] & s[y + 5];
        s[y + 2] ^= ~s[y + 4] & s[y + 6];
        s[y + 3] ^= ~s[y + 5] & s[y + 7];
        s[y + 4] ^= ~s[y + 6] & s[y + 8];
        s[y + 5] ^= ~s[y + 7] & s[y + 9];
        s[y + 6] ^= ~s[y + 8] & b0;
        s[y + 7] ^= ~s[y + 9] & b1;
        s[y + 8] ^= ~b0 & b2;
        s[y + 9] ^= ~b1 & b3;
      }
      s[0] ^= SHA3_IOTA_H[round];
      s[1] ^= SHA3_IOTA_L[round];
    }
    clean(B);
  }
  var Keccak = class _Keccak {
    // NOTE: we accept arguments in bytes instead of bits here.
    constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
      __publicField(this, "state");
      __publicField(this, "pos", 0);
      __publicField(this, "posOut", 0);
      __publicField(this, "finished", false);
      __publicField(this, "state32");
      __publicField(this, "destroyed", false);
      __publicField(this, "blockLen");
      __publicField(this, "suffix");
      __publicField(this, "outputLen");
      __publicField(this, "canXOF");
      __publicField(this, "enableXOF", false);
      __publicField(this, "rounds");
      this.blockLen = blockLen;
      this.suffix = suffix;
      this.outputLen = outputLen;
      this.enableXOF = enableXOF;
      this.canXOF = enableXOF;
      this.rounds = rounds;
      anumber(outputLen, "outputLen");
      if (!(0 < blockLen && blockLen < 200))
        throw new Error("only keccak-f1600 function is supported");
      this.state = new Uint8Array(200);
      this.state32 = u32(this.state);
    }
    clone() {
      return this._cloneInto();
    }
    keccak() {
      swap32IfBE(this.state32);
      keccakP(this.state32, this.rounds);
      swap32IfBE(this.state32);
      this.posOut = 0;
      this.pos = 0;
    }
    update(data) {
      aexists(this);
      abytes(data);
      const { blockLen, state } = this;
      const len = data.length;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        for (let i = 0; i < take; i++)
          state[this.pos++] ^= data[pos++];
        if (this.pos === blockLen)
          this.keccak();
      }
      return this;
    }
    finish() {
      if (this.finished)
        return;
      this.finished = true;
      const { state, suffix, pos, blockLen } = this;
      state[pos] ^= suffix;
      if ((suffix & 128) !== 0 && pos === blockLen - 1)
        this.keccak();
      state[blockLen - 1] ^= 128;
      this.keccak();
    }
    writeInto(out) {
      aexists(this, false);
      abytes(out);
      this.finish();
      const bufferOut = this.state;
      const { blockLen } = this;
      for (let pos = 0, len = out.length; pos < len; ) {
        if (this.posOut >= blockLen)
          this.keccak();
        const take = Math.min(blockLen - this.posOut, len - pos);
        out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
        this.posOut += take;
        pos += take;
      }
      return out;
    }
    xofInto(out) {
      if (!this.enableXOF)
        throw new Error("XOF is not possible for this instance");
      return this.writeInto(out);
    }
    xof(bytes) {
      anumber(bytes);
      return this.xofInto(new Uint8Array(bytes));
    }
    digestInto(out) {
      aoutput(out, this);
      if (this.finished)
        throw new Error("digest() was already called");
      this.writeInto(out.subarray(0, this.outputLen));
      this.destroy();
    }
    digest() {
      const out = new Uint8Array(this.outputLen);
      this.digestInto(out);
      return out;
    }
    destroy() {
      this.destroyed = true;
      clean(this.state);
    }
    _cloneInto(to) {
      const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
      to || (to = new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
      to.blockLen = blockLen;
      to.state32.set(this.state32);
      to.pos = this.pos;
      to.posOut = this.posOut;
      to.finished = this.finished;
      to.rounds = rounds;
      to.suffix = suffix;
      to.outputLen = outputLen;
      to.enableXOF = enableXOF;
      to.canXOF = this.canXOF;
      to.destroyed = this.destroyed;
      return to;
    }
  };
  var genKeccak = (suffix, blockLen, outputLen, info = {}) => createHasher(() => new Keccak(blockLen, suffix, outputLen), info);
  var sha3_256 = /* @__PURE__ */ genKeccak(
    6,
    136,
    32,
    /* @__PURE__ */ oidNist(8)
  );
  var sha3_512 = /* @__PURE__ */ genKeccak(
    6,
    72,
    64,
    /* @__PURE__ */ oidNist(10)
  );
  var genShake = (suffix, blockLen, outputLen, info = {}) => createHasher((opts2 = {}) => new Keccak(blockLen, suffix, opts2.dkLen === void 0 ? outputLen : opts2.dkLen, true), info);
  var shake128 = /* @__PURE__ */ genShake(31, 168, 16, /* @__PURE__ */ oidNist(11));
  var shake256 = /* @__PURE__ */ genShake(31, 136, 32, /* @__PURE__ */ oidNist(12));

  // node_modules/@noble/curves/abstract/fft.js
  function checkU32(n) {
    if (!Number.isSafeInteger(n) || n < 0 || n > 4294967295)
      throw new Error("wrong u32 integer:" + n);
    return n;
  }
  function isPowerOfTwo(x) {
    checkU32(x);
    return (x & x - 1) === 0 && x !== 0;
  }
  function reverseBits(n, bits) {
    checkU32(n);
    if (!Number.isSafeInteger(bits) || bits < 0 || bits > 32)
      throw new Error(`expected integer 0 <= bits <= 32, got ${bits}`);
    let reversed = 0;
    for (let i = 0; i < bits; i++, n >>>= 1)
      reversed = reversed << 1 | n & 1;
    return reversed >>> 0;
  }
  function log2(n) {
    checkU32(n);
    return 31 - Math.clz32(n);
  }
  function bitReversalInplace(values) {
    const n = values.length;
    if (!isPowerOfTwo(n))
      throw new Error("expected positive power-of-two length, got " + n);
    const bits = log2(n);
    for (let i = 0; i < n; i++) {
      const j = reverseBits(i, bits);
      if (i < j) {
        const tmp = values[i];
        values[i] = values[j];
        values[j] = tmp;
      }
    }
    return values;
  }
  var FFTCore = (F3, coreOpts) => {
    const { N: N3, roots, dit, invertButterflies = false, skipStages = 0, brp = true } = coreOpts;
    const bits = log2(N3);
    if (!isPowerOfTwo(N3))
      throw new Error("FFT: Polynomial size should be power of two");
    if (roots.length !== N3)
      throw new Error(`FFT: wrong roots length: expected ${N3}, got ${roots.length}`);
    const isDit = dit !== invertButterflies;
    isDit;
    return (values) => {
      if (values.length !== N3)
        throw new Error("FFT: wrong Polynomial length");
      if (dit && brp)
        bitReversalInplace(values);
      for (let i = 0, g = 1; i < bits - skipStages; i++) {
        const s = dit ? i + 1 + skipStages : bits - i;
        const m = 1 << s;
        const m2 = m >> 1;
        const stride = N3 >> s;
        for (let k = 0; k < N3; k += m) {
          for (let j = 0, grp = g++; j < m2; j++) {
            const rootPos = invertButterflies ? dit ? N3 - grp : grp : j * stride;
            const i0 = k + j;
            const i1 = k + j + m2;
            const omega = roots[rootPos];
            const b = values[i1];
            const a = values[i0];
            if (isDit) {
              const t = F3.mul(b, omega);
              values[i0] = F3.add(a, t);
              values[i1] = F3.sub(a, t);
            } else if (invertButterflies) {
              values[i0] = F3.add(b, a);
              values[i1] = F3.mul(F3.sub(b, a), omega);
            } else {
              values[i0] = F3.add(a, b);
              values[i1] = F3.mul(F3.sub(a, b), omega);
            }
          }
        }
      }
      if (!dit && brp)
        bitReversalInplace(values);
      return values;
    };
  };

  // node_modules/@noble/post-quantum/utils.js
  var abytesDoc = abytes;
  var randomBytes2 = randomBytes;
  function equalBytes(a, b) {
    if (a.length !== b.length)
      return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
      diff |= a[i] ^ b[i];
    return diff === 0;
  }
  function copyBytes(bytes) {
    return Uint8Array.from(abytes(bytes));
  }
  function validateOpts(opts2) {
    if (Object.prototype.toString.call(opts2) !== "[object Object]")
      throw new TypeError("expected valid options object");
  }
  function validateVerOpts(opts2) {
    validateOpts(opts2);
    if (opts2.context !== void 0)
      abytes(opts2.context, void 0, "opts.context");
  }
  function validateSigOpts(opts2) {
    validateVerOpts(opts2);
    if (opts2.extraEntropy !== false && opts2.extraEntropy !== void 0)
      abytes(opts2.extraEntropy, void 0, "opts.extraEntropy");
  }
  function splitCoder(label, ...lengths) {
    const getLength = (c) => typeof c === "number" ? c : c.bytesLen;
    const bytesLen = lengths.reduce((sum, a) => sum + getLength(a), 0);
    return {
      bytesLen,
      encode: (bufs) => {
        const res = new Uint8Array(bytesLen);
        for (let i = 0, pos = 0; i < lengths.length; i++) {
          const c = lengths[i];
          const l = getLength(c);
          const b = typeof c === "number" ? bufs[i] : c.encode(bufs[i]);
          abytes(b, l, label);
          res.set(b, pos);
          if (typeof c !== "number")
            b.fill(0);
          pos += l;
        }
        return res;
      },
      decode: (buf) => {
        abytes(buf, bytesLen, label);
        const res = [];
        for (const c of lengths) {
          const l = getLength(c);
          const b = buf.subarray(0, l);
          res.push(typeof c === "number" ? b : c.decode(b));
          buf = buf.subarray(l);
        }
        return res;
      }
    };
  }
  function vecCoder(c, vecLen) {
    const coder = c;
    const bytesLen = vecLen * coder.bytesLen;
    return {
      bytesLen,
      encode: (u) => {
        if (u.length !== vecLen)
          throw new RangeError(`vecCoder.encode: wrong length=${u.length}. Expected: ${vecLen}`);
        const res = new Uint8Array(bytesLen);
        for (let i = 0, pos = 0; i < u.length; i++) {
          const b = coder.encode(u[i]);
          res.set(b, pos);
          b.fill(0);
          pos += b.length;
        }
        return res;
      },
      decode: (a) => {
        abytes(a, bytesLen);
        const r = [];
        for (let i = 0; i < a.length; i += coder.bytesLen)
          r.push(coder.decode(a.subarray(i, i + coder.bytesLen)));
        return r;
      }
    };
  }
  function cleanBytes(...list) {
    for (const t of list) {
      if (Array.isArray(t))
        for (const b of t)
          b.fill(0);
      else
        t.fill(0);
    }
  }
  function getMask(bits) {
    if (!Number.isSafeInteger(bits) || bits < 0 || bits > 32)
      throw new RangeError(`expected bits in [0..32], got ${bits}`);
    return bits === 32 ? 4294967295 : ~(-1 << bits) >>> 0;
  }
  var EMPTY = /* @__PURE__ */ Uint8Array.of();
  function getMessage(msg, ctx = EMPTY) {
    abytes(msg);
    abytes(ctx);
    if (ctx.length > 255)
      throw new RangeError("context should be 255 bytes or less");
    return concatBytes(new Uint8Array([0, ctx.length]), ctx, msg);
  }
  var oidNistP = /* @__PURE__ */ Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2]);
  function checkHash(hash, requiredStrength = 0) {
    if (!hash.oid || !equalBytes(hash.oid.subarray(0, 10), oidNistP))
      throw new Error("hash.oid is invalid: expected NIST hash");
    const collisionResistance = hash.outputLen * 8 / 2;
    if (requiredStrength > collisionResistance) {
      throw new Error("Pre-hash security strength too low: " + collisionResistance + ", required: " + requiredStrength);
    }
  }
  function getMessagePrehash(hash, msg, ctx = EMPTY) {
    abytes(msg);
    abytes(ctx);
    if (ctx.length > 255)
      throw new RangeError("context should be 255 bytes or less");
    const hashed = hash(msg);
    return concatBytes(new Uint8Array([1, ctx.length]), ctx, hash.oid, hashed);
  }

  // node_modules/@noble/post-quantum/_crystals.js
  var genCrystals = (opts2) => {
    const { newPoly: newPoly2, N: N3, Q: Q3, F: F3, ROOT_OF_UNITY: ROOT_OF_UNITY3, brvBits, isKyber } = opts2;
    const mod = (a, modulo = Q3) => {
      const result = a % modulo | 0;
      return (result >= 0 ? result | 0 : modulo + result | 0) | 0;
    };
    const smod = (a, modulo = Q3) => {
      const r = mod(a, modulo) | 0;
      return (r > modulo >> 1 ? r - modulo | 0 : r) | 0;
    };
    function getZettas() {
      const out = newPoly2(N3);
      for (let i = 0; i < N3; i++) {
        const b = reverseBits(i, brvBits);
        const p = BigInt(ROOT_OF_UNITY3) ** BigInt(b) % BigInt(Q3);
        out[i] = Number(p) | 0;
      }
      return out;
    }
    const nttZetas = getZettas();
    const field = {
      add: (a, b) => mod((a | 0) + (b | 0)) | 0,
      sub: (a, b) => mod((a | 0) - (b | 0)) | 0,
      mul: (a, b) => mod((a | 0) * (b | 0)) | 0,
      inv: (_a) => {
        throw new Error("not implemented");
      }
    };
    const nttOpts = {
      N: N3,
      roots: nttZetas,
      invertButterflies: true,
      skipStages: isKyber ? 1 : 0,
      brp: false
    };
    const dif = FFTCore(field, { dit: false, ...nttOpts });
    const dit = FFTCore(field, { dit: true, ...nttOpts });
    const NTT = {
      encode: (r) => {
        return dif(r);
      },
      decode: (r) => {
        dit(r);
        for (let i = 0; i < r.length; i++)
          r[i] = mod(F3 * r[i]);
        return r;
      }
    };
    const bitsCoder = (d, c) => {
      const mask = getMask(d);
      const bytesLen = d * (N3 / 8);
      return {
        bytesLen,
        encode: (poly_) => {
          const poly = poly_;
          const r = new Uint8Array(bytesLen);
          for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < poly.length; i++) {
            buf |= (c.encode(poly[i]) & mask) << bufLen;
            bufLen += d;
            for (; bufLen >= 8; bufLen -= 8, buf >>= 8)
              r[pos++] = buf & getMask(bufLen);
          }
          return r;
        },
        decode: (bytes) => {
          const r = newPoly2(N3);
          for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < bytes.length; i++) {
            buf |= bytes[i] << bufLen;
            bufLen += 8;
            for (; bufLen >= d; bufLen -= d, buf >>= d)
              r[pos++] = c.decode(buf & mask);
          }
          return r;
        }
      };
    };
    return {
      mod,
      smod,
      nttZetas,
      NTT: {
        encode: (r) => NTT.encode(r),
        decode: (r) => NTT.decode(r)
      },
      bitsCoder
    };
  };
  var createXofShake = (shake) => (seed, blockLen) => {
    if (!blockLen)
      blockLen = shake.blockLen;
    const _seed = new Uint8Array(seed.length + 2);
    _seed.set(seed);
    const seedLen = seed.length;
    const buf = new Uint8Array(blockLen);
    let h = shake.create({});
    let calls = 0;
    let xofs = 0;
    return {
      stats: () => ({ calls, xofs }),
      get: (x, y) => {
        _seed[seedLen + 0] = x;
        _seed[seedLen + 1] = y;
        h.destroy();
        h = shake.create({}).update(_seed);
        calls++;
        return () => {
          xofs++;
          return h.xofInto(buf);
        };
      },
      clean: () => {
        h.destroy();
        cleanBytes(buf, _seed);
      }
    };
  };
  var XOF128 = /* @__PURE__ */ createXofShake(shake128);
  var XOF256 = /* @__PURE__ */ createXofShake(shake256);

  // node_modules/@noble/post-quantum/ml-dsa.js
  function validateInternalOpts(opts2) {
    validateOpts(opts2);
    if (opts2.externalMu !== void 0)
      abool(opts2.externalMu, "opts.externalMu");
  }
  var N = 256;
  var Q = 8380417;
  var ROOT_OF_UNITY = 1753;
  var F = 8347681;
  var D = 13;
  var GAMMA2_1 = Math.floor((Q - 1) / 88) | 0;
  var GAMMA2_2 = Math.floor((Q - 1) / 32) | 0;
  var PARAMS = /* @__PURE__ */ (() => Object.freeze({
    2: Object.freeze({
      K: 4,
      L: 4,
      D,
      GAMMA1: 2 ** 17,
      GAMMA2: GAMMA2_1,
      TAU: 39,
      ETA: 2,
      OMEGA: 80
    }),
    3: Object.freeze({
      K: 6,
      L: 5,
      D,
      GAMMA1: 2 ** 19,
      GAMMA2: GAMMA2_2,
      TAU: 49,
      ETA: 4,
      OMEGA: 55
    }),
    5: Object.freeze({
      K: 8,
      L: 7,
      D,
      GAMMA1: 2 ** 19,
      GAMMA2: GAMMA2_2,
      TAU: 60,
      ETA: 2,
      OMEGA: 75
    })
  }))();
  var newPoly = (n) => new Int32Array(n);
  var crystals = /* @__PURE__ */ genCrystals({
    N,
    Q,
    F,
    ROOT_OF_UNITY,
    newPoly,
    isKyber: false,
    brvBits: 8
  });
  var id = (n) => n;
  var polyCoder = (d, compress2 = id, verify = id) => crystals.bitsCoder(d, {
    encode: (i) => compress2(verify(i)),
    decode: (i) => verify(compress2(i))
  });
  var polyAdd = (a_, b_) => {
    const a = a_;
    const b = b_;
    for (let i = 0; i < a.length; i++)
      a[i] = crystals.mod(a[i] + b[i]);
    return a;
  };
  var polySub = (a_, b_) => {
    const a = a_;
    const b = b_;
    for (let i = 0; i < a.length; i++)
      a[i] = crystals.mod(a[i] - b[i]);
    return a;
  };
  var polyShiftl = (p_) => {
    const p = p_;
    for (let i = 0; i < N; i++)
      p[i] <<= D;
    return p;
  };
  var polyChknorm = (p_, B) => {
    const p = p_;
    for (let i = 0; i < N; i++)
      if (Math.abs(crystals.smod(p[i])) >= B)
        return true;
    return false;
  };
  var MultiplyNTTs = (a_, b_) => {
    const a = a_;
    const b = b_;
    const c = newPoly(N);
    for (let i = 0; i < a.length; i++)
      c[i] = crystals.mod(a[i] * b[i]);
    return c;
  };
  function RejNTTPoly(xof_) {
    const xof = xof_;
    const r = newPoly(N);
    for (let j = 0; j < N; ) {
      const b = xof();
      if (b.length % 3)
        throw new Error("RejNTTPoly: unaligned block");
      for (let i = 0; j < N && i <= b.length - 3; i += 3) {
        const t = (b[i + 0] | b[i + 1] << 8 | b[i + 2] << 16) & 8388607;
        if (t < Q)
          r[j++] = t;
      }
    }
    return r;
  }
  function getDilithium(opts_) {
    const opts2 = opts_;
    const { K, L, GAMMA1, GAMMA2, TAU, ETA, OMEGA } = opts2;
    const { CRH_BYTES, TR_BYTES, C_TILDE_BYTES, XOF128: XOF1282, XOF256: XOF2562, securityLevel } = opts2;
    if (![2, 4].includes(ETA))
      throw new Error("Wrong ETA");
    if (![1 << 17, 1 << 19].includes(GAMMA1))
      throw new Error("Wrong GAMMA1");
    if (![GAMMA2_1, GAMMA2_2].includes(GAMMA2))
      throw new Error("Wrong GAMMA2");
    const BETA = TAU * ETA;
    const decompose = (r) => {
      const rPlus = crystals.mod(r);
      const r0 = crystals.smod(rPlus, 2 * GAMMA2) | 0;
      if (rPlus - r0 === Q - 1)
        return { r1: 0 | 0, r0: r0 - 1 | 0 };
      const r1 = Math.floor((rPlus - r0) / (2 * GAMMA2)) | 0;
      return { r1, r0 };
    };
    const HighBits = (r) => decompose(r).r1;
    const LowBits = (r) => decompose(r).r0;
    const MakeHint = (z, r) => {
      const res0 = z <= GAMMA2 || z > Q - GAMMA2 || z === Q - GAMMA2 && r === 0 ? 0 : 1;
      return res0;
    };
    const UseHint = (h, r) => {
      const m = Math.floor((Q - 1) / (2 * GAMMA2));
      const { r1, r0 } = decompose(r);
      if (h === 1)
        return r0 > 0 ? crystals.mod(r1 + 1, m) | 0 : crystals.mod(r1 - 1, m) | 0;
      return r1 | 0;
    };
    const Power2Round = (r) => {
      const rPlus = crystals.mod(r);
      const r0 = crystals.smod(rPlus, 2 ** D) | 0;
      return { r1: Math.floor((rPlus - r0) / 2 ** D) | 0, r0 };
    };
    const hintCoder = {
      bytesLen: OMEGA + K,
      encode: (h_) => {
        const h = h_;
        if (h === false)
          throw new Error("hint.encode: hint is false");
        const res = new Uint8Array(OMEGA + K);
        for (let i = 0, k = 0; i < K; i++) {
          for (let j = 0; j < N; j++)
            if (h[i][j] !== 0)
              res[k++] = j;
          res[OMEGA + i] = k;
        }
        return res;
      },
      decode: (buf) => {
        const h = [];
        let k = 0;
        for (let i = 0; i < K; i++) {
          const hi = newPoly(N);
          if (buf[OMEGA + i] < k || buf[OMEGA + i] > OMEGA)
            return false;
          for (let j = k; j < buf[OMEGA + i]; j++) {
            if (j > k && buf[j] <= buf[j - 1])
              return false;
            hi[buf[j]] = 1;
          }
          k = buf[OMEGA + i];
          h.push(hi);
        }
        for (let j = k; j < OMEGA; j++)
          if (buf[j] !== 0)
            return false;
        return h;
      }
    };
    const ETACoder = polyCoder(ETA === 2 ? 3 : 4, (i) => ETA - i, (i) => {
      if (!(-ETA <= i && i <= ETA))
        throw new Error(`malformed key s1/s3 ${i} outside of ETA range [${-ETA}, ${ETA}]`);
      return i;
    });
    const T0Coder = polyCoder(13, (i) => (1 << D - 1) - i);
    const T1Coder = polyCoder(10);
    const ZCoder = polyCoder(GAMMA1 === 1 << 17 ? 18 : 20, (i) => crystals.smod(GAMMA1 - i));
    const W1Coder = polyCoder(GAMMA2 === GAMMA2_1 ? 6 : 4);
    const W1Vec = vecCoder(W1Coder, K);
    const publicCoder = splitCoder("publicKey", 32, vecCoder(T1Coder, K));
    const secretCoder = splitCoder("secretKey", 32, 32, TR_BYTES, vecCoder(ETACoder, L), vecCoder(ETACoder, K), vecCoder(T0Coder, K));
    const sigCoder = splitCoder("signature", C_TILDE_BYTES, vecCoder(ZCoder, L), hintCoder);
    const CoefFromHalfByte = ETA === 2 ? (n) => n < 15 ? 2 - n % 5 : false : (n) => n < 9 ? 4 - n : false;
    function RejBoundedPoly(xof_) {
      const xof = xof_;
      const r = newPoly(N);
      for (let j = 0; j < N; ) {
        const b = xof();
        for (let i = 0; j < N && i < b.length; i += 1) {
          const d1 = CoefFromHalfByte(b[i] & 15);
          const d2 = CoefFromHalfByte(b[i] >> 4 & 15);
          if (d1 !== false)
            r[j++] = d1;
          if (j < N && d2 !== false)
            r[j++] = d2;
        }
      }
      return r;
    }
    const SampleInBall = (seed) => {
      const pre = newPoly(N);
      const s = shake256.create({}).update(seed);
      const buf = new Uint8Array(shake256.blockLen);
      s.xofInto(buf);
      const masks = buf.slice(0, 8);
      for (let i = N - TAU, pos = 8, maskPos = 0, maskBit = 0; i < N; i++) {
        let b = i + 1;
        for (; b > i; ) {
          b = buf[pos++];
          if (pos < shake256.blockLen)
            continue;
          s.xofInto(buf);
          pos = 0;
        }
        pre[i] = pre[b];
        pre[b] = 1 - ((masks[maskPos] >> maskBit++ & 1) << 1);
        if (maskBit >= 8) {
          maskPos++;
          maskBit = 0;
        }
      }
      return pre;
    };
    const polyPowerRound = (p_) => {
      const p = p_;
      const res0 = newPoly(N);
      const res1 = newPoly(N);
      for (let i = 0; i < p.length; i++) {
        const { r0, r1 } = Power2Round(p[i]);
        res0[i] = r0;
        res1[i] = r1;
      }
      return { r0: res0, r1: res1 };
    };
    const polyUseHint = (u_, h_) => {
      const u = u_;
      const h = h_;
      for (let i = 0; i < N; i++)
        u[i] = UseHint(h[i], u[i]);
      return u;
    };
    const polyMakeHint = (a_, b_) => {
      const a = a_;
      const b = b_;
      const v = newPoly(N);
      let cnt = 0;
      for (let i = 0; i < N; i++) {
        const h = MakeHint(a[i], b[i]);
        v[i] = h;
        cnt += h;
      }
      return { v, cnt };
    };
    const signRandBytes = 32;
    const seedCoder = splitCoder("seed", 32, 64, 32);
    const internal = Object.freeze({
      info: Object.freeze({ type: "internal-ml-dsa" }),
      lengths: Object.freeze({
        secretKey: secretCoder.bytesLen,
        publicKey: publicCoder.bytesLen,
        seed: 32,
        signature: sigCoder.bytesLen,
        signRand: signRandBytes
      }),
      keygen: (seed) => {
        const seedDst = new Uint8Array(32 + 2);
        const randSeed = seed === void 0;
        if (randSeed)
          seed = randomBytes2(32);
        abytesDoc(seed, 32, "seed");
        seedDst.set(seed);
        if (randSeed)
          cleanBytes(seed);
        seedDst[32] = K;
        seedDst[33] = L;
        const [rho, rhoPrime, K_] = seedCoder.decode(shake256(seedDst, { dkLen: seedCoder.bytesLen }));
        const xofPrime = XOF2562(rhoPrime);
        const s1 = [];
        for (let i = 0; i < L; i++)
          s1.push(RejBoundedPoly(xofPrime.get(i & 255, i >> 8 & 255)));
        const s2 = [];
        for (let i = L; i < L + K; i++)
          s2.push(RejBoundedPoly(xofPrime.get(i & 255, i >> 8 & 255)));
        const s1Hat = s1.map((i) => crystals.NTT.encode(i.slice()));
        const t0 = [];
        const t1 = [];
        const xof = XOF1282(rho);
        const t = newPoly(N);
        for (let i = 0; i < K; i++) {
          cleanBytes(t);
          for (let j = 0; j < L; j++) {
            const aij = RejNTTPoly(xof.get(j, i));
            polyAdd(t, MultiplyNTTs(aij, s1Hat[j]));
          }
          crystals.NTT.decode(t);
          const { r0, r1 } = polyPowerRound(polyAdd(t, s2[i]));
          t0.push(r0);
          t1.push(r1);
        }
        const publicKey = publicCoder.encode([rho, t1]);
        const tr = shake256(publicKey, { dkLen: TR_BYTES });
        const secretKey = secretCoder.encode([rho, K_, tr, s1, s2, t0]);
        xof.clean();
        xofPrime.clean();
        cleanBytes(rho, rhoPrime, K_, s1, s2, s1Hat, t, t0, t1, tr, seedDst);
        return {
          publicKey,
          secretKey
        };
      },
      getPublicKey: (secretKey) => {
        const [rho, _K, _tr, s1, s2, _t0] = secretCoder.decode(secretKey);
        const xof = XOF1282(rho);
        const s1Hat = s1.map((p) => crystals.NTT.encode(p.slice()));
        const t1 = [];
        const tmp = newPoly(N);
        for (let i = 0; i < K; i++) {
          tmp.fill(0);
          for (let j = 0; j < L; j++) {
            const aij = RejNTTPoly(xof.get(j, i));
            polyAdd(tmp, MultiplyNTTs(aij, s1Hat[j]));
          }
          crystals.NTT.decode(tmp);
          polyAdd(tmp, s2[i]);
          const { r1 } = polyPowerRound(tmp);
          t1.push(r1);
        }
        xof.clean();
        cleanBytes(tmp, s1Hat, _t0, s1, s2);
        return publicCoder.encode([rho, t1]);
      },
      // NOTE: random is optional.
      sign: (msg, secretKey, opts3 = {}) => {
        validateSigOpts(opts3);
        validateInternalOpts(opts3);
        let { extraEntropy: random, externalMu = false } = opts3;
        const [rho, _K, tr, s1, s2, t0] = secretCoder.decode(secretKey);
        const A = [];
        const xof = XOF1282(rho);
        for (let i = 0; i < K; i++) {
          const pv = [];
          for (let j = 0; j < L; j++)
            pv.push(RejNTTPoly(xof.get(j, i)));
          A.push(pv);
        }
        xof.clean();
        for (let i = 0; i < L; i++)
          crystals.NTT.encode(s1[i]);
        for (let i = 0; i < K; i++) {
          crystals.NTT.encode(s2[i]);
          crystals.NTT.encode(t0[i]);
        }
        const mu = externalMu ? msg : (
          // 6: µ ← H(tr||M, 512)
          //    ▷ Compute message representative µ
          shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest()
        );
        const rnd = random === false ? new Uint8Array(32) : random === void 0 ? randomBytes2(signRandBytes) : random;
        abytesDoc(rnd, 32, "extraEntropy");
        const rhoprime = shake256.create({ dkLen: CRH_BYTES }).update(_K).update(rnd).update(mu).digest();
        abytesDoc(rhoprime, CRH_BYTES);
        const x256 = XOF2562(rhoprime, ZCoder.bytesLen);
        main_loop: for (let kappa = 0; ; ) {
          const y = [];
          for (let i = 0; i < L; i++, kappa++)
            y.push(ZCoder.decode(x256.get(kappa & 255, kappa >> 8)()));
          const z = y.map((i) => crystals.NTT.encode(i.slice()));
          const w = [];
          for (let i = 0; i < K; i++) {
            const wi = newPoly(N);
            for (let j = 0; j < L; j++)
              polyAdd(wi, MultiplyNTTs(A[i][j], z[j]));
            crystals.NTT.decode(wi);
            w.push(wi);
          }
          const w1 = w.map((j) => j.map(HighBits));
          const cTilde = shake256.create({ dkLen: C_TILDE_BYTES }).update(mu).update(W1Vec.encode(w1)).digest();
          const cHat = crystals.NTT.encode(SampleInBall(cTilde));
          const cs1 = s1.map((i) => MultiplyNTTs(i, cHat));
          for (let i = 0; i < L; i++) {
            polyAdd(crystals.NTT.decode(cs1[i]), y[i]);
            if (polyChknorm(cs1[i], GAMMA1 - BETA))
              continue main_loop;
          }
          let cnt = 0;
          const h = [];
          for (let i = 0; i < K; i++) {
            const cs2 = crystals.NTT.decode(MultiplyNTTs(s2[i], cHat));
            const r0 = polySub(w[i], cs2).map(LowBits);
            if (polyChknorm(r0, GAMMA2 - BETA))
              continue main_loop;
            const ct0 = crystals.NTT.decode(MultiplyNTTs(t0[i], cHat));
            if (polyChknorm(ct0, GAMMA2))
              continue main_loop;
            polyAdd(r0, ct0);
            const hint = polyMakeHint(r0, w1[i]);
            h.push(hint.v);
            cnt += hint.cnt;
          }
          if (cnt > OMEGA)
            continue;
          x256.clean();
          const res = sigCoder.encode([cTilde, cs1, h]);
          cleanBytes(cTilde, cs1, h, cHat, w1, w, z, y, rhoprime, s1, s2, t0, ...A);
          if (!externalMu)
            cleanBytes(mu);
          return res;
        }
        throw new Error("Unreachable code path reached, report this error");
      },
      verify: (sig, msg, publicKey, opts3 = {}) => {
        validateInternalOpts(opts3);
        const { externalMu = false } = opts3;
        const [rho, t1] = publicCoder.decode(publicKey);
        const tr = shake256(publicKey, { dkLen: TR_BYTES });
        if (sig.length !== sigCoder.bytesLen)
          return false;
        const [cTilde, z, h] = sigCoder.decode(sig);
        if (h === false)
          return false;
        for (let i = 0; i < L; i++)
          if (polyChknorm(z[i], GAMMA1 - BETA))
            return false;
        const mu = externalMu ? msg : (
          // 7: µ ← H(tr||M, 512)
          shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest()
        );
        const c = crystals.NTT.encode(SampleInBall(cTilde));
        const zNtt = z.map((i) => i.slice());
        for (let i = 0; i < L; i++)
          crystals.NTT.encode(zNtt[i]);
        const wTick1 = [];
        const xof = XOF1282(rho);
        for (let i = 0; i < K; i++) {
          const ct12d = MultiplyNTTs(crystals.NTT.encode(polyShiftl(t1[i])), c);
          const Az = newPoly(N);
          for (let j = 0; j < L; j++) {
            const aij = RejNTTPoly(xof.get(j, i));
            polyAdd(Az, MultiplyNTTs(aij, zNtt[j]));
          }
          const wApprox = crystals.NTT.decode(polySub(Az, ct12d));
          wTick1.push(polyUseHint(wApprox, h[i]));
        }
        xof.clean();
        const c2 = shake256.create({ dkLen: C_TILDE_BYTES }).update(mu).update(W1Vec.encode(wTick1)).digest();
        for (const t of h) {
          const sum = t.reduce((acc, i) => acc + i, 0);
          if (!(sum <= OMEGA))
            return false;
        }
        for (const t of z)
          if (polyChknorm(t, GAMMA1 - BETA))
            return false;
        return equalBytes(cTilde, c2);
      }
    });
    return Object.freeze({
      info: Object.freeze({ type: "ml-dsa" }),
      internal,
      securityLevel,
      keygen: internal.keygen,
      lengths: internal.lengths,
      getPublicKey: internal.getPublicKey,
      sign: (msg, secretKey, opts3 = {}) => {
        validateSigOpts(opts3);
        const M = getMessage(msg, opts3.context);
        const res = internal.sign(M, secretKey, opts3);
        cleanBytes(M);
        return res;
      },
      verify: (sig, msg, publicKey, opts3 = {}) => {
        validateVerOpts(opts3);
        return internal.verify(sig, getMessage(msg, opts3.context), publicKey);
      },
      prehash: (hash) => {
        checkHash(hash, securityLevel);
        return Object.freeze({
          info: Object.freeze({ type: "hashml-dsa" }),
          securityLevel,
          lengths: internal.lengths,
          keygen: internal.keygen,
          getPublicKey: internal.getPublicKey,
          sign: (msg, secretKey, opts3 = {}) => {
            validateSigOpts(opts3);
            const M = getMessagePrehash(hash, msg, opts3.context);
            const res = internal.sign(M, secretKey, opts3);
            cleanBytes(M);
            return res;
          },
          verify: (sig, msg, publicKey, opts3 = {}) => {
            validateVerOpts(opts3);
            return internal.verify(sig, getMessagePrehash(hash, msg, opts3.context), publicKey);
          }
        });
      }
    });
  }
  var ml_dsa65 = /* @__PURE__ */ (() => getDilithium({
    ...PARAMS[3],
    CRH_BYTES: 64,
    TR_BYTES: 64,
    C_TILDE_BYTES: 48,
    XOF128,
    XOF256,
    securityLevel: 192
  }))();

  // node_modules/@noble/post-quantum/ml-kem.js
  var N2 = 256;
  var Q2 = 3329;
  var F2 = 3303;
  var ROOT_OF_UNITY2 = 17;
  var crystals2 = /* @__PURE__ */ genCrystals({
    N: N2,
    Q: Q2,
    F: F2,
    ROOT_OF_UNITY: ROOT_OF_UNITY2,
    newPoly: (n) => new Uint16Array(n),
    brvBits: 7,
    isKyber: true
  });
  var PARAMS2 = /* @__PURE__ */ (() => Object.freeze({
    512: Object.freeze({ N: N2, Q: Q2, K: 2, ETA1: 3, ETA2: 2, du: 10, dv: 4, RBGstrength: 128 }),
    768: Object.freeze({ N: N2, Q: Q2, K: 3, ETA1: 2, ETA2: 2, du: 10, dv: 4, RBGstrength: 192 }),
    1024: Object.freeze({ N: N2, Q: Q2, K: 4, ETA1: 2, ETA2: 2, du: 11, dv: 5, RBGstrength: 256 })
  }))();
  var compress = (d) => {
    if (d >= 12)
      return { encode: (i) => i, decode: (i) => i >= Q2 ? i - Q2 : i };
    const a = 2 ** (d - 1);
    return {
      // This only matches standalone Compress_d after bitsCoder masks the result into Z_(2^d).
      encode: (i) => ((i << d) + Q2 / 2) / Q2,
      // const decompress = (i: number) => round((Q / 2 ** d) * i);
      decode: (i) => i * Q2 + a >>> d
    };
  };
  var byteCoder = (d) => crystals2.bitsCoder(d, d === 12 ? { encode: (i) => i, decode: (i) => i >= Q2 ? i - Q2 : i } : { encode: (i) => i, decode: (i) => i });
  var polyCoder2 = (d) => d === 12 ? byteCoder(12) : crystals2.bitsCoder(d, compress(d));
  function polyAdd2(a_, b_) {
    const a = a_;
    const b = b_;
    for (let i = 0; i < N2; i++)
      a[i] = crystals2.mod(a[i] + b[i]);
  }
  function polySub2(a_, b_) {
    const a = a_;
    const b = b_;
    for (let i = 0; i < N2; i++)
      a[i] = crystals2.mod(a[i] - b[i]);
  }
  function BaseCaseMultiply(a0, a1, b0, b1, zeta) {
    const c0 = crystals2.mod(a1 * b1 * zeta + a0 * b0);
    const c1 = crystals2.mod(a0 * b1 + a1 * b0);
    return { c0, c1 };
  }
  function MultiplyNTTs2(f_, g_) {
    const f = f_;
    const g = g_;
    for (let i = 0; i < N2 / 2; i++) {
      let z = crystals2.nttZetas[64 + (i >> 1)];
      if (i & 1)
        z = -z;
      const { c0, c1 } = BaseCaseMultiply(f[2 * i + 0], f[2 * i + 1], g[2 * i + 0], g[2 * i + 1], z);
      f[2 * i + 0] = c0;
      f[2 * i + 1] = c1;
    }
    return f;
  }
  function SampleNTT(xof_) {
    const xof = xof_;
    const r = new Uint16Array(N2);
    for (let j = 0; j < N2; ) {
      const b = xof();
      if (b.length % 3)
        throw new Error("SampleNTT: unaligned block");
      for (let i = 0; j < N2 && i + 3 <= b.length; i += 3) {
        const d1 = (b[i + 0] >> 0 | b[i + 1] << 8) & 4095;
        const d2 = (b[i + 1] >> 4 | b[i + 2] << 4) & 4095;
        if (d1 < Q2)
          r[j++] = d1;
        if (j < N2 && d2 < Q2)
          r[j++] = d2;
      }
    }
    return r;
  }
  var sampleCBDBytes = (buf, eta) => {
    const r = new Uint16Array(N2);
    const b32 = u32(buf);
    swap32IfBE(b32);
    let len = 0;
    for (let i = 0, p = 0, bb = 0, t0 = 0; i < b32.length; i++) {
      let b = b32[i];
      for (let j = 0; j < 32; j++) {
        bb += b & 1;
        b >>= 1;
        len += 1;
        if (len === eta) {
          t0 = bb;
          bb = 0;
        } else if (len === 2 * eta) {
          r[p++] = crystals2.mod(t0 - bb);
          bb = 0;
          len = 0;
        }
      }
    }
    swap32IfBE(b32);
    if (len)
      throw new Error(`sampleCBD: leftover bits: ${len}`);
    return r;
  };
  function sampleCBD(PRF_, seed, nonce, eta) {
    const PRF = PRF_;
    return sampleCBDBytes(PRF(eta * N2 / 4, seed, nonce), eta);
  }
  var genKPKE = (opts_) => {
    const opts2 = opts_;
    const { K, PRF, XOF, HASH512, ETA1, ETA2, du, dv } = opts2;
    const poly1 = polyCoder2(1);
    const polyV = polyCoder2(dv);
    const polyU = polyCoder2(du);
    const publicCoder = splitCoder("publicKey", vecCoder(polyCoder2(12), K), 32);
    const secretCoder = vecCoder(polyCoder2(12), K);
    const cipherCoder = splitCoder("ciphertext", vecCoder(polyU, K), polyV);
    const seedCoder = splitCoder("seed", 32, 32);
    return {
      secretCoder,
      lengths: {
        secretKey: secretCoder.bytesLen,
        publicKey: publicCoder.bytesLen,
        cipherText: cipherCoder.bytesLen
      },
      keygen: (seed) => {
        abytesDoc(seed, 32, "seed");
        const seedDst = new Uint8Array(33);
        seedDst.set(seed);
        seedDst[32] = K;
        const seedHash = HASH512(seedDst);
        const [rho, sigma] = seedCoder.decode(seedHash);
        const sHat = [];
        const tHat = [];
        for (let i = 0; i < K; i++)
          sHat.push(crystals2.NTT.encode(sampleCBD(PRF, sigma, i, ETA1)));
        const x = XOF(rho);
        for (let i = 0; i < K; i++) {
          const e = crystals2.NTT.encode(sampleCBD(PRF, sigma, K + i, ETA1));
          for (let j = 0; j < K; j++) {
            const aji = SampleNTT(x.get(j, i));
            polyAdd2(e, MultiplyNTTs2(aji, sHat[j]));
          }
          tHat.push(e);
        }
        x.clean();
        const res = {
          publicKey: publicCoder.encode([tHat, rho]),
          secretKey: secretCoder.encode(sHat)
        };
        cleanBytes(rho, sigma, sHat, tHat, seedDst, seedHash);
        return res;
      },
      encrypt: (publicKey, msg, seed) => {
        const [tHat, rho] = publicCoder.decode(publicKey);
        const rHat = [];
        for (let i = 0; i < K; i++)
          rHat.push(crystals2.NTT.encode(sampleCBD(PRF, seed, i, ETA1)));
        const x = XOF(rho);
        const tmp2 = new Uint16Array(N2);
        const u = [];
        for (let i = 0; i < K; i++) {
          const e1 = sampleCBD(PRF, seed, K + i, ETA2);
          const tmp = new Uint16Array(N2);
          for (let j = 0; j < K; j++) {
            const aij = SampleNTT(x.get(i, j));
            polyAdd2(tmp, MultiplyNTTs2(aij, rHat[j]));
          }
          polyAdd2(e1, crystals2.NTT.decode(tmp));
          u.push(e1);
          polyAdd2(tmp2, MultiplyNTTs2(tHat[i], rHat[i]));
          cleanBytes(tmp);
        }
        x.clean();
        const e2 = sampleCBD(PRF, seed, 2 * K, ETA2);
        polyAdd2(e2, crystals2.NTT.decode(tmp2));
        const v = poly1.decode(msg);
        polyAdd2(v, e2);
        cleanBytes(tHat, rHat, tmp2, e2);
        return cipherCoder.encode([u, v]);
      },
      decrypt: (cipherText, privateKey) => {
        const [u, v] = cipherCoder.decode(cipherText);
        const sk = secretCoder.decode(privateKey);
        const tmp = new Uint16Array(N2);
        for (let i = 0; i < K; i++)
          polyAdd2(tmp, MultiplyNTTs2(sk[i], crystals2.NTT.encode(u[i])));
        polySub2(v, crystals2.NTT.decode(tmp));
        cleanBytes(tmp, sk, u);
        return poly1.encode(v);
      }
    };
  };
  function createKyber(opts2) {
    const rawOpts = opts2;
    const KPKE = genKPKE(rawOpts);
    const { HASH256, HASH512, KDF } = rawOpts;
    const { secretCoder: KPKESecretCoder, lengths } = KPKE;
    const secretCoder = splitCoder("secretKey", lengths.secretKey, lengths.publicKey, 32, 32);
    const msgLen = 32;
    const seedLen = 64;
    const kemLengths = Object.freeze({
      ...lengths,
      seed: 64,
      msg: msgLen,
      msgRand: msgLen,
      secretKey: secretCoder.bytesLen
    });
    return Object.freeze({
      info: Object.freeze({ type: "ml-kem" }),
      lengths: kemLengths,
      keygen: (seed = randomBytes2(seedLen)) => {
        abytesDoc(seed, seedLen, "seed");
        const { publicKey, secretKey: sk } = KPKE.keygen(seed.subarray(0, 32));
        const publicKeyHash = HASH256(publicKey);
        const secretKey = secretCoder.encode([sk, publicKey, publicKeyHash, seed.subarray(32)]);
        cleanBytes(sk, publicKeyHash);
        return {
          publicKey,
          secretKey
        };
      },
      getPublicKey: (secretKey) => {
        const [_sk, publicKey, _publicKeyHash, _z] = secretCoder.decode(secretKey);
        return Uint8Array.from(publicKey);
      },
      encapsulate: (publicKey, msg = randomBytes2(msgLen)) => {
        abytesDoc(publicKey, lengths.publicKey, "publicKey");
        abytesDoc(msg, msgLen, "message");
        const eke = publicKey.subarray(0, 384 * opts2.K);
        const ek = KPKESecretCoder.encode(KPKESecretCoder.decode(copyBytes(eke)));
        if (!equalBytes(ek, eke)) {
          cleanBytes(ek);
          throw new Error("ML-KEM.encapsulate: wrong publicKey modulus");
        }
        cleanBytes(ek);
        const kr = HASH512.create().update(msg).update(HASH256(publicKey)).digest();
        const cipherText = KPKE.encrypt(publicKey, msg, kr.subarray(32, 64));
        cleanBytes(kr.subarray(32));
        return {
          cipherText,
          sharedSecret: kr.subarray(0, 32)
        };
      },
      decapsulate: (cipherText, secretKey) => {
        abytesDoc(secretKey, secretCoder.bytesLen, "secretKey");
        abytesDoc(cipherText, lengths.cipherText, "cipherText");
        const k768 = secretCoder.bytesLen - 96;
        const start = k768 + 32;
        const test = HASH256(secretKey.subarray(k768 / 2, start));
        if (!equalBytes(test, secretKey.subarray(start, start + 32)))
          throw new Error("invalid secretKey: hash check failed");
        const [sk, publicKey, publicKeyHash, z] = secretCoder.decode(secretKey);
        const msg = KPKE.decrypt(cipherText, sk);
        const kr = HASH512.create().update(msg).update(publicKeyHash).digest();
        const Khat = kr.subarray(0, 32);
        const cipherText2 = KPKE.encrypt(publicKey, msg, kr.subarray(32, 64));
        const isValid = equalBytes(cipherText, cipherText2);
        const Kbar = KDF.create({ dkLen: 32 }).update(z).update(cipherText).digest();
        cleanBytes(msg, cipherText2, !isValid ? Khat : Kbar);
        return isValid ? Khat : Kbar;
      }
    });
  }
  function shakePRF(dkLen, key, nonce) {
    return shake256.create({ dkLen }).update(key).update(new Uint8Array([nonce])).digest();
  }
  var opts = /* @__PURE__ */ (() => ({
    HASH256: sha3_256,
    HASH512: sha3_512,
    KDF: shake256,
    XOF: XOF128,
    PRF: shakePRF
  }))();
  var mk = (params) => createKyber({
    ...opts,
    ...params
  });
  var ml_kem768 = /* @__PURE__ */ (() => mk(PARAMS2[768]))();

  // src/crypto/discrete-pq.mjs
  var DISCRETE_PQ_SIZES = Object.freeze({
    dsaSeed: 32,
    dsaPublicKey: 1952,
    dsaSecretKey: 4032,
    dsaSignature: 3309,
    kemSeed: 64,
    kemPublicKey: 1184,
    kemSecretKey: 2400,
    kemCiphertext: 1088,
    kemSharedSecret: 32
  });
  function exactBytes(name, value, length) {
    if (!(value instanceof Uint8Array) || value.length !== length) {
      throw new TypeError(`${name} must be a ${length}-byte Uint8Array`);
    }
    return value;
  }
  function mlDsa65Keygen(seed) {
    return ml_dsa65.keygen(exactBytes("ML-DSA seed", seed, DISCRETE_PQ_SIZES.dsaSeed));
  }
  function mlDsa65Sign(message, secretKey, randomSeed) {
    exactBytes("ML-DSA secret key", secretKey, DISCRETE_PQ_SIZES.dsaSecretKey);
    if (!(message instanceof Uint8Array)) throw new TypeError("message must be a Uint8Array");
    const opts2 = randomSeed === void 0 ? void 0 : {
      extraEntropy: exactBytes("ML-DSA signing randomness", randomSeed, 32)
    };
    return ml_dsa65.sign(message, secretKey, opts2);
  }
  function mlDsa65Verify(signature, message, publicKey) {
    exactBytes("ML-DSA signature", signature, DISCRETE_PQ_SIZES.dsaSignature);
    exactBytes("ML-DSA public key", publicKey, DISCRETE_PQ_SIZES.dsaPublicKey);
    if (!(message instanceof Uint8Array)) throw new TypeError("message must be a Uint8Array");
    return ml_dsa65.verify(signature, message, publicKey);
  }
  function mlKem768Keygen(seed) {
    return ml_kem768.keygen(exactBytes("ML-KEM seed", seed, DISCRETE_PQ_SIZES.kemSeed));
  }
  function mlKem768Encapsulate(publicKey, randomSeed) {
    exactBytes("ML-KEM public key", publicKey, DISCRETE_PQ_SIZES.kemPublicKey);
    if (randomSeed !== void 0) exactBytes("ML-KEM encapsulation randomness", randomSeed, 32);
    return ml_kem768.encapsulate(publicKey, randomSeed);
  }
  function mlKem768Decapsulate(cipherText, secretKey) {
    exactBytes("ML-KEM ciphertext", cipherText, DISCRETE_PQ_SIZES.kemCiphertext);
    exactBytes("ML-KEM secret key", secretKey, DISCRETE_PQ_SIZES.kemSecretKey);
    return ml_kem768.decapsulate(cipherText, secretKey);
  }

  // node_modules/@noble/ciphers/utils.js
  function isBytes2(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
  }
  function abool2(b) {
    if (typeof b !== "boolean")
      throw new TypeError(`boolean expected, not ${b}`);
  }
  function anumber2(n) {
    if (typeof n !== "number")
      throw new TypeError("number expected, got " + typeof n);
    if (!Number.isSafeInteger(n) || n < 0)
      throw new RangeError("positive integer expected, got " + n);
  }
  function abytes2(value, length, title = "") {
    const bytes = isBytes2(value);
    const len = value?.length;
    const needsLen = length !== void 0;
    if (!bytes || needsLen && len !== length) {
      const prefix = title && `"${title}" `;
      const ofLen = needsLen ? ` of length ${length}` : "";
      const got = bytes ? `length=${len}` : `type=${typeof value}`;
      const message = prefix + "expected Uint8Array" + ofLen + ", got " + got;
      if (!bytes)
        throw new TypeError(message);
      throw new RangeError(message);
    }
    return value;
  }
  function aexists2(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("Hash instance has been destroyed");
    if (checkFinished && instance.finished)
      throw new Error("Hash#digest() has already been called");
  }
  function aoutput2(out, instance, onlyAligned = false) {
    abytes2(out, void 0, "output");
    const min = instance.outputLen;
    if (out.length < min) {
      throw new RangeError("digestInto() expects output buffer of length at least " + min);
    }
    if (onlyAligned && !isAligned32(out))
      throw new Error("invalid output, must be aligned");
  }
  function u322(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
  }
  function clean2(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
      arrays[i].fill(0);
    }
  }
  function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  var isLE2 = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
  var byteSwap2 = (word) => word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
  var byteSwap322 = (arr) => {
    for (let i = 0; i < arr.length; i++)
      arr[i] = byteSwap2(arr[i]);
    return arr;
  };
  var swap32IfBE2 = isLE2 ? (u) => u : byteSwap322;
  function checkOpts(defaults, opts2) {
    if (opts2 == null || typeof opts2 !== "object")
      throw new Error("options must be defined");
    const merged = Object.assign(defaults, opts2);
    return merged;
  }
  function equalBytes2(a, b) {
    if (a.length !== b.length)
      return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
      diff |= a[i] ^ b[i];
    return diff === 0;
  }
  function wrapMacConstructor(keyLen, macCons, fromMsg) {
    const mac = macCons;
    const getArgs = fromMsg || (() => []);
    const macC = (msg, key) => mac(key, ...getArgs(msg)).update(msg).digest();
    const tmp = mac(new Uint8Array(keyLen), ...getArgs(new Uint8Array(0)));
    macC.outputLen = tmp.outputLen;
    macC.blockLen = tmp.blockLen;
    macC.create = (key, ...args) => mac(key, ...args);
    return macC;
  }
  var wrapCipher = /* @__NO_SIDE_EFFECTS__ */ (params, constructor) => {
    function wrappedCipher(key, ...args) {
      abytes2(key, void 0, "key");
      if (params.nonceLength !== void 0) {
        const nonce = args[0];
        abytes2(nonce, params.varSizeNonce ? void 0 : params.nonceLength, "nonce");
      }
      const tagl = params.tagLength;
      if (tagl && args[1] !== void 0)
        abytes2(args[1], void 0, "AAD");
      const cipher = constructor(key, ...args);
      const checkOutput = (fnLength, output) => {
        if (output !== void 0) {
          if (fnLength !== 2)
            throw new Error("cipher output not supported");
          abytes2(output, void 0, "output");
        }
      };
      let called = false;
      const wrCipher = {
        encrypt(data, output) {
          if (called)
            throw new Error("cannot encrypt() twice with same key + nonce");
          called = true;
          abytes2(data);
          checkOutput(cipher.encrypt.length, output);
          return cipher.encrypt(data, output);
        },
        decrypt(data, output) {
          abytes2(data);
          if (tagl && data.length < tagl)
            throw new Error('"ciphertext" expected length bigger than tagLength=' + tagl);
          checkOutput(cipher.decrypt.length, output);
          return cipher.decrypt(data, output);
        }
      };
      return wrCipher;
    }
    Object.assign(wrappedCipher, params);
    return wrappedCipher;
  };
  function getOutput(expectedLength, out, onlyAligned = true) {
    if (out === void 0)
      return new Uint8Array(expectedLength);
    abytes2(out, void 0, "output");
    if (out.length !== expectedLength)
      throw new Error('"output" expected Uint8Array of length ' + expectedLength + ", got: " + out.length);
    if (onlyAligned && !isAligned32(out))
      throw new Error("invalid output, must be aligned");
    return out;
  }
  function u64Lengths(dataLength, aadLength, isLE3) {
    anumber2(dataLength);
    anumber2(aadLength);
    abool2(isLE3);
    const num = new Uint8Array(16);
    const view = createView(num);
    view.setBigUint64(0, BigInt(aadLength), isLE3);
    view.setBigUint64(8, BigInt(dataLength), isLE3);
    return num;
  }
  function isAligned32(bytes) {
    return bytes.byteOffset % 4 === 0;
  }
  function copyBytes2(bytes) {
    return Uint8Array.from(abytes2(bytes));
  }

  // node_modules/@noble/ciphers/_arx.js
  var encodeStr = (str) => Uint8Array.from(str.split(""), (c) => c.charCodeAt(0));
  var sigma16_32 = /* @__PURE__ */ (() => swap32IfBE2(u322(encodeStr("expand 16-byte k"))))();
  var sigma32_32 = /* @__PURE__ */ (() => swap32IfBE2(u322(encodeStr("expand 32-byte k"))))();
  function rotl(a, b) {
    return a << b | a >>> 32 - b;
  }
  var BLOCK_LEN = 64;
  var BLOCK_LEN32 = 16;
  var MAX_COUNTER = /* @__PURE__ */ (() => 2 ** 32 - 1)();
  var U32_EMPTY = /* @__PURE__ */ Uint32Array.of();
  function runCipher(core, sigma, key, nonce, data, output, counter, rounds) {
    const len = data.length;
    const block = new Uint8Array(BLOCK_LEN);
    const b32 = u322(block);
    const isAligned = isLE2 && isAligned32(data) && isAligned32(output);
    const d32 = isAligned ? u322(data) : U32_EMPTY;
    const o32 = isAligned ? u322(output) : U32_EMPTY;
    if (!isLE2) {
      for (let pos = 0; pos < len; counter++) {
        core(sigma, key, nonce, b32, counter, rounds);
        swap32IfBE2(b32);
        if (counter >= MAX_COUNTER)
          throw new Error("arx: counter overflow");
        const take = Math.min(BLOCK_LEN, len - pos);
        for (let j = 0, posj; j < take; j++) {
          posj = pos + j;
          output[posj] = data[posj] ^ block[j];
        }
        pos += take;
      }
      return;
    }
    for (let pos = 0; pos < len; counter++) {
      core(sigma, key, nonce, b32, counter, rounds);
      if (counter >= MAX_COUNTER)
        throw new Error("arx: counter overflow");
      const take = Math.min(BLOCK_LEN, len - pos);
      if (isAligned && take === BLOCK_LEN) {
        const pos32 = pos / 4;
        if (pos % 4 !== 0)
          throw new Error("arx: invalid block position");
        for (let j = 0, posj; j < BLOCK_LEN32; j++) {
          posj = pos32 + j;
          o32[posj] = d32[posj] ^ b32[j];
        }
        pos += BLOCK_LEN;
        continue;
      }
      for (let j = 0, posj; j < take; j++) {
        posj = pos + j;
        output[posj] = data[posj] ^ block[j];
      }
      pos += take;
    }
  }
  function createCipher(core, opts2) {
    const { allowShortKeys, extendNonceFn, counterLength, counterRight, rounds } = checkOpts({ allowShortKeys: false, counterLength: 8, counterRight: false, rounds: 20 }, opts2);
    if (typeof core !== "function")
      throw new Error("core must be a function");
    anumber2(counterLength);
    anumber2(rounds);
    abool2(counterRight);
    abool2(allowShortKeys);
    return (key, nonce, data, output, counter = 0) => {
      abytes2(key, void 0, "key");
      abytes2(nonce, void 0, "nonce");
      abytes2(data, void 0, "data");
      const len = data.length;
      output = getOutput(len, output, false);
      anumber2(counter);
      if (counter < 0 || counter >= MAX_COUNTER)
        throw new Error("arx: counter overflow");
      const toClean = [];
      let l = key.length;
      let k;
      let sigma;
      if (l === 32) {
        toClean.push(k = copyBytes2(key));
        sigma = sigma32_32;
      } else if (l === 16 && allowShortKeys) {
        k = new Uint8Array(32);
        k.set(key);
        k.set(key, 16);
        sigma = sigma16_32;
        toClean.push(k);
      } else {
        abytes2(key, 32, "arx key");
        throw new Error("invalid key size");
      }
      if (!isLE2 || !isAligned32(nonce))
        toClean.push(nonce = copyBytes2(nonce));
      let k32 = u322(k);
      if (extendNonceFn) {
        if (nonce.length !== 24)
          throw new Error(`arx: extended nonce must be 24 bytes`);
        const n16 = nonce.subarray(0, 16);
        if (isLE2)
          extendNonceFn(sigma, k32, u322(n16), k32);
        else {
          const sigmaRaw = swap32IfBE2(Uint32Array.from(sigma));
          extendNonceFn(sigmaRaw, k32, u322(n16), k32);
          clean2(sigmaRaw);
          swap32IfBE2(k32);
        }
        nonce = nonce.subarray(16);
      } else if (!isLE2)
        swap32IfBE2(k32);
      const nonceNcLen = 16 - counterLength;
      if (nonceNcLen !== nonce.length)
        throw new Error(`arx: nonce must be ${nonceNcLen} or 16 bytes`);
      if (nonceNcLen !== 12) {
        const nc = new Uint8Array(12);
        nc.set(nonce, counterRight ? 0 : 12 - nonce.length);
        nonce = nc;
        toClean.push(nonce);
      }
      const n32 = swap32IfBE2(u322(nonce));
      try {
        runCipher(core, sigma, k32, n32, data, output, counter, rounds);
        return output;
      } finally {
        clean2(...toClean);
      }
    };
  }

  // node_modules/@noble/ciphers/_poly1305.js
  function u8to16(a, i) {
    return a[i++] & 255 | (a[i++] & 255) << 8;
  }
  var Poly1305 = class {
    // Can be speed-up using BigUint64Array, at the cost of complexity
    constructor(key) {
      __publicField(this, "blockLen", 16);
      __publicField(this, "outputLen", 16);
      __publicField(this, "buffer", new Uint8Array(16));
      __publicField(this, "r", new Uint16Array(10));
      // Allocating 1 array with .subarray() here is slower than 3
      __publicField(this, "h", new Uint16Array(10));
      __publicField(this, "pad", new Uint16Array(8));
      __publicField(this, "pos", 0);
      __publicField(this, "finished", false);
      __publicField(this, "destroyed", false);
      key = copyBytes2(abytes2(key, 32, "key"));
      const t0 = u8to16(key, 0);
      const t1 = u8to16(key, 2);
      const t2 = u8to16(key, 4);
      const t3 = u8to16(key, 6);
      const t4 = u8to16(key, 8);
      const t5 = u8to16(key, 10);
      const t6 = u8to16(key, 12);
      const t7 = u8to16(key, 14);
      this.r[0] = t0 & 8191;
      this.r[1] = (t0 >>> 13 | t1 << 3) & 8191;
      this.r[2] = (t1 >>> 10 | t2 << 6) & 7939;
      this.r[3] = (t2 >>> 7 | t3 << 9) & 8191;
      this.r[4] = (t3 >>> 4 | t4 << 12) & 255;
      this.r[5] = t4 >>> 1 & 8190;
      this.r[6] = (t4 >>> 14 | t5 << 2) & 8191;
      this.r[7] = (t5 >>> 11 | t6 << 5) & 8065;
      this.r[8] = (t6 >>> 8 | t7 << 8) & 8191;
      this.r[9] = t7 >>> 5 & 127;
      for (let i = 0; i < 8; i++)
        this.pad[i] = u8to16(key, 16 + 2 * i);
    }
    process(data, offset, isLast = false) {
      const hibit = isLast ? 0 : 1 << 11;
      const { h, r } = this;
      const r0 = r[0];
      const r1 = r[1];
      const r2 = r[2];
      const r3 = r[3];
      const r4 = r[4];
      const r5 = r[5];
      const r6 = r[6];
      const r7 = r[7];
      const r8 = r[8];
      const r9 = r[9];
      const t0 = u8to16(data, offset + 0);
      const t1 = u8to16(data, offset + 2);
      const t2 = u8to16(data, offset + 4);
      const t3 = u8to16(data, offset + 6);
      const t4 = u8to16(data, offset + 8);
      const t5 = u8to16(data, offset + 10);
      const t6 = u8to16(data, offset + 12);
      const t7 = u8to16(data, offset + 14);
      let h0 = h[0] + (t0 & 8191);
      let h1 = h[1] + ((t0 >>> 13 | t1 << 3) & 8191);
      let h2 = h[2] + ((t1 >>> 10 | t2 << 6) & 8191);
      let h3 = h[3] + ((t2 >>> 7 | t3 << 9) & 8191);
      let h4 = h[4] + ((t3 >>> 4 | t4 << 12) & 8191);
      let h5 = h[5] + (t4 >>> 1 & 8191);
      let h6 = h[6] + ((t4 >>> 14 | t5 << 2) & 8191);
      let h7 = h[7] + ((t5 >>> 11 | t6 << 5) & 8191);
      let h8 = h[8] + ((t6 >>> 8 | t7 << 8) & 8191);
      let h9 = h[9] + (t7 >>> 5 | hibit);
      let c = 0;
      let d0 = c + h0 * r0 + h1 * (5 * r9) + h2 * (5 * r8) + h3 * (5 * r7) + h4 * (5 * r6);
      c = d0 >>> 13;
      d0 &= 8191;
      d0 += h5 * (5 * r5) + h6 * (5 * r4) + h7 * (5 * r3) + h8 * (5 * r2) + h9 * (5 * r1);
      c += d0 >>> 13;
      d0 &= 8191;
      let d1 = c + h0 * r1 + h1 * r0 + h2 * (5 * r9) + h3 * (5 * r8) + h4 * (5 * r7);
      c = d1 >>> 13;
      d1 &= 8191;
      d1 += h5 * (5 * r6) + h6 * (5 * r5) + h7 * (5 * r4) + h8 * (5 * r3) + h9 * (5 * r2);
      c += d1 >>> 13;
      d1 &= 8191;
      let d2 = c + h0 * r2 + h1 * r1 + h2 * r0 + h3 * (5 * r9) + h4 * (5 * r8);
      c = d2 >>> 13;
      d2 &= 8191;
      d2 += h5 * (5 * r7) + h6 * (5 * r6) + h7 * (5 * r5) + h8 * (5 * r4) + h9 * (5 * r3);
      c += d2 >>> 13;
      d2 &= 8191;
      let d3 = c + h0 * r3 + h1 * r2 + h2 * r1 + h3 * r0 + h4 * (5 * r9);
      c = d3 >>> 13;
      d3 &= 8191;
      d3 += h5 * (5 * r8) + h6 * (5 * r7) + h7 * (5 * r6) + h8 * (5 * r5) + h9 * (5 * r4);
      c += d3 >>> 13;
      d3 &= 8191;
      let d4 = c + h0 * r4 + h1 * r3 + h2 * r2 + h3 * r1 + h4 * r0;
      c = d4 >>> 13;
      d4 &= 8191;
      d4 += h5 * (5 * r9) + h6 * (5 * r8) + h7 * (5 * r7) + h8 * (5 * r6) + h9 * (5 * r5);
      c += d4 >>> 13;
      d4 &= 8191;
      let d5 = c + h0 * r5 + h1 * r4 + h2 * r3 + h3 * r2 + h4 * r1;
      c = d5 >>> 13;
      d5 &= 8191;
      d5 += h5 * r0 + h6 * (5 * r9) + h7 * (5 * r8) + h8 * (5 * r7) + h9 * (5 * r6);
      c += d5 >>> 13;
      d5 &= 8191;
      let d6 = c + h0 * r6 + h1 * r5 + h2 * r4 + h3 * r3 + h4 * r2;
      c = d6 >>> 13;
      d6 &= 8191;
      d6 += h5 * r1 + h6 * r0 + h7 * (5 * r9) + h8 * (5 * r8) + h9 * (5 * r7);
      c += d6 >>> 13;
      d6 &= 8191;
      let d7 = c + h0 * r7 + h1 * r6 + h2 * r5 + h3 * r4 + h4 * r3;
      c = d7 >>> 13;
      d7 &= 8191;
      d7 += h5 * r2 + h6 * r1 + h7 * r0 + h8 * (5 * r9) + h9 * (5 * r8);
      c += d7 >>> 13;
      d7 &= 8191;
      let d8 = c + h0 * r8 + h1 * r7 + h2 * r6 + h3 * r5 + h4 * r4;
      c = d8 >>> 13;
      d8 &= 8191;
      d8 += h5 * r3 + h6 * r2 + h7 * r1 + h8 * r0 + h9 * (5 * r9);
      c += d8 >>> 13;
      d8 &= 8191;
      let d9 = c + h0 * r9 + h1 * r8 + h2 * r7 + h3 * r6 + h4 * r5;
      c = d9 >>> 13;
      d9 &= 8191;
      d9 += h5 * r4 + h6 * r3 + h7 * r2 + h8 * r1 + h9 * r0;
      c += d9 >>> 13;
      d9 &= 8191;
      c = (c << 2) + c | 0;
      c = c + d0 | 0;
      d0 = c & 8191;
      c = c >>> 13;
      d1 += c;
      h[0] = d0;
      h[1] = d1;
      h[2] = d2;
      h[3] = d3;
      h[4] = d4;
      h[5] = d5;
      h[6] = d6;
      h[7] = d7;
      h[8] = d8;
      h[9] = d9;
    }
    finalize() {
      const { h, pad } = this;
      const g = new Uint16Array(10);
      let c = h[1] >>> 13;
      h[1] &= 8191;
      for (let i = 2; i < 10; i++) {
        h[i] += c;
        c = h[i] >>> 13;
        h[i] &= 8191;
      }
      h[0] += c * 5;
      c = h[0] >>> 13;
      h[0] &= 8191;
      h[1] += c;
      c = h[1] >>> 13;
      h[1] &= 8191;
      h[2] += c;
      g[0] = h[0] + 5;
      c = g[0] >>> 13;
      g[0] &= 8191;
      for (let i = 1; i < 10; i++) {
        g[i] = h[i] + c;
        c = g[i] >>> 13;
        g[i] &= 8191;
      }
      g[9] -= 1 << 13;
      let mask = (c ^ 1) - 1;
      for (let i = 0; i < 10; i++)
        g[i] &= mask;
      mask = ~mask;
      for (let i = 0; i < 10; i++)
        h[i] = h[i] & mask | g[i];
      h[0] = (h[0] | h[1] << 13) & 65535;
      h[1] = (h[1] >>> 3 | h[2] << 10) & 65535;
      h[2] = (h[2] >>> 6 | h[3] << 7) & 65535;
      h[3] = (h[3] >>> 9 | h[4] << 4) & 65535;
      h[4] = (h[4] >>> 12 | h[5] << 1 | h[6] << 14) & 65535;
      h[5] = (h[6] >>> 2 | h[7] << 11) & 65535;
      h[6] = (h[7] >>> 5 | h[8] << 8) & 65535;
      h[7] = (h[8] >>> 8 | h[9] << 5) & 65535;
      let f = h[0] + pad[0];
      h[0] = f & 65535;
      for (let i = 1; i < 8; i++) {
        f = (h[i] + pad[i] | 0) + (f >>> 16) | 0;
        h[i] = f & 65535;
      }
      clean2(g);
    }
    update(data) {
      aexists2(this);
      abytes2(data);
      data = copyBytes2(data);
      const { buffer, blockLen } = this;
      const len = data.length;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        if (take === blockLen) {
          for (; blockLen <= len - pos; pos += blockLen)
            this.process(data, pos);
          continue;
        }
        buffer.set(data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(buffer, 0, false);
          this.pos = 0;
        }
      }
      return this;
    }
    destroy() {
      this.destroyed = true;
      clean2(this.h, this.r, this.buffer, this.pad);
    }
    digestInto(out) {
      aexists2(this);
      aoutput2(out, this);
      this.finished = true;
      const { buffer, h } = this;
      let { pos } = this;
      if (pos) {
        buffer[pos++] = 1;
        for (; pos < 16; pos++)
          buffer[pos] = 0;
        this.process(buffer, 0, true);
      }
      this.finalize();
      let opos = 0;
      for (let i = 0; i < 8; i++) {
        out[opos++] = h[i] >>> 0;
        out[opos++] = h[i] >>> 8;
      }
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
  };
  var poly1305 = /* @__PURE__ */ wrapMacConstructor(32, (key) => new Poly1305(key));

  // node_modules/@noble/ciphers/chacha.js
  function chachaCore(s, k, n, out, cnt, rounds = 20) {
    let y00 = s[0], y01 = s[1], y02 = s[2], y03 = s[3], y04 = k[0], y05 = k[1], y06 = k[2], y07 = k[3], y08 = k[4], y09 = k[5], y10 = k[6], y11 = k[7], y12 = cnt, y13 = n[0], y14 = n[1], y15 = n[2];
    let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
    for (let r = 0; r < rounds; r += 2) {
      x00 = x00 + x04 | 0;
      x12 = rotl(x12 ^ x00, 16);
      x08 = x08 + x12 | 0;
      x04 = rotl(x04 ^ x08, 12);
      x00 = x00 + x04 | 0;
      x12 = rotl(x12 ^ x00, 8);
      x08 = x08 + x12 | 0;
      x04 = rotl(x04 ^ x08, 7);
      x01 = x01 + x05 | 0;
      x13 = rotl(x13 ^ x01, 16);
      x09 = x09 + x13 | 0;
      x05 = rotl(x05 ^ x09, 12);
      x01 = x01 + x05 | 0;
      x13 = rotl(x13 ^ x01, 8);
      x09 = x09 + x13 | 0;
      x05 = rotl(x05 ^ x09, 7);
      x02 = x02 + x06 | 0;
      x14 = rotl(x14 ^ x02, 16);
      x10 = x10 + x14 | 0;
      x06 = rotl(x06 ^ x10, 12);
      x02 = x02 + x06 | 0;
      x14 = rotl(x14 ^ x02, 8);
      x10 = x10 + x14 | 0;
      x06 = rotl(x06 ^ x10, 7);
      x03 = x03 + x07 | 0;
      x15 = rotl(x15 ^ x03, 16);
      x11 = x11 + x15 | 0;
      x07 = rotl(x07 ^ x11, 12);
      x03 = x03 + x07 | 0;
      x15 = rotl(x15 ^ x03, 8);
      x11 = x11 + x15 | 0;
      x07 = rotl(x07 ^ x11, 7);
      x00 = x00 + x05 | 0;
      x15 = rotl(x15 ^ x00, 16);
      x10 = x10 + x15 | 0;
      x05 = rotl(x05 ^ x10, 12);
      x00 = x00 + x05 | 0;
      x15 = rotl(x15 ^ x00, 8);
      x10 = x10 + x15 | 0;
      x05 = rotl(x05 ^ x10, 7);
      x01 = x01 + x06 | 0;
      x12 = rotl(x12 ^ x01, 16);
      x11 = x11 + x12 | 0;
      x06 = rotl(x06 ^ x11, 12);
      x01 = x01 + x06 | 0;
      x12 = rotl(x12 ^ x01, 8);
      x11 = x11 + x12 | 0;
      x06 = rotl(x06 ^ x11, 7);
      x02 = x02 + x07 | 0;
      x13 = rotl(x13 ^ x02, 16);
      x08 = x08 + x13 | 0;
      x07 = rotl(x07 ^ x08, 12);
      x02 = x02 + x07 | 0;
      x13 = rotl(x13 ^ x02, 8);
      x08 = x08 + x13 | 0;
      x07 = rotl(x07 ^ x08, 7);
      x03 = x03 + x04 | 0;
      x14 = rotl(x14 ^ x03, 16);
      x09 = x09 + x14 | 0;
      x04 = rotl(x04 ^ x09, 12);
      x03 = x03 + x04 | 0;
      x14 = rotl(x14 ^ x03, 8);
      x09 = x09 + x14 | 0;
      x04 = rotl(x04 ^ x09, 7);
    }
    let oi = 0;
    out[oi++] = y00 + x00 | 0;
    out[oi++] = y01 + x01 | 0;
    out[oi++] = y02 + x02 | 0;
    out[oi++] = y03 + x03 | 0;
    out[oi++] = y04 + x04 | 0;
    out[oi++] = y05 + x05 | 0;
    out[oi++] = y06 + x06 | 0;
    out[oi++] = y07 + x07 | 0;
    out[oi++] = y08 + x08 | 0;
    out[oi++] = y09 + x09 | 0;
    out[oi++] = y10 + x10 | 0;
    out[oi++] = y11 + x11 | 0;
    out[oi++] = y12 + x12 | 0;
    out[oi++] = y13 + x13 | 0;
    out[oi++] = y14 + x14 | 0;
    out[oi++] = y15 + x15 | 0;
  }
  var chacha20 = /* @__PURE__ */ createCipher(chachaCore, {
    counterRight: false,
    counterLength: 4,
    allowShortKeys: false
  });
  var ZEROS16 = /* @__PURE__ */ new Uint8Array(16);
  var updatePadded = (h, msg) => {
    h.update(msg);
    const leftover = msg.length % 16;
    if (leftover)
      h.update(ZEROS16.subarray(leftover));
  };
  var ZEROS32 = /* @__PURE__ */ new Uint8Array(32);
  function computeTag(fn, key, nonce, ciphertext, AAD) {
    if (AAD !== void 0)
      abytes2(AAD, void 0, "AAD");
    const authKey = fn(key, nonce, ZEROS32);
    const lengths = u64Lengths(ciphertext.length, AAD ? AAD.length : 0, true);
    const h = poly1305.create(authKey);
    if (AAD)
      updatePadded(h, AAD);
    updatePadded(h, ciphertext);
    h.update(lengths);
    const res = h.digest();
    clean2(authKey, lengths);
    return res;
  }
  var _poly1305_aead = (xorStream) => (key, nonce, AAD) => {
    const tagLength = 16;
    return {
      encrypt(plaintext, output) {
        const plength = plaintext.length;
        output = getOutput(plength + tagLength, output, false);
        output.set(plaintext);
        const oPlain = output.subarray(0, -tagLength);
        xorStream(key, nonce, oPlain, oPlain, 1);
        const tag = computeTag(xorStream, key, nonce, oPlain, AAD);
        output.set(tag, plength);
        clean2(tag);
        return output;
      },
      decrypt(ciphertext, output) {
        output = getOutput(ciphertext.length - tagLength, output, false);
        const data = ciphertext.subarray(0, -tagLength);
        const passedTag = ciphertext.subarray(-tagLength);
        const tag = computeTag(xorStream, key, nonce, data, AAD);
        if (!equalBytes2(passedTag, tag)) {
          clean2(tag);
          throw new Error("invalid tag");
        }
        output.set(ciphertext.subarray(0, -tagLength));
        xorStream(key, nonce, output, output, 1);
        clean2(tag);
        return output;
      }
    };
  };
  var chacha20poly1305 = /* @__PURE__ */ wrapCipher(
    { blockSize: 64, nonceLength: 12, tagLength: 16 },
    /* @__PURE__ */ _poly1305_aead(chacha20)
  );

  // node_modules/@noble/hashes/hmac.js
  var _HMAC = class {
    constructor(hash, key) {
      __publicField(this, "oHash");
      __publicField(this, "iHash");
      __publicField(this, "blockLen");
      __publicField(this, "outputLen");
      __publicField(this, "canXOF", false);
      __publicField(this, "finished", false);
      __publicField(this, "destroyed", false);
      ahash(hash);
      abytes(key, void 0, "key");
      this.iHash = hash.create();
      if (typeof this.iHash.update !== "function")
        throw new Error("Expected instance of class which extends utils.Hash");
      this.blockLen = this.iHash.blockLen;
      this.outputLen = this.iHash.outputLen;
      const blockLen = this.blockLen;
      const pad = new Uint8Array(blockLen);
      pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
      for (let i = 0; i < pad.length; i++)
        pad[i] ^= 54;
      this.iHash.update(pad);
      this.oHash = hash.create();
      for (let i = 0; i < pad.length; i++)
        pad[i] ^= 54 ^ 92;
      this.oHash.update(pad);
      clean(pad);
    }
    update(buf) {
      aexists(this);
      this.iHash.update(buf);
      return this;
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      this.finished = true;
      const buf = out.subarray(0, this.outputLen);
      this.iHash.digestInto(buf);
      this.oHash.update(buf);
      this.oHash.digestInto(buf);
      this.destroy();
    }
    digest() {
      const out = new Uint8Array(this.oHash.outputLen);
      this.digestInto(out);
      return out;
    }
    _cloneInto(to) {
      to || (to = Object.create(Object.getPrototypeOf(this), {}));
      const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
      to = to;
      to.finished = finished;
      to.destroyed = destroyed;
      to.blockLen = blockLen;
      to.outputLen = outputLen;
      to.oHash = oHash._cloneInto(to.oHash);
      to.iHash = iHash._cloneInto(to.iHash);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
    destroy() {
      this.destroyed = true;
      this.oHash.destroy();
      this.iHash.destroy();
    }
  };
  var hmac = /* @__PURE__ */ (() => {
    const hmac_ = (hash, key, message) => new _HMAC(hash, key).update(message).digest();
    hmac_.create = (hash, key) => new _HMAC(hash, key);
    return hmac_;
  })();

  // node_modules/@noble/hashes/hkdf.js
  function extract(hash, ikm, salt) {
    ahash(hash);
    if (salt === void 0)
      salt = new Uint8Array(hash.outputLen);
    return hmac(hash, salt, ikm);
  }
  var HKDF_COUNTER = /* @__PURE__ */ Uint8Array.of(0);
  var EMPTY_BUFFER = /* @__PURE__ */ Uint8Array.of();
  function expand(hash, prk, info, length = 32) {
    ahash(hash);
    anumber(length, "length");
    abytes(prk, void 0, "prk");
    const olen = hash.outputLen;
    if (prk.length < olen)
      throw new Error('"prk" must be at least HashLen octets');
    if (length > 255 * olen)
      throw new Error("Length must be <= 255*HashLen");
    const blocks = Math.ceil(length / olen);
    if (info === void 0)
      info = EMPTY_BUFFER;
    else
      abytes(info, void 0, "info");
    const okm = new Uint8Array(blocks * olen);
    const HMAC = hmac.create(hash, prk);
    const HMACTmp = HMAC._cloneInto();
    const T = new Uint8Array(HMAC.outputLen);
    for (let counter = 0; counter < blocks; counter++) {
      HKDF_COUNTER[0] = counter + 1;
      HMACTmp.update(counter === 0 ? EMPTY_BUFFER : T).update(info).update(HKDF_COUNTER).digestInto(T);
      okm.set(T, olen * counter);
      HMAC._cloneInto(HMACTmp);
    }
    HMAC.destroy();
    HMACTmp.destroy();
    clean(T, HKDF_COUNTER);
    return okm.slice(0, length);
  }
  var hkdf = (hash, ikm, salt, info, length) => expand(hash, extract(hash, ikm, salt), info, length);

  // src/crypto/discrete-protocol.mjs
  var utf8 = new TextEncoder();
  var ZERO_32 = new Uint8Array(32);
  var ZERO_12 = new Uint8Array(12);
  var DOMAINS = Object.freeze({
    viewRoot: "discrete-pq-view-root-v1",
    spendRoot: "discrete-pq-spend-root-v1",
    inputsHash: "discrete-pq-inputs-hash-v1",
    // LEGACY: the original outContext formula folded LE64(T) into the hash used
    // to derive the AEAD key, so scanning had to guess T in advance. Every
    // output minted before the outContext-v2 activation used this domain,
    // always at T=0. Retained ONLY as a receiver-side fallback (see
    // legacyOutputContextV1 below) so those outputs stay scannable. Never use
    // this to build a new output.
    outContextLegacyV1: "discrete-pq-out-context-v1",
    // CURRENT: outContext no longer depends on T. T travels only inside the
    // AEAD-encrypted payload and is read back after a single decrypt, so
    // scanning never needs to enumerate candidate T values.
    outContext: "discrete-pq-out-context-v2",
    aeadKey: "discrete-pq-aead-key-v1",
    spendCommit: "discrete-pq-spend-commit-v1",
    nullifier: "discrete-pq-nullifier-v1",
    coinbaseRho: "discrete-coinbase-rho-v1"
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
  function deriveViewSeed(masterSeed) {
    return hkdf(sha3_256, masterSeed, ZERO_32, domain(DOMAINS.viewRoot), 64);
  }
  function deriveSpendSeed(masterSeed) {
    return hkdf(sha3_256, masterSeed, ZERO_32, domain(DOMAINS.spendRoot), 32);
  }
  function transactionInputsHash(inputs) {
    if (inputs.length === 0) return new Uint8Array(32);
    return sha3_256(concat(domain(DOMAINS.inputsHash), ...inputs.flatMap((input) => [input.prevTxid, le32(input.prevOutIndex)])));
  }
  function outputContext(inputsHash, kemCiphertext, outputIndex) {
    return sha3_256(concat(
      domain(DOMAINS.outContext),
      inputsHash,
      kemCiphertext,
      le32(outputIndex)
    ));
  }
  function legacyOutputContextV1(inputsHash, kemCiphertext, outputIndex, subaddressIndex) {
    return sha3_256(concat(
      domain(DOMAINS.outContextLegacyV1),
      inputsHash,
      kemCiphertext,
      le32(outputIndex),
      le64(subaddressIndex)
    ));
  }
  function deriveOutputAeadKey(sharedSecret, context) {
    return hkdf(
      sha3_256,
      sharedSecret,
      ZERO_32,
      concat(domain(DOMAINS.aeadKey), context),
      32
    );
  }
  function calculateSpendCommit(spendPublicKey, rho) {
    return sha3_256(concat(domain(DOMAINS.spendCommit), spendPublicKey, rho));
  }
  function calculateNullifier(spendPublicKey, rho, transactionHash, outputIndex) {
    return sha3_256(concat(
      domain(DOMAINS.nullifier),
      spendPublicKey,
      rho,
      transactionHash,
      le32(outputIndex)
    ));
  }
  function calculateCoinbaseRho(spendPublicKey, height, outputIndex) {
    return sha3_256(concat(
      domain(DOMAINS.coinbaseRho),
      spendPublicKey,
      le32(height),
      le32(outputIndex)
    ));
  }
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
  function scanPqOutput(output, inputsHash, viewSecretKey, spendPublicKey) {
    try {
      const sharedSecret = ml_kem768.decapsulate(output.kemCiphertext, viewSecretKey);
      const contextV2 = outputContext(inputsHash, output.kemCiphertext, output.outputIndex);
      let decrypted = tryDecrypt(sharedSecret, contextV2, output);
      let context = contextV2;
      if (!decrypted) {
        const contextLegacy = legacyOutputContextV1(inputsHash, output.kemCiphertext, output.outputIndex, 0n);
        const legacy = tryDecrypt(sharedSecret, contextLegacy, output);
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
  function scanPqOutputLegacyTWindow(output, inputsHash, viewSecretKey, spendPublicKey, maxT) {
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
  function recognizesCoinbaseOutput(spendCommit, spendPublicKey, height, outputIndex) {
    const rho = calculateCoinbaseRho(spendPublicKey, height, outputIndex);
    const expected = calculateSpendCommit(spendPublicKey, rho);
    return expected.every((byte, index) => byte === spendCommit[index]) ? rho : null;
  }

  // src/crypto/discrete-wallet-state.mjs
  var hexToBytes = (value) => {
    if (typeof value !== "string" || value.length % 2 !== 0) throw new TypeError("invalid hex field");
    return Uint8Array.from(value.match(/../g) || [], (byte) => parseInt(byte, 16));
  };
  var bytesToHex2 = (value) => Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
  var amount = (value) => {
    if (typeof value === "number" && !Number.isSafeInteger(value)) throw new RangeError("unsafe JSON amount");
    return BigInt(value);
  };
  function pqInputs(transaction) {
    return (transaction.vin || []).filter((input) => input.type === "10").map((input) => ({
      prevTxid: hexToBytes(input.value.prev_txid),
      prevOutIndex: Number(input.value.prev_out_index),
      authPublicKey: hexToBytes(input.value.auth_pub),
      rho: hexToBytes(input.value.rho_reveal)
    }));
  }
  var DiscreteWalletState = class _DiscreteWalletState {
    constructor(startHeight = 0) {
      this.reset(startHeight);
    }
    reset(startHeight = 0) {
      const height = Number(startHeight);
      if (!Number.isSafeInteger(height) || height < 0 || height > 4294967295) {
        throw new RangeError("wallet start height is out of range");
      }
      this.height = height;
      this.tipHash = null;
      this.outputs = [];
      this.history = [];
      this.chain = [];
      this._nullifiers = /* @__PURE__ */ new Map();
    }
    static fromJSON(raw) {
      const state = new _DiscreteWalletState();
      state.height = Number(raw.height || 0);
      state.tipHash = raw.tipHash || null;
      state.outputs = (raw.outputs || []).map((output) => ({
        ...output,
        amount: BigInt(output.amount),
        rho: hexToBytes(output.rho),
        nullifier: output.nullifier
      }));
      state.history = (raw.history || []).map((row) => ({
        ...row,
        credited: BigInt(row.credited),
        debited: BigInt(row.debited)
      }));
      state.chain = raw.chain || [];
      state.outputs.forEach((output, index) => state._nullifiers.set(output.nullifier, index));
      return state;
    }
    toJSON() {
      return {
        height: this.height,
        tipHash: this.tipHash,
        outputs: this.outputs.map((output) => ({
          ...output,
          amount: output.amount.toString(),
          rho: bytesToHex2(output.rho)
        })),
        history: this.history.map((row) => ({
          ...row,
          credited: row.credited.toString(),
          debited: row.debited.toString()
        })),
        chain: this.chain
      };
    }
    applyBlock(block, keys) {
      if (this.tipHash !== null && block.previous_hash !== this.tipHash) {
        throw new Error(`wallet chain discontinuity at height ${block.height}`);
      }
      if (Number(block.height) !== this.height) {
        throw new Error(`expected wallet block ${this.height}, received ${block.height}`);
      }
      const journal = {
        height: Number(block.height),
        hash: block.hash,
        previousHash: block.previous_hash,
        created: [],
        spent: [],
        historyCount: 0
      };
      for (const entry of block.transactions || []) this.applyTransaction(entry, block, keys, journal);
      this.chain.push(journal);
      this.tipHash = block.hash;
      this.height = Number(block.height) + 1;
    }
    applyTransaction(entry, block, keys, journal = null) {
      const transaction = entry.transaction;
      const inputs = pqInputs(transaction);
      let debited = 0n;
      let credited = 0n;
      for (const input of inputs) {
        const nullifier = bytesToHex2(calculateNullifier(
          input.authPublicKey,
          input.rho,
          input.prevTxid,
          input.prevOutIndex
        ));
        const ownedIndex = this._nullifiers.get(nullifier);
        if (ownedIndex === void 0) continue;
        const owned = this.outputs[ownedIndex];
        if (!owned.spent) {
          if (journal) journal.spent.push({
            index: ownedIndex,
            spent: owned.spent,
            spentHeight: owned.spentHeight,
            spentTransactionHash: owned.spentTransactionHash
          });
          owned.spent = true;
          owned.spentHeight = Number(block.height);
          owned.spentTransactionHash = entry.hash;
          debited += owned.amount;
        }
      }
      const inputHash = transactionInputsHash(inputs);
      for (let outputIndex = 0; outputIndex < (transaction.vout || []).length; ++outputIndex) {
        const wire = transaction.vout[outputIndex];
        const target = wire.target || {};
        const data = target.data || {};
        let rho = null;
        if (target.type === "10") {
          rho = scanPqOutput({
            outputIndex,
            amount: amount(wire.amount),
            kemCiphertext: hexToBytes(data.kem_ct),
            encryptedPayload: hexToBytes(data.enc_payload),
            spendCommit: hexToBytes(data.spend_commit)
          }, inputHash, keys.viewSecretKey, keys.spendPublicKey)?.rho || null;
        } else if (target.type === "11") {
          rho = recognizesCoinbaseOutput(
            hexToBytes(data.spend_commit),
            keys.spendPublicKey,
            Number(block.height),
            outputIndex
          );
        }
        if (rho === null) continue;
        const nullifier = bytesToHex2(calculateNullifier(
          keys.spendPublicKey,
          rho,
          hexToBytes(entry.hash),
          outputIndex
        ));
        if (this._nullifiers.has(nullifier)) continue;
        const owned = {
          transactionHash: entry.hash,
          outputIndex,
          amount: amount(wire.amount),
          unlockHeight: Number(wire.unlock_height || 0),
          blockHeight: Number(block.height),
          rho,
          nullifier,
          spent: false
        };
        this._nullifiers.set(nullifier, this.outputs.length);
        this.outputs.push(owned);
        if (journal) journal.created.push(nullifier);
        credited += owned.amount;
      }
      if (credited !== 0n || debited !== 0n) {
        this.history.push({
          transactionHash: entry.hash,
          blockHeight: Number(block.height),
          timestamp: Number(block.timestamp),
          coinbase: Boolean(entry.coinbase),
          credited,
          debited
        });
        if (journal) journal.historyCount++;
      }
    }
    rollbackToHeight(height) {
      while (this.height > height) {
        const journal = this.chain.pop();
        if (!journal) throw new Error("wallet rollback journal is incomplete");
        this.history.splice(this.history.length - journal.historyCount, journal.historyCount);
        for (let i = journal.created.length - 1; i >= 0; --i) {
          const nullifier = journal.created[i];
          const outputIndex = this._nullifiers.get(nullifier);
          if (outputIndex !== this.outputs.length - 1) throw new Error("wallet output journal is corrupt");
          this.outputs.pop();
          this._nullifiers.delete(nullifier);
        }
        for (let i = journal.spent.length - 1; i >= 0; --i) {
          const prior = journal.spent[i];
          const output = this.outputs[prior.index];
          output.spent = prior.spent;
          if (prior.spentHeight === void 0) delete output.spentHeight;
          else output.spentHeight = prior.spentHeight;
          if (prior.spentTransactionHash === void 0) delete output.spentTransactionHash;
          else output.spentTransactionHash = prior.spentTransactionHash;
        }
        this.height = journal.height;
        this.tipHash = journal.previousHash;
      }
    }
    previewMempool(entries, keys, timestamp = Math.floor(Date.now() / 1e3)) {
      const overlay = _DiscreteWalletState.fromJSON(this.toJSON());
      const pseudoBlock = { height: overlay.height, timestamp };
      for (const entry of entries) overlay.applyTransaction(entry, pseudoBlock, keys);
      return overlay;
    }
    balance() {
      return this.outputs.reduce((sum, output) => output.spent ? sum : sum + output.amount, 0n);
    }
    spendableBalance(chainHeight) {
      return this.outputs.reduce((sum, output) => output.spent || output.unlockHeight > chainHeight ? sum : sum + output.amount, 0n);
    }
  };

  // src/crypto/discrete-wallet-keys.mjs
  var CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  var BECH32M = 734539939;
  var concat2 = (...parts) => {
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  };
  var varint = (value) => {
    let v = BigInt(value);
    const out = [];
    while (v >= 128n) {
      out.push(Number(v & 127n) | 128);
      v >>= 7n;
    }
    out.push(Number(v));
    return Uint8Array.from(out);
  };
  var polymod = (values) => {
    const generators = [996825010, 642813549, 513874426, 1027748829, 705979059];
    let check = 1;
    for (const value of values) {
      const top = check >>> 25;
      check = (check & 33554431) << 5 ^ value;
      for (let i = 0; i < 5; ++i) if (top >>> i & 1) check ^= generators[i];
    }
    return check >>> 0;
  };
  var hrpExpand = (hrp) => [...hrp].map((c) => c.charCodeAt(0) >>> 5).concat([0], [...hrp].map((c) => c.charCodeAt(0) & 31));
  var convertBits = (input, from, to, pad) => {
    let accumulator = 0, bits = 0;
    const result = [], mask = (1 << to) - 1;
    for (const value of input) {
      if (value >>> from) throw new Error("invalid address symbol");
      accumulator = (accumulator << from | value) & (1 << from + to - 1) - 1;
      bits += from;
      while (bits >= to) {
        bits -= to;
        result.push(accumulator >>> bits & mask);
      }
    }
    if (pad && bits) result.push(accumulator << to - bits & mask);
    else if (!pad && (bits >= from || accumulator << to - bits & mask)) throw new Error("invalid address padding");
    return Uint8Array.from(result);
  };
  function deriveWalletKeys(masterSeed) {
    if (!(masterSeed instanceof Uint8Array) || masterSeed.length !== 32) throw new TypeError("master seed must be 32 bytes");
    const view = ml_kem768.keygen(deriveViewSeed(masterSeed));
    const spend = ml_dsa65.keygen(deriveSpendSeed(masterSeed));
    return {
      masterSeed: masterSeed.slice(),
      viewPublicKey: view.publicKey,
      viewSecretKey: view.secretKey,
      spendPublicKey: spend.publicKey,
      spendSecretKey: spend.secretKey
    };
  }
  function encodeAddress(viewPublicKey, spendPublicKey, networkPrefix = 3425755, testnet = false) {
    const prefix = concat2(Uint8Array.of(1), varint(networkPrefix), viewPublicKey, spendPublicKey);
    const payload = concat2(prefix, sha3_256(prefix).slice(0, 4));
    const data = Array.from(convertBits(payload, 8, 5, true));
    const hrp = testnet ? "tdisc" : "disc";
    const check = polymod(hrpExpand(hrp).concat(data, [0, 0, 0, 0, 0, 0])) ^ BECH32M;
    for (let i = 0; i < 6; ++i) data.push(check >>> 5 * (5 - i) & 31);
    return `${hrp}1${data.map((value) => CHARSET[value]).join("")}`;
  }
  function decodeAddress(address, testnet = false) {
    const separator = address.lastIndexOf("1");
    const hrp = testnet ? "tdisc" : "disc";
    if (separator <= 0 || address.slice(0, separator) !== hrp) throw new Error("wrong Discrete address network");
    const data = [...address.slice(separator + 1)].map((character) => {
      const index = CHARSET.indexOf(character);
      if (index < 0) throw new Error("invalid Discrete address");
      return index;
    });
    if (data.length < 6 || polymod(hrpExpand(hrp).concat(data)) !== BECH32M) throw new Error("invalid Discrete address checksum");
    const payload = convertBits(data.slice(0, -6), 5, 8, false);
    let offset = 1, shift = 0, networkPrefix = 0n;
    while (offset < payload.length) {
      const byte = payload[offset++];
      networkPrefix |= BigInt(byte & 127) << BigInt(shift);
      if (!(byte & 128)) break;
      shift += 7;
    }
    if (payload[0] !== 1 || payload.length - offset !== 1184 + 1952 + 4) throw new Error("invalid Discrete address payload");
    const content = payload.slice(0, -4), checksum = payload.slice(-4), expected = sha3_256(content).slice(0, 4);
    if (!expected.every((byte, index) => byte === checksum[index])) throw new Error("invalid Discrete address payload checksum");
    return { networkPrefix, viewPublicKey: payload.slice(offset, offset + 1184), spendPublicKey: payload.slice(offset + 1184, offset + 3136) };
  }
  var ACCOUNT_NUMBER_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  function accountNumberSymbolValue(character) {
    if (character >= "0" && character <= "9") return character.charCodeAt(0) - 48;
    const upper = character.toUpperCase();
    if (upper === "O") return 0;
    if (upper === "I" || upper === "L") return 1;
    return ACCOUNT_NUMBER_ALPHABET.indexOf(upper);
  }
  function accountNumberCheck(digits) {
    let factor = 2, sum = 0;
    for (let i = digits.length - 1; i >= 0; --i) {
      const codePoint = accountNumberSymbolValue(digits[i]);
      if (codePoint < 0) throw new Error("invalid account-number character");
      let addend = factor * codePoint;
      factor = factor === 2 ? 1 : 2;
      addend = Math.floor(addend / 32) + addend % 32;
      sum += addend;
    }
    return ACCOUNT_NUMBER_ALPHABET[(32 - sum % 32) % 32];
  }
  function canonicalAccountNumberSymbols(symbols) {
    let canonical = "";
    for (const character of String(symbols)) {
      const value = accountNumberSymbolValue(character);
      if (value < 0) throw new Error("invalid account-number character");
      canonical += ACCOUNT_NUMBER_ALPHABET[value];
    }
    return canonical;
  }
  function formatAccountNumber(blockHeight, transactionIndex, fingerprint, subaddressIndex = null) {
    const canonicalFingerprint = canonicalAccountNumberSymbols(fingerprint);
    if (canonicalFingerprint.length !== 4) throw new Error("account-number fingerprint must be 4 characters");
    const numericFields = [blockHeight, transactionIndex];
    if (subaddressIndex !== null) numericFields.push(subaddressIndex);
    for (const field of numericFields) {
      if (!Number.isInteger(field) || field < 0 || field > 4294967295) throw new Error("account-number field out of range");
    }
    const fields = [String(blockHeight), String(transactionIndex), canonicalFingerprint];
    if (subaddressIndex !== null) fields.push(String(subaddressIndex));
    return fields.join("-") + "-" + accountNumberCheck(fields.join(""));
  }
  function parseAccountNumber(value) {
    const match = String(value).trim().match(/^(\d+)-(\d+)-([0-9A-Za-z]{4})(?:-(\d+))?-([0-9A-Za-z])$/);
    if (!match) throw new Error("invalid account-number format");
    const blockHeight = Number(match[1]);
    const transactionIndex = Number(match[2]);
    const fingerprint = canonicalAccountNumberSymbols(match[3]);
    const hasSubaddress = match[4] !== void 0;
    const subaddressIndex = hasSubaddress ? Number(match[4]) : 0;
    if ([blockHeight, transactionIndex, subaddressIndex].some(
      (field) => !Number.isSafeInteger(field) || field < 0 || field > 4294967295
    )) throw new Error("account-number field out of range");
    const payload = match[1] + match[2] + fingerprint + (hasSubaddress ? match[4] : "");
    const actualCheck = canonicalAccountNumberSymbols(match[5]);
    if (accountNumberCheck(payload) !== actualCheck) throw new Error("invalid account-number checksum");
    return { blockHeight, transactionIndex, subaddressIndex, fingerprint };
  }

  // src/crypto/discrete-transaction.mjs
  var utf82 = new TextEncoder();
  var concat3 = (...parts) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  };
  var le322 = (value) => {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value, true);
    return out;
  };
  var le642 = (value) => {
    let v = BigInt(value);
    const out = new Uint8Array(8);
    for (let i = 0; i < 8; ++i) {
      out[i] = Number(v & 255n);
      v >>= 8n;
    }
    return out;
  };
  var varint2 = (value) => {
    let v = BigInt(value);
    const out = [];
    while (v >= 128n) {
      out.push(Number(v & 127n) | 128);
      v >>= 7n;
    }
    out.push(Number(v));
    return Uint8Array.from(out);
  };
  function accountRegistrationExtra(viewPublicKey, spendPublicKey) {
    if (!(viewPublicKey instanceof Uint8Array) || viewPublicKey.length !== 1184) throw new Error("invalid ML-KEM-768 public key");
    if (!(spendPublicKey instanceof Uint8Array) || spendPublicKey.length !== 1952) throw new Error("invalid ML-DSA-65 public key");
    return concat3(Uint8Array.of(5), viewPublicKey, spendPublicKey);
  }
  function buildFreeRegistrationTransaction({ viewPublicKey, spendPublicKey, referenceBlockHash, nonce }) {
    const hash = typeof referenceBlockHash === "string" ? Uint8Array.from(referenceBlockHash.match(/../g) || [], (byte) => parseInt(byte, 16)) : referenceBlockHash;
    if (!(hash instanceof Uint8Array) || hash.length !== 32) throw new Error("invalid reference block hash");
    const extra = concat3(accountRegistrationExtra(viewPublicKey, spendPublicKey), Uint8Array.of(6), hash, le642(nonce));
    const transaction = { txType: 3, inputs: [], outputs: [], extra, signatures: [] };
    return { transaction, bytes: serializeTransaction(transaction) };
  }
  function transactionSigningDigest(transaction, fee) {
    const chunks = [utf82.encode("discrete-pq-tx-sign-v1"), Uint8Array.of(1, 1), le642(0), le322(transaction.inputs.length)];
    for (const input of transaction.inputs) chunks.push(input.transactionHash, le322(input.outputIndex), input.spendPublicKey, input.rho);
    chunks.push(le322(transaction.outputs.length));
    for (const output of transaction.outputs) chunks.push(
      Uint8Array.of(16),
      le642(output.amount),
      le642(output.unlockHeight),
      output.kemCiphertext,
      output.encryptedPayload,
      output.spendCommit
    );
    chunks.push(le322(transaction.extra.length), transaction.extra, le642(fee));
    return sha3_256(concat3(...chunks));
  }
  function serializeTransaction(transaction) {
    const chunks = [varint2(1), varint2(transaction.txType === void 0 ? 1 : transaction.txType), varint2(0), varint2(transaction.inputs.length)];
    for (const input of transaction.inputs) chunks.push(
      Uint8Array.of(16),
      input.transactionHash,
      varint2(input.outputIndex),
      input.spendPublicKey,
      input.rho
    );
    chunks.push(varint2(transaction.outputs.length));
    for (const output of transaction.outputs) chunks.push(
      varint2(output.amount),
      varint2(output.unlockHeight),
      Uint8Array.of(16),
      output.kemCiphertext,
      output.encryptedPayload,
      output.spendCommit
    );
    chunks.push(varint2(transaction.extra.length), transaction.extra, ...transaction.signatures);
    return concat3(...chunks);
  }
  function buildSignedTransaction({ inputs, destinations, fee, spendPublicKey, spendSecretKey, extra = new Uint8Array() }) {
    const normalizedInputs = inputs.map((input) => ({
      transactionHash: typeof input.transactionHash === "string" ? Uint8Array.from(input.transactionHash.match(/../g), (b) => parseInt(b, 16)) : input.transactionHash,
      outputIndex: input.outputIndex,
      amount: BigInt(input.amount),
      rho: input.rho,
      spendPublicKey
    }));
    const inputTotal = normalizedInputs.reduce((sum, input) => sum + input.amount, 0n);
    const outputTotal = destinations.reduce((sum, destination) => sum + BigInt(destination.amount), 0n);
    if (inputTotal !== outputTotal + BigInt(fee)) throw new Error("input/output/fee balance mismatch");
    const inputsHash = transactionInputsHash(normalizedInputs.map((input) => ({ prevTxid: input.transactionHash, prevOutIndex: input.outputIndex })));
    const outputs = destinations.map((destination, outputIndex) => {
      const encapsulated = ml_kem768.encapsulate(destination.viewPublicKey);
      const rho = crypto.getRandomValues(new Uint8Array(32));
      const context = outputContext(inputsHash, encapsulated.cipherText, outputIndex);
      const key = deriveOutputAeadKey(encapsulated.sharedSecret, context);
      const amount2 = BigInt(destination.amount), unlockHeight = BigInt(destination.unlockHeight || 0);
      const aad = concat3(context, le642(amount2));
      const plaintext = concat3(rho, le642(destination.subaddressIndex || 0));
      const encryptedPayload = chacha20poly1305(key, new Uint8Array(12), aad).encrypt(plaintext);
      return {
        amount: amount2,
        unlockHeight,
        kemCiphertext: encapsulated.cipherText,
        encryptedPayload,
        spendCommit: calculateSpendCommit(destination.spendPublicKey, rho),
        rho
      };
    });
    const transaction = { txType: 1, inputs: normalizedInputs, outputs, extra, signatures: [] };
    const digest = transactionSigningDigest(transaction, BigInt(fee));
    transaction.signatures = normalizedInputs.map(() => ml_dsa65.sign(digest, spendSecretKey));
    return { transaction, bytes: serializeTransaction(transaction) };
  }

  // src/crypto/discrete-registration-pow.mjs
  var concat4 = (...parts) => {
    const output = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  };
  var hexBytes = (value) => typeof value === "string" ? Uint8Array.from(value.match(/../g) || [], (byte) => parseInt(byte, 16)) : value;
  var FREE_REG_POW_TARGET = 0x00007fffffffffffn;
  var FREE_REG_POW_DOMAIN = new TextEncoder().encode("discrete-pq-free-reg-pow-v1");
  function freeRegistrationPowPrefix(viewPublicKey, spendPublicKey, referenceBlockHash) {
    const hash = hexBytes(referenceBlockHash);
    if (!(viewPublicKey instanceof Uint8Array) || viewPublicKey.length !== 1184) throw new Error("invalid ML-KEM-768 public key");
    if (!(spendPublicKey instanceof Uint8Array) || spendPublicKey.length !== 1952) throw new Error("invalid ML-DSA-65 public key");
    if (!(hash instanceof Uint8Array) || hash.length !== 32) throw new Error("invalid reference block hash");
    return concat4(FREE_REG_POW_DOMAIN, viewPublicKey, spendPublicKey, hash);
  }
  function grindFreeRegistrationPow(viewPublicKey, spendPublicKey, referenceBlockHash, options = {}) {
    const prefix = freeRegistrationPowPrefix(viewPublicKey, spendPublicKey, referenceBlockHash);
    const workerCount = Math.max(1, Math.min(options.workers || navigator.hardwareConcurrency || 2, 8));
    const target = options.target === void 0 ? FREE_REG_POW_TARGET : BigInt(options.target);
    const workers = [];
    let attempts = 0, settled = false;
    const started = performance.now();
    return new Promise((resolve, reject) => {
      const stop = () => {
        for (const worker of workers) worker.terminate();
      };
      const abort = () => {
        if (settled) return;
        settled = true;
        stop();
        reject(new DOMException("Registration PoW cancelled", "AbortError"));
      };
      if (options.signal) {
        if (options.signal.aborted) {
          abort();
          return;
        }
        options.signal.addEventListener("abort", abort, { once: true });
      }
      for (let index = 0; index < workerCount; ++index) {
        const worker = new Worker("workers/yespower-worker.js");
        workers.push(worker);
        worker.onmessage = (event) => {
          if (settled) return;
          if (event.data.type === "progress") {
            attempts += event.data.attempts;
            if (options.onProgress) options.onProgress({ attempts, elapsedMs: performance.now() - started, workers: workerCount });
          } else if (event.data.type === "found") {
            settled = true;
            stop();
            resolve(BigInt(event.data.nonce));
          } else if (event.data.type === "error") {
            settled = true;
            stop();
            reject(new Error(event.data.error));
          }
        };
        worker.onerror = (event) => {
          if (settled) return;
          settled = true;
          stop();
          reject(new Error(event.message || "yespower worker failed"));
        };
        worker.postMessage({
          type: "start",
          prefix: prefix.slice().buffer,
          start: index.toString(),
          stride: workerCount.toString(),
          target: target.toString()
        });
      }
    });
  }
  return __toCommonJS(discrete_runtime_entry_exports);
})();
/*! Bundled license information:

@noble/curves/utils.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/post-quantum/utils.js:
@noble/post-quantum/_crystals.js:
@noble/post-quantum/ml-dsa.js:
@noble/post-quantum/ml-kem.js:
  (*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) *)

@noble/ciphers/utils.js:
  (*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) *)
*/
