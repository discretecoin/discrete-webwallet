# Discrete web wallet port

This repository is being ported from `karbo-webwallet-js`. The inherited UI,
storage, routing, and deployment code are a starting point only; Karbo's
CryptoNote transaction and key logic is not compatible with Discrete.

## Architecture direction

- Keep all wallet secrets and transaction construction in the browser.
- Use the standards-aligned `@noble/post-quantum` JavaScript implementation for
  ML-DSA-65 and ML-KEM-768, behind a small Discrete-specific adapter.
- Differential-test Noble in both directions against Open Quantum Safe's
  liboqs/WASM implementation; the latter is a development-only test oracle and
  is not shipped in the wallet bundle.
- Store only the encrypted master seed and derive expanded keys on demand.
- Treat daemon responses as untrusted input and validate all encodings locally.
- Add a wallet-scanning RPC that returns canonical serialized transactions plus
  block metadata and output indexes required by the scanner.

## Port phases

1. Import and rebrand the Karbo application shell.
2. Specify the crypto API and daemon scan payload from Discrete's native wallet.
3. Implement seed derivation, addresses, output scanning, and nullifiers.
4. Implement transaction construction/signing and raw transaction submission.
5. Add cross-implementation vectors against Discrete's native C++ backend.
6. Remove all inherited CryptoNote/Ed25519 transaction code.

The application must not be advertised as a working Discrete wallet until
phases 2-5 have interoperability tests against the node.
