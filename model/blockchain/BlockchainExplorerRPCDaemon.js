/*
 * Copyright (c) 2018, Gnock
 * Copyright (c) 2018, The Masari Project
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
define(["require", "exports", "../Cn", "../WalletWatchdog"], function (require, exports, Cn_1, WalletWatchdog_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BlockchainExplorerRpcDaemon = void 0;
    var BlockchainExplorerRpcDaemon = /** @class */ (function () {
        function BlockchainExplorerRpcDaemon(daemonAddress) {
            if (daemonAddress === void 0) { daemonAddress = null; }
            //daemonAddress = config.nodeList[Math.floor(Math.random() * Math.floor(config.nodeList.length))];
            this.daemonAddress = config.nodeUrl;
            this.phpProxy = false;
            this.cacheInfo = null;
            this.cacheHeight = 0;
            this.lastTimeRetrieveInfo = 0;
            this.scannedHeight = 0;
            if (daemonAddress !== null && daemonAddress.trim() !== '') {
                this.daemonAddress = daemonAddress;
            }
        }
        BlockchainExplorerRpcDaemon.prototype.makeRpcRequest = function (method, params) {
            if (params === void 0) { params = {}; }
            return new Promise(function (resolve, reject) {
                $.ajax({
                    url: config.nodeUrl + 'json_rpc',
                    method: 'POST',
                    data: JSON.stringify({
                        jsonrpc: '2.0',
                        method: method,
                        params: params,
                        id: 0
                    }),
                    contentType: 'application/json'
                }).done(function (raw) {
                    if (typeof raw.id === 'undefined' ||
                        typeof raw.jsonrpc === 'undefined' ||
                        raw.jsonrpc !== '2.0' ||
                        typeof raw.result !== 'object')
                        reject('Daemon response is not properly formatted');
                    else
                        resolve(raw.result);
                }).fail(function (data) {
                    reject(data);
                });
            });
        };
        BlockchainExplorerRpcDaemon.prototype.makeRequest = function (method, url, body) {
            if (body === void 0) { body = undefined; }
            return new Promise(function (resolve, reject) {
                $.ajax({
                    url: config.nodeUrl + url,
                    method: method,
                    data: typeof body === 'string' ? body : JSON.stringify(body)
                }).done(function (raw) {
                    resolve(raw);
                }).fail(function (data) {
                    reject(data);
                });
            });
        };
        BlockchainExplorerRpcDaemon.prototype.getInfo = function () {
            var _this = this;
            if (Date.now() - this.lastTimeRetrieveInfo < 10 * 1000 && this.cacheInfo !== null) {
                return Promise.resolve(this.cacheInfo);
            }
            this.lastTimeRetrieveInfo = Date.now();
            return this.makeRequest('GET', 'getinfo').then(function (data) {
                _this.cacheInfo = data;
                console.log("GetInfo: ");
                return data;
            });
        };
        BlockchainExplorerRpcDaemon.prototype.getHeight = function () {
            var _this = this;
            if (Date.now() - this.lastTimeRetrieveInfo < 10 * 1000 && this.cacheHeight !== 0) {
                return Promise.resolve(this.cacheHeight);
            }
            this.lastTimeRetrieveInfo = Date.now();
            return this.makeRpcRequest('getlastblockheader').then(function (data) {
                var height = parseInt(data.block_header['height']);
                _this.cacheHeight = height;
                config.lastBlockMajorVersion = parseInt(data.block_header['major_version']);
                return height;
            });
        };
        BlockchainExplorerRpcDaemon.prototype.getScannedHeight = function () {
            return this.scannedHeight;
        };
        BlockchainExplorerRpcDaemon.prototype.watchdog = function (wallet) {
            var watchdog = new WalletWatchdog_1.WalletWatchdog(wallet, this);
            watchdog.start();
            return watchdog;
        };
        /**
         * Returns an array containing all numbers like [start;end]
         * @param start
         * @param end
         */
        BlockchainExplorerRpcDaemon.prototype.range = function (start, end) {
            var numbers = [];
            for (var i = start; i <= end; ++i) {
                numbers.push(i);
            }
            return numbers;
        };
        BlockchainExplorerRpcDaemon.prototype.getTransactionsForBlocks = function (startBlock, endBlock, includeMinerTxs) {
            var blockCount = Math.max(0, endBlock - startBlock + 1);
            return this.getWalletSyncData(startBlock, blockCount, includeMinerTxs).then(function (response) {
                var formatted = [];
                for (var _i = 0, _a = response.blocks; _i < _a.length; _i++) {
                    var block = _a[_i];
                    for (var _b = 0, _c = block.transactions; _b < _c.length; _b++) {
                        var rawTx = _c[_b];
                        var tx = rawTx.transaction;
                        if (tx !== null) {
                            tx.ts = block.timestamp;
                            tx.height = block.height;
                            tx.hash = rawTx.hash;
                            tx.block_hash = block.hash;
                            tx.fee = 0;
                            tx.output_indexes = [];
                            formatted.push(tx);
                        }
                    }
                }
                return formatted;
            });
        };
        BlockchainExplorerRpcDaemon.prototype.getTransactionPool = function () {
            return this.makeRequest('GET', 'getrawtransactionspool').then(function (response) {
                var formatted = [];
                for (var _i = 0, _a = response.transactions; _i < _a.length; _i++) {
                    var rawTx = _a[_i];
                    var tx = null;
                    try {
                        tx = rawTx.transaction;
                    }
                    catch (e) {
                        try {
                            //compat for some invalid endpoints
                            tx = rawTx.transaction;
                        }
                        catch (e) {
                        }
                    }
                    if (tx !== null) {
                        tx.hash = rawTx.hash;
                        tx.fee = 0;
                        tx.output_indexes = [];
                        formatted.push(tx);
                    }
                }
                return formatted;
            });
        };
        BlockchainExplorerRpcDaemon.prototype.getRandomOuts = function (amounts, nbOutsNeeded) {
            var requestAmounts = amounts.map(function (amount) {
                return amount === Cn_1.CnTransactions.ctConfidentialOutputAmount() ? Cn_1.CnTransactions.ctConfidentialOutputAmountRpc() : amount;
            });
            return this.makeRequest('POST', 'getrandom_outs', {
                amounts: requestAmounts,
                outs_count: nbOutsNeeded
            }).then(function (response) {
                if (response.status !== 'OK')
                    throw { error: 'invalid_getrandom_outs_answer', response: response };
                if (response.outs.length > 0) {
                    console.log("Got random outs: ");
                    console.log(response.outs);
                }
                return response.outs;
            });
        };
        BlockchainExplorerRpcDaemon.prototype.sendRawTx = function (rawTx) {
            return this.makeRequest('POST', 'sendrawtransaction', {
                tx_as_hex: rawTx,
                do_not_relay: false
            }).then(function (transactions) {
                if (!transactions.status || transactions.status !== 'OK')
                    throw transactions;
            });
        };
        BlockchainExplorerRpcDaemon.prototype.getNetworkInfo = function () {
            return this.makeRpcRequest('getlastblockheader').then(function (raw) {
                config.lastBlockMajorVersion = parseInt(raw.block_header['major_version']);
                //console.log(raw);
                return {
                    'node': config.nodeUrl, //.split(':')[1].replace(/[-[\]\/{}()*+?\\^$|#\s]/g, ''),
                    'major_version': raw.block_header['major_version'],
                    'hash': raw.block_header['hash'],
                    'reward': raw.block_header['reward'],
                    'height': raw.block_header['height'],
                    'timestamp': raw.block_header['timestamp'],
                    'difficulty': raw.block_header['difficulty']
                };
            });
        };
        BlockchainExplorerRpcDaemon.prototype.getWalletSyncData = function (startHeight, blockCount, includeMinerTxs) {
            var _this = this;
            if (!Number.isInteger(startHeight) || startHeight < 0)
                return Promise.reject('invalid_start_height');
            if (!Number.isInteger(blockCount) || blockCount < 1 || blockCount > 100)
                return Promise.reject('invalid_block_count');
            return this.makeRequest('POST', 'get_wallet_sync_data', {
                start_height: startHeight,
                block_count: blockCount,
                include_miner_txs: includeMinerTxs
            }).then(function (response) {
                if (!response || response.status !== 'OK' || !Array.isArray(response.blocks))
                    throw 'invalid_wallet_sync_answer';
                var expectedHeight = startHeight;
                var previousHash = null;
                for (var _i = 0, _a = response.blocks; _i < _a.length; _i++) {
                    var block = _a[_i];
                    if (block.height !== expectedHeight || !Array.isArray(block.transactions))
                        throw 'non_contiguous_wallet_sync_answer';
                    if (previousHash !== null && block.previous_hash !== previousHash)
                        throw 'unlinked_wallet_sync_answer';
                    for (var _b = 0, _c = block.transactions; _b < _c.length; _b++) {
                        var tx = _c[_b];
                        if (!tx || typeof tx.hash !== 'string' || typeof tx.transaction !== 'object')
                            throw 'invalid_wallet_sync_transaction';
                    }
                    previousHash = block.hash;
                    expectedHeight++;
                }
                _this.scannedHeight = response.blocks.length === 0
                    ? startHeight
                    : response.blocks[response.blocks.length - 1].height;
                return response;
            });
        };
        BlockchainExplorerRpcDaemon.prototype.getRemoteNodeInformation = function () {
            // TODO change to /feeaddress
            return this.getInfo().then(function (info) {
                return {
                    'fee_address': info['fee_address'],
                    'status': info['status']
                };
            });
        };
        BlockchainExplorerRpcDaemon.prototype.resolveAccountNumber = function (accountNumber) {
            var parsed = DiscreteRuntime.parseAccountNumber(accountNumber);
            return this.makeRpcRequest('resolveaccountnumber', {
                block_height: parsed.blockHeight,
                tx_index: parsed.transactionIndex
            }).then(function (response) {
                if (response.status === 'OK' && response.found) {
                    // Failsafe: the keys the node resolved must fingerprint to the 'A' the
                    // user typed. response.account_number is the canonical base number the
                    // node reconstructs FROM those keys; if its fingerprint differs, the
                    // (H,I) slot was repointed (reorg) — refuse rather than pay stranger keys.
                    // (The node also only resolves once the registration is past finality.)
                    if (!response.account_number)
                        throw 'account_number_binding_missing';
                    var resolved = DiscreteRuntime.parseAccountNumber(response.account_number);
                    if (resolved.blockHeight !== parsed.blockHeight ||
                        resolved.transactionIndex !== parsed.transactionIndex ||
                        resolved.fingerprint !== parsed.fingerprint) {
                        throw 'account_number_fingerprint_mismatch';
                    }
                    var viewPublicKey = new Uint8Array(response.view_pub.match(/../g).map(function (byte) { return parseInt(byte, 16); }));
                    var spendPublicKey = new Uint8Array(response.spend_pub.match(/../g).map(function (byte) { return parseInt(byte, 16); }));
                    return DiscreteRuntime.encodeAddress(viewPublicKey, spendPublicKey, 0x3445db, Boolean(config.testnet));
                }
                throw 'account_number_not_found';
            });
        };
        BlockchainExplorerRpcDaemon.prototype.getAccountNumber = function (address) {
            var decoded;
            try {
                decoded = DiscreteRuntime.decodeAddress(address, Boolean(config.testnet));
            }
            catch (e) {
                return Promise.resolve(null);
            }
            var toHex = function (bytes) { return Array.prototype.map.call(bytes, function (byte) { return ('0' + byte.toString(16)).slice(-2); }).join(''); };
            return this.makeRpcRequest('getaccountnumber', {
                view_pub: toHex(decoded.viewPublicKey),
                spend_pub: toHex(decoded.spendPublicKey)
            }).then(function (response) {
                // The daemon renders the full H-I-A-C string (fingerprint A over these keys);
                // display it verbatim rather than recomputing A client-side.
                if (response.status === 'OK' && response.registered && response.account_number)
                    return response.account_number;
                return null;
            }).catch(function () {
                return null;
            });
        };
        return BlockchainExplorerRpcDaemon;
    }());
    exports.BlockchainExplorerRpcDaemon = BlockchainExplorerRpcDaemon;
});
