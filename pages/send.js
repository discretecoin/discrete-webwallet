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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define(["require", "exports", "../lib/numbersLab/DestructableView", "../lib/numbersLab/VueAnnotate", "../model/TransactionsExplorer", "../lib/numbersLab/DependencyInjector", "../model/Wallet", "../utils/Url", "../model/CoinUri", "../model/QRReader", "../model/AppState", "../providers/BlockchainExplorerProvider", "../model/Nfc", "../model/Cn", "../model/WalletWatchdog"], function (require, exports, DestructableView_1, VueAnnotate_1, TransactionsExplorer_1, DependencyInjector_1, Wallet_1, Url_1, CoinUri_1, QRReader_1, AppState_1, BlockchainExplorerProvider_1, Nfc_1, Cn_1, WalletWatchdog_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var wallet = (0, DependencyInjector_1.DependencyInjectorInstance)().getInstance(Wallet_1.Wallet.name, 'default', false);
    var blockchainExplorer = BlockchainExplorerProvider_1.BlockchainExplorerProvider.getInstance();
    // Triptych ring sizes the daemon accepts for non-coinbase inputs. The
    // coinbase carve-out (ring size 1) is selected automatically by the
    // wallet; the user only picks among the privacy-preserving values.
    var RING_SIZE_CHOICES = [4, 8, 16];
    var MIN_FEE = '0.01';
    var MAX_FEE = '0.1';
    // Consensus limit on PQ transaction inputs (parameters::MAX_PQ_INPUTS_PER_TX in
    // the daemon's CryptoNoteConfig.h). Keep the two in step.
    var MAX_PQ_INPUTS_PER_TX = 32;
    AppState_1.AppState.enableLeftMenu();
    var SendView = /** @class */ (function (_super) {
        __extends(SendView, _super);
        function SendView(container) {
            var _this = _super.call(this, container) || this;
            _this.accountNumberSubaddressIndex = 0;
            _this.qrReader = null;
            _this.redirectUrlAfterSend = null;
            _this.ndefListener = null;
            _this.timeoutResolveAlias = 0;
            _this.pqWallet = wallet.pqMasterSeed !== null;
            var sendAddress = Url_1.Url.getHashSearchParameter('address');
            var amount = Url_1.Url.getHashSearchParameter('amount');
            var destinationName = Url_1.Url.getHashSearchParameter('destName');
            var description = Url_1.Url.getHashSearchParameter('txDesc');
            var redirect = Url_1.Url.getHashSearchParameter('redirect');
            if (sendAddress !== null)
                _this.destinationAddressUser = sendAddress.substr(0, 256);
            if (amount !== null)
                _this.amountToSend = amount;
            if (destinationName !== null)
                _this.txDestinationName = destinationName.substr(0, 256);
            if (description !== null)
                _this.txDescription = description.substr(0, 256);
            if (redirect !== null)
                _this.redirectUrlAfterSend = decodeURIComponent(redirect);
            _this.ringSize = (config.defaultMixin + 1).toString();
            _this.fee = Cn_1.Cn.formatMoney(window.config.coinFee);
            _this.nfcAvailable = _this.nfc.has;
            return _this;
        }
        SendView.prototype.reset = function () {
            this.lockedForm = false;
            this.destinationAddressUser = '';
            this.destinationAddress = '';
            this.amountToSend = '0';
            this.destinationAddressValid = false;
            this.qrScanning = false;
            this.amountToSendValid = false;
            this.accountNumberAddress = null;
            this.accountNumberValid = true;
            this.txDestinationName = null;
            this.txDescription = null;
            this.advancedOpen = false;
            this.ringSize = (config.defaultMixin + 1).toString();
            this.fee = MIN_FEE;
            this.ringSizeIsValid = true;
            this.feeIsValid = true;
            this.sending = false;
            this.stopScan();
        };
        SendView.prototype.startNfcScan = function () {
            var _this = this;
            var self = this;
            if (this.ndefListener === null) {
                this.ndefListener = function (data) {
                    if (data.text)
                        self.handleScanResult(data.text.content);
                    swal.close();
                };
                this.nfc.listenNdef(this.ndefListener);
                swal({
                    title: i18n.t('sendPage.waitingNfcModal.title'),
                    html: i18n.t('sendPage.waitingNfcModal.content'),
                    onOpen: function () {
                        swal.showLoading();
                    },
                    onClose: function () {
                        _this.stopNfcScan();
                    }
                }).then(function (result) {
                });
            }
        };
        SendView.prototype.stopNfcScan = function () {
            if (this.ndefListener !== null)
                this.nfc.removeNdef(this.ndefListener);
            this.ndefListener = null;
        };
        SendView.prototype.initQr = function () {
            this.stopScan();
            this.qrReader = new QRReader_1.QRReader();
            this.qrReader.init('/lib/');
        };
        SendView.prototype.startScan = function () {
            var self = this;
            if (typeof window.QRScanner !== 'undefined') {
                window.QRScanner.scan(function (err, result) {
                    if (err) {
                        if (err.name === 'SCAN_CANCELED') {
                        }
                        else {
                            alert(JSON.stringify(err));
                        }
                    }
                    else {
                        self.handleScanResult(result);
                    }
                });
                window.QRScanner.show();
                $('body').addClass('transparent');
                $('#appContent').hide();
                $('#nativeCameraPreview').show();
            }
            else {
                this.initQr();
                if (this.qrReader) {
                    this.qrScanning = true;
                    this.qrReader.scan(function (result) {
                        self.qrScanning = false;
                        self.handleScanResult(result);
                    });
                }
            }
        };
        SendView.prototype.handleScanResult = function (result) {
            //console.log('Scan result:', result);
            var self = this;
            var parsed = false;
            try {
                var txDetails = CoinUri_1.CoinUri.decodeTx(result);
                if (txDetails !== null) {
                    self.destinationAddressUser = txDetails.address;
                    if (typeof txDetails.description !== 'undefined')
                        self.txDescription = txDetails.description;
                    if (typeof txDetails.recipientName !== 'undefined')
                        self.txDestinationName = txDetails.recipientName;
                    if (typeof txDetails.amount !== 'undefined') {
                        self.amountToSend = txDetails.amount;
                        self.lockedForm = true;
                    }
                    if (typeof txDetails.paymentId !== 'undefined')
                        self.paymentId = txDetails.paymentId;
                    parsed = true;
                }
            }
            catch (e) {
            }
            try {
                var txDetails = CoinUri_1.CoinUri.decodeWallet(result);
                if (txDetails !== null) {
                    self.destinationAddressUser = txDetails.address;
                    parsed = true;
                }
            }
            catch (e) {
            }
            if (!parsed)
                self.destinationAddressUser = result;
            self.stopScan();
        };
        SendView.prototype.stopScan = function () {
            if (typeof window.QRScanner !== 'undefined') {
                window.QRScanner.cancelScan(function (status) {
                    //console.log(status);
                });
                window.QRScanner.hide();
                $('body').removeClass('transparent');
                $('#appContent').show();
                $('#nativeCameraPreview').hide();
            }
            else {
                if (this.qrReader !== null) {
                    this.qrReader.stop();
                    this.qrReader = null;
                    this.qrScanning = false;
                }
            }
        };
        SendView.prototype.destruct = function () {
            this.stopScan();
            this.stopNfcScan();
            swal.close();
            return _super.prototype.destruct.call(this);
        };
        SendView.prototype.send = function () {
            if (wallet.pqMasterSeed !== null) {
                this.sendPq();
                return;
            }
            var self = this;
            if (this.sending)
                return;
            this.sending = true;
            blockchainExplorer.getHeight().then(function (blockchainHeight) {
                var amount = parseFloat(self.amountToSend);
                if (self.destinationAddress !== null) {
                    //todo use BigInteger
                    if (amount * Math.pow(10, config.coinUnitPlaces) > wallet.unlockedAmount(blockchainHeight)) {
                        self.sending = false;
                        swal({
                            type: 'error',
                            title: i18n.t('sendPage.notEnoughMoneyModal.title'),
                            text: i18n.t('sendPage.notEnoughMoneyModal.content'),
                            confirmButtonText: i18n.t('sendPage.notEnoughMoneyModal.confirmText'),
                        });
                        return;
                    }
                    //TODO use biginteger
                    var amountToSend = amount * Math.pow(10, config.coinUnitPlaces);
                    var destinationAddress_1 = self.destinationAddress;
                    var feeToSendWith = self.parseMoneyToAtomic(self.fee);
                    if (feeToSendWith === null || !self.feeIsValid) {
                        self.sending = false;
                        swal({
                            type: 'error',
                            title: i18n.t('sendPage.invalidAmountModal.title'),
                            html: i18n.t('sendPage.sendBlock.fee.invalid'),
                            confirmButtonText: i18n.t('sendPage.invalidAmountModal.confirmText'),
                        });
                        return;
                    }
                    swal({
                        title: i18n.t('sendPage.creatingTransferModal.title'),
                        html: i18n.t('sendPage.creatingTransferModal.content'),
                        onOpen: function () {
                            swal.showLoading();
                        }
                    });
                    var mixinToSendWith = parseInt(self.ringSize) - 1;
                    TransactionsExplorer_1.TransactionsExplorer.createTx([{ address: destinationAddress_1, amount: amountToSend }], self.paymentId, wallet, blockchainHeight, function (amounts, numberOuts) {
                        return blockchainExplorer.getRandomOuts(amounts, numberOuts);
                    }, function (amount, feesAmount) {
                        if (amount + feesAmount > wallet.unlockedAmount(blockchainHeight)) {
                            swal({
                                type: 'error',
                                title: i18n.t('sendPage.notEnoughMoneyModal.title'),
                                text: i18n.t('sendPage.notEnoughMoneyModal.content'),
                                confirmButtonText: i18n.t('sendPage.notEnoughMoneyModal.confirmText'),
                                onOpen: function () {
                                    swal.hideLoading();
                                }
                            });
                            throw '';
                        }
                        return new Promise(function (resolve, reject) {
                            setTimeout(function () {
                                swal({
                                    title: i18n.t('sendPage.confirmTransactionModal.title'),
                                    html: i18n.t('sendPage.confirmTransactionModal.content', {
                                        amount: amount / Math.pow(10, config.coinUnitPlaces),
                                        fees: feesAmount / Math.pow(10, config.coinUnitPlaces),
                                        total: (amount + feesAmount) / Math.pow(10, config.coinUnitPlaces),
                                    }),
                                    showCancelButton: true,
                                    confirmButtonText: i18n.t('sendPage.confirmTransactionModal.confirmText'),
                                    cancelButtonText: i18n.t('sendPage.confirmTransactionModal.cancelText'),
                                }).then(function (result) {
                                    if (result.dismiss) {
                                        reject('');
                                    }
                                    else {
                                        swal({
                                            title: i18n.t('sendPage.finalizingTransferModal.title'),
                                            html: i18n.t('sendPage.finalizingTransferModal.content'),
                                            onOpen: function () {
                                                swal.showLoading();
                                            }
                                        });
                                        resolve();
                                    }
                                }).catch(reject);
                            }, 1);
                        });
                    }, mixinToSendWith, false, feeToSendWith).then(function (rawTxData) {
                        blockchainExplorer.sendRawTx(rawTxData.raw.raw).then(function () {
                            self.sending = false;
                            //save the tx private key
                            wallet.addTxPrivateKeyWithTxHash(rawTxData.raw.hash, rawTxData.raw.prvkey);
                            // Retry the mempool refresh a few times because some nodes accept
                            // the tx before they expose it through the pool endpoint.
                            var watchdog = (0, DependencyInjector_1.DependencyInjectorInstance)().getInstance(WalletWatchdog_1.WalletWatchdog.name);
                            if (watchdog !== null) {
                                watchdog.checkMempool(true);
                                [1500, 5000, 15000].forEach(function (delay) {
                                    setTimeout(function () {
                                        watchdog.checkMempool(true);
                                    }, delay);
                                });
                            }
                            var promise = Promise.resolve();
                            if (destinationAddress_1 === 'Kdev1L9V5ow3cdKNqDpLcFFxZCqu5W2GE9xMKewsB2pUXWxcXvJaUWHcSrHuZw91eYfQFzRtGfTemReSSMN4kE445i6Etb3' ||
                                destinationAddress_1 === 'KarBo7DQFVyCpMcb1Zk8nLR1xjPdAmo9jJ27mwX7pbgD7nHrra5uRgJdwGmUyinzb5cYrumqLW7Av539Jm46tXHYQfrYyW2' ||
                                destinationAddress_1 === 'KdevxwLgUts7BVfWKFWrFWXLjfX6xf2HcbPP7jTirKhj1SWudNYFeKiHuLGRK4USLiBnaKPbNf7oj6iDNLgnn4Z45LhwtBi') {
                                promise = swal({
                                    type: 'success',
                                    title: i18n.t('sendPage.thankYouDonationModal.title'),
                                    text: i18n.t('sendPage.thankYouDonationModal.content'),
                                    confirmButtonText: i18n.t('sendPage.thankYouDonationModal.confirmText'),
                                    onClose: function () {
                                        window.location.href = '#!account';
                                    }
                                });
                            }
                            else
                                promise = swal({
                                    type: 'success',
                                    title: i18n.t('sendPage.transferSentModal.title'),
                                    confirmButtonText: i18n.t('sendPage.transferSentModal.confirmText'),
                                    onClose: function () {
                                        window.location.href = '#!account';
                                    }
                                });
                            promise.then(function () {
                                if (self.redirectUrlAfterSend !== null) {
                                    window.location.href = self.redirectUrlAfterSend.replace('{TX_HASH}', rawTxData.raw.hash);
                                }
                            });
                        }).catch(function (data) {
                            self.sending = false;
                            swal({
                                type: 'error',
                                title: i18n.t('sendPage.transferExceptionModal.title'),
                                html: i18n.t('sendPage.transferExceptionModal.content', { details: JSON.stringify(data) }),
                                confirmButtonText: i18n.t('sendPage.transferExceptionModal.confirmText'),
                            });
                        });
                        swal.close();
                    }).catch(function (error) {
                        self.sending = false;
                        //console.log(error);
                        if (error && error !== '') {
                            if (typeof error === 'string')
                                swal({
                                    type: 'error',
                                    title: i18n.t('sendPage.transferExceptionModal.title'),
                                    html: i18n.t('sendPage.transferExceptionModal.content', { details: error }),
                                    confirmButtonText: i18n.t('sendPage.transferExceptionModal.confirmText'),
                                });
                            else
                                swal({
                                    type: 'error',
                                    title: i18n.t('sendPage.transferExceptionModal.title'),
                                    html: i18n.t('sendPage.transferExceptionModal.content', { details: JSON.stringify(error) }),
                                    confirmButtonText: i18n.t('sendPage.transferExceptionModal.confirmText'),
                                });
                        }
                    });
                }
                else {
                    self.sending = false;
                    swal({
                        type: 'error',
                        title: i18n.t('sendPage.invalidAmountModal.title'),
                        html: i18n.t('sendPage.invalidAmountModal.content'),
                        confirmButtonText: i18n.t('sendPage.invalidAmountModal.confirmText'),
                    });
                }
            }).catch(function () {
                self.sending = false;
            });
        };
        SendView.prototype.sendPq = function () {
            var self = this;
            if (this.sending || this.destinationAddress === null || wallet.pqState === null)
                return;
            this.sending = true;
            try {
                if (this.paymentId !== '')
                    throw new Error('Payment IDs are not yet supported for Discrete PQ transfers');
                var requested = this.parseAtomicAmount(this.amountToSend);
                var fee = this.parseMoneyToAtomic(this.fee);
                if (requested === null || fee === null)
                    throw new Error('Invalid amount or fee');
                var amount = BigInt(requested);
                var feeAmount = BigInt(fee);
                var recipient = DiscreteRuntime.decodeAddress(this.destinationAddress, Boolean(config.testnet));
                var seed = new Uint8Array(wallet.pqMasterSeed.match(/../g).map(function (byte) { return parseInt(byte, 16); }));
                var keys = DiscreteRuntime.deriveWalletKeys(seed);
                // Consensus caps a PQ transaction at MAX_PQ_INPUTS_PER_TX inputs, and each
                // input carries its own 3309-byte ML-DSA-65 signature. Spend the largest
                // outputs first so the cap is reached as rarely as possible, and refuse
                // here rather than after minutes of signing a tx the daemon will reject.
                var spendable = wallet.pqState.outputs
                    .filter(function (output) { return !output.spent && output.unlockHeight <= wallet.lastHeight; })
                    .sort(function (a, b) { return BigInt(a.amount) === BigInt(b.amount) ? 0 : (BigInt(a.amount) > BigInt(b.amount) ? -1 : 1); });
                var spendableTotal = spendable.reduce(function (sum, output) { return sum + BigInt(output.amount); }, BigInt(0));
                var selected = [];
                var total = BigInt(0);
                for (var _i = 0, spendable_1 = spendable; _i < spendable_1.length; _i++) {
                    var output = spendable_1[_i];
                    if (selected.length >= MAX_PQ_INPUTS_PER_TX)
                        break;
                    selected.push(output);
                    total += BigInt(output.amount);
                    if (total >= amount + feeAmount)
                        break;
                }
                if (total < amount + feeAmount) {
                    if (spendableTotal >= amount + feeAmount)
                        throw new Error('This amount would need more than ' + MAX_PQ_INPUTS_PER_TX +
                            ' inputs, which is over the per-transaction limit. Send a smaller amount, ' +
                            'or consolidate your funds by sending them to yourself first.');
                    throw new Error('Not enough unlocked balance');
                }
                var destinations = [{ viewPublicKey: recipient.viewPublicKey, spendPublicKey: recipient.spendPublicKey,
                        amount: amount, subaddressIndex: this.accountNumberSubaddressIndex }];
                var change = total - amount - feeAmount;
                if (change > BigInt(0))
                    destinations.push({ viewPublicKey: keys.viewPublicKey, spendPublicKey: keys.spendPublicKey, amount: change });
                var built = DiscreteRuntime.buildSignedTransaction({ inputs: selected, destinations: destinations, fee: feeAmount,
                    spendPublicKey: keys.spendPublicKey, spendSecretKey: keys.spendSecretKey });
                var raw_1 = Array.prototype.map.call(built.bytes, function (byte) { return ('0' + byte.toString(16)).slice(-2); }).join('');
                swal({ title: i18n.t('sendPage.confirmTransactionModal.title'), html: i18n.t('sendPage.confirmTransactionModal.content', {
                        amount: Number(amount) / Math.pow(10, config.coinUnitPlaces), fees: Number(feeAmount) / Math.pow(10, config.coinUnitPlaces),
                        total: Number(amount + feeAmount) / Math.pow(10, config.coinUnitPlaces)
                    }), showCancelButton: true,
                    confirmButtonText: i18n.t('sendPage.confirmTransactionModal.confirmText'), cancelButtonText: i18n.t('sendPage.confirmTransactionModal.cancelText')
                }).then(function (result) {
                    if (result.dismiss) {
                        self.sending = false;
                        return;
                    }
                    return blockchainExplorer.sendRawTx(raw_1).then(function () {
                        self.sending = false;
                        swal({ type: 'success', title: i18n.t('sendPage.transferSentModal.title'),
                            confirmButtonText: i18n.t('sendPage.transferSentModal.confirmText'), onClose: function () { window.location.href = '#!account'; } });
                    });
                }).catch(function (error) { self.sending = false; swal({ type: 'error', title: i18n.t('sendPage.transferExceptionModal.title'), text: String(error) }); });
            }
            catch (error) {
                this.sending = false;
                swal({ type: 'error', title: i18n.t('sendPage.transferExceptionModal.title'), text: String(error) });
            }
        };
        SendView.prototype.destinationAddressUserWatch = function () {
            var self = this;
            var parsedAccountNumber = null;
            try {
                parsedAccountNumber = DiscreteRuntime.parseAccountNumber(this.destinationAddressUser);
            }
            catch (e) { }
            if (parsedAccountNumber !== null) {
                this.accountNumberSubaddressIndex = parsedAccountNumber.subaddressIndex;
                // Resolving (H,I,A) -> keys is asynchronous, but T above is applied now.
                // Anything left over from the previously typed number is therefore already
                // inconsistent: paying the OLD resolved address with the NEW deposit index
                // would send someone else's money to the wrong account. Drop the
                // destination until this number resolves on its own.
                this.destinationAddress = '';
                this.destinationAddressValid = false;
                this.accountNumberAddress = null;
                if (this.timeoutResolveAlias !== 0)
                    clearTimeout(this.timeoutResolveAlias);
                // Resolve the exact string T was parsed from, and ignore the answer if the
                // user has typed on since: clearTimeout cancels a pending debounce but not
                // an RPC already in flight.
                var pending_1 = this.destinationAddressUser;
                this.timeoutResolveAlias = setTimeout(function () {
                    blockchainExplorer.resolveAccountNumber(pending_1).then(function (address) {
                        if (self.destinationAddressUser !== pending_1)
                            return;
                        try {
                            if (wallet.pqMasterSeed !== null)
                                DiscreteRuntime.decodeAddress(address, Boolean(config.testnet));
                            else
                                Cn_1.Cn.decode_address(address);
                            self.destinationAddress = address;
                            self.accountNumberAddress = address;
                            self.destinationAddressValid = true;
                            self.accountNumberValid = true;
                        }
                        catch (e) {
                            self.destinationAddressValid = false;
                            self.accountNumberValid = false;
                            self.accountNumberAddress = null;
                        }
                        self.timeoutResolveAlias = 0;
                    }).catch(function () {
                        if (self.destinationAddressUser !== pending_1)
                            return;
                        self.destinationAddressValid = false;
                        self.accountNumberValid = false;
                        self.accountNumberAddress = null;
                        self.timeoutResolveAlias = 0;
                    });
                }, 400);
            }
            else {
                this.accountNumberSubaddressIndex = 0;
                this.accountNumberValid = true;
                this.accountNumberAddress = null;
                try {
                    if (wallet.pqMasterSeed !== null)
                        DiscreteRuntime.decodeAddress(this.destinationAddressUser, Boolean(config.testnet));
                    else
                        Cn_1.Cn.decode_address(this.destinationAddressUser);
                    this.destinationAddressValid = true;
                    this.destinationAddress = this.destinationAddressUser;
                }
                catch (e) {
                    this.destinationAddressValid = false;
                }
            }
        };
        SendView.prototype.amountToSendWatch = function () {
            this.amountToSendValid = this.parseAtomicAmount(this.amountToSend) !== null;
        };
        SendView.prototype.paymentIdWatch = function () {
            try {
                if (wallet.pqMasterSeed !== null) {
                    this.paymentIdValid = this.paymentId.length === 0;
                    return;
                }
                this.paymentIdValid = this.paymentId.length === 0 ||
                    (this.paymentId.length === 16 && (/^[0-9a-fA-F]{16}$/.test(this.paymentId))) ||
                    (this.paymentId.length === 64 && (/^[0-9a-fA-F]{64}$/.test(this.paymentId)));
            }
            catch (e) {
                this.paymentIdValid = false;
            }
        };
        SendView.prototype.ringSizeWatch = function () {
            if (this.pqWallet) {
                this.ringSizeIsValid = true;
                return;
            }
            var ringSize = parseInt(this.ringSize, 10);
            this.ringSizeIsValid = RING_SIZE_CHOICES.indexOf(ringSize) >= 0;
        };
        SendView.prototype.feeWatch = function () {
            this.feeIsValid = this.parseMoneyToAtomic(this.fee) !== null;
        };
        SendView.prototype.parseMoneyToAtomic = function (amount) {
            try {
                var atomicString = this.parseAtomicAmount(amount);
                if (atomicString === null)
                    return null;
                var atomic = new JSBigInt(atomicString);
                if (this.pqWallet)
                    return atomic;
                var minFee = new JSBigInt(this.moneyStringToAtomicString(MIN_FEE));
                var maxFee = new JSBigInt(this.moneyStringToAtomicString(MAX_FEE));
                if (atomic.compare(minFee) < 0 || atomic.compare(maxFee) > 0) {
                    return null;
                }
                return atomic;
            }
            catch (e) {
                return null;
            }
        };
        SendView.prototype.parseAtomicAmount = function (amount) {
            var normalized = (amount || '').trim();
            if (!/^[0-9]+(\.[0-9]+)?$/.test(normalized))
                return null;
            var parts = normalized.split('.');
            var decimal = parts.length > 1 ? parts[1] : '';
            if (decimal.length > config.coinUnitPlaces)
                return null;
            while (decimal.length < config.coinUnitPlaces)
                decimal += '0';
            var atomic = (parts[0] + decimal).replace(/^0+/, '') || '0';
            return BigInt(atomic) > BigInt(0) ? atomic : null;
        };
        SendView.prototype.moneyStringToAtomicString = function (amount) {
            var parts = amount.split('.');
            var decimal = parts.length > 1 ? parts[1] : '';
            while (decimal.length < config.coinUnitPlaces) {
                decimal += '0';
            }
            return (parts[0] + decimal).replace(/^0+/, '') || '0';
        };
        __decorate([
            (0, VueAnnotate_1.VueVar)('')
        ], SendView.prototype, "destinationAddressUser", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)('')
        ], SendView.prototype, "destinationAddress", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(false)
        ], SendView.prototype, "destinationAddressValid", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)('0')
        ], SendView.prototype, "amountToSend", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(false)
        ], SendView.prototype, "lockedForm", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(true)
        ], SendView.prototype, "amountToSendValid", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)('')
        ], SendView.prototype, "paymentId", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(true)
        ], SendView.prototype, "paymentIdValid", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(false)
        ], SendView.prototype, "advancedOpen", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)('16')
        ], SendView.prototype, "ringSize", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(true)
        ], SendView.prototype, "ringSizeIsValid", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(MIN_FEE)
        ], SendView.prototype, "minimumFee", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)('0.01')
        ], SendView.prototype, "fee", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(true)
        ], SendView.prototype, "feeIsValid", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(false)
        ], SendView.prototype, "sending", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(false)
        ], SendView.prototype, "pqWallet", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(null)
        ], SendView.prototype, "txDestinationName", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(null)
        ], SendView.prototype, "txDescription", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(null)
        ], SendView.prototype, "accountNumberAddress", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(true)
        ], SendView.prototype, "accountNumberValid", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(false)
        ], SendView.prototype, "qrScanning", void 0);
        __decorate([
            (0, VueAnnotate_1.VueVar)(false)
        ], SendView.prototype, "nfcAvailable", void 0);
        __decorate([
            (0, DependencyInjector_1.Autowire)(Nfc_1.Nfc.name)
        ], SendView.prototype, "nfc", void 0);
        __decorate([
            (0, VueAnnotate_1.VueWatched)()
        ], SendView.prototype, "destinationAddressUserWatch", null);
        __decorate([
            (0, VueAnnotate_1.VueWatched)()
        ], SendView.prototype, "amountToSendWatch", null);
        __decorate([
            (0, VueAnnotate_1.VueWatched)()
        ], SendView.prototype, "paymentIdWatch", null);
        __decorate([
            (0, VueAnnotate_1.VueWatched)()
        ], SendView.prototype, "ringSizeWatch", null);
        __decorate([
            (0, VueAnnotate_1.VueWatched)()
        ], SendView.prototype, "feeWatch", null);
        return SendView;
    }(DestructableView_1.DestructableView));
    if (wallet !== null && blockchainExplorer !== null)
        new SendView('#app');
    else {
        AppState_1.AppState.askUserOpenWallet(false).then(function () {
            wallet = (0, DependencyInjector_1.DependencyInjectorInstance)().getInstance(Wallet_1.Wallet.name, 'default', false);
            if (wallet === null)
                throw 'e';
            new SendView('#app');
        }).catch(function () {
            window.location.href = '#index';
        });
    }
});
