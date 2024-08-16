import { UserTxData } from "./types";
import { JsonRpcProvider } from "ethers";
import path from "path";
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
import GraphQLHelper from "./graph";
import { graphQuery } from "./constants";

export const queryUserTxData = async (startBlock: number, endBlock: number) => {
    const contractAddress = "0xe0971a2B6E34bd060866081aE879630e83C4A0BD"
    const rpcEndpoint = "https://rpc.zklink.io"
    const graphUri = process.env.SUBGRAPH_ENDPOINT as string

    const provider = new JsonRpcProvider(rpcEndpoint)

    let userTxCollection: UserTxData[] = [];
    const pageSize = 1000;
    let skip = 0;
    let fetchNext = true;

    while (fetchNext) {
        const response = await GraphQLHelper.fetchGraphQLData(graphUri, graphQuery(startBlock, endBlock, pageSize, skip))

        // parse mint event
        if (response.mintedDomains.length > 0) {
            for await (const mint of response.mintedDomains) {
                try {
                    const transaction = await provider.getTransaction(mint.transactionHash)

                    userTxCollection.push({
                        blockNumber: Number(mint.blockNumber),
                        contractAddress,
                        decimals: 0,
                        nonce: (transaction?.nonce || 0).toString() + mint.tokenId,
                        price: 0,
                        quantity: BigInt(mint.expiry),
                        timestamp: Number(mint.blockTimestamp),
                        tokenAddress: '',
                        txHash: mint.transactionHash,
                        userAddress: mint.owner
                    })
                }
                catch {
                    continue
                }
            }
        }

        // parse renew event
        if (response.renewedDomains.length > 0) {
            for await (const renew of response.renewedDomains) {
                try {
                    const transaction = await provider.getTransaction(renew.transactionHash)

                    userTxCollection.push({
                        blockNumber: Number(renew.blockNumber),
                        contractAddress,
                        decimals: 0,
                        nonce: (transaction?.nonce || 0).toString() + renew.tokenId,
                        price: 0,
                        quantity: BigInt(renew.expiry),
                        timestamp: Number(renew.blockTimestamp),
                        tokenAddress: contractAddress, // nft do not have tokenAddress, set it as contractAddress
                        txHash: renew.transactionHash,
                        userAddress: transaction?.from || ''
                    })
                }
                catch {
                    continue
                }
            }
        }

        if (response.mintedDomains.length < pageSize && response.renewedDomains.length < pageSize) {
            fetchNext = false
        }
        else {
            skip += pageSize;
        }
    }

    return userTxCollection
}