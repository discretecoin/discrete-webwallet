# Discrete web wallet

Client-side browser wallet for Discrete, ported from
[`karbo-webwallet-js`](https://github.com/Karbovanets/karbo-webwallet-js).

> **Development status:** the application shell has been imported, but the
> inherited Karbo transaction engine is incompatible with Discrete and is being
> replaced by a standards-aligned JavaScript ML-DSA-65 + ML-KEM-768 core based
> on `@noble/post-quantum`. Do not use this build with
> real keys or funds.

See [PORTING.md](PORTING.md) for the implementation plan and trust boundaries.

## Development

```powershell
npm install
npm run build:web
```
