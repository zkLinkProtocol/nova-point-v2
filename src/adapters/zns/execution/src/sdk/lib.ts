import { ContractInteraction, UserTxData } from "./types";
import { JsonRpcProvider, Contract, EventLog } from "ethers";
import path from "path";
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

import RegistryABI from '../abis/Registry.json'

export default class ZNSNovaPointer {
    contractAddress: string
    provider: JsonRpcProvider
    contract: Contract

    MAX_DOMAIN_LENGTH: number = 24
    TLD = '.zkl'

    mintEvents: Array<EventLog>
    renewEvents: Array<EventLog>

    /**
     * 
     * @param {String} rpcurl
     * @param {String} contractAddress
     */
    constructor(rpcurl: string, contractAddress: string) {
        this.contractAddress = contractAddress
        this.provider = new JsonRpcProvider(rpcurl)
        this.contract = new Contract(contractAddress, RegistryABI, this.provider)
    }

    /**
     * initialize event list of MintdDomain and RenewedDomain events
     */
    initialize = async () => {
        const mintEventFilters = this.contract.filters.MintedDomain()
        const renewEventFilters = this.contract.filters.RenewedDomain()

        this.mintEvents = await this.contract.queryFilter(mintEventFilters) as Array<EventLog>
        this.renewEvents = await this.contract.queryFilter(renewEventFilters) as Array<EventLog>
    }

    /**
     * Returns user's ZNS protocol interaction events by block number
     * @param {Number} blockNumber 
     * @returns {Promise<Array<UserTxData>>} userTxDataCollection
     */
    getZNSInteractionByBlock = async (blockNumber: number): Promise<Array<UserTxData>> => {
        const block = await this.provider.getBlock(blockNumber)
        if (block) {
            const mintEvents = this.mintEvents.filter(event => event.blockNumber === blockNumber)
            const renewEvents = this.renewEvents.filter(event => event.blockNumber === blockNumber)

            // print block scsan result for mint and renew events
            if(mintEvents.length === 0) {
                console.log("\nNo mint event in this block ==>", blockNumber)
            }
            else {
                console.log(`\n${mintEvents.length} mint events in this block ==> ${blockNumber}`)
            }
            if(renewEvents.length === 0) {
                console.log("No renew event in this block ==>", blockNumber + "\n")
            }
            else {
                console.log(`${renewEvents.length} renew events in this block ==> ${blockNumber}\n`)
            }

            const userTxDataCollection: Array<UserTxData> = []

            // mint event process
            for await (const event of mintEvents) {
                try {
                    const transaction = await this.provider.getTransaction(event.transactionHash)
                    const domainName: string = event.args[0]
                    const tokenId = event.args[1]
                    const owner = event.args[2]

                    // domain => price process
                    const tldIndex = domainName.lastIndexOf(this.TLD)
                    const pureDomain = tldIndex === -1 ? domainName : domainName.substring(0, tldIndex) + domainName.substring(tldIndex + this.TLD.length)
                    const domainLength = pureDomain.length
                    const price = await this.contract.priceToRegister(domainLength)

                    // expiry => quantity process
                    const expiry = await this.contract.mintToExpire(tokenId)

                    console.log({
                        blockNumber,
                        contractAddress: this.contractAddress,
                        decimals: 0,
                        nonce: (transaction?.nonce || 0).toString(),
                        price,
                        quantity: expiry,
                        timestamp: block?.timestamp,
                        tokenAddress: '',
                        txHash: event.transactionHash,
                        userAddress: owner
                    })

                    userTxDataCollection.push({
                        blockNumber,
                        contractAddress: this.contractAddress,
                        decimals: 0,
                        nonce: (transaction?.nonce || 0).toString(),
                        price,
                        quantity: expiry,
                        timestamp: block?.timestamp,
                        tokenAddress: '',
                        txHash: event.transactionHash,
                        userAddress: owner
                    })
                }
                catch (error) {
                    console.log(error)
                    continue
                }
            }

            // renew event process
            for await (const event of renewEvents) {
                try {
                    const transaction = await this.provider.getTransaction(event.transactionHash)
                    const tokenId = event.args[0]
                    const expiry = event.args[1]
                    const owner = await this.contract.ownerOf(tokenId)

                    // domain => price process
                    const pureDomain = await this.contract.idToDomain(tokenId)
                    const domainLength = pureDomain.length
                    const price = await this.contract.priceToRegister(domainLength)

                    console.log({
                        blockNumber,
                        contractAddress: this.contractAddress,
                        decimals: 0,
                        nonce: (transaction?.nonce || 0).toString(),
                        price,
                        quantity: expiry,
                        timestamp: block?.timestamp,
                        tokenAddress: '',
                        txHash: event.transactionHash,
                        userAddress: owner
                    })

                    userTxDataCollection.push({
                        blockNumber,
                        contractAddress: this.contractAddress,
                        decimals: 0,
                        nonce: (transaction?.nonce || 0).toString(),
                        price,
                        quantity: expiry,
                        timestamp: block?.timestamp,
                        tokenAddress: '',
                        txHash: event.transactionHash,
                        userAddress: owner
                    })
                }
                catch (error) {
                    console.log(error)
                    continue
                }
            }

            return userTxDataCollection
        }
        else {
            return []
        }
    }

    /**
     * Returns contract interaction transactions and details from block number
     * @param {Number} blockNumber 
     * @returns {Promise<Array<ContractInteraction>>} interactions
     */
    getContractCallTransactionsByBlock = async (blockNumber: number): Promise<Array<ContractInteraction>> => {
        // get block from blockNumber
        const block = await this.provider.getBlock(blockNumber)
        const hashs = await block?.transactions || []
        const interactions: Array<ContractInteraction> = []

        // transaction hashs process
        for await (const hash of hashs) {
            try {
                // get transaction data from hash
                const transaction = await this.provider.getTransaction(hash)
                if (!!transaction && transaction.to === this.contractAddress) {
                    interactions.push({
                        transaction,
                        method: transaction.data.slice(0, 10),
                        value: transaction.value,
                        timestamp: block?.timestamp || 0
                    })
                }
                else {
                    // skip iteration if transaction is not ZNS contract call tranasction
                    continue
                }
            }
            catch {
                // skip iteration if transaction is not exist for given hash
                continue
            }
        }

        return interactions
    }
}