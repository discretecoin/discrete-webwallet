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

import {VueVar} from "../lib/numbersLab/VueAnnotate";
import {DependencyInjectorInstance} from "../lib/numbersLab/DependencyInjector";
import {Wallet} from "../model/Wallet";
import {DestructableView} from "../lib/numbersLab/DestructableView";
import {Constants} from "../model/Constants";
import {WalletRepository} from "../model/WalletRepository";
import {Mnemonic} from "../model/Mnemonic";
import {MnemonicLang} from "../model/MnemonicLang";

let wallet: Wallet = DependencyInjectorInstance().getInstance(Wallet.name, 'default', false);
let blockchainExplorer = DependencyInjectorInstance().getInstance(Constants.BLOCKCHAIN_EXPLORER);


class ExportView extends DestructableView {
	@VueVar('') publicAddress: string;
	@VueVar(false) nativePlatform !: boolean;
	@VueVar(false) phraseUnverified !: boolean;

	constructor(container: string) {
		super(container);
		let self = this;

		this.publicAddress = wallet.getPublicAddress();
		this.nativePlatform = window.native;

		// A wallet created before phrases were checked carries no mnemonicLang, so we
		// cannot know which word list its backup used — prompt the holder to verify.
		// A wallet that records a retired list is a definite problem, not a maybe.
		this.phraseUnverified = wallet.pqMasterSeed !== null
			&& (wallet.mnemonicLang === null || !MnemonicLang.isNativeCompatible(wallet.mnemonicLang));
	}

	// Verify a written-down phrase against the open wallet, locally.
	//
	// This needs no stored metadata and therefore works for every existing wallet:
	// decode the phrase, derive its seed, and compare with this wallet's master seed.
	// That answers the only two questions that matter — does this phrase still open
	// this wallet, and will it restore anywhere else.
	checkRecoveryPhrase() {
		let self = this;
		swal({
			title: 'Check your recovery phrase',
			text: 'Paste the 25 words you wrote down.',
			input: 'text',
			showCancelButton: true,
			confirmButtonText: 'Check',
		}).then((result: any) => {
			if (!result.value) return;

			let phrase: string = ('' + result.value).trim();
			let lang = Mnemonic.detectLang(phrase);
			let decoded: string | null = null;
			if (lang !== null) {
				try { decoded = Mnemonic.mn_decode(phrase, lang); } catch (e) { decoded = null; }
			}

			if (lang === null || decoded === null) {
				swal({
					type: 'error',
					title: 'Not a recognized recovery phrase',
					html: 'These words do not form a valid recovery phrase in any word list this ' +
						'wallet knows. Check for typos and word order.<br><br>If you cannot recover ' +
						'it, use <b>Show recovery seed</b> above to save a fresh backup now.',
				});
				return;
			}

			if (decoded.toLowerCase() !== (wallet.pqMasterSeed || '').toLowerCase()) {
				swal({
					type: 'error',
					title: 'This phrase does not open this wallet',
					html: 'The phrase is valid, but it belongs to a different wallet — restoring ' +
						'from it would not give you these funds.<br><br>Save a correct backup now ' +
						'with <b>Show recovery phrase</b>, and keep it somewhere safe.',
				});
				return;
			}

			if (!MnemonicLang.isNativeCompatible(lang)) {
				swal({
					type: 'warning',
					title: 'Phrase works here, but nowhere else',
					html: 'This phrase does open this wallet, and your funds are safe.<br><br>' +
						'It uses the <b>' + lang + '</b> word list, which the Discrete daemon and ' +
						'desktop wallets do not share, so it will not restore outside this web ' +
						'wallet.<br><br>Use <b>Show recovery phrase</b>, pick <b>English</b>, and ' +
						'keep that phrase instead. Both open the same wallet.',
				});
				return;
			}

			swal({
				type: 'success',
				title: 'Recovery phrase is good',
				html: 'This phrase opens this wallet and uses the <b>' + lang + '</b> word list, ' +
					'which restores in the Discrete daemon and desktop wallets too.',
			});
			// Remember the answer so the prompt stops nagging a holder who is fine.
			if (wallet.mnemonicLang === null) {
				wallet.mnemonicLang = lang;
				self.phraseUnverified = false;
			}
		});
	}

	destruct(): Promise<void> {
		return super.destruct();
	}

	askUserPassword(): Promise<{ wallet: Wallet, password: string } | null> {
		return swal({
			input: 'password',
			showCancelButton: true,
			title: i18n.t('global.openWalletModal.title'),
			confirmButtonText: i18n.t('exportPage.mnemonicLangSelectionModal.confirmText'),
			cancelButtonText: i18n.t('exportPage.mnemonicKeyModal.confirmText'),
		}).then((result: any) => {
			if (result.value) {
				let savePassword : string = result.value;
				// let password = prompt();
				// let wallet = WalletRepository.getMain();
				return WalletRepository.getLocalWalletWithPassword(savePassword, WalletRepository.getCurrentWalletId(), false).then((wallet : Wallet|null) : { wallet: Wallet, password: string }|null => {
					if (wallet !== null) {
						return {wallet: wallet, password: savePassword};
					} else {
						swal({
							type: 'error',
							title: i18n.t('global.invalidPasswordModal.title'),
							text: i18n.t('global.invalidPasswordModal.content'),
							confirmButtonText: i18n.t('global.invalidPasswordModal.confirmText'),
						});
					}
					return null;
				});
			}
			return null;
		});
	}

	getPrivateKeys() {
		this.askUserPassword().then(function (params: { wallet: Wallet, password: string } | null) {
			if (params !== null && params.wallet !== null) {
				if (params.wallet.pqMasterSeed !== null) {
					swal({
						title: 'Recovery seed',
						confirmButtonText: i18n.t('exportPage.walletKeysModal.confirmText'),
						html: '<p>Keep this 32-byte master seed private. It restores all post-quantum wallet keys.</p>' +
							'<code style="overflow-wrap:anywhere">' + params.wallet.pqMasterSeed + '</code>',
					});
					return;
				}
				swal({
					title: i18n.t('exportPage.walletKeysModal.title'),
					confirmButtonText: i18n.t('exportPage.walletKeysModal.confirmText'),
					html: i18n.t('exportPage.walletKeysModal.content', {
						privViewKey: params.wallet.keys.priv.view,
						privSpendKey: params.wallet.keys.priv.spend
					}),
				});
			}
		});
	}

	getMnemonicPhrase() {
		this.askUserPassword().then(function (params: { wallet: Wallet, password: string } | null) {
			if (params !== null && params.wallet !== null) {
				swal({
					title: i18n.t('exportPage.mnemonicLangSelectionModal.title'),
					input: 'select',
					showCancelButton: true,
					confirmButtonText: i18n.t('exportPage.mnemonicLangSelectionModal.confirmText'),
					// Only word lists verified byte-identical to core's, including prefix
					// length — see MnemonicLang.NATIVE_COMPATIBLE for the diff results
					// and why Electrum/Esperanto/Lojban/Spanish/Portuguese/Japanese are
					// not here. German was compatible all along but was never offered.
					inputOptions: {
						'english': 'English',
						'chinese': 'Chinese (simplified)',
						'dutch': 'Dutch',
						'french': 'French',
						'german': 'German',
						'italian': 'Italian',
						'japanese': 'Japanese',
						'portuguese': 'Portuguese',
						'russian': 'Russian',
						'spanish': 'Spanish',
					}
				}).then((mnemonicLangResult: {value?:string}) => {
					if(mnemonicLangResult.value) {
						let recoverySeed = params.wallet.pqMasterSeed !== null ? params.wallet.pqMasterSeed : params.wallet.keys.priv.spend;
						let mnemonic = Mnemonic.mn_encode(recoverySeed, mnemonicLangResult.value);
						swal({
							title: i18n.t('exportPage.mnemonicKeyModal.title'),
							confirmButtonText: i18n.t('exportPage.mnemonicKeyModal.confirmText'),
							html: i18n.t('exportPage.mnemonicKeyModal.content', {
								mnemonic: mnemonic,
							}),
						});
					}
				});
			}
		});
	}

	fileExport() {
		this.askUserPassword().then(function (params: { wallet: Wallet, password: string } | null) {
			if (params !== null && params.wallet !== null) {
				let blob = new Blob([JSON.stringify(WalletRepository.getEncrypted(params.wallet, params.password))], {type: "application/json"});
				saveAs(blob, "wallet.json");
			}
		});
	}

	exportEncryptedPdf() {
		this.askUserPassword().then(function (params: { wallet: Wallet, password: string } | null) {
			if (params !== null && params.wallet !== null) {
				WalletRepository.downloadEncryptedPdf(params.wallet);
			}
		});
	}

}

if (wallet !== null && blockchainExplorer !== null)
	new ExportView('#app');
else
	window.location.href = '#index';
