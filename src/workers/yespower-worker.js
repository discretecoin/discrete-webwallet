/* global createYespowerModule */
importScripts('yespower-module.js');

let stopped = false;

self.onmessage = async event => {
  if (event.data && event.data.type === 'stop') {
    stopped = true;
    return;
  }
  if (!event.data || event.data.type !== 'start') return;
  try {
    const module = await createYespowerModule();
    const prefix = new Uint8Array(event.data.prefix);
    const pointer = module._malloc(prefix.length);
    module.HEAPU8.set(prefix, pointer);
    const stride = BigInt(event.data.stride);
    const batchSize = 128;
    let start = BigInt(event.data.start);
    while (!stopped) {
      const nonce = module._grind_free_reg_pow(pointer, prefix.length, start, stride, batchSize, BigInt(event.data.target));
      if (nonce !== -1n) {
        self.postMessage({type: 'found', nonce: nonce.toString()});
        break;
      }
      start += stride * BigInt(batchSize);
      self.postMessage({type: 'progress', attempts: batchSize});
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    module._free(pointer);
  } catch (error) {
    self.postMessage({type: 'error', error: String(error)});
  }
};
