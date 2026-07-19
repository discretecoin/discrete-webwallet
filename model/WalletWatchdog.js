/**
 *     Copyright (c) 2018-2020, ExploShot
 *     Copyright (c) 2018-2020, The Qwertycoin Project
 *     Copyright (c) 2018-2020, The Karbo
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
define(["require", "exports", "./Transaction", "./TransactionsExplorer"], function (require, exports, Transaction_1, TransactionsExplorer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WalletWatchdog = void 0;
    var WalletWatchdog = /** @class */ (function () {
        function WalletWatchdog(wallet, explorer) {
            var _this = this;
            this.pqTimer = 0;
            this.pqSyncing = false;
            this.pqKeys = null;
            this.lifecycleGeneration = 0;
            this.healStaleCtOutputsPromise = null;
            this.defaultNodeUrl = null;
            this.intervalMempool = 0;
            this.stopped = true;
            this.transactionsToProcess = [];
            this.intervalTransactionsProcess = 0;
            this.workerProcessingReady = false;
            this.workerProcessingWorking = false;
            this.workerCurrentProcessing = [];
            this.workerCountProcessed = 0;
            this.lastBlockLoading = -1;
            this.lastMaximumHeight = 0;
            this.start = function () {
                if (!_this.stopped)
                    return;
                _this.stopped = false;
                _this.lifecycleGeneration++;
                _this.lastBlockLoading = -1;
                _this.lastMaximumHeight = 0;
                if (_this.wallet.pqMasterSeed !== null) {
                    _this.pqSyncing = false;
                    _this.initPqSync();
                    return;
                }
                _this.initWorker();
                // init the mempool
                _this.initMempool();
                // set the interval for checking the new transactions
                _this.intervalTransactionsProcess = setInterval(function () {
                    _this.checkTransactionsInterval();
                }, _this.wallet.options.readSpeed);
                // run main loop
                _this.loadHistory();
                // Background, fire-and-forget. Errors are logged inside.
                _this.healStaleCtOutputs();
            };
            this.wallet = wallet;
            this.explorer = explorer;
        }
        WalletWatchdog.prototype.initPqSync = function () {
            this.applyNodeUrl();
            var seed = new Uint8Array(this.wallet.pqMasterSeed.match(/../g).map(function (byte) { return parseInt(byte, 16); }));
            this.pqKeys = DiscreteRuntime.deriveWalletKeys(seed);
            this.syncPq();
            var self = this;
            this.pqTimer = setInterval(function () { self.syncPq(); }, 5000);
        };
        WalletWatchdog.prototype.syncPq = function () {
            if (this.stopped || this.pqSyncing || this.wallet.pqState === null)
                return;
            var generation = this.lifecycleGeneration;
            this.pqSyncing = true;
            var self = this;
            var startHeight = this.wallet.pqState.height;
            this.explorer.getWalletSyncData(startHeight, 100, true).then(function (response) {
                if (self.stopped || generation !== self.lifecycleGeneration)
                    return;
                for (var _i = 0, _a = response.blocks; _i < _a.length; _i++) {
                    var block = _a[_i];
                    try {
                        self.wallet.pqState.applyBlock(block, self.pqKeys);
                    }
                    catch (error) {
                        if (self.wallet.pqState.height > self.wallet.creationHeight) {
                            self.wallet.pqState.rollbackToHeight(self.wallet.pqState.height - 1);
                            self.wallet.lastHeight = self.wallet.pqState.height;
                            self.wallet.signalChanged();
                            return;
                        }
                        throw error;
                    }
                }
                self.lastMaximumHeight = response.top_height;
                self.wallet.lastHeight = self.wallet.pqState.height;
                return self.refreshPqMempool(generation).then(function () {
                    if (self.stopped || generation !== self.lifecycleGeneration)
                        return;
                    if (response.blocks.length > 0)
                        self.wallet.signalChanged();
                    if (self.wallet.pqState.height <= response.top_height)
                        setTimeout(function () { self.syncPq(); }, 0);
                });
            }).catch(function (error) {
                if (generation !== self.lifecycleGeneration)
                    return;
                console.warn('[pq-sync] synchronization failed', error);
            }).then(function () {
                if (generation === self.lifecycleGeneration)
                    self.pqSyncing = false;
            });
        };
        WalletWatchdog.prototype.refreshPqMempool = function (generation) {
            var self = this;
            return this.explorer.getTransactionPool().then(function (pool) {
                if (self.stopped || generation !== self.lifecycleGeneration)
                    return;
                var entries = (pool || []).map(function (transaction) {
                    return { transaction: transaction, hash: transaction.hash, coinbase: false };
                });
                self.wallet.pqMempoolState = self.wallet.pqState.previewMempool(entries, self.pqKeys);
                self.wallet.notify();
            }).catch(function (error) {
                console.warn('[pq-sync] mempool refresh failed', error);
            });
        };
        /**
         * One-shot, deduped (per WalletWatchdog instance) repair pass: for every
         * stored tx that contains a CT-era output without CT markers, re-fetch the
         * raw tx from the daemon and re-parse it with the current CT-aware
         * scanner. The re-parsed Transaction replaces the old one via
         * Wallet.addNew(replace=true), repopulating ctCommitment / ctMaskedAmount
         * / ctBlinding / ctRingAmount. After this completes, formatWalletOutsForTx
         * stops dropping those outputs and the user's balance comes back.
         *
         * Runs sequentially to keep node load low; failures are logged and the
         * pass continues; leftover suspects will simply be re-attempted next
         * time a watchdog is constructed (e.g. wallet switch).
         */
        WalletWatchdog.prototype.healStaleCtOutputs = function () {
            if (this.healStaleCtOutputsPromise !== null)
                return this.healStaleCtOutputsPromise;
            var self = this;
            this.healStaleCtOutputsPromise = this.explorer.getHeight().catch(function (e) {
                console.warn('[ct-heal] failed to refresh daemon height before scan', e);
            }).then(function () {
                // Snapshot the runtime context so the user (or we) can see at a
                // glance whether CT detection is even on. Without this it was
                // impossible to tell the difference between "heal ran and found
                // nothing" and "heal ran but CT detection was off".
                var lastMajor = config.lastBlockMajorVersion;
                var ctForkHeight = config.ctForkHeight;
                var ctForkHeightTestnet = config.ctForkHeightTestnet;
                console.info('[ct-heal] runtime: lastBlockMajorVersion=' + lastMajor +
                    ' ctForkHeight=' + ctForkHeight +
                    ' ctForkHeightTestnet=' + ctForkHeightTestnet +
                    ' walletLastHeight=' + self.wallet.lastHeight +
                    ' txCount=' + self.wallet.getAll().length);
                var suspects = TransactionsExplorer_1.TransactionsExplorer.findStaleCtSuspectTxs(self.wallet);
                if (suspects.length === 0) {
                    console.info('[ct-heal] no suspect txs found - nothing to do');
                    return;
                }
                console.warn('[ct-heal] queued ' + suspects.length + ' tx(es) for re-fetch:', suspects.map(function (s) { return ({ hash: s.hash, height: s.height }); }));
                var healed = 0;
                var healedNoChange = 0;
                var failed = 0;
                var chain = Promise.resolve();
                var _loop_1 = function (suspect) {
                    var s = suspect;
                    chain = chain.then(function () {
                        if (self.stopped)
                            return;
                        // Snapshot the pre-heal state of every out in this tx so we
                        // can compare against the post-heal state. If nothing
                        // changed after `addNew(replace=true)`, we know the
                        // re-parse produced an identical-looking output - i.e.
                        // either the daemon's response is missing the CT fields
                        // or parse() is taking a path that doesn't populate them.
                        var priorTx = self.wallet.findWithTxHash(s.hash);
                        var priorOuts = priorTx ? priorTx.outs.map(function (o) { return ({
                            outputIdx: o.outputIdx,
                            globalIndex: o.globalIndex,
                            amount: o.amount,
                            ctCommitment: !!o.ctCommitment,
                            ctMaskedAmount: !!o.ctMaskedAmount,
                            ctBlinding: !!o.ctBlinding,
                            ctRingAmount: !!o.ctRingAmount,
                        }); }) : [];
                        return self.explorer.getTransactionsForBlocks(s.height, s.height, /*includeMinerTx*/ true).then(function (rawTxs) {
                            if (self.stopped)
                                return;
                            if (!Array.isArray(rawTxs)) {
                                failed++;
                                console.warn('[ct-heal] block ' + s.height + ' returned non-array:', rawTxs);
                                return;
                            }
                            var matched = null;
                            for (var _i = 0, _a = rawTxs; _i < _a.length; _i++) {
                                var rawTx = _a[_i];
                                if (rawTx.hash === s.hash) {
                                    matched = rawTx;
                                    break;
                                }
                            }
                            if (matched === null) {
                                failed++;
                                console.warn('[ct-heal] tx ' + s.hash + ' not present in block ' + s.height +
                                    '; daemon returned hashes:', rawTxs.map(function (t) { return t.hash; }));
                                return;
                            }
                            var parsed = TransactionsExplorer_1.TransactionsExplorer.parse(matched, self.wallet);
                            if (parsed === null) {
                                failed++;
                                console.warn('[ct-heal] re-parse returned null for ' + s.hash +
                                    ' (version=' + matched.version + ', vout.length=' + (matched.vout || []).length + ')');
                                return;
                            }
                            var parsedOuts = parsed.outs.map(function (o) { return ({
                                outputIdx: o.outputIdx,
                                globalIndex: o.globalIndex,
                                amount: o.amount,
                                ctCommitment: !!o.ctCommitment,
                                ctMaskedAmount: !!o.ctMaskedAmount,
                                ctBlinding: !!o.ctBlinding,
                                ctRingAmount: !!o.ctRingAmount,
                            }); });
                            self.wallet.addNew(parsed, /*replace*/ true);
                            // Re-fetch from the wallet to confirm the swap actually
                            // landed (e.g. catches the case where txPubKey mismatch
                            // prevented `addNew` from doing the assignment).
                            var postTx = self.wallet.findWithTxHash(s.hash);
                            var postOuts = postTx ? postTx.outs.map(function (o) { return ({
                                outputIdx: o.outputIdx,
                                globalIndex: o.globalIndex,
                                amount: o.amount,
                                ctCommitment: !!o.ctCommitment,
                                ctMaskedAmount: !!o.ctMaskedAmount,
                                ctBlinding: !!o.ctBlinding,
                                ctRingAmount: !!o.ctRingAmount,
                            }); }) : [];
                            var stillStale = postTx ? postTx.outs.some(function (o) { return TransactionsExplorer_1.TransactionsExplorer.isStaleCtOutput(postTx, o); }) : false;
                            if (stillStale) {
                                healedNoChange++;
                                console.warn('[ct-heal] ' + s.hash + ' re-parsed but outputs are STILL stale after addNew(replace=true).' +
                                    ' prior=' + JSON.stringify(priorOuts) +
                                    ' parsed=' + JSON.stringify(parsedOuts) +
                                    ' post=' + JSON.stringify(postOuts) +
                                    ' priorTxPubKey=' + (priorTx ? priorTx.txPubKey : '(none)') +
                                    ' parsedTxPubKey=' + parsed.txPubKey);
                            }
                            else {
                                healed++;
                                console.info('[ct-heal] healed ' + s.hash + ' (' + parsed.outs.length + ' out(s) repopulated)');
                            }
                        }).catch(function (e) {
                            failed++;
                            console.warn('[ct-heal] fetch failed for ' + s.hash + ' at height ' + s.height, e);
                        });
                    });
                };
                for (var _i = 0, suspects_1 = suspects; _i < suspects_1.length; _i++) {
                    var suspect = suspects_1[_i];
                    _loop_1(suspect);
                }
                return chain.then(function () {
                    console.info('[ct-heal] pass complete: healed=' + healed +
                        ' stillStale=' + healedNoChange +
                        ' failed=' + failed +
                        ' total=' + suspects.length);
                });
            }).then(function () {
                self.healStaleCtOutputsPromise = null;
            });
            return this.healStaleCtOutputsPromise;
        };
        WalletWatchdog.prototype.applyNodeUrl = function () {
            if (this.wallet.options.customNode && this.wallet.options.nodeUrl !== '') {
                config.nodeUrl = this.wallet.options.nodeUrl;
                return;
            }
            if (this.defaultNodeUrl === null || config.nodeList.indexOf(this.defaultNodeUrl) === -1) {
                var randNodeInt = Math.floor(Math.random() * Math.floor(config.nodeList.length));
                this.defaultNodeUrl = config.nodeList[randNodeInt];
            }
            config.nodeUrl = this.defaultNodeUrl;
        };
        WalletWatchdog.prototype.getSyncRetryDelayMs = function () {
            if (this.wallet.lastHeight < this.lastMaximumHeight) {
                return 5 * 1000;
            }
            return 30 * 1000;
        };
        WalletWatchdog.prototype.initWorker = function () {
            var self = this;
            this.applyNodeUrl();
            this.workerProcessing = new Worker('./workers/TransferProcessingEntrypoint.js');
            this.workerProcessing.onmessage = function (data) {
                var message = data.data;
                logDebugMsg("InitWorker message", message);
                if (message === 'ready') {
                    logDebugMsg('worker ready');
                    self.signalWalletUpdate();
                }
                else if (message === 'readyWallet') {
                    self.workerProcessingReady = true;
                }
                else if (message.type) {
                    if (self.stopped)
                        return;
                    if (message.type === 'processed') {
                        var transactions = message.transactions;
                        var txPrivateKeys = typeof message.txPrivateKeys === 'object' && message.txPrivateKeys !== null ? message.txPrivateKeys : {};
                        var hasUpdates = transactions.length > 0;
                        for (var hash in txPrivateKeys) {
                            if (Object.prototype.hasOwnProperty.call(txPrivateKeys, hash) && self.wallet.findTxPrivateKeyWithHash(hash) === null) {
                                self.wallet.addTxPrivateKeyWithTxHash(hash, txPrivateKeys[hash]);
                                hasUpdates = true;
                            }
                        }
                        if (transactions.length > 0) {
                            for (var _i = 0, transactions_1 = transactions; _i < transactions_1.length; _i++) {
                                var tx = transactions_1[_i];
                                self.wallet.addNew(Transaction_1.Transaction.fromRaw(tx));
                            }
                        }
                        if (hasUpdates) {
                            self.signalWalletUpdate();
                        }
                        //if (self.workerCurrentProcessing.length > 0) {
                        //    let transactionHeight = self.workerCurrentProcessing[self.workerCurrentProcessing.length - 1].height;
                        //    if (typeof transactionHeight !== 'undefined')
                        //        self.wallet.lastHeight = transactionHeight;
                        //}
                        // we are done processing now
                        self.workerProcessingWorking = false;
                    }
                }
            };
        };
        WalletWatchdog.prototype.signalWalletUpdate = function () {
            if (this.stopped)
                return;
            var self = this;
            logDebugMsg('wallet update');
            this.lastBlockLoading = -1; //reset scanning
            this.applyNodeUrl();
            if (this.wallet.pqMasterSeed !== null) {
                this.syncPq();
                return;
            }
            this.workerProcessing.postMessage({
                type: 'initWallet',
                wallet: this.wallet.exportToRaw()
            });
            clearInterval(this.intervalTransactionsProcess);
            this.intervalTransactionsProcess = setInterval(function () {
                self.checkTransactionsInterval();
            }, this.wallet.options.readSpeed);
            //force mempool update after a wallet update (new tx, ...)
            self.checkMempool();
        };
        WalletWatchdog.prototype.initMempool = function (force) {
            if (force === void 0) { force = false; }
            var self = this;
            if (this.intervalMempool === 0 || force) {
                if (force && this.intervalMempool !== 0) {
                    clearInterval(this.intervalMempool);
                }
                this.intervalMempool = setInterval(function () {
                    self.checkMempool();
                }, 30 * 1000);
            }
            self.checkMempool();
        };
        WalletWatchdog.prototype.stop = function () {
            this.stopped = true;
            this.lifecycleGeneration++;
            clearInterval(this.pqTimer);
            this.pqTimer = 0;
            clearInterval(this.intervalTransactionsProcess);
            this.intervalTransactionsProcess = 0;
            this.transactionsToProcess = [];
            clearInterval(this.intervalMempool);
            this.intervalMempool = 0;
            if (typeof this.workerProcessing !== 'undefined')
                this.terminateWorker();
        };
        WalletWatchdog.prototype.checkMempool = function (force) {
            if (force === void 0) { force = false; }
            var self = this;
            if (!force && this.lastMaximumHeight - this.lastBlockLoading > 1) { //only check memory pool if the user is up to date to ensure outs & ins will be found in the wallet
                return false;
            }
            this.explorer.getTransactionPool().then(function (pool) {
                if (self.stopped)
                    return;
                var txsMem = [];
                if (typeof pool !== 'undefined')
                    for (var _i = 0, pool_1 = pool; _i < pool_1.length; _i++) {
                        var rawTx = pool_1[_i];
                        var tx = TransactionsExplorer_1.TransactionsExplorer.parse(rawTx, self.wallet);
                        if (tx !== null) {
                            txsMem.push(tx);
                        }
                    }
                self.wallet.txsMem = txsMem;
            }).catch(function () {
            });
            return true;
        };
        WalletWatchdog.prototype.terminateWorker = function () {
            this.workerProcessing.terminate();
            this.workerProcessingReady = false;
            this.workerCurrentProcessing = [];
            this.workerProcessingWorking = false;
            this.workerCountProcessed = 0;
        };
        WalletWatchdog.prototype.checkTransactionsInterval = function () {
            logDebugMsg("checkTransactionsInterval called...");
            if (this.stopped) {
                clearInterval(this.intervalTransactionsProcess);
                this.intervalTransactionsProcess = 0;
                return;
            }
            //somehow we're repeating and regressing back to re-process Tx's
            //loadHistory getting into a stack overflow ?
            //need to work out timings and ensure process does not reload when it's already running...
            if (this.workerProcessingWorking || !this.workerProcessingReady) {
                logDebugMsg("checkTransactionsInterval exiting...", this.workerProcessingWorking, this.workerProcessingReady);
                return;
            }
            //we destroy the worker in charge of decoding the transactions every 5k transactions to ensure the memory is not corrupted
            //cnUtil bug, see https://github.com/mymonero/mymonero-core-js/issues/8
            if (this.workerCountProcessed >= 5 * 1000) {
                logDebugMsg('Recreate worker..');
                this.terminateWorker();
                this.initWorker();
                return;
            }
            // define the transactions we need to process
            var transactionsToProcess = [];
            if (this.transactionsToProcess.length > 0) {
                transactionsToProcess = this.transactionsToProcess.shift();
            }
            // check if we have anything to process and log it if in debug more
            logDebugMsg('checkTransactionsInterval', 'Transactions to be processed', transactionsToProcess);
            if (transactionsToProcess.length > 0) {
                this.workerCurrentProcessing = transactionsToProcess;
                this.workerProcessingWorking = true;
                this.workerProcessing.postMessage({
                    type: 'process',
                    transactions: transactionsToProcess
                });
                ++this.workerCountProcessed;
            }
            else {
                clearInterval(this.intervalTransactionsProcess);
                this.intervalTransactionsProcess = 0;
            }
        };
        WalletWatchdog.prototype.processTransactions = function (transactions, callback) {
            logDebugMsg("processTransactions called...", transactions);
            if (this.stopped) {
                callback();
                return;
            }
            var transactionsToAdd = transactions;
            // add the raw transaction to the processing FIFO list
            this.transactionsToProcess.push(transactionsToAdd);
            if (this.intervalTransactionsProcess === 0) {
                var self_1 = this;
                this.intervalTransactionsProcess = setInterval(function () {
                    self_1.checkTransactionsInterval();
                }, this.wallet.options.readSpeed);
            }
            // signal we are finished
            callback();
        };
        WalletWatchdog.prototype.loadHistory = function () {
            if (this.stopped)
                return;
            var self = this;
            if (this.lastBlockLoading === -1)
                this.lastBlockLoading = this.wallet.lastHeight;
            //don't reload until it's finished processing the last batch of transactions
            if (this.workerProcessingWorking || !this.workerProcessingReady) {
                logDebugMsg("Cannot process, need to wait...", this.workerProcessingWorking, this.workerProcessingReady);
                setTimeout(function () {
                    self.loadHistory();
                }, 250);
                return;
            }
            if (this.transactionsToProcess.length > 500) {
                logDebugMsg("Having more then 500 TX packets in FIFO queue", this.transactionsToProcess.length);
                //to ensure no pile explosion
                setTimeout(function () {
                    self.loadHistory();
                }, 2 * 1000);
                return;
            }
            this.explorer.getHeight().then(function (height) {
                if (self.stopped)
                    return;
                logDebugMsg("Checking on height", height);
                if (height > self.lastMaximumHeight) {
                    self.lastMaximumHeight = height;
                }
                else {
                    if (self.wallet.lastHeight >= self.lastMaximumHeight) {
                        setTimeout(function () {
                            self.loadHistory();
                        }, 1000);
                        return;
                    }
                }
                // we are only here if the block is actually increased from last processing
                if (self.lastBlockLoading === -1)
                    self.lastBlockLoading = self.wallet.lastHeight;
                if (self.lastBlockLoading !== height) {
                    var previousStartBlock_1 = Number(self.lastBlockLoading);
                    var endBlock_1 = previousStartBlock_1 + config.syncBlockCount;
                    if (previousStartBlock_1 > self.lastMaximumHeight)
                        previousStartBlock_1 = self.lastMaximumHeight;
                    if (endBlock_1 > self.lastMaximumHeight)
                        endBlock_1 = self.lastMaximumHeight;
                    self.explorer.getTransactionsForBlocks(previousStartBlock_1, endBlock_1, self.wallet.options.checkMinerTx).then(function (transactions) {
                        if (self.stopped)
                            return;
                        logDebugMsg("getTransactionsForBlocks", previousStartBlock_1, endBlock_1, transactions);
                        //to ensure no pile explosion
                        if (transactions === 'OK') {
                            self.lastBlockLoading = endBlock_1;
                            self.wallet.lastHeight = endBlock_1;
                            setTimeout(function () {
                                self.loadHistory();
                            }, 25);
                        }
                        else if (transactions.length > 0) {
                            var lastTx = transactions[transactions.length - 1];
                            if (typeof lastTx.height !== 'undefined') {
                                self.lastBlockLoading = lastTx.height + 1;
                            }
                            self.processTransactions(transactions, function () {
                                self.wallet.lastHeight = endBlock_1;
                                setTimeout(function () {
                                    self.loadHistory();
                                }, 25);
                            });
                        }
                        else {
                            self.lastBlockLoading = endBlock_1;
                            self.wallet.lastHeight = endBlock_1;
                            var delay = endBlock_1 < self.lastMaximumHeight ? 25 : 30 * 1000;
                            setTimeout(function () {
                                self.loadHistory();
                            }, delay);
                        }
                    }).catch(function () {
                        if (self.stopped)
                            return;
                        logDebugMsg("Error occured in loadHistory[1]...");
                        setTimeout(function () {
                            self.loadHistory();
                        }, self.getSyncRetryDelayMs()); //retry later if an error occurred
                    });
                }
                else {
                    setTimeout(function () {
                        self.loadHistory();
                    }, 30 * 1000);
                }
            }).catch(function () {
                if (self.stopped)
                    return;
                logDebugMsg("Error occured in loadHistory[2]...");
                setTimeout(function () {
                    self.loadHistory();
                }, self.getSyncRetryDelayMs()); //retry later if an error occurred
            });
        };
        return WalletWatchdog;
    }());
    exports.WalletWatchdog = WalletWatchdog;
});
