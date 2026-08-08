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

### WARNING!

*If you created a wallet in the web wallet, check your recovery phrase.** Open
**Export → Check my recovery phrase** and paste the words you wrote down. The
check runs in your browser and tells you whether the phrase still opens your
wallet and whether it restores in the daemon and desktop wallets. Your funds are
not at risk in the web wallet either way — this is about whether your written
backup works anywhere else.

- Spanish, Portuguese and Japanese recovery phrases now use the same word lists
  and prefix lengths as the CLI wallets, so they restore correctly. Previously
  Spanish differed by 34 words, Portuguese by 3 words plus a prefix-length
  mismatch, and Japanese matched on words but disagreed on the checksum word.
- Phrases minted in those languages before this update, and in Electrum,
  Esperanto or Lojban, still import into the web wallet and still open your
  wallet. They cannot be restored elsewhere — re-export in English and keep that
  phrase instead.
- Wallet creation could pick the Electrum word list purely from a Greek browser
  locale, producing a 24-word phrase with no checksum that restored nowhere. Only
  word lists shared with the CLI wallets can be minted now.
- Fixed: automatic language detection could identify a phrase as the wrong
  language and silently return a different seed. Detection now re-encodes and
  requires an exact match.
- Fixed: Portuguese phrases could fail to decode back to their own seed, because
  that list had 1626 words but only 1597 unique 3-character prefixes.
- Phrases pasted with newlines, tabs or extra spaces are accepted, matching the CLI
