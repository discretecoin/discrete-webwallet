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

import {DestructableView} from "../lib/numbersLab/DestructableView";
import {VueRequireFilter, VueVar, VueWatched} from "../lib/numbersLab/VueAnnotate";
import {TransactionsExplorer} from "../model/TransactionsExplorer";
import {Autowire, DependencyInjectorInstance} from "../lib/numbersLab/DependencyInjector";
import {Wallet} from "../model/Wallet";
import {Url} from "../utils/Url";
import {CoinUri} from "../model/CoinUri";
import {QRReader} from "../model/QRReader";
import {AppState} from "../model/AppState";
import {BlockchainExplorerProvider} from "../providers/BlockchainExplorerProvider";
import {NdefMessage, Nfc} from "../model/Nfc";
import {BlockchainExplorer, RawDaemon_OutsForAmount} from "../model/blockchain/BlockchainExplorer";
import {Cn} from "../model/Cn";
import {WalletWatchdog} from "../model/WalletWatchdog";

let wallet: Wallet = DependencyInjectorInstance().getInstance(Wallet.name, 'default', false);
let blockchainExplorer: BlockchainExplorer = BlockchainExplorerProvider.getInstance();
// Triptych ring sizes the daemon accepts for non-coinbase inputs. The
// coinbase carve-out (ring size 1) is selected automatically by the
// wallet; the user only picks among the privacy-preserving values.
const RING_SIZE_CHOICES = [4, 8, 16];
const MIN_FEE = '0.01';
const MAX_FEE = '0.1';
// Consensus limit on PQ transaction inputs (parameters::MAX_PQ_INPUTS_PER_TX in
// the daemon's CryptoNoteConfig.h). Keep the two in step.
const MAX_PQ_INPUTS_PER_TX = 32;

AppState.enableLeftMenu();

class SendView extends DestructableView {
	@VueVar('') destinationAddressUser !: string;
	@VueVar('') destinationAddress !: string;
	@VueVar(false) destinationAddressValid !: boolean;
	@VueVar('0') amountToSend !: string;
	@VueVar(false) lockedForm !: boolean;
	@VueVar(true) amountToSendValid !: boolean;
	@VueVar('') paymentId !: string;
	@VueVar(true) paymentIdValid !: boolean;
	@VueVar(false) advancedOpen !: boolean;
	@VueVar('16') ringSize !: string;
	@VueVar(true) ringSizeIsValid !: boolean;
	@VueVar(MIN_FEE) minimumFee !: string;
	@VueVar('0.01') fee !: string;
	@VueVar(true) feeIsValid !: boolean;
	@VueVar(false) sending !: boolean;
	@VueVar(false) pqWallet !: boolean;

	@VueVar(null) txDestinationName !: string | null;
	@VueVar(null) txDescription !: string | null;

	@VueVar(null) accountNumberAddress !: string | null;
	@VueVar(true) accountNumberValid !: boolean;
	accountNumberSubaddressIndex: number = 0;

	@VueVar(false) qrScanning !: boolean;
	@VueVar(false) nfcAvailable !: boolean;

	@Autowire(Nfc.name) nfc !: Nfc;

	qrReader: QRReader | null = null;
	redirectUrlAfterSend: string | null = null;

	ndefListener : ((data: NdefMessage)=>void)|null = null;

	constructor(container: string) {
		super(container);
		this.pqWallet = wallet.pqMasterSeed !== null;
		let sendAddress = Url.getHashSearchParameter('address');
		let amount = Url.getHashSearchParameter('amount');
		let destinationName = Url.getHashSearchParameter('destName');
		let description = Url.getHashSearchParameter('txDesc');
		let redirect = Url.getHashSearchParameter('redirect');
		if (sendAddress !== null) this.destinationAddressUser = sendAddress.substr(0, 256);
		if (amount !== null) this.amountToSend = amount;
		if (destinationName !== null) this.txDestinationName = destinationName.substr(0, 256);
		if (description !== null) this.txDescription = description.substr(0, 256);
		if (redirect !== null) this.redirectUrlAfterSend = decodeURIComponent(redirect);
		this.ringSize = (config.defaultMixin + 1).toString();
		this.fee = Cn.formatMoney((<any>window).config.coinFee);

		this.nfcAvailable = this.nfc.has;
	}

	reset() {
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
	}

	startNfcScan(){
		let self = this;
		if(this.ndefListener === null) {
			this.ndefListener = function (data: NdefMessage) {
				if (data.text)
					self.handleScanResult(data.text.content);
				swal.close();
			};
			this.nfc.listenNdef(this.ndefListener);
			swal({
				title:  i18n.t('sendPage.waitingNfcModal.title'),
				html: i18n.t('sendPage.waitingNfcModal.content'),
				onOpen: () => {
					swal.showLoading();
				},
				onClose: () => {
					this.stopNfcScan();
				}
			}).then((result : any) => {
			});
		}
	}

	stopNfcScan(){
		if(this.ndefListener !== null)
			this.nfc.removeNdef(this.ndefListener);
		this.ndefListener = null;
	}

	initQr() {
		this.stopScan();
		this.qrReader = new QRReader();
		this.qrReader.init('/lib/');
	}

	startScan() {
		let self = this;
		if(typeof window.QRScanner !== 'undefined') {
			window.QRScanner.scan(function (err : any, result : any){
				if (err) {
					if(err.name === 'SCAN_CANCELED'){

					}else{
						alert(JSON.stringify(err));
					}
				} else {
					self.handleScanResult(result);
				}
			});

			window.QRScanner.show();
			$('body').addClass('transparent');
			$('#appContent').hide();
			$('#nativeCameraPreview').show();
		}else {
			this.initQr();
			if (this.qrReader) {
				this.qrScanning = true;
				this.qrReader.scan(function (result: string) {
					self.qrScanning = false;
					self.handleScanResult(result);
				});
			}
		}
	}

	handleScanResult(result : string){
		//console.log('Scan result:', result);
		let self = this;
		let parsed = false;
		try {
			let txDetails = CoinUri.decodeTx(result);
			if (txDetails !== null) {
				self.destinationAddressUser = txDetails.address;
				if (typeof txDetails.description !== 'undefined') self.txDescription = txDetails.description;
				if (typeof txDetails.recipientName !== 'undefined') self.txDestinationName = txDetails.recipientName;
				if (typeof txDetails.amount !== 'undefined') {
					self.amountToSend = txDetails.amount;
					self.lockedForm = true;
				}
				if(typeof txDetails.paymentId !== 'undefined')self.paymentId = txDetails.paymentId;
				parsed = true;
			}
		} catch (e) {
		}

		try {
			let txDetails = CoinUri.decodeWallet(result);
			if (txDetails !== null) {
				self.destinationAddressUser = txDetails.address;
				parsed = true;
			}
		} catch (e) {
		}

		if (!parsed)
			self.destinationAddressUser = result;
		self.stopScan();
	}

	stopScan() {
		if(typeof window.QRScanner !== 'undefined') {
			window.QRScanner.cancelScan(function (status:any){
				//console.log(status);
			});
			window.QRScanner.hide();
			$('body').removeClass('transparent');
			$('#appContent').show();
			$('#nativeCameraPreview').hide();
		}else {
			if (this.qrReader !== null) {
				this.qrReader.stop();
				this.qrReader = null;
				this.qrScanning = false;
			}
		}

	}


	destruct(): Promise<void> {
		this.stopScan();
		this.stopNfcScan();
		swal.close();
		return super.destruct();
	}

	send() {
		if(wallet.pqMasterSeed !== null){
			this.sendPq();
			return;
		}
		let self = this;
		if (this.sending) return;
		this.sending = true;
		blockchainExplorer.getHeight().then(function (blockchainHeight: number) {
			let amount = parseFloat(self.amountToSend);
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
				let amountToSend = amount * Math.pow(10, config.coinUnitPlaces);
				let destinationAddress = self.destinationAddress;
				let feeToSendWith = self.parseMoneyToAtomic(self.fee);
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
					onOpen: () => {
						swal.showLoading();
					}
				});

				let mixinToSendWith: number = parseInt(self.ringSize) - 1;

				TransactionsExplorer.createTx([{address: destinationAddress, amount: amountToSend}], self.paymentId, wallet, blockchainHeight,
					function (amounts: any[], numberOuts: number): Promise<RawDaemon_OutsForAmount[]> {
						return blockchainExplorer.getRandomOuts(amounts, numberOuts);
					}
					, function (amount: number, feesAmount: number): Promise<void> {
						if (amount + feesAmount > wallet.unlockedAmount(blockchainHeight)) {
							swal({
								type: 'error',
								title: i18n.t('sendPage.notEnoughMoneyModal.title'),
								text: i18n.t('sendPage.notEnoughMoneyModal.content'),
								confirmButtonText: i18n.t('sendPage.notEnoughMoneyModal.confirmText'),
								onOpen: () => {
									swal.hideLoading();
								}
							});
							throw '';
						}

						return new Promise<void>(function (resolve, reject) {
							setTimeout(function () {//prevent bug with swal when code is too fast
								swal({
									title: i18n.t('sendPage.confirmTransactionModal.title'),
									html: i18n.t('sendPage.confirmTransactionModal.content', {
										amount:amount / Math.pow(10, config.coinUnitPlaces),
										fees:feesAmount / Math.pow(10, config.coinUnitPlaces),
										total:(amount+feesAmount) / Math.pow(10, config.coinUnitPlaces),
									}),
									showCancelButton: true,
									confirmButtonText: i18n.t('sendPage.confirmTransactionModal.confirmText'),
									cancelButtonText: i18n.t('sendPage.confirmTransactionModal.cancelText'),
								}).then(function (result: any) {
									if (result.dismiss) {
										reject('');
									} else {
										swal({
											title: i18n.t('sendPage.finalizingTransferModal.title'),
											html: i18n.t('sendPage.finalizingTransferModal.content'),
											onOpen: () => {
												swal.showLoading();
											}
										});
										resolve();
									}
								}).catch(reject);
							}, 1);
						});
					},
					mixinToSendWith,
					false,
					feeToSendWith).then(function (rawTxData: { raw: { hash: string, prvkey: string, raw: string }, signed: any }) {
					blockchainExplorer.sendRawTx(rawTxData.raw.raw).then(function () {
						self.sending = false;
						//save the tx private key
						wallet.addTxPrivateKeyWithTxHash(rawTxData.raw.hash, rawTxData.raw.prvkey);

						// Retry the mempool refresh a few times because some nodes accept
						// the tx before they expose it through the pool endpoint.
						let watchdog: WalletWatchdog = DependencyInjectorInstance().getInstance(WalletWatchdog.name);
						if (watchdog !== null) {
							watchdog.checkMempool(true);
							[1500, 5000, 15000].forEach(function(delay: number) {
								setTimeout(function() {
									watchdog.checkMempool(true);
								}, delay);
							});
						}

						let promise = Promise.resolve();
						if (
							destinationAddress === 'Kdev1L9V5ow3cdKNqDpLcFFxZCqu5W2GE9xMKewsB2pUXWxcXvJaUWHcSrHuZw91eYfQFzRtGfTemReSSMN4kE445i6Etb3' ||
							destinationAddress === 'KarBo7DQFVyCpMcb1Zk8nLR1xjPdAmo9jJ27mwX7pbgD7nHrra5uRgJdwGmUyinzb5cYrumqLW7Av539Jm46tXHYQfrYyW2' ||
							destinationAddress === 'KdevxwLgUts7BVfWKFWrFWXLjfX6xf2HcbPP7jTirKhj1SWudNYFeKiHuLGRK4USLiBnaKPbNf7oj6iDNLgnn4Z45LhwtBi'
						) {
							promise = swal({
								type: 'success',
								title: i18n.t('sendPage.thankYouDonationModal.title'),
								text: i18n.t('sendPage.thankYouDonationModal.content'),
								confirmButtonText: i18n.t('sendPage.thankYouDonationModal.confirmText'),
								onClose: () => {
									window.location.href = '#!account';
								}
							});
						} else
							promise = swal({
								type: 'success',
								title: i18n.t('sendPage.transferSentModal.title'),
								confirmButtonText: i18n.t('sendPage.transferSentModal.confirmText'),
								onClose: () => {
									window.location.href = '#!account';
								}
							});

						promise.then(function () {
							if (self.redirectUrlAfterSend !== null) {
								window.location.href = self.redirectUrlAfterSend.replace('{TX_HASH}', rawTxData.raw.hash);
							}
						});
					}).catch(function (data: any) {
						self.sending = false;
						swal({
							type: 'error',
							title: i18n.t('sendPage.transferExceptionModal.title'),
							html: i18n.t('sendPage.transferExceptionModal.content', {details: JSON.stringify(data)}),
							confirmButtonText: i18n.t('sendPage.transferExceptionModal.confirmText'),
						});
					});
					swal.close();
				}).catch(function (error: any) {
					self.sending = false;
					//console.log(error);
					if (error && error !== '') {
						if (typeof error === 'string')
							swal({
								type: 'error',
								title: i18n.t('sendPage.transferExceptionModal.title'),
								html: i18n.t('sendPage.transferExceptionModal.content', {details: error}),
								confirmButtonText: i18n.t('sendPage.transferExceptionModal.confirmText'),
							});
						else
							swal({
								type: 'error',
								title: i18n.t('sendPage.transferExceptionModal.title'),
								html: i18n.t('sendPage.transferExceptionModal.content', {details: JSON.stringify(error)}),
								confirmButtonText: i18n.t('sendPage.transferExceptionModal.confirmText'),
							});
					}
				});
			} else {
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
	}

	private sendPq(){
		let self = this;
		if(this.sending || this.destinationAddress === null || wallet.pqState === null) return;
		this.sending = true;
		try {
			if(this.paymentId !== '') throw new Error('Payment IDs are not yet supported for Discrete PQ transfers');
			let requested = this.parseAtomicAmount(this.amountToSend);
			let fee = this.parseMoneyToAtomic(this.fee);
			if(requested === null || fee === null) throw new Error('Invalid amount or fee');
			let amount = BigInt(requested);
			let feeAmount = BigInt(fee);
			let recipient = DiscreteRuntime.decodeAddress(this.destinationAddress, Boolean((<any>config).testnet));
			let seed = new Uint8Array((wallet.pqMasterSeed as string).match(/../g)!.map(byte => parseInt(byte, 16)));
			let keys = DiscreteRuntime.deriveWalletKeys(seed);
			// Consensus caps a PQ transaction at MAX_PQ_INPUTS_PER_TX inputs, and each
			// input carries its own 3309-byte ML-DSA-65 signature. Spend the largest
			// outputs first so the cap is reached as rarely as possible, and refuse
			// here rather than after minutes of signing a tx the daemon will reject.
			let spendable = wallet.pqState.outputs
				.filter((output:any) => !output.spent && output.unlockHeight <= wallet.lastHeight)
				.sort((a:any, b:any) => BigInt(a.amount) === BigInt(b.amount) ? 0 : (BigInt(a.amount) > BigInt(b.amount) ? -1 : 1));
			let spendableTotal = spendable.reduce((sum:bigint, output:any) => sum + BigInt(output.amount), BigInt(0));
			let selected:any[] = [];
			let total = BigInt(0);
			for(let output of spendable){
				if(selected.length >= MAX_PQ_INPUTS_PER_TX) break;
				selected.push(output);
				total += BigInt(output.amount);
				if(total >= amount + feeAmount) break;
			}
			if(total < amount + feeAmount) {
				if(spendableTotal >= amount + feeAmount)
					throw new Error('This amount would need more than ' + MAX_PQ_INPUTS_PER_TX +
						' inputs, which is over the per-transaction limit. Send a smaller amount, ' +
						'or consolidate your funds by sending them to yourself first.');
				throw new Error('Not enough unlocked balance');
			}
			let destinations:any[] = [{viewPublicKey:recipient.viewPublicKey, spendPublicKey:recipient.spendPublicKey,
				amount:amount, subaddressIndex:this.accountNumberSubaddressIndex}];
			let change = total - amount - feeAmount;
			if(change > BigInt(0)) destinations.push({viewPublicKey:keys.viewPublicKey, spendPublicKey:keys.spendPublicKey, amount:change});
			let built = DiscreteRuntime.buildSignedTransaction({inputs:selected, destinations:destinations, fee:feeAmount,
				spendPublicKey:keys.spendPublicKey, spendSecretKey:keys.spendSecretKey});
			let raw = Array.prototype.map.call(built.bytes, (byte:number) => ('0'+byte.toString(16)).slice(-2)).join('');
			swal({title:i18n.t('sendPage.confirmTransactionModal.title'), html:i18n.t('sendPage.confirmTransactionModal.content', {
				amount:Number(amount) / Math.pow(10, config.coinUnitPlaces), fees:Number(feeAmount) / Math.pow(10, config.coinUnitPlaces),
				total:Number(amount + feeAmount) / Math.pow(10, config.coinUnitPlaces)}), showCancelButton:true,
				confirmButtonText:i18n.t('sendPage.confirmTransactionModal.confirmText'), cancelButtonText:i18n.t('sendPage.confirmTransactionModal.cancelText')
			}).then(function(result:any){
				if(result.dismiss){ self.sending = false; return; }
				return blockchainExplorer.sendRawTx(raw).then(function(){
					self.sending = false;
					swal({type:'success', title:i18n.t('sendPage.transferSentModal.title'),
						confirmButtonText:i18n.t('sendPage.transferSentModal.confirmText'), onClose:()=>{window.location.href='#!account';}});
				});
			}).catch(function(error:any){ self.sending=false; swal({type:'error', title:i18n.t('sendPage.transferExceptionModal.title'), text:String(error)}); });
		}catch(error){
			this.sending = false;
			swal({type:'error', title:i18n.t('sendPage.transferExceptionModal.title'), text:String(error)});
		}
	}

	timeoutResolveAlias = 0;

	@VueWatched()
	destinationAddressUserWatch() {
		let self = this;
		let parsedAccountNumber:any = null;
		try { parsedAccountNumber = DiscreteRuntime.parseAccountNumber(this.destinationAddressUser); } catch (e) {}
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
			let pending = this.destinationAddressUser;
			this.timeoutResolveAlias = <any>setTimeout(function () {
				blockchainExplorer.resolveAccountNumber(pending).then(function (address: string) {
					if (self.destinationAddressUser !== pending) return;
					try {
						if(wallet.pqMasterSeed !== null) DiscreteRuntime.decodeAddress(address, Boolean((<any>config).testnet));
						else Cn.decode_address(address);
						self.destinationAddress = address;
						self.accountNumberAddress = address;
						self.destinationAddressValid = true;
						self.accountNumberValid = true;
					} catch (e) {
						self.destinationAddressValid = false;
						self.accountNumberValid = false;
						self.accountNumberAddress = null;
					}
					self.timeoutResolveAlias = 0;
				}).catch(function () {
					if (self.destinationAddressUser !== pending) return;
					self.destinationAddressValid = false;
					self.accountNumberValid = false;
					self.accountNumberAddress = null;
					self.timeoutResolveAlias = 0;
				});
			}, 400);
		} else {
			this.accountNumberSubaddressIndex = 0;
			this.accountNumberValid = true;
			this.accountNumberAddress = null;
			try {
				if(wallet.pqMasterSeed !== null) DiscreteRuntime.decodeAddress(this.destinationAddressUser, Boolean((<any>config).testnet));
				else Cn.decode_address(this.destinationAddressUser);
				this.destinationAddressValid = true;
				this.destinationAddress = this.destinationAddressUser;
			} catch (e) {
				this.destinationAddressValid = false;
			}
		}
	}

	@VueWatched()
	amountToSendWatch() {
		this.amountToSendValid = this.parseAtomicAmount(this.amountToSend) !== null;
	}

	@VueWatched()
	paymentIdWatch() {
		try {
			if(wallet.pqMasterSeed !== null) {
				this.paymentIdValid = this.paymentId.length === 0;
				return;
			}
			this.paymentIdValid = this.paymentId.length === 0 ||
				(this.paymentId.length === 16 && (/^[0-9a-fA-F]{16}$/.test(this.paymentId))) ||
				(this.paymentId.length === 64 && (/^[0-9a-fA-F]{64}$/.test(this.paymentId)))
			;
		} catch (e) {
			this.paymentIdValid = false;
		}
	}

	@VueWatched()
	ringSizeWatch() {
		if(this.pqWallet) {
			this.ringSizeIsValid = true;
			return;
		}
		const ringSize = parseInt(this.ringSize, 10);
		this.ringSizeIsValid = RING_SIZE_CHOICES.indexOf(ringSize) >= 0;
	}

	@VueWatched()
	feeWatch() {
		this.feeIsValid = this.parseMoneyToAtomic(this.fee) !== null;
	}

	parseMoneyToAtomic(amount: string): any {
		try {
			let atomicString = this.parseAtomicAmount(amount);
			if(atomicString === null) return null;
			let atomic = new JSBigInt(atomicString);
			if(this.pqWallet) return atomic;
			let minFee = new JSBigInt(this.moneyStringToAtomicString(MIN_FEE));
			let maxFee = new JSBigInt(this.moneyStringToAtomicString(MAX_FEE));
			if (atomic.compare(minFee) < 0 || atomic.compare(maxFee) > 0) {
				return null;
			}
			return atomic;
		} catch (e) {
			return null;
		}
	}

	parseAtomicAmount(amount: string): string|null {
		let normalized = (amount || '').trim();
		if (!/^[0-9]+(\.[0-9]+)?$/.test(normalized)) return null;
		let parts = normalized.split('.');
		let decimal = parts.length > 1 ? parts[1] : '';
		if (decimal.length > config.coinUnitPlaces) return null;
		while (decimal.length < config.coinUnitPlaces) decimal += '0';
		let atomic = (parts[0] + decimal).replace(/^0+/, '') || '0';
		return BigInt(atomic) > BigInt(0) ? atomic : null;
	}

	moneyStringToAtomicString(amount: string): string {
		let parts = amount.split('.');
		let decimal = parts.length > 1 ? parts[1] : '';
		while (decimal.length < config.coinUnitPlaces) {
			decimal += '0';
		}
		return (parts[0] + decimal).replace(/^0+/, '') || '0';
	}
}


if (wallet !== null && blockchainExplorer !== null)
	new SendView('#app');
else {
	AppState.askUserOpenWallet(false).then(function () {
		wallet = DependencyInjectorInstance().getInstance(Wallet.name, 'default', false);
		if (wallet === null)
			throw 'e';
		new SendView('#app');
	}).catch(function () {
		window.location.href = '#index';
	});
}
