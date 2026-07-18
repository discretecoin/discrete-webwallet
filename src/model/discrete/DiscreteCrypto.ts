/** Stable boundary between wallet/domain code and the selected crypto library. */
export interface DiscreteCrypto {
	deriveWallet(masterSeed: Uint8Array, network: number): DiscreteWalletKeys;
	decodeAddress(address: string): DiscreteAddress;
	scanTransaction(transactionBlob: Uint8Array, keys: DiscreteScanKeys): ScanResult;
	createTransaction(request: CreateTransactionRequest, masterSeed: Uint8Array): Uint8Array;
}

export interface DiscreteWalletKeys {
	address: string;
	spendPublicKey: Uint8Array; // ML-DSA-65, 1952 bytes
	viewPublicKey: Uint8Array;  // ML-KEM-768, 1184 bytes
}

export interface DiscreteAddress {
	network: number;
	spendPublicKey: Uint8Array;
	viewPublicKey: Uint8Array;
}

export interface DiscreteScanKeys {
	viewSecretKey: Uint8Array;
	spendPublicKey: Uint8Array;
}

export interface ScanResult {
	ownedOutputs: OwnedOutput[];
	spentOutpoints: Outpoint[];
}

export interface Outpoint {
	transactionHash: string;
	outputIndex: number;
}

export interface OwnedOutput extends Outpoint {
	amount: string;
	unlockHeight: string;
	rho: Uint8Array;
}

export interface CreateTransactionRequest {
	inputs: OwnedOutput[];
	destinations: Array<{ address: string; amount: string; unlockHeight?: string }>;
	fee: string;
}
