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
import {VueVar, VueWatched} from "../lib/numbersLab/VueAnnotate";
import {DestructableView} from "../lib/numbersLab/DestructableView";
import {KeysRepository} from "../model/KeysRepository";
import {Wallet} from "../model/Wallet";
import {Password} from "../model/Password";
import {BlockchainExplorerProvider} from "../providers/BlockchainExplorerProvider";
import {Mnemonic} from "../model/Mnemonic";
import {AppState} from "../model/AppState";
import {WalletRepository} from "../model/WalletRepository";
import {Translations} from "../model/Translations";
import {MnemonicLang} from "../model/MnemonicLang";
import {BlockchainExplorer} from "../model/blockchain/BlockchainExplorer";
import {Cn, CnNativeBride, CnRandom} from "../model/Cn";
import {Storage, StorageProtectionStatus} from "../model/Storage";

let blockchainExplorer : BlockchainExplorer = BlockchainExplorerProvider.getInstance();

class CreateViewWallet extends DestructableView{
	@VueVar(0) step !: number;

	@VueVar('') walletPassword !: string;
	@VueVar('') walletPassword2 !: string;
	@VueVar(false) insecurePassword !: boolean;
	@VueVar(false) forceInsecurePassword !: boolean;

	@VueVar(false) walletBackupMade !: boolean;
	@VueVar('walletVault.storageStatus.notAvailable') storageProtectionKey !: string;

	@VueVar(null) newWallet !: Wallet|null;
	@VueVar('') mnemonicPhrase !: string;

	constructor(container : string){
		super(container);
		this.generateWallet();
		this.refreshStorageProtection();
		AppState.enableLeftMenu();
	}

	destruct(): Promise<void> {
		return super.destruct();
	}

	generateWallet(){
		let self = this;
		setTimeout(function(){
			let newWallet = new Wallet();
			let seedBytes = new Uint8Array(32);
			crypto.getRandomValues(seedBytes);
			newWallet.initializePq(seedBytes, Boolean((<any>config).testnet));

			let updateSyncHeight = function(currentHeight:number){
				let height = currentHeight - 10;
				if(height < 0)height = 0;
				newWallet.lastHeight = height;
				newWallet.creationHeight = height;
				if(newWallet.pqState !== null) newWallet.pqState.height = height;
			};
			updateSyncHeight(0);
			let syncHeightLocked = false;

			self.newWallet = newWallet;

			Translations.getLang().then(function(userLang : string){
				// getBrowserLang() returns the raw navigator locale, not one of the
				// shipped translations, so this can be any ISO code. Only word lists
				// the native wallets can also read are eligible here: 'el' (Greek)
				// used to match the 'electrum' list and mint the one backup a user is
				// ever shown as 24 unchecksummed words that restore nowhere.
				let langToExport = 'english';
				for(let lang of MnemonicLang.getMintableLangs()){
					if(lang.shortLang === userLang){
						langToExport = lang.name;
						break;
					}
				}
				let phrase = Mnemonic.mn_encode(newWallet.pqMasterSeed as string, langToExport);
				if(phrase !== null)
					self.mnemonicPhrase = phrase;
			});

			// Height zero is always safe for a fresh wallet. A reachable node may
			// optimize the first scan, but local key and recovery-word generation
			// never waits for it.
			blockchainExplorer.getHeight().then(function(height:number){
				if(!syncHeightLocked) updateSyncHeight(height);
			}).catch(function(){});

			setTimeout(function(){
				syncHeightLocked = true;
				self.step = 1;
			}, 2000);
		},0);
	}

	@VueWatched()
	walletPasswordWatch(){
		if(!Password.checkPasswordConstraints(this.walletPassword, false)){
			this.insecurePassword = true;
		}else
			this.insecurePassword = false;
	}

	@VueWatched()
	stepWatch(){
		$("html, body").animate({ scrollTop: 0 }, "fast");
	}

	forceInsecurePasswordCheck(){
		let self = this;
		/*swal({
			title: 'Are you sure?',
			text: "You won't be able to revert this!",
			type: 'warning',
			showCancelButton: true,
			reverseButtons:true,
			confirmButtonText: 'Yes'
		}).then((result:{value:boolean}) => {
			if (result.value) {*/
		self.forceInsecurePassword = true;
		// }
		// });
	}

	exportStep(){
		if(this.walletPassword !== '' && (!this.insecurePassword || this.forceInsecurePassword)) {
			this.step = 2;
		}
	}

	refreshStorageProtection(){
		Storage.requestPersistentStorage().then((status: StorageProtectionStatus) => {
			if (status === 'enabled')
				this.storageProtectionKey = 'walletVault.storageStatus.enabled';
			else if (status === 'not_available')
				this.storageProtectionKey = 'walletVault.storageStatus.notAvailable';
			else
				this.storageProtectionKey = 'walletVault.storageStatus.notGranted';
		});
	}

	downloadBackup(){
		if(this.newWallet !== null)
			WalletRepository.downloadEncryptedPdf(this.newWallet);
		this.walletBackupMade = true;
	}

	finish(){
		if(this.newWallet !== null) {
			AppState.openWallet(this.newWallet, this.walletPassword);
			window.location.href = '#account';
		}
	}

}

new CreateViewWallet('#app');
