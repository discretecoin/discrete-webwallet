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

import {BlockchainExplorer, DiscreteWalletSyncData, NetworkInfo, RawDaemon_Transaction, RawDaemon_Out, RawDaemon_OutsForAmount, RemoteNodeInformation} from "./BlockchainExplorer";
import {Wallet} from "../Wallet";
import {MathUtil} from "../MathUtil";
import {CnTransactions, CnUtils} from "../Cn";
import {Transaction} from "../Transaction";
import {WalletWatchdog} from "../WalletWatchdog";

export type DaemonResponseGetInfo = {
    "already_generated_coins": number,
    "block_major_version": number,
    "contact": string,
    "cumulative_difficulty": number,
    "difficulty": number,
    "fee_address": string,
    "grey_peerlist_size": number,
    "height": number,
    "height_without_bootstrap": number,
    "is_synchronized": boolean,
    "incoming_connections_count": number,
    "outgoing_connections_count": number,
    "last_known_block_index": number,
    "min_fee": number,
    "next_reward": number,
    "rpc_connections_count": number,
    "start_time": number,
    "status": "OK" | string,
    "target": number,
    "top_block_hash": string,
    "transactions_count": number,
    "transactions_pool_size": number,
    "white_peerlist_size": number
}

export type DaemonResponseGetNodeFeeInfo = {
    fee_address: string,
    fee_amount: number,
    status: "OK" | string
}

export class BlockchainExplorerRpcDaemon implements BlockchainExplorer {
    //daemonAddress = config.nodeList[Math.floor(Math.random() * Math.floor(config.nodeList.length))];
    daemonAddress = config.nodeUrl;
    phpProxy: boolean = false;

    constructor(daemonAddress: string | null = null) {
        if (daemonAddress !== null && daemonAddress.trim() !== '') {
            this.daemonAddress = daemonAddress;
        }
    }

    protected makeRpcRequest(method: string, params: any = {}): Promise<any> {
        return new Promise<any>((resolve, reject) => {
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
            }).done(function (raw: any) {
                if (
                    typeof raw.id === 'undefined' ||
                    typeof raw.jsonrpc === 'undefined' ||
                    raw.jsonrpc !== '2.0' ||
                    typeof raw.result !== 'object'
                )
                    reject('Daemon response is not properly formatted');
                else
                    resolve(raw.result);
            }).fail(function (data: any) {
                reject(data);
            });
        });
    }

    protected makeRequest(method: 'GET' | 'POST', url: string, body: any = undefined): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            $.ajax({
                url: config.nodeUrl + url,
                method: method,
                data: typeof body === 'string' ? body : JSON.stringify(body)
            }).done(function (raw: any) {
                resolve(raw);
            }).fail(function (data: any) {
                reject(data);
            });
        });
    }

    cacheInfo: any = null;
    cacheHeight: number = 0;
    lastTimeRetrieveInfo = 0;

    getInfo(): Promise<DaemonResponseGetInfo> {
        if (Date.now() - this.lastTimeRetrieveInfo < 10 * 1000 && this.cacheInfo !== null) {
            return Promise.resolve(this.cacheInfo);
        }

        this.lastTimeRetrieveInfo = Date.now();
        return this.makeRequest('GET', 'getinfo').then((data: DaemonResponseGetInfo) => {
            this.cacheInfo = data;
            console.log(`GetInfo: `)
            return data;
        })
    }

    getHeight(): Promise<number> {
        if (Date.now() - this.lastTimeRetrieveInfo < 10 * 1000 && this.cacheHeight !== 0) {
            return Promise.resolve(this.cacheHeight);
        }

        this.lastTimeRetrieveInfo = Date.now();
        return this.makeRpcRequest('getlastblockheader').then((data: any) => {
            let height = parseInt(data.block_header['height']);
            this.cacheHeight = height;
            (<any>config).lastBlockMajorVersion = parseInt(data.block_header['major_version']);
            return height;
        })
    }

    scannedHeight: number = 0;

    getScannedHeight(): number {
        return this.scannedHeight;
    }

    watchdog(wallet: Wallet): WalletWatchdog {
        let watchdog = new WalletWatchdog(wallet, this);
        watchdog.start();
        return watchdog;
    }

    /**
     * Returns an array containing all numbers like [start;end]
     * @param start
     * @param end
     */
    range(start: number, end: number) {
        let numbers: number[] = [];
        for (let i = start; i <= end; ++i) {
            numbers.push(i);
        }

        return numbers;
    }

    getTransactionsForBlocks(startBlock: number, endBlock: number, includeMinerTxs: boolean): Promise<any> {
        const blockCount = Math.max(0, endBlock - startBlock + 1);
        return this.getWalletSyncData(startBlock, blockCount, includeMinerTxs).then(response => {
            let formatted: RawDaemon_Transaction[] = [];
            for (const block of response.blocks) {
                for (const rawTx of block.transactions) {
                    const tx = rawTx.transaction as RawDaemon_Transaction;
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
    }

    getTransactionPool(): Promise<RawDaemon_Transaction[]> {
        return this.makeRequest('GET', 'getrawtransactionspool').then(
              (response: {
                status: 'OK' | 'string',
                transactions: { transaction: any, hash: string, coinbase: boolean }[]
              }) => {

                let formatted: RawDaemon_Transaction[] = [];

                for (let rawTx of response.transactions) {
                    let tx: RawDaemon_Transaction | null = null;
                    try {
                        tx = rawTx.transaction;
                    } catch (e) {
                        try {
                            //compat for some invalid endpoints
                            tx = rawTx.transaction;
                        } catch (e) {
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
    }

    getRandomOuts(amounts: any[], nbOutsNeeded: number): Promise<RawDaemon_OutsForAmount[]> {
        let requestAmounts = amounts.map((amount: any) => {
            return amount === CnTransactions.ctConfidentialOutputAmount() ? CnTransactions.ctConfidentialOutputAmountRpc() : amount;
        });
        return this.makeRequest('POST', 'getrandom_outs', {
            amounts: requestAmounts,
            outs_count: nbOutsNeeded
        }).then((response: {
            status: 'OK' | string,
            outs: { amount: any, outs: RawDaemon_Out[] }[]
        }) => {
            if (response.status !== 'OK') throw {error: 'invalid_getrandom_outs_answer', response: response};
            if (response.outs.length > 0) {
                console.log("Got random outs: ");
                console.log(response.outs);
            }

            return response.outs;
        });
    }

    sendRawTx(rawTx: string) {
        return this.makeRequest('POST', 'sendrawtransaction', {
            tx_as_hex: rawTx,
            do_not_relay: false
        }).then((transactions: any) => {
            if (!transactions.status || transactions.status !== 'OK')
                throw transactions;
        });
    }

    getNetworkInfo(): Promise<NetworkInfo> {
        return this.makeRpcRequest('getlastblockheader').then((raw: any) => {
            (<any>config).lastBlockMajorVersion = parseInt(raw.block_header['major_version']);
            //console.log(raw);
            return {
                'node': config.nodeUrl,//.split(':')[1].replace(/[-[\]\/{}()*+?\\^$|#\s]/g, ''),
                'major_version': raw.block_header['major_version'],
                'hash': raw.block_header['hash'],
                'reward': raw.block_header['reward'],
                'height': raw.block_header['height'],
                'timestamp': raw.block_header['timestamp'],
                'difficulty': raw.block_header['difficulty']
            }
        });
    }

    getWalletSyncData(startHeight: number, blockCount: number, includeMinerTxs: boolean): Promise<DiscreteWalletSyncData> {
        if (!Number.isInteger(startHeight) || startHeight < 0)
            return Promise.reject('invalid_start_height');
        if (!Number.isInteger(blockCount) || blockCount < 1 || blockCount > 100)
            return Promise.reject('invalid_block_count');

        return this.makeRequest('POST', 'get_wallet_sync_data', {
            start_height: startHeight,
            block_count: blockCount,
            include_miner_txs: includeMinerTxs
        }).then((response: DiscreteWalletSyncData) => {
            if (!response || response.status !== 'OK' || !Array.isArray(response.blocks))
                throw 'invalid_wallet_sync_answer';

            let expectedHeight = startHeight;
            let previousHash: string | null = null;
            for (let block of response.blocks) {
                if (block.height !== expectedHeight || !Array.isArray(block.transactions))
                    throw 'non_contiguous_wallet_sync_answer';
                if (previousHash !== null && block.previous_hash !== previousHash)
                    throw 'unlinked_wallet_sync_answer';
                for (let tx of block.transactions) {
                    if (!tx || typeof tx.hash !== 'string' || typeof tx.transaction !== 'object')
                        throw 'invalid_wallet_sync_transaction';
                }
                previousHash = block.hash;
                expectedHeight++;
            }
            this.scannedHeight = response.blocks.length === 0
                ? startHeight
                : response.blocks[response.blocks.length - 1].height;
            return response;
        });
    }

    getRemoteNodeInformation(): Promise<RemoteNodeInformation> {
        // TODO change to /feeaddress
        return this.getInfo().then((info: DaemonResponseGetInfo) => {
            return {
                'fee_address': info['fee_address'],
                'status': info['status']
            }
        });
    }

    resolveAccountNumber(accountNumber: string): Promise<string> {
        let parsed = DiscreteRuntime.parseAccountNumber(accountNumber);
        return this.makeRpcRequest('resolveaccountnumber', {
            block_height: parsed.blockHeight,
            tx_index: parsed.transactionIndex
        }).then(function (response: {
            found: boolean,
            view_pub: string,
            spend_pub: string,
            account_number: string,
            status: 'OK' | string
        }) {
            if (response.status === 'OK' && response.found) {
                // Failsafe: the keys the node resolved must fingerprint to the 'A' the
                // user typed. response.account_number is the canonical base number the
                // node reconstructs FROM those keys; if its fingerprint differs, the
                // (H,I) slot was repointed (reorg) — refuse rather than pay stranger keys.
                // (The node also only resolves once the registration is past finality.)
                if (!response.account_number) throw 'account_number_binding_missing';
                let resolved = DiscreteRuntime.parseAccountNumber(response.account_number);
                if (resolved.blockHeight !== parsed.blockHeight ||
                    resolved.transactionIndex !== parsed.transactionIndex ||
                    resolved.fingerprint !== parsed.fingerprint) {
                    throw 'account_number_fingerprint_mismatch';
                }
                let viewPublicKey = new Uint8Array(response.view_pub.match(/../g)!.map(byte => parseInt(byte, 16)));
                let spendPublicKey = new Uint8Array(response.spend_pub.match(/../g)!.map(byte => parseInt(byte, 16)));
                return DiscreteRuntime.encodeAddress(viewPublicKey, spendPublicKey, 0x3445db, Boolean((<any>config).testnet));
            }
            throw 'account_number_not_found';
        });
    }

    getAccountNumber(address: string): Promise<string | null> {
        let decoded: any;
        try {
            decoded = DiscreteRuntime.decodeAddress(address, Boolean((<any>config).testnet));
        } catch (e) {
            return Promise.resolve(null);
        }
        let toHex = (bytes: Uint8Array) => Array.prototype.map.call(bytes, (byte: number) => ('0' + byte.toString(16)).slice(-2)).join('');
        return this.makeRpcRequest('getaccountnumber', {
            view_pub: toHex(decoded.viewPublicKey),
            spend_pub: toHex(decoded.spendPublicKey)
        }).then(function (response: {
            registered: boolean,
            block_height: number,
            tx_index: number,
            account_number: string,
            status: 'OK' | string
        }) {
            // The daemon renders the full H-I-A-C string (fingerprint A over these keys);
            // display it verbatim rather than recomputing A client-side.
            if (response.status === 'OK' && response.registered && response.account_number)
                return response.account_number;
            return null;
        }).catch(function () {
            return null;
        });
    }

}

