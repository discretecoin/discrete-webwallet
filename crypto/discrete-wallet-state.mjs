import {
  calculateNullifier, recognizesCoinbaseOutput, scanPqOutput, transactionInputsHash,
} from './discrete-protocol.mjs';

const hexToBytes = value => {
  if (typeof value !== 'string' || value.length % 2 !== 0) throw new TypeError('invalid hex field');
  return Uint8Array.from(value.match(/../g) || [], byte => parseInt(byte, 16));
};
const bytesToHex = value => Array.from(value, byte => byte.toString(16).padStart(2, '0')).join('');
const amount = value => {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new RangeError('unsafe JSON amount');
  return BigInt(value);
};

function pqInputs(transaction) {
  return (transaction.vin || []).filter(input => input.type === '10').map(input => ({
    prevTxid: hexToBytes(input.value.prev_txid),
    prevOutIndex: Number(input.value.prev_out_index),
    authPublicKey: hexToBytes(input.value.auth_pub),
    rho: hexToBytes(input.value.rho_reveal),
  }));
}

export class DiscreteWalletState {
  constructor(startHeight = 0) {
    this.reset(startHeight);
  }

  reset(startHeight = 0) {
    const height = Number(startHeight);
    if (!Number.isSafeInteger(height) || height < 0 || height > 0xffffffff) {
      throw new RangeError('wallet start height is out of range');
    }
    this.height = height;
    this.tipHash = null;
    this.outputs = [];
    this.history = [];
    this.chain = [];
    this._nullifiers = new Map();
  }

  static fromJSON(raw) {
    const state = new DiscreteWalletState();
    state.height = Number(raw.height || 0);
    state.tipHash = raw.tipHash || null;
    state.outputs = (raw.outputs || []).map(output => ({ ...output,
      amount: BigInt(output.amount), rho: hexToBytes(output.rho), nullifier: output.nullifier,
    }));
    state.history = (raw.history || []).map(row => ({ ...row,
      credited: BigInt(row.credited), debited: BigInt(row.debited),
    }));
    state.chain = raw.chain || [];
    state.outputs.forEach((output, index) => state._nullifiers.set(output.nullifier, index));
    return state;
  }

  toJSON() {
    return {
      height: this.height,
      tipHash: this.tipHash,
      outputs: this.outputs.map(output => ({ ...output,
        amount: output.amount.toString(), rho: bytesToHex(output.rho),
      })),
      history: this.history.map(row => ({ ...row,
        credited: row.credited.toString(), debited: row.debited.toString(),
      })),
      chain: this.chain,
    };
  }

  applyBlock(block, keys) {
    if (this.tipHash !== null && block.previous_hash !== this.tipHash) {
      throw new Error(`wallet chain discontinuity at height ${block.height}`);
    }
    if (Number(block.height) !== this.height) {
      throw new Error(`expected wallet block ${this.height}, received ${block.height}`);
    }
    const journal = { height: Number(block.height), hash: block.hash, previousHash: block.previous_hash,
      created: [], spent: [], historyCount: 0 };
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
      const nullifier = bytesToHex(calculateNullifier(
        input.authPublicKey, input.rho, input.prevTxid, input.prevOutIndex));
      const ownedIndex = this._nullifiers.get(nullifier);
      if (ownedIndex === undefined) continue;
      const owned = this.outputs[ownedIndex];
      if (!owned.spent) {
        if (journal) journal.spent.push({ index: ownedIndex, spent: owned.spent,
          spentHeight: owned.spentHeight, spentTransactionHash: owned.spentTransactionHash });
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
      if (target.type === '10') {
        rho = scanPqOutput({
          outputIndex,
          amount: amount(wire.amount),
          kemCiphertext: hexToBytes(data.kem_ct),
          encryptedPayload: hexToBytes(data.enc_payload),
          spendCommit: hexToBytes(data.spend_commit),
        }, inputHash, keys.viewSecretKey, keys.spendPublicKey)?.rho || null;
      } else if (target.type === '11') {
        rho = recognizesCoinbaseOutput(hexToBytes(data.spend_commit), keys.spendPublicKey,
          Number(block.height), outputIndex);
      }
      if (rho === null) continue;

      const nullifier = bytesToHex(calculateNullifier(
        keys.spendPublicKey, rho, hexToBytes(entry.hash), outputIndex));
      if (this._nullifiers.has(nullifier)) continue;
      const owned = {
        transactionHash: entry.hash,
        outputIndex,
        amount: amount(wire.amount),
        unlockHeight: Number(wire.unlock_height || 0),
        blockHeight: Number(block.height),
        rho,
        nullifier,
        spent: false,
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
        debited,
      });
      if (journal) journal.historyCount++;
    }
  }

  rollbackToHeight(height) {
    while (this.height > height) {
      const journal = this.chain.pop();
      if (!journal) throw new Error('wallet rollback journal is incomplete');
      this.history.splice(this.history.length - journal.historyCount, journal.historyCount);
      for (let i = journal.created.length - 1; i >= 0; --i) {
        const nullifier = journal.created[i];
        const outputIndex = this._nullifiers.get(nullifier);
        if (outputIndex !== this.outputs.length - 1) throw new Error('wallet output journal is corrupt');
        this.outputs.pop();
        this._nullifiers.delete(nullifier);
      }
      for (let i = journal.spent.length - 1; i >= 0; --i) {
        const prior = journal.spent[i];
        const output = this.outputs[prior.index];
        output.spent = prior.spent;
        if (prior.spentHeight === undefined) delete output.spentHeight;
        else output.spentHeight = prior.spentHeight;
        if (prior.spentTransactionHash === undefined) delete output.spentTransactionHash;
        else output.spentTransactionHash = prior.spentTransactionHash;
      }
      this.height = journal.height;
      this.tipHash = journal.previousHash;
    }
  }

  previewMempool(entries, keys, timestamp = Math.floor(Date.now() / 1000)) {
    const overlay = DiscreteWalletState.fromJSON(this.toJSON());
    const pseudoBlock = { height: overlay.height, timestamp };
    for (const entry of entries) overlay.applyTransaction(entry, pseudoBlock, keys);
    return overlay;
  }

  balance() {
    return this.outputs.reduce((sum, output) => output.spent ? sum : sum + output.amount, 0n);
  }

  spendableBalance(chainHeight) {
    return this.outputs.reduce((sum, output) =>
      output.spent || output.unlockHeight > chainHeight ? sum : sum + output.amount, 0n);
  }
}
