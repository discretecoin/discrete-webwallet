import { accountRegistrationExtra, buildSignedTransaction } from '../src/crypto/discrete-transaction.mjs';
import { deriveWalletKeys, encodeAddress, parseAccountNumber } from '../src/crypto/discrete-wallet-keys.mjs';
import { DiscreteWalletState } from '../src/crypto/discrete-wallet-state.mjs';

const base = process.env.DISCRETE_E2E_RPC || 'http://127.0.0.1:19331/';
const hex = bytes => Buffer.from(bytes).toString('hex');
const rpc = async (path, body) => {
  const response = await fetch(new URL(path, base), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
};
const waitForHeight = async target => {
  for (let i = 0; i < 240; ++i) {
    const info = await fetch(new URL('getheight', base)).then(r => r.json());
    if (info.height >= target) return info.height;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`timed out mining height ${target}`);
};
const currentHeight = async () => fetch(new URL('getheight', base)).then(r => r.json()).then(info => info.height);

const senderSeed = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const recipientSeed = Uint8Array.from({ length: 32 }, (_, i) => 255 - i);
const senderKeys = deriveWalletKeys(senderSeed);
const recipientKeys = deriveWalletKeys(recipientSeed);
const senderAddress = encodeAddress(senderKeys.viewPublicKey, senderKeys.spendPublicKey, 0x3445db, true);
if (!senderAddress.startsWith('tdisc1')) throw new Error('address derivation failed');

const mining = await rpc('start_mining', { miner_spend_key: hex(senderSeed), miner_view_key: '', threads_count: 4 });
if (mining.status !== 'OK') throw new Error(`mining did not start: ${JSON.stringify(mining)}`);
await waitForHeight(Math.max(12, await currentHeight()));
await rpc('stop_mining', {});

const sync = await rpc('get_wallet_sync_data', { start_height: 0, block_count: 100, include_miner_txs: true });
const sender = new DiscreteWalletState();
for (const block of sync.blocks) sender.applyBlock(block, senderKeys);
const spendable = sender.outputs.filter(output => !output.spent && output.unlockHeight <= sync.top_height);
if (spendable.length === 0) throw new Error('mined reward was not recognized');
const input = spendable[0];
const fee = 1n;
const sendAmount = input.amount - fee;
const built = buildSignedTransaction({ inputs: [input], destinations: [{
  viewPublicKey: recipientKeys.viewPublicKey, spendPublicKey: recipientKeys.spendPublicKey, amount: sendAmount,
}], fee, spendPublicKey: senderKeys.spendPublicKey, spendSecretKey: senderKeys.spendSecretKey });
const submitted = await rpc('sendrawtransaction', { tx_as_hex: hex(built.bytes) });
if (submitted.status !== 'OK') throw new Error(`transaction rejected: ${JSON.stringify(submitted)}`);

const confirmationTarget = (await currentHeight()) + 1;
await rpc('start_mining', { miner_spend_key: hex(senderSeed), miner_view_key: '', threads_count: 4 });
await waitForHeight(confirmationTarget);
await rpc('stop_mining', {});
const recipientSync = await rpc('get_wallet_sync_data', { start_height: 0, block_count: 100, include_miner_txs: true });
const recipient = new DiscreteWalletState();
for (const block of recipientSync.blocks) recipient.applyBlock(block, recipientKeys);
if (recipient.balance() !== sendAmount) throw new Error(`recipient balance mismatch: ${recipient.balance()} != ${sendAmount}`);

const registrationInput = recipient.outputs.find(output => !output.spent && output.unlockHeight <= recipientSync.top_height);
if (!registrationInput) throw new Error('recipient output unavailable for paid registration');
const registrationExtra = accountRegistrationExtra(recipientKeys.viewPublicKey, recipientKeys.spendPublicKey);
const registrationChange = registrationInput.amount - fee - 1n;
const registrationDestinations = [{ viewPublicKey: recipientKeys.viewPublicKey, spendPublicKey: recipientKeys.spendPublicKey, amount: 1n }];
if (registrationChange > 0n) registrationDestinations.push({
  viewPublicKey: recipientKeys.viewPublicKey, spendPublicKey: recipientKeys.spendPublicKey, amount: registrationChange,
});
const registrationTx = buildSignedTransaction({ inputs: [registrationInput], destinations: registrationDestinations,
  fee, extra: registrationExtra, spendPublicKey: recipientKeys.spendPublicKey, spendSecretKey: recipientKeys.spendSecretKey });
const registrationSubmitted = await rpc('sendrawtransaction', { tx_as_hex: hex(registrationTx.bytes) });
if (registrationSubmitted.status !== 'OK') throw new Error(`registration rejected: ${JSON.stringify(registrationSubmitted)}`);
const registrationHeight = (await currentHeight()) + 1;
await rpc('start_mining', { miner_spend_key: hex(senderSeed), miner_view_key: '', threads_count: 4 });
await waitForHeight(registrationHeight);
await rpc('stop_mining', {});

const accountStatus = await rpc('json_rpc', { jsonrpc: '2.0', id: 1, method: 'getaccountnumber', params: {
  view_pub: hex(recipientKeys.viewPublicKey), spend_pub: hex(recipientKeys.spendPublicKey),
} });
if (!accountStatus.result?.registered) throw new Error(`account was not registered: ${JSON.stringify(accountStatus)}`);
const accountNumber = accountStatus.result.account_number;
const parsedAccountNumber = parseAccountNumber(accountNumber);
if (parsedAccountNumber.blockHeight !== accountStatus.result.block_height ||
    parsedAccountNumber.transactionIndex !== accountStatus.result.tx_index) {
  throw new Error(`daemon returned inconsistent account number: ${JSON.stringify(accountStatus)}`);
}
const resolved = await rpc('json_rpc', { jsonrpc: '2.0', id: 2, method: 'resolveaccountnumber', params: {
  block_height: accountStatus.result.block_height, tx_index: accountStatus.result.tx_index,
} });
if (resolved.result?.view_pub !== hex(recipientKeys.viewPublicKey) || resolved.result?.spend_pub !== hex(recipientKeys.spendPublicKey)) {
  throw new Error(`account resolution mismatch: ${JSON.stringify(resolved)}`);
}
console.log(JSON.stringify({ senderMinedOutputs: sender.outputs.length, sent: sendAmount.toString(),
  recipientBalance: recipient.balance().toString(), accountNumber }));
