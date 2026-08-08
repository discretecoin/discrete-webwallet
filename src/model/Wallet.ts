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

import {Transaction, TransactionIn, TransactionOut} from "./Transaction";
import {KeysRepository, UserKeys} from "./KeysRepository";
import {Observable} from "../lib/numbersLab/Observable";
import {Cn, CnNativeBride, CnTransactions} from "./Cn";

export type RawWalletOptions = {
	checkMinerTx?:boolean,
	readSpeed:number,
	customNode?:boolean,
	nodeUrl:string
}

export class WalletOptions{
	checkMinerTx:boolean = false;
	readSpeed:number = 10;
	customNode:boolean = false;
	nodeUrl:string = 'http://127.0.0.1:9331/';

	static fromRaw(raw : RawWalletOptions){
		let options = new WalletOptions();

		if(typeof raw.checkMinerTx !== 'undefined')options.checkMinerTx = raw.checkMinerTx;
		if(typeof raw.readSpeed !== 'undefined')options.readSpeed = raw.readSpeed;
		if(typeof raw.customNode !== 'undefined')options.customNode = raw.customNode;
		if(typeof raw.nodeUrl !== 'undefined')options.nodeUrl = raw.nodeUrl;

		return options;
	}

	exportToJson() : RawWalletOptions{
		let data : RawWalletOptions = {
			readSpeed:this.readSpeed,
			checkMinerTx:this.checkMinerTx,
			customNode:this.customNode,
			nodeUrl:this.nodeUrl
		};
		return data;
	}
}


export type RawWallet = {
	transactions : any[],
	txPrivateKeys?:any,
	lastHeight : number,
	encryptedKeys?:string|Array<number>,
	nonce:string,
	keys?:UserKeys,
	creationHeight?:number,
	options?:RawWalletOptions,
	coinAddressPrefix?:any,
	pqMasterSeed?:string,
	pqAddress?:string,
	pqState?:any,
	// Word list the recovery phrase shown to the user was minted in. Absent on any
	// wallet created before phrase portability was enforced, which is exactly the
	// signal that its backup predates the fix and is worth re-checking.
	mnemonicLang?:string,
}
export type RawFullyEncryptedWallet = {
	data:number[],
	nonce:string
}

export class Wallet extends Observable{
	// lastHeight : number = 114000;
	// lastHeight : number = 75900;
	// private _lastHeight : number = 50000;
	private _lastHeight : number = 0;

	private transactions : Transaction[] = [];
	txsMem : Transaction[] = [];
	private modified = true;
	private modifiedTS: Date = new Date();
	creationHeight : number = 0;
	txPrivateKeys : {[id: string]: string} = {};
	coinAddressPrefix:any = config.addressPrefix;

	keys !: UserKeys;
	pqMasterSeed: string|null = null;
	pqAddress: string|null = null;
	pqState: any = null;
	pqMempoolState: any = null;
	// See RawWallet.mnemonicLang. null means "unknown", not "none".
	mnemonicLang: string|null = null;

	private _options : WalletOptions = new WalletOptions();

	signalChanged = () => {
		this.modifiedTS = new Date();
		this.modified = true;
		this.notify(Observable.EVENT_MODIFIED);
	}

	exportToRaw() : RawWallet{
		let transactions : any[] = [];
		for(let transaction of this.transactions){
			transactions.push(transaction.export());
		}

		let data : RawWallet = {
			transactions: transactions,
			txPrivateKeys:this.txPrivateKeys,
			lastHeight: this._lastHeight,
			nonce:'',
			options : this._options,
			coinAddressPrefix:this.coinAddressPrefix
		};

		data.keys = this.keys;
		if(this.pqMasterSeed !== null) data.pqMasterSeed = this.pqMasterSeed;
		if(this.pqAddress !== null) data.pqAddress = this.pqAddress;
		if(this.pqState !== null) data.pqState = this.pqState.toJSON();
		if(this.mnemonicLang !== null) data.mnemonicLang = this.mnemonicLang;

		if(this.creationHeight !== 0) data.creationHeight = this.creationHeight;

		return data;
	}

	static loadFromRaw(raw : RawWallet) : Wallet{
		logDebugMsg("Wallet.loadFromRaw");
		let wallet = new Wallet();
		wallet.transactions = [];
		for(let rawTransac of raw.transactions){
			wallet.transactions.push(Transaction.fromRaw(rawTransac));
		}
		wallet._lastHeight = raw.lastHeight;
		if(typeof raw.encryptedKeys === 'string' && raw.encryptedKeys !== '') {
			if(raw.encryptedKeys.length === 128) {
				let privView = raw.encryptedKeys.substr(0, 64);
				let privSpend = raw.encryptedKeys.substr(64, 64);
				wallet.keys =  KeysRepository.fromPriv(privSpend, privView);
			}else{
				let privView = raw.encryptedKeys.substr(0, 64);
				let pubViewKey = raw.encryptedKeys.substr(64, 64);
				let pubSpendKey = raw.encryptedKeys.substr(128, 64);

				wallet.keys = {
					pub:{
						view:pubViewKey,
						spend:pubSpendKey
					},
					priv:{
						view:privView,
						spend:'',
					}
				};
			}
		}else if(typeof raw.keys !== 'undefined'){
			wallet.keys = raw.keys;
		}
		if(typeof raw.creationHeight !== 'undefined') wallet.creationHeight = raw.creationHeight;

		if(typeof raw.options !== 'undefined') wallet._options = WalletOptions.fromRaw(raw.options);
		if(typeof raw.txPrivateKeys !== 'undefined') wallet.txPrivateKeys = raw.txPrivateKeys;

		if(typeof raw.coinAddressPrefix !== 'undefined') wallet.coinAddressPrefix = raw.coinAddressPrefix;
		else wallet.coinAddressPrefix = config.addressPrefix;

		if(typeof raw.coinAddressPrefix !== 'undefined') wallet.coinAddressPrefix = raw.coinAddressPrefix;
		else wallet.coinAddressPrefix = config.addressPrefix;

		if(typeof raw.pqMasterSeed === 'string') wallet.pqMasterSeed = raw.pqMasterSeed;
		if(typeof raw.pqAddress === 'string') wallet.pqAddress = raw.pqAddress;
		if(typeof raw.mnemonicLang === 'string') wallet.mnemonicLang = raw.mnemonicLang;
		if(typeof raw.pqState !== 'undefined') wallet.pqState = DiscreteRuntime.DiscreteWalletState.fromJSON(raw.pqState);
		if(wallet.pqMasterSeed !== null && wallet.pqState === null) wallet.pqState = new DiscreteRuntime.DiscreteWalletState();
		if(wallet.pqMasterSeed === null) wallet.recalculateKeyImages();
		return wallet;
	}

	initializePq(masterSeed: Uint8Array, testnet: boolean = false){
		let derived = DiscreteRuntime.deriveWalletKeys(masterSeed);
		let toHex = (value: Uint8Array) => Array.prototype.map.call(value, (byte:number) => ('0'+byte.toString(16)).slice(-2)).join('');
		this.pqMasterSeed = toHex(masterSeed);
		this.pqAddress = DiscreteRuntime.encodeAddress(derived.viewPublicKey, derived.spendPublicKey, config.addressPrefix, testnet);
		this.pqState = new DiscreteRuntime.DiscreteWalletState();
		this.keys = {pub:{view:toHex(derived.viewPublicKey), spend:toHex(derived.spendPublicKey)},
			priv:{view:toHex(derived.viewSecretKey), spend:toHex(derived.spendSecretKey)}};
	}

	isViewOnly(){
		return this.keys.priv.spend === '';
	}

	get lastHeight(): number {
		return this._lastHeight;
	}

	set lastHeight(value: number) {
		let modified = value !== this._lastHeight;
		this._lastHeight = value;
		if(modified)this.notify();
	}

	get options(): WalletOptions {
		return this._options;
	}

	set options(value: WalletOptions) {
		this._options = value;
		this.signalChanged();
	}

	getAll(forceReload = false) : Transaction[]{
		return this.transactions.slice();
	}

	getAllOuts() : TransactionOut[]{
		let alls = this.getAll();
		let outs : TransactionOut[] = [];
		for(let tr of alls){
			outs.push.apply(outs, tr.outs);
		}
		return outs;
	}

	addNew(transaction : Transaction, replace = true){
		let exist = this.findWithTxPubKey(transaction.txPubKey);
		if(!exist || replace) {
			if(!exist) {
				this.transactions.push(transaction);
			} else {
				for(let tr = 0; tr < this.transactions.length; ++tr) {
					if(this.transactions[tr].txPubKey === transaction.txPubKey) {
						this.transactions[tr] = transaction;
					}
				}
			}

			// remove from unconfirmed
			let existMem = this.findMemWithTxPubKey(transaction.txPubKey);
			if(existMem) {
				let trIndex = this.txsMem.indexOf(existMem);
				if(trIndex != -1) {
					this.txsMem.splice(trIndex, 1);
				}
			}

			// this.saveAll();
			this.recalculateKeyImages();
			this.signalChanged();
			this.notify();
		}
	}

	findWithTxPubKey(pubKey : string) : Transaction|null{
		for(let tr of this.transactions)
			if(tr.txPubKey === pubKey)
				return tr;
		return null;
	}

	findMemWithTxPubKey(pubKey : string) : Transaction|null{
		for(let tr of this.txsMem)
			if(tr.txPubKey === pubKey)
				return tr;
		return null;
	}

	findWithTxHash(hash : string) : Transaction|null{
		for(let tr of this.transactions)
			if(tr.hash === hash)
				return tr;
		for(let tr of this.txsMem)
			if(tr.hash === hash)
				return tr;
		return null;
	}
	
	findTxPrivateKeyWithHash(hash : string) : string|null{
		if(typeof this.txPrivateKeys[hash] !== 'undefined')
			return this.txPrivateKeys[hash];
		return null;
	}

	addTxPrivateKeyWithTxHash(txHash : string, txPrivKey : string) : void{
		this.txPrivateKeys[txHash] = txPrivKey;
		this.signalChanged();
	}

	getTransactionKeyImages(){
		return this.keyImages;
	}

	getTransactionOutIndexes(){
		return this.txOutIndexes;
	}

	getOutWithGlobalIndex(index : number) : TransactionOut|null{
		for(let tx of this.transactions){
			for(let out of tx.outs){
				if(out.globalIndex === index)
					return out;
			}
		}
		return null;
	}

	private keyImages : string[] = [];
	private txOutIndexes : number[] = [];
	private recalculateKeyImages(){
		let keys : string[] = [];
		let indexes : number[] = [];
		for(let transaction of this.transactions){
			for(let out of transaction.outs){
				if(out.keyImage !== null && out.keyImage !== '')
					keys.push(out.keyImage);
				if(out.globalIndex !== 0)
					indexes.push(out.globalIndex);
			}
		}
		this.keyImages = keys;
		this.txOutIndexes = indexes;
	}

	getTransactionsCopy() : Transaction[]{
		if(this.pqState !== null) {
			let rows: any[] = this.pqState.history.slice();
			if(this.pqMempoolState !== null)
				rows = rows.concat(this.pqMempoolState.history.slice(this.pqState.history.length));
			return rows.map((row:any) => {
				let transaction = new Transaction();
				transaction.hash = row.transactionHash;
				transaction.txPubKey = row.transactionHash;
				transaction.blockHeight = row.blockHeight;
				transaction.timestamp = row.timestamp;
				transaction.is_coinbase = row.coinbase;
				if(row.credited > BigInt(0)) {
					let output = new TransactionOut();
					output.amount = Number(row.credited);
					transaction.outs.push(output);
				}
				if(row.debited > BigInt(0)) {
					let input = new TransactionIn();
					input.amount = Number(row.debited);
					transaction.ins.push(input);
				}
				return transaction;
			}).sort((a:Transaction,b:Transaction) => a.timestamp - b.timestamp);
		}
		let news: any[] = [];
		for(let transaction of this.transactions){
			news.push(Transaction.fromRaw(transaction.export()));
		}
		news.sort((a,b) =>{
			return a.timestamp - b.timestamp;
		 })
		return news;
	}

	totalAmount() : number{
		if(this.pqState !== null) return Number((this.pqMempoolState || this.pqState).balance());
		let amount = 0;

		for(let transaction of this.transactions){
			if(!transaction.isFullyChecked())
				continue;
			amount += transaction.getAmount();
		}

		for(let transaction of this.txsMem){
			if(!transaction.isFullyChecked())
				continue;
			amount += transaction.getAmount();
		}

		return amount;
	}

	private spentKeyImages() : {[key: string]: boolean}{
		let spentKeyImages : {[key: string]: boolean} = {};

		for(let transaction of this.transactions.concat(this.txsMem)){
			if(!transaction.isFullyChecked())
				continue;

			for(let input of transaction.ins){
				if(input.keyImage !== '')
					spentKeyImages[input.keyImage] = true;
			}
		}

		return spentKeyImages;
	}

	unlockedAmount(currentBlockHeight : number = -1) : number{
		if(this.pqState !== null) return Number((this.pqMempoolState || this.pqState).spendableBalance(currentBlockHeight < 0 ? this.lastHeight : currentBlockHeight));
		let amount = 0;
		let spentKeyImages = this.spentKeyImages();

		for(let transaction of this.transactions){
			if(!transaction.isFullyChecked())
				continue;

			if(currentBlockHeight !== -1 && !transaction.isConfirmed(currentBlockHeight))
				continue;

			for(let out of transaction.outs){
				if(out.keyImage !== '' && spentKeyImages[out.keyImage])
					continue;
				amount += out.amount;
			}
		}

		return amount;
	}

	hasBeenModified(){
		return this.modified;
	}

	getPublicAddress(){
		if(this.pqAddress !== null) return this.pqAddress;
		return Cn.pubkeys_to_string(this.keys.pub.spend, this.keys.pub.view);
	}

	recalculateIfNotViewOnly(){
		if(!this.isViewOnly()) {
			for(let tx of this.transactions){
				let needDerivation = false;
				for(let out of tx.outs) {
					if (out.keyImage === '') {
						needDerivation = true;
						break;
					}
				}

				if(needDerivation) {
					let derivation = '';
					try {
						derivation = CnNativeBride.generate_key_derivation(tx.txPubKey, this.keys.priv.view);
					} catch (e) {
						continue;
					}
					for (let out of tx.outs) {
						if (out.keyImage === '') {
							let m_key_image = CnTransactions.generate_key_image_helper({
								view_secret_key: this.keys.priv.view,
								spend_secret_key: this.keys.priv.spend,
								public_spend_key: this.keys.pub.spend,
							}, tx.txPubKey, out.outputIdx, derivation);

							out.keyImage = m_key_image.key_image;
							out.ephemeralPub = m_key_image.ephemeral_pub;
							this.signalChanged();
						}
					}
				}
			}

			if(this.modified)
				this.recalculateKeyImages();

			for(let iTx = 0; iTx < this.transactions.length; ++iTx){
				for(let iIn = 0; iIn < this.transactions[iTx].ins.length;++iIn){
					let vin = this.transactions[iTx].ins[iIn];

					if(vin.amount < 0) {
						if (this.keyImages.indexOf(vin.keyImage) != -1) {
							//console.log('found in', vin);
							let walletOuts = this.getAllOuts();
							for (let ut of walletOuts) {
								if (ut.keyImage == vin.keyImage) {
									this.transactions[iTx].ins[iIn].amount = ut.amount;
									this.transactions[iTx].ins[iIn].keyImage = ut.keyImage;

									this.signalChanged();
									break;
								}
							}
						}else{
							this.transactions[iTx].ins.splice(iIn,1);
							--iIn;
						}
					}
				}

				if(this.transactions[iTx].outs.length === 0 && this.transactions[iTx].ins.length === 0){
					this.transactions.splice(iTx, 1);
					--iTx;
				}
			}

		}
	}

  clearTransactions = () => {
    this.txsMem = [];
    this.transactions = [];
    this.recalculateKeyImages();
    this.notify();
  }

  resetScanHeight = () => {
    this.lastHeight = this.creationHeight;
    this.signalChanged();
    this.notify();
  }

  /** Remove all derived chain history while retaining keys and settings. */
  resetHistory = () => {
    this.txsMem = [];
    this.transactions = [];
    this.txPrivateKeys = {};
    this.pqMempoolState = null;
    if (this.pqMasterSeed !== null) {
      if (this.pqState !== null && typeof this.pqState.reset === 'function')
        this.pqState.reset(this.creationHeight);
      else
        this.pqState = new DiscreteRuntime.DiscreteWalletState(this.creationHeight);
    }
    this._lastHeight = this.creationHeight;
    this.recalculateKeyImages();
    this.signalChanged();
  }
}
