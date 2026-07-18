const concat = (...parts) => {
  const output = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
};

const hexBytes = value => typeof value === 'string'
  ? Uint8Array.from(value.match(/../g) || [], byte => parseInt(byte, 16))
  : value;

export const FREE_REG_POW_TARGET = 0x00007fffffffffffn;
export const FREE_REG_POW_DOMAIN = new TextEncoder().encode('discrete-pq-free-reg-pow-v1');

export function freeRegistrationPowPrefix(viewPublicKey, spendPublicKey, referenceBlockHash) {
  const hash = hexBytes(referenceBlockHash);
  if (!(viewPublicKey instanceof Uint8Array) || viewPublicKey.length !== 1184) throw new Error('invalid ML-KEM-768 public key');
  if (!(spendPublicKey instanceof Uint8Array) || spendPublicKey.length !== 1952) throw new Error('invalid ML-DSA-65 public key');
  if (!(hash instanceof Uint8Array) || hash.length !== 32) throw new Error('invalid reference block hash');
  return concat(FREE_REG_POW_DOMAIN, viewPublicKey, spendPublicKey, hash);
}

export function grindFreeRegistrationPow(viewPublicKey, spendPublicKey, referenceBlockHash, options = {}) {
  const prefix = freeRegistrationPowPrefix(viewPublicKey, spendPublicKey, referenceBlockHash);
  const workerCount = Math.max(1, Math.min(options.workers || navigator.hardwareConcurrency || 2, 8));
  const target = options.target === undefined ? FREE_REG_POW_TARGET : BigInt(options.target);
  const workers = [];
  let attempts = 0, settled = false;
  const started = performance.now();

  return new Promise((resolve, reject) => {
    const stop = () => { for (const worker of workers) worker.terminate(); };
    const abort = () => {
      if (settled) return;
      settled = true;
      stop();
      reject(new DOMException('Registration PoW cancelled', 'AbortError'));
    };
    if (options.signal) {
      if (options.signal.aborted) { abort(); return; }
      options.signal.addEventListener('abort', abort, {once: true});
    }
    for (let index = 0; index < workerCount; ++index) {
      const worker = new Worker('workers/yespower-worker.js');
      workers.push(worker);
      worker.onmessage = event => {
        if (settled) return;
        if (event.data.type === 'progress') {
          attempts += event.data.attempts;
          if (options.onProgress) options.onProgress({attempts, elapsedMs: performance.now() - started, workers: workerCount});
        } else if (event.data.type === 'found') {
          settled = true;
          stop();
          resolve(BigInt(event.data.nonce));
        } else if (event.data.type === 'error') {
          settled = true;
          stop();
          reject(new Error(event.data.error));
        }
      };
      worker.onerror = event => {
        if (settled) return;
        settled = true;
        stop();
        reject(new Error(event.message || 'yespower worker failed'));
      };
      worker.postMessage({type: 'start', prefix: prefix.slice().buffer, start: index.toString(),
        stride: workerCount.toString(), target: target.toString()});
    }
  });
}
