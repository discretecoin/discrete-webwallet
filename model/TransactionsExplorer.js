/**
 *	   Copyright (c) 2018, Gnock
 *     Copyright (c) 2018-2020, ExploShot
 *     Copyright (c) 2018-2020, The Qwertycoin Project
 *     Copyright (c) 2018-2020, The Masari Project
 *     Copyright (c) 2014-2018, MyMonero.com
 *
 *     All rights reserved.
 *     Redistribution and use in source and binary forms, with or without modification,
 *     are permitted provided that the following conditions are met:
 *
 *     ==> Redistributions of source code must retain the above copyright notice,
 *         this list of conditions and the following disclaimer.
 *     ==> Redistributions in binary form must reproduce the above copyright notice,
 *         this list of conditions and the following disclaimer in the documentation
 *         and/or other materials provided with the distribution.
 *     ==> Neither the name of Qwertycoin nor the names of its contributors
 *         may be used to endorse or promote products derived from this software
 *          without specific prior written permission.
 *
 *     THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 *     "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 *     LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 *     A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 *     CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *     EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *     PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *     PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 *     LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *     NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 *     SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
define(["require", "exports", "./Transaction", "./MathUtil", "./Cn"], function (require, exports, Transaction_1, MathUtil_1, Cn_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TransactionsExplorer = exports.TX_EXTRA_NONCE_ENCRYPTED_PAYMENT_ID = exports.TX_EXTRA_NONCE_PAYMENT_ID = exports.TX_EXTRA_MYSTERIOUS_MINERGATE_TAG = exports.TX_EXTRA_TAG_ACCOUNT_REGISTRATION = exports.TX_EXTRA_MERGE_MINING_TAG = exports.TX_EXTRA_NONCE = exports.TX_EXTRA_TAG_PUBKEY = exports.TX_EXTRA_TAG_PADDING = exports.TX_EXTRA_NONCE_MAX_COUNT = exports.TX_EXTRA_PADDING_MAX_COUNT = void 0;
    var hextobin = Cn_1.CnUtils.hextobin;
    exports.TX_EXTRA_PADDING_MAX_COUNT = 255;
    exports.TX_EXTRA_NONCE_MAX_COUNT = 255;
    exports.TX_EXTRA_TAG_PADDING = 0x00;
    exports.TX_EXTRA_TAG_PUBKEY = 0x01;
    exports.TX_EXTRA_NONCE = 0x02;
    exports.TX_EXTRA_MERGE_MINING_TAG = 0x03;
    // Karbo reuses tag 0x04 for account registration (04 <spendPub:32> <viewPub:32>).
    // Monero's "additional pubkeys" meaning of 0x04 is a subaddress feature Karbo
    // never emits, so it is intentionally not supported here.
    exports.TX_EXTRA_TAG_ACCOUNT_REGISTRATION = 0x04;
    exports.TX_EXTRA_MYSTERIOUS_MINERGATE_TAG = 0xDE;
    exports.TX_EXTRA_NONCE_PAYMENT_ID = 0x00;
    exports.TX_EXTRA_NONCE_ENCRYPTED_PAYMENT_ID = 0x01;
    var CT_MIN_MIXIN = 3;
    var CT_MAX_MIXIN = 15;
    var TransactionsExplorer = /** @class */ (function () {
        function TransactionsExplorer() {
        }
        TransactionsExplorer.isCtActivated = function (blockchainHeight) {
            var lastBlockMajorVersion = parseInt(config.lastBlockMajorVersion || '0');
            var forkHeight = new JSBigInt(typeof config.ctForkHeight !== 'undefined' ? config.ctForkHeight : '4294967294');
            if (lastBlockMajorVersion >= 6 &&
                forkHeight.compare(new JSBigInt(blockchainHeight)) > 0 &&
                typeof config.ctForkHeightTestnet !== 'undefined') {
                forkHeight = new JSBigInt(config.ctForkHeightTestnet);
            }
            return new JSBigInt(blockchainHeight).compare(forkHeight) >= 0;
        };
        TransactionsExplorer.randomOutAmountForWalletOut = function (out) {
            var ringAmount = out.ring_amount || (out.ctCommitment ? Cn_1.CnTransactions.ctConfidentialOutputAmount() : out.amount);
            return ringAmount === Cn_1.CnTransactions.ctConfidentialOutputAmount() ? Cn_1.CnTransactions.ctConfidentialOutputAmountRpc() : ringAmount;
        };
        TransactionsExplorer.alignMixOutsWithRequestedAmounts = function (lotsMixOuts, requestedAmounts) {
            var groupsByAmount = {};
            for (var _i = 0, lotsMixOuts_1 = lotsMixOuts; _i < lotsMixOuts_1.length; _i++) {
                var group = lotsMixOuts_1[_i];
                var key = Cn_1.CnTransactions.normalizeMixAmount(group.amount);
                if (typeof groupsByAmount[key] === 'undefined') {
                    groupsByAmount[key] = [];
                }
                groupsByAmount[key].push(group);
            }
            var usedByAmount = {};
            var aligned = [];
            for (var i = 0; i < requestedAmounts.length; ++i) {
                var key = Cn_1.CnTransactions.normalizeMixAmount(requestedAmounts[i]);
                var groups = groupsByAmount[key] || [];
                var selectedGroup = null;
                if (groups.length > 0) {
                    var used = usedByAmount[key] || 0;
                    selectedGroup = groups[Math.min(used, groups.length - 1)];
                    usedByAmount[key] = used + 1;
                }
                else if (lotsMixOuts.length === requestedAmounts.length &&
                    typeof lotsMixOuts[i] !== 'undefined' &&
                    Cn_1.CnTransactions.normalizeMixAmount(lotsMixOuts[i].amount) === key) {
                    selectedGroup = lotsMixOuts[i];
                }
                if (selectedGroup === null) {
                    throw 'Random outs missing amount bucket ' + requestedAmounts[i];
                }
                aligned.push({
                    amount: selectedGroup.amount,
                    outs: (selectedGroup.outs || []).slice()
                });
            }
            return aligned;
        };
        // An output is a stale CT suspect when it sits in a CT-era non-coinbase
        // tx but has incomplete CT markers. The common case is data persisted by
        // an older scanner that decoded the amount but did not store all CT fields.
        // formatWalletOutsForTx drops these from sends so we don't ship rings the
        // daemon will reject; healStaleCtOutputs (WalletWatchdog) re-fetches the
        // parent tx and re-parses it under the current scanner to repopulate them.
        TransactionsExplorer.isStaleCtOutput = function (tr, out) {
            return TransactionsExplorer.isCtActivated(tr.blockHeight)
                && !tr.is_coinbase
                && (!out.ctCommitment ||
                    !out.ctMaskedAmount ||
                    !out.ctBlinding ||
                    !out.ctRingAmount);
        };
        // Returns one entry per suspect tx (deduped by hash), regardless of how
        // many suspect outs it contains. Caller uses this to know which raw txs
        // to re-fetch and re-parse.
        TransactionsExplorer.findStaleCtSuspectTxs = function (wallet) {
            var seen = {};
            var suspects = [];
            for (var _i = 0, _a = wallet.getAll(); _i < _a.length; _i++) {
                var tr = _a[_i];
                if (tr.hash === '' || tr.blockHeight <= 0)
                    continue;
                if (seen[tr.hash])
                    continue;
                for (var _b = 0, _c = tr.outs; _b < _c.length; _b++) {
                    var out = _c[_b];
                    if (TransactionsExplorer.isStaleCtOutput(tr, out)) {
                        seen[tr.hash] = true;
                        suspects.push({ hash: tr.hash, height: tr.blockHeight });
                        break;
                    }
                }
            }
            return suspects;
        };
        TransactionsExplorer.parseExtra = function (oExtra) {
            var extra = oExtra.slice();
            var extras = [];
            var hasFoundPubKey = false;
            while (extra.length > 0) {
                var extraSize = 0;
                var startOffset = 0;
                if (extra[0] === exports.TX_EXTRA_NONCE ||
                    extra[0] === exports.TX_EXTRA_MERGE_MINING_TAG ||
                    extra[0] === exports.TX_EXTRA_MYSTERIOUS_MINERGATE_TAG) {
                    extraSize = extra[1];
                    startOffset = 2;
                }
                else if (extra[0] === exports.TX_EXTRA_TAG_PUBKEY) {
                    extraSize = 32;
                    startOffset = 1;
                    hasFoundPubKey = true;
                }
                else if (extra[0] === exports.TX_EXTRA_TAG_ACCOUNT_REGISTRATION) {
                    // Karbo account registration: 04 <spendPub:32> <viewPub:32>.
                    // Fixed 64-byte payload, no count byte. Skipping it cleanly lets
                    // the loop reach the 0x01 tx pubkey regardless of tag order
                    // (construct_ct_tx emits 04 before 01); the old additional-pubkeys
                    // reading misread spendPub[0] as a key count, overran the buffer,
                    // never found the pubkey, and parse() dropped the whole tx -
                    // hiding the spend and inflating the balance.
                    extraSize = 64;
                    startOffset = 1;
                }
                else if (extra[0] === exports.TX_EXTRA_TAG_PADDING) {
                    // this tag has to be the last in extra
                    // we do nothing with it
                    /*
    
                    let iExtra = 2;
                    let fExtras = {
                        type: extra[0],
                        data: [extra[1]]
                    };
    
                    while (extra.length > iExtra && extra[iExtra++] == 0) {
                        fExtras.data.push(0);
                    }
    
                    continue;
                    */
                }
                if (extraSize === 0) {
                    if (!hasFoundPubKey) {
                        throw 'Invalid extra size' + extra[0];
                    }
                    break;
                }
                var data = extra.slice(startOffset, startOffset + extraSize);
                extras.push({
                    type: extra[0],
                    data: data
                });
                extra = extra.slice(startOffset + extraSize);
            }
            return extras;
        };
        TransactionsExplorer.isMinerTx = function (rawTransaction) {
            if (rawTransaction.vin.length > 0 && rawTransaction.vin[0].type === 'ff') {
                return true;
            }
            return false;
        };
        TransactionsExplorer.buildDeterministicTxKeyInputs = function (rawTransaction) {
            var inputs = [];
            for (var _i = 0, _a = rawTransaction.vin; _i < _a.length; _i++) {
                var rawVin = _a[_i];
                if (rawVin.type === '04' || rawVin.type === 'confidential_input' || rawVin.type === 'input_to_confidential') {
                    if (typeof rawVin.value === 'undefined' || typeof rawVin.value.k_image !== 'string') {
                        return null;
                    }
                    var value = rawVin.value;
                    // Prefer the per-member ring_members layout from the mixed-ring
                    // schema; fall back to the legacy single-bucket (ring_amount +
                    // ring_offsets) layout for any old daemon RPC responses still
                    // in flight during the rollout.
                    var ringMembers = [];
                    if (Array.isArray(value.ring_members)) {
                        for (var _b = 0, _c = value.ring_members; _b < _c.length; _b++) {
                            var m = _c[_b];
                            ringMembers.push({
                                amount: '' + (m.amount !== undefined ? m.amount : (m.ringAmount || Cn_1.CnTransactions.ctConfidentialOutputAmount())),
                                output_index: m.output_index !== undefined ? m.output_index : m.outputIndex
                            });
                        }
                    }
                    else {
                        var legacyBucket = '' + (value.ring_amount || value.ringAmount || Cn_1.CnTransactions.ctConfidentialOutputAmount());
                        var legacyOffsets = (value.ring_offsets || value.ringOutputIndexes || []);
                        for (var _d = 0, legacyOffsets_1 = legacyOffsets; _d < legacyOffsets_1.length; _d++) {
                            var offset = legacyOffsets_1[_d];
                            ringMembers.push({ amount: legacyBucket, output_index: offset });
                        }
                    }
                    inputs.push({
                        type: 'confidential_input',
                        ring_members: ringMembers,
                        ring_pubkeys: (value.ring_pubkeys || value.ringPubkeys || []).slice(),
                        ring_commits: (value.ring_commits || value.ringCommitments || []).slice(),
                        pseudo_commit: value.pseudo_commit || value.pseudoCommitment || '',
                        k_image: value.k_image
                    });
                    continue;
                }
                if (rawVin.type !== '02' && rawVin.type !== 'input_to_key') {
                    return null;
                }
                if (typeof rawVin.value === 'undefined' || !Array.isArray(rawVin.value.key_offsets) || typeof rawVin.value.k_image !== 'string') {
                    return null;
                }
                inputs.push({
                    type: 'input_to_key',
                    amount: '' + rawVin.value.amount,
                    k_image: rawVin.value.k_image,
                    key_offsets: rawVin.value.key_offsets.slice()
                });
            }
            return inputs.length > 0 ? inputs : null;
        };
        TransactionsExplorer.deriveDeterministicTxPrivateKey = function (rawTransaction, wallet, txPubKey) {
            if (txPubKey === void 0) { txPubKey = ''; }
            if (wallet.keys.priv.view === '') {
                return null;
            }
            var inputs = this.buildDeterministicTxKeyInputs(rawTransaction);
            if (inputs === null) {
                return null;
            }
            try {
                var txKeys = Cn_1.CnTransactions.generate_deterministic_tx_keys(inputs, wallet.keys.priv.view);
                return {
                    txPrivKey: txKeys.sec,
                    txPubKeyMatches: txPubKey !== '' && txKeys.pub === txPubKey
                };
            }
            catch (e) {
                return null;
            }
        };
        TransactionsExplorer.parse = function (rawTransaction, wallet) {
            var transaction = null;
            var tx_pub_key = '';
            var paymentId = null;
            var txExtras = [];
            try {
                var hexExtra = [];
                var uint8Array = hextobin(rawTransaction.extra);
                for (var i = 0; i < uint8Array.byteLength; i++) {
                    hexExtra[i] = uint8Array[i];
                }
                txExtras = this.parseExtra(hexExtra);
            }
            catch (e) {
                console.error(e);
                console.log('Error when scanning transaction on block ' + rawTransaction.height, rawTransaction);
                return null;
            }
            for (var _i = 0, txExtras_1 = txExtras; _i < txExtras_1.length; _i++) {
                var extra = txExtras_1[_i];
                if (extra.type === exports.TX_EXTRA_TAG_PUBKEY) {
                    for (var i = 0; i < 32; ++i) {
                        tx_pub_key += String.fromCharCode(extra.data[i]);
                    }
                    break;
                }
            }
            if (tx_pub_key === '') {
                console.log("tx_pub_key === null");
                return null;
            }
            tx_pub_key = Cn_1.CnUtils.bintohex(tx_pub_key);
            var encryptedPaymentId = null;
            for (var _a = 0, txExtras_2 = txExtras; _a < txExtras_2.length; _a++) {
                var extra = txExtras_2[_a];
                if (extra.type === exports.TX_EXTRA_NONCE) {
                    if (extra.data[0] === exports.TX_EXTRA_NONCE_PAYMENT_ID) {
                        paymentId = '';
                        for (var i = 1; i < extra.data.length; ++i) {
                            paymentId += String.fromCharCode(extra.data[i]);
                        }
                        paymentId = Cn_1.CnUtils.bintohex(paymentId);
                        break;
                    }
                    else if (extra.data[0] === exports.TX_EXTRA_NONCE_ENCRYPTED_PAYMENT_ID) {
                        encryptedPaymentId = '';
                        for (var i = 1; i < extra.data.length; ++i) {
                            encryptedPaymentId += String.fromCharCode(extra.data[i]);
                        }
                        encryptedPaymentId = Cn_1.CnUtils.bintohex(encryptedPaymentId);
                        break;
                    }
                }
            }
            var derivation = null;
            try {
                derivation = Cn_1.CnNativeBride.generate_key_derivation(tx_pub_key, wallet.keys.priv.view);
            }
            catch (e) {
                console.log('UNABLE TO CREATE DERIVATION', e);
                return null;
            }
            var outs = [];
            var ins = [];
            var isCtTx = rawTransaction.version === 2;
            for (var iOut = 0; iOut < rawTransaction.vout.length; iOut++) {
                var out = rawTransaction.vout[iOut];
                var txout_k = out.target.data || out.target || {};
                var outKey = txout_k.key || txout_k.target_key || txout_k.targetKey;
                var outCommitment = txout_k.commitment || txout_k.commit || '';
                var outMaskedAmount = txout_k.masked_amount || txout_k.maskedAmount || '';
                var amount = 0;
                try {
                    amount = out.amount;
                }
                catch (e) {
                    console.error(e);
                    continue;
                }
                var output_idx_in_tx = iOut;
                var generated_tx_pubkey = Cn_1.CnNativeBride.derive_public_key(derivation, output_idx_in_tx, wallet.keys.pub.spend);
                // check if generated public key matches the current output's key
                var mine_output = (outKey == generated_tx_pubkey);
                if (mine_output) {
                    var ctBlinding = '';
                    if (isCtTx) {
                        if (outMaskedAmount === '' || outCommitment === '') {
                            console.warn('Skipping CT output with missing commitment or masked amount', rawTransaction.hash, iOut);
                            continue;
                        }
                        var decodedCt = Cn_1.CnTransactions.decode_ct_amount(outMaskedAmount, outCommitment, derivation, output_idx_in_tx);
                        amount = decodedCt.amount.toJSValue();
                        ctBlinding = decodedCt.blinding;
                    }
                    var transactionOut = new Transaction_1.TransactionOut();
                    if (typeof rawTransaction.global_index_start !== 'undefined')
                        transactionOut.globalIndex = rawTransaction.output_indexes[output_idx_in_tx];
                    else
                        transactionOut.globalIndex = output_idx_in_tx;
                    transactionOut.amount = amount;
                    transactionOut.pubKey = outKey;
                    transactionOut.outputIdx = output_idx_in_tx;
                    if (isCtTx) {
                        transactionOut.ctCommitment = outCommitment;
                        transactionOut.ctMaskedAmount = outMaskedAmount;
                        transactionOut.ctBlinding = ctBlinding;
                        transactionOut.ctRingAmount = Cn_1.CnTransactions.ctConfidentialOutputAmount();
                    }
                    /*
                    if (!minerTx) {
                        transactionOut.rtcOutPk = rawTransaction.rct_signatures.outPk[output_idx_in_tx];
                        transactionOut.rtcMask = rawTransaction.rct_signatures.ecdhInfo[output_idx_in_tx].mask;
                        transactionOut.rtcAmount = rawTransaction.rct_signatures.ecdhInfo[output_idx_in_tx].amount;
                    }
                    */
                    if (wallet.keys.priv.spend !== null && wallet.keys.priv.spend !== '') {
                        var m_key_image = Cn_1.CnTransactions.generate_key_image_helper({
                            view_secret_key: wallet.keys.priv.view,
                            spend_secret_key: wallet.keys.priv.spend,
                            public_spend_key: wallet.keys.pub.spend,
                        }, tx_pub_key, output_idx_in_tx, derivation);
                        transactionOut.keyImage = m_key_image.key_image;
                        transactionOut.ephemeralPub = m_key_image.ephemeral_pub;
                    }
                    outs.push(transactionOut);
                    //if (minerTx)
                    //    break;
                } //  if (mine_output)
            }
            //check if no read only wallet
            if (wallet.keys.priv.spend !== null && wallet.keys.priv.spend !== '') {
                var keyImages = wallet.getTransactionKeyImages();
                for (var iIn = 0; iIn < rawTransaction.vin.length; ++iIn) {
                    var vin = rawTransaction.vin[iIn];
                    if (vin.value && keyImages.indexOf(vin.value.k_image) !== -1) {
                        //console.log('found in', vin);
                        var walletOuts = wallet.getAllOuts();
                        for (var _b = 0, walletOuts_1 = walletOuts; _b < walletOuts_1.length; _b++) {
                            var ut = walletOuts_1[_b];
                            if (ut.keyImage == vin.value.k_image) {
                                // ins.push(vin.key.k_image);
                                // sumIns += ut.amount;
                                var transactionIn = new Transaction_1.TransactionIn();
                                transactionIn.amount = ut.amount;
                                transactionIn.keyImage = ut.keyImage;
                                ins.push(transactionIn);
                                // console.log(ut);
                                break;
                            }
                        }
                    }
                }
            }
            else {
                var txOutIndexes = wallet.getTransactionOutIndexes();
                for (var iIn = 0; iIn < rawTransaction.vin.length; ++iIn) {
                    var vin = rawTransaction.vin[iIn];
                    if (!vin.value)
                        continue;
                    var vinValue = vin.value;
                    // Two sources of ring offsets:
                    //   (a) New per-member schema: vin.ring_members[k].output_index
                    //       is *absolute* — no delta decoding needed. Mixed-bucket
                    //       rings live here too, but for the "is this output of
                    //       mine spent" heuristic we don't need the bucket; an
                    //       index match alone is suggestive enough.
                    //   (b) Legacy single-bucket schema: vin.ring_offsets /
                    //       ringOutputIndexes / key_offsets are *relative* and
                    //       need delta decoding.
                    var absoluteOffets = [];
                    if (Array.isArray(vinValue.ring_members) && vinValue.ring_members.length > 0) {
                        for (var _c = 0, _d = vinValue.ring_members; _c < _d.length; _c++) {
                            var m = _d[_c];
                            var idx = m.output_index !== undefined ? m.output_index : m.outputIndex;
                            if (idx !== undefined) {
                                absoluteOffets.push(new JSBigInt(idx).toJSValue());
                            }
                        }
                    }
                    else {
                        var relativeOffsets = (vinValue.key_offsets || vinValue.ring_offsets || vinValue.ringOutputIndexes || []);
                        absoluteOffets = relativeOffsets.map(function (offset) { return new JSBigInt(offset).toJSValue(); });
                        for (var i = 1; i < absoluteOffets.length; ++i) {
                            absoluteOffets[i] = new JSBigInt(absoluteOffets[i]).add(absoluteOffets[i - 1]).toJSValue();
                        }
                    }
                    var ownTx = -1;
                    for (var _e = 0, absoluteOffets_1 = absoluteOffets; _e < absoluteOffets_1.length; _e++) {
                        var index = absoluteOffets_1[_e];
                        if (txOutIndexes.indexOf(index) !== -1) {
                            ownTx = index;
                            break;
                        }
                    }
                    if (ownTx !== -1) {
                        var txOut = wallet.getOutWithGlobalIndex(ownTx);
                        if (txOut !== null) {
                            var transactionIn = new Transaction_1.TransactionIn();
                            transactionIn.amount = -txOut.amount;
                            transactionIn.keyImage = txOut.keyImage;
                            ins.push(transactionIn);
                        }
                    }
                }
            }
            if (outs.length > 0 || ins.length) {
                transaction = new Transaction_1.Transaction();
                if (typeof rawTransaction.height !== 'undefined')
                    transaction.blockHeight = rawTransaction.height;
                if (typeof rawTransaction.ts !== 'undefined')
                    transaction.timestamp = rawTransaction.ts;
                if (typeof rawTransaction.hash !== 'undefined')
                    transaction.hash = rawTransaction.hash;
                if (typeof rawTransaction.block_hash !== 'undefined')
                    transaction.blockHash = rawTransaction.block_hash;
                transaction.txPubKey = tx_pub_key;
                if (paymentId !== null)
                    transaction.paymentId = paymentId;
                if (encryptedPaymentId !== null) {
                    transaction.paymentId = Cn_1.Cn.decrypt_payment_id(encryptedPaymentId, tx_pub_key, wallet.keys.priv.view);
                }
                if (rawTransaction.vin[0].type === 'ff') {
                    transaction.fee = 0;
                }
                else {
                    transaction.fee = rawTransaction.fee;
                }
                transaction.outs = outs;
                transaction.ins = ins;
                transaction.is_coinbase = rawTransaction.vin[0].type === 'ff';
                if (transaction.hash !== '' && transaction.getAmount() < 0 && wallet.findTxPrivateKeyWithHash(transaction.hash) === null) {
                    var derivedTxKey = TransactionsExplorer.deriveDeterministicTxPrivateKey(rawTransaction, wallet, tx_pub_key);
                    if (derivedTxKey !== null && derivedTxKey.txPubKeyMatches) {
                        wallet.addTxPrivateKeyWithTxHash(transaction.hash, derivedTxKey.txPrivKey);
                    }
                }
            }
            return transaction;
        };
        TransactionsExplorer.formatWalletOutsForTx = function (wallet, blockchainHeight) {
            var unspentOuts = [];
            //rct=rct_outpk + rct_mask + rct_amount
            // {"amount"          , out.amount},
            // {"public_key"      , out.out_pub_key},
            // {"index"           , out.out_index},
            // {"global_index"    , out.global_index},
            // {"rct"             , rct},
            // {"tx_id"           , out.tx_id},
            // {"tx_hash"         , tx.hash},
            // {"tx_prefix_hash"  , tx.prefix_hash},
            // {"tx_pub_key"      , tx.tx_pub_key},
            // {"timestamp"       , static_cast<uint64_t>(out.timestamp)},
            // {"height"          , tx.height},
            // {"spend_key_images", json::array()}
            // Outputs scanned by an older scanner can be
            // persisted without ctCommitment / ctMaskedAmount / ctRingAmount even
            // when they're actually confidential outputs from v2 txs. If we feed
            // those to the sender path they get classified as transparent (see
            // `ring_amount` below) and shipped to the daemon as inputs with the
            // decoded amount but with a globalIndex that lives in the CT bucket -
            // the daemon then rejects with "Wrong index in transaction inputs".
            // Skip them defensively until a rescan repopulates the CT markers.
            var staleCtSuspects = [];
            for (var _i = 0, _a = wallet.getAll(); _i < _a.length; _i++) {
                var tr = _a[_i];
                //todo improve to take into account miner tx
                //only add outs unlocked
                if (!tr.isConfirmed(blockchainHeight)) {
                    continue;
                }
                for (var _b = 0, _c = tr.outs; _b < _c.length; _b++) {
                    var out = _c[_b];
                    if (TransactionsExplorer.isStaleCtOutput(tr, out)) {
                        // globalIndex points into the CT bucket, not the amount
                        // bucket implied by `amount`. WalletWatchdog.healStaleCtOutputs
                        // re-fetches the parent tx in the background; until then we
                        // skip the output so we don't ship a daemon-rejecting ring.
                        staleCtSuspects.push({
                            hash: tr.hash,
                            height: tr.blockHeight,
                            amount: out.amount,
                            globalIndex: out.globalIndex,
                        });
                        continue;
                    }
                    var rct = '';
                    if (out.rtcAmount !== '') {
                        rct = out.rtcOutPk + out.rtcMask + out.rtcAmount;
                    }
                    else {
                        rct = Cn_1.CnTransactions.zeroCommit(Cn_1.CnUtils.d2s(out.amount));
                    }
                    unspentOuts.push({
                        keyImage: out.keyImage,
                        amount: out.amount,
                        public_key: out.pubKey,
                        index: out.outputIdx,
                        global_index: out.globalIndex,
                        tx_pub_key: tr.txPubKey,
                        ctCommitment: out.ctCommitment,
                        ctMaskedAmount: out.ctMaskedAmount,
                        ctBlinding: out.ctBlinding,
                        ring_amount: out.ctRingAmount || (out.ctCommitment ? Cn_1.CnTransactions.ctConfidentialOutputAmount() : out.amount),
                        is_coinbase: tr.is_coinbase
                    });
                }
            }
            if (staleCtSuspects.length > 0) {
                console.warn('[wallet] Skipping ' + staleCtSuspects.length +
                    ' CT-era output(s) with incomplete CT markers. ' +
                    'The wallet will re-fetch those txs in the background.', staleCtSuspects);
            }
            //console.log('outs count before spend:', unspentOuts.length, unspentOuts);
            for (var _d = 0, _e = wallet.getAll().concat(wallet.txsMem); _d < _e.length; _d++) {
                var tr = _e[_d];
                //console.log(tr.ins);
                for (var _f = 0, _g = tr.ins; _f < _g.length; _f++) {
                    var i = _g[_f];
                    for (var iOut = 0; iOut < unspentOuts.length; ++iOut) {
                        var out = unspentOuts[iOut];
                        var exist = out.keyImage === i.keyImage;
                        if (exist) {
                            unspentOuts.splice(iOut, 1);
                            break;
                        }
                    }
                }
            }
            return unspentOuts;
        };
        TransactionsExplorer.createRawTx = function (dsts, wallet, rct, usingOuts, pid_encrypt, mix_outs, mixin, neededFee, payment_id, accountRegistration) {
            if (mix_outs === void 0) { mix_outs = []; }
            if (accountRegistration === void 0) { accountRegistration = false; }
            return new Promise(function (resolve, reject) {
                var signed;
                try {
                    //console.log('Destinations: ');
                    //need to get viewkey for encrypting here, because of splitting and sorting
                    var realDestViewKey = undefined;
                    if (pid_encrypt) {
                        realDestViewKey = Cn_1.Cn.decode_address(dsts[0].address).view;
                    }
                    var splittedDsts = Cn_1.CnTransactions.decompose_tx_destinations(dsts, rct);
                    signed = Cn_1.CnTransactions.create_transaction({
                        spend: wallet.keys.pub.spend,
                        view: wallet.keys.pub.view
                    }, {
                        spend: wallet.keys.priv.spend,
                        view: wallet.keys.priv.view
                    }, splittedDsts, usingOuts, mix_outs, mixin, neededFee, payment_id, pid_encrypt, realDestViewKey, 0, rct, accountRegistration);
                    console.log("signed tx: ", signed);
                    var raw_tx_and_hash = Cn_1.CnTransactions.serialize_tx_with_hash(signed);
                    resolve({ raw: raw_tx_and_hash, signed: signed });
                }
                catch (e) {
                    reject("Failed to create transaction: " + e);
                }
            });
        };
        TransactionsExplorer.createTx = function (userDestinations, userPaymentId, wallet, blockchainHeight, obtainMixOutsCallback, confirmCallback, mixin, accountRegistration, feeAmount) {
            if (userPaymentId === void 0) { userPaymentId = ''; }
            if (mixin === void 0) { mixin = config.defaultMixin; }
            if (accountRegistration === void 0) { accountRegistration = false; }
            if (feeAmount === void 0) { feeAmount = null; }
            return new Promise(function (resolve, reject) {
                var useCt = TransactionsExplorer.isCtActivated(blockchainHeight);
                if (useCt) {
                    if (mixin > CT_MAX_MIXIN) {
                        reject('ct_mixin_too_big');
                        return;
                    }
                    if (mixin !== 0 && mixin < CT_MIN_MIXIN) {
                        mixin = CT_MIN_MIXIN;
                    }
                }
                var neededFee = feeAmount === null ? new JSBigInt(window.config.coinFee) : new JSBigInt(feeAmount);
                if (useCt && neededFee.compare(Cn_1.CnTransactions.ctMinimumDenomination()) < 0) {
                    neededFee = Cn_1.CnTransactions.ctMinimumDenomination();
                }
                var pid_encrypt = false; //don't encrypt payment ID unless we find an integrated one
                var totalAmountWithoutFee = new JSBigInt(0);
                var paymentIdIncluded = 0;
                var paymentId = '';
                var dsts = [];
                for (var _i = 0, userDestinations_1 = userDestinations; _i < userDestinations_1.length; _i++) {
                    var dest = userDestinations_1[_i];
                    totalAmountWithoutFee = totalAmountWithoutFee.add(dest.amount);
                    var target = Cn_1.Cn.decode_address(dest.address);
                    if (target.intPaymentId !== null) {
                        ++paymentIdIncluded;
                        paymentId = target.intPaymentId;
                        pid_encrypt = true;
                    }
                    dsts.push({
                        address: dest.address,
                        amount: new JSBigInt(dest.amount)
                    });
                }
                if (useCt) {
                    for (var _a = 0, dsts_1 = dsts; _a < dsts_1.length; _a++) {
                        var dest = dsts_1[_a];
                        var amount = new JSBigInt(dest.amount);
                        if (amount.compare(0) <= 0 || amount.remainder(Cn_1.CnTransactions.ctMinimumDenomination()).compare(0) !== 0) {
                            reject('ct_wrong_amount');
                            return;
                        }
                    }
                }
                if (paymentIdIncluded > 1) {
                    reject('multiple_payment_ids');
                    return;
                }
                if (paymentId !== '' && userPaymentId !== '') {
                    reject('address_payment_id_conflict_user_payment_id');
                    return;
                }
                if (totalAmountWithoutFee.compare(0) <= 0) {
                    reject('negative_amount');
                    return;
                }
                if (paymentId === '' && userPaymentId !== '') {
                    if (userPaymentId.length <= 16 && /^[0-9a-fA-F]+$/.test(userPaymentId)) {
                        userPaymentId = ('0000000000000000' + userPaymentId).slice(-16);
                    }
                    // now double check if ok
                    if ((userPaymentId.length !== 16 && userPaymentId.length !== 64) ||
                        (!(/^[0-9a-fA-F]{16}$/.test(userPaymentId)) && !(/^[0-9a-fA-F]{64}$/.test(userPaymentId)))) {
                        reject('invalid_payment_id');
                        return;
                    }
                    pid_encrypt = userPaymentId.length === 16;
                    paymentId = userPaymentId;
                }
                var unspentOuts = TransactionsExplorer.formatWalletOutsForTx(wallet, blockchainHeight);
                //console.log('outs available:', unspentOuts.length, unspentOuts);
                var usingOuts = [];
                var usingOuts_amount = new JSBigInt(0);
                var unusedOuts = unspentOuts.slice(0);
                var totalAmount = totalAmountWithoutFee.add(neededFee) /*.add(chargeAmount)*/;
                //selecting outputs to fit the desired amount (totalAmount);
                function pop_random_value(list) {
                    var idx = Math.floor(MathUtil_1.MathUtil.randomFloat() * list.length);
                    var val = list[idx];
                    list.splice(idx, 1);
                    return val;
                }
                while (usingOuts_amount.compare(totalAmount) < 0 && unusedOuts.length > 0) {
                    var out = pop_random_value(unusedOuts);
                    usingOuts.push(out);
                    usingOuts_amount = usingOuts_amount.add(out.amount);
                    //console.log("Using output: " + out.amount + " - " + JSON.stringify(out));
                }
                console.log("Selected outs:", usingOuts);
                console.log('using amount of ' + usingOuts_amount + ' for sending ' + totalAmountWithoutFee + ' with fees of ' + (neededFee / Math.pow(10, config.coinUnitPlaces)) + ' KRB');
                confirmCallback(totalAmountWithoutFee, neededFee).then(function () {
                    if (usingOuts_amount.compare(totalAmount) < 0) {
                        console.log("Not enough spendable outputs / balance too low (have "
                            + Cn_1.Cn.formatMoneyFull(usingOuts_amount) + " but need "
                            + Cn_1.Cn.formatMoneyFull(totalAmount)
                            + " (estimated fee " + Cn_1.Cn.formatMoneyFull(neededFee) + " KRB included)");
                        // return;
                        reject({ error: 'balance_too_low' });
                        return;
                    }
                    else if (usingOuts_amount.compare(totalAmount) > 0) {
                        var changeAmount = usingOuts_amount.subtract(totalAmount);
                        var changeCanonical = changeAmount;
                        if (useCt) {
                            changeCanonical = changeAmount.divide(Cn_1.CnTransactions.ctMinimumDenomination()).multiply(Cn_1.CnTransactions.ctMinimumDenomination());
                            var residue = changeAmount.subtract(changeCanonical);
                            if (residue.compare(0) > 0) {
                                neededFee = neededFee.add(residue);
                            }
                        }
                        if (changeCanonical.compare(0) > 0) {
                            console.log("1) Sending change of " + Cn_1.Cn.formatMoneySymbol(changeCanonical)
                                + " to " + wallet.getPublicAddress());
                            dsts.push({
                                address: wallet.getPublicAddress(),
                                amount: changeCanonical
                            });
                        }
                    } /*
                    // not applicable for Karbo
                    else if (usingOuts_amount.compare(totalAmount) === 0) {
                        //create random destination to keep 2 outputs always in case of 0 change
                        let fakeAddress = Cn.create_address(CnRandom.random_scalar()).public_addr;
                        console.log("Sending 0 KRB to a fake address to keep tx uniform (no change exists): " + fakeAddress);
                        dsts.push({
                            address: fakeAddress,
                            amount: 0
                        });
                    }*/
                    console.log('destinations', dsts);
                    var amounts = [];
                    for (var l = 0; l < usingOuts.length; l++) {
                        amounts.push(TransactionsExplorer.randomOutAmountForWalletOut(usingOuts[l]));
                    }
                    var allInputsAreCoinbase = useCt && usingOuts.length > 0 && usingOuts.every(function (out) {
                        return out.is_coinbase === true;
                    });
                    var requestedMixin = allInputsAreCoinbase ? 0 : mixin;
                    var nbOutsNeeded = requestedMixin + 1;
                    var signWithMixins = function (lotsMixOuts, txMixin) {
                        console.log('------------------------------mix_outs');
                        console.log('amounts', amounts);
                        console.log('lots_mix_outs', lotsMixOuts);
                        if (useCt && txMixin > 0) {
                            var hasFullRing = lotsMixOuts.length === usingOuts.length;
                            for (var i = 0; hasFullRing && i < lotsMixOuts.length; ++i) {
                                hasFullRing = (lotsMixOuts[i].outs || []).length >= txMixin + 1;
                            }
                            if (!hasFullRing) {
                                reject('ct_not_enough_mixins');
                                return;
                            }
                        }
                        TransactionsExplorer.createRawTx(dsts, wallet, useCt, usingOuts, pid_encrypt, lotsMixOuts, txMixin, neededFee, paymentId, accountRegistration).then(function (data) {
                            resolve(data);
                        }).catch(function (e) {
                            reject(e);
                        });
                    };
                    if (requestedMixin === 0) {
                        signWithMixins([], 0);
                        return;
                    }
                    obtainMixOutsCallback(amounts, nbOutsNeeded).then(function (lotsMixOuts) {
                        try {
                            signWithMixins(TransactionsExplorer.alignMixOutsWithRequestedAmounts(lotsMixOuts, amounts), requestedMixin);
                        }
                        catch (e) {
                            reject(e);
                        }
                    }).catch(function (e) {
                        console.error('Failed to obtain mix outs', e);
                        reject(e);
                    });
                    //https://github.com/moneroexamples/openmonero/blob/ebf282faa8d385ef3cf97e6561bd1136c01cf210/README.md
                    //https://github.com/moneroexamples/openmonero/blob/95bc207e1dd3881ba0795c02c06493861de8c705/src/YourMoneroRequests.cpp
                }).catch(function (e) {
                    reject(e);
                });
            });
        };
        return TransactionsExplorer;
    }());
    exports.TransactionsExplorer = TransactionsExplorer;
});
