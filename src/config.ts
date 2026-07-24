//export {};
let myGlobal : any = typeof window !== 'undefined' ? window : self;
myGlobal.config = {
	debug: false,
	nodeList: [
		"https://seed1.discrete.cash:9332/",
		"https://seed2.discrete.cash:9332/"
	],
	nodeUrl: "https://seed2.discrete.cash:9332/",
	mainnetExplorerUrl: "https://explorer.discrete.cash/",
	mainnetExplorerUrlHash: "https://explorer.discrete.cash/transaction/{ID}",
	mainnetExplorerUrlBlock: "https://explorer.discrete.cash/block/{ID}",
	testnetExplorerUrl: "https://testnet.discrete.cash/",
	testnetExplorerUrlHash: "https://testnet.discrete.cash/transaction/{ID}",
	testnetExplorerUrlBlock: "https://testnet.discrete.cash/block/{ID}",
	testnet: false,
	coinUnitPlaces: 2,
	coinDisplayUnitPlaces: 2,
	txMinConfirms: 2,
	txCoinbaseMinConfirms: 10,
	ctForkHeight: 4294967294,
	ctForkHeightTestnet: 400,
	addressPrefix: 3425755, // 0x3445db ("disc")
	integratedAddressPrefix: 3425755,
	addressPrefixTestnet: 3425755,
	integratedAddressPrefixTestnet: 3425755,
	subAddressPrefix: 3425755,
	subAddressPrefixTestnet: 3425755,
	coinFee: new JSBigInt('1'),
	dustThreshold: new JSBigInt('1'),
	defaultMixin: 0, // Discrete uses PQ outpoints/nullifiers, not ring decoys
	syncBlockCount: 1000,
	coinSymbol: 'XDS',
	openAliasPrefix: "xds",
	coinName: 'Discrete',
	coinUriPrefix: 'discrete:',
	avgBlockTime: 90,
	maxBlockNumber: 500000000,
};

let randInt = Math.floor(Math.random() * Math.floor(config.nodeList.length));
config.nodeUrl = config.nodeList[randInt];

function logDebugMsg(...data: any[]) {
  if (config.debug) {
    if (data.length > 1) {
      console.log(data[0], data.slice(1));
    } else {
      console.log(data[0]);
    }
  }
}

// log debug messages if debug is set to true
myGlobal.logDebugMsg = logDebugMsg;
