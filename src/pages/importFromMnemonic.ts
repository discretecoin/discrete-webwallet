/*
 * Copyright (c) 2018, Gnock
 * Copyright (c) 2018, The Masari Project
 * Copyright (c) 2022, The Karbo Developers
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
import {VueVar, VueWatched} from "../lib/numbersLab/VueAnnotate";
import {AppState} from "../model/AppState";
import {Password} from "../model/Password";
import {Wallet} from "../model/Wallet";
import {KeysRepository} from "../model/KeysRepository";
import {BlockchainExplorerProvider} from "../providers/BlockchainExplorerProvider";
import {Mnemonic} from "../model/Mnemonic";
import {MnemonicLang} from "../model/MnemonicLang";
import {BlockchainExplorer} from "../model/blockchain/BlockchainExplorer";
import {Cn} from "../model/Cn";

AppState.enableLeftMenu();

let blockchainExplorer: BlockchainExplorer = BlockchainExplorerProvider.getInstance();

class ImportView extends DestructableView {
	@VueVar('') password !: string;
	@VueVar('') password2 !: string;
	@VueVar(false) insecurePassword !: boolean;
	@VueVar(false) forceInsecurePassword !: boolean;
	@VueVar(0) importHeight !: number;

	@VueVar('') mnemonicPhrase !: string;
	@VueVar('') validMnemonicPhrase !: boolean;
	@VueVar('') language !: string;
	@VueVar([]) languages !: { key: string, name: string }[];

	constructor(container: string) {
		super(container);

		// Import stays permissive on purpose: every word list this wallet has ever
		// minted a phrase in must remain importable, including the six no longer
		// offered for export — otherwise this change would lock those holders out.
		// Each entry must correspond to a real list in MnemonicLang: 'ukrainian' was
		// offered here without one, so picking it could only ever fail, and 'german'
		// had a list but was never offered.
		this.languages.push({key: 'auto', name: 'Detect automatically'});
		this.languages.push({key: 'english', name: 'English'});
		this.languages.push({key: 'chinese', name: 'Chinese (simplified)'});
		this.languages.push({key: 'dutch', name: 'Dutch'});
		this.languages.push({key: 'french', name: 'French'});
		this.languages.push({key: 'german', name: 'German'});
		this.languages.push({key: 'italian', name: 'Italian'});
		this.languages.push({key: 'russian', name: 'Russian'});
		// Legacy only — not offered for export, cannot be restored in native wallets.
		this.languages.push({key: 'spanish', name: 'Spanish (legacy)'});
		this.languages.push({key: 'portuguese', name: 'Portuguese (legacy)'});
		this.languages.push({key: 'japanese', name: 'Japanese (legacy)'});
		this.languages.push({key: 'electrum', name: 'Electrum (legacy)'});
		this.languages.push({key: 'esperanto', name: 'Esperanto (legacy)'});
		this.languages.push({key: 'lojban', name: 'Lojban (legacy)'});
		this.language = 'auto';
	}

	formValid() {
		if (this.password != this.password2)
			return false;

		if (!(this.password !== '' && (!this.insecurePassword || this.forceInsecurePassword)))
			return false;

		if (!this.validMnemonicPhrase)
			return false;

		return true;
	}

	importWallet() {
		let self = this;
		blockchainExplorer.getHeight().then(function (currentHeight) {
			let newWallet = new Wallet();

			let mnemonic = self.mnemonicPhrase.trim();
			// let current_lang = 'english';
			let current_lang = 'english';

			if (self.language === 'auto') {
				let detectedLang = Mnemonic.detectLang(self.mnemonicPhrase.trim());
				if (detectedLang !== null)
					current_lang = detectedLang;
			} else
				current_lang = self.language;

			let mnemonic_decoded = Mnemonic.mn_decode(mnemonic, current_lang);
			if (mnemonic_decoded !== null) {
				let newWallet = new Wallet();
				let seed = new Uint8Array((mnemonic_decoded as string).match(/../g)!.map(byte => parseInt(byte, 16)));
				newWallet.initializePq(seed, Boolean((<any>config).testnet));

				let height = self.importHeight - 10;
				if (height < 0) height = 0;
				if (height > currentHeight) height = currentHeight;

				newWallet.lastHeight = height;
				newWallet.creationHeight = newWallet.lastHeight;
				newWallet.pqState.height = height;
				AppState.openWallet(newWallet, self.password);

				// A phrase in a word list the native wallets do not ship still imports
				// here — the seed is the same 32 bytes — but it is not a portable
				// backup. Tell the holder now, while they are looking at a working
				// wallet, rather than when they try to restore it somewhere else.
				if (!MnemonicLang.isNativeCompatible(current_lang)) {
					swal({
						type: 'warning',
						title: 'Recovery phrase is not portable',
						html: 'This phrase uses the <b>' + current_lang + '</b> word list, which the Discrete ' +
							'daemon and desktop wallets cannot read. Your funds are safe and this wallet works ' +
							'normally, but the phrase will not restore anywhere else.<br><br>' +
							'Open <b>Export</b>, save a new recovery phrase in English, and keep that one instead.',
					});
				}

				window.location.href = '#account';
			} else {
				swal({
					type: 'error',
					title: i18n.t('global.invalidMnemonicModal.title'),
					text: i18n.t('global.invalidMnemonicModal.content'),
					confirmButtonText: i18n.t('global.invalidMnemonicModal.confirmText'),
				});
			}

		});
	}

	@VueWatched()
	passwordWatch() {
		if (!Password.checkPasswordConstraints(this.password, false)) {
			this.insecurePassword = true;
		} else
			this.insecurePassword = false;
	}

	@VueWatched()
	importHeightWatch() {
		if ((<any>this.importHeight) === '') this.importHeight = 0;
		if (this.importHeight < 0) {
			this.importHeight = 0;
		}
		this.importHeight = parseInt('' + this.importHeight);
	}

	@VueWatched()
	mnemonicPhraseWatch() {
		this.checkMnemonicValidity();
	}

	@VueWatched()
	languageWatch() {
		this.checkMnemonicValidity();
	}

	checkMnemonicValidity() {
		let splitted = this.mnemonicPhrase.trim().split(' ');
		if (splitted.length != 25) {
			this.validMnemonicPhrase = false;
		} else {
			let detected = Mnemonic.detectLang(this.mnemonicPhrase.trim());
			if (this.language === 'auto')
				this.validMnemonicPhrase = detected !== null;
			else
				this.validMnemonicPhrase = detected === this.language;
		}
	}

	forceInsecurePasswordCheck() {
		let self = this;
		self.forceInsecurePassword = true;
	}

}

new ImportView('#app');
