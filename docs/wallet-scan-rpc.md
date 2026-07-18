# Wallet scan RPC requirements

The existing Karbo wallet expects CryptoNote explorer-shaped transactions. A
Discrete scanner instead needs the exact PQ transaction wire data. The daemon
endpoint should return contiguous blocks and canonical transaction blobs:

```json
{
  "start_height": 1200,
  "block_count": 100,
  "include_miner_txs": true
}
```

```json
{
  "status": "OK",
  "top_height": 9000,
  "blocks": [{
    "height": 1200,
    "hash": "<32-byte hex>",
    "previous_hash": "<32-byte hex>",
    "timestamp": 0,
    "transactions": [{
      "hash": "<32-byte hex>",
      "transaction": "<standard TransactionPrefix JSON object>",
      "coinbase": false
    }]
  }]
}
```

`transaction` includes the prefix and every `PqInput`, `PqOutput` or
`CoinbaseOutput`. Signatures are intentionally omitted: both the native
`BlockchainSynchronizer` and browser scanner need transaction hashes and
prefixes, not signatures. PQ inputs use explicit outpoints, so global output
indexes are also omitted. Block hash linkage lets the wallet detect reorgs. The
server caps `block_count` using the normal RPC block-list limit.

`/get_wallet_sync_data` is the browser-friendly equivalent of the native
`queryBlocksLite` synchronization path. The Karbo-era
`/get_raw_transactions_by_heights`, `getrawtransactionsbyheights`, and
`/get_o_indexes(.bin)` RPC methods are intentionally not served by Discrete.
The raw transaction-pool response uses the same compact transaction-prefix
shape and likewise contains no global indexes.
