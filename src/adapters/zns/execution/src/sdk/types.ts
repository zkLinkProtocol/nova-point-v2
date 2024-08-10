export interface GraphResponse {
    mintedDomains: Array<{
        id: string
        blockNumber: string
        expiry: string
        blockTimestamp: string
        domainName: string
        owner: string
        transactionHash: string
        tokenId: string
    }>
    renewedDomains: Array<{
        id: string
        blockNumber: string
        expiry: string
        blockTimestamp: string
        transactionHash: string
        tokenId: string
    }>
}

export interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

export type UserTxData = {
    timestamp: number
    userAddress: string
    contractAddress: string
    tokenAddress: string
    decimals: number
    price: number
    quantity: bigint
    txHash: string
    nonce: string
    blockNumber: number
}

export interface PriceToRegister {
    [key: number]: bigint
}

export interface PriceToRenew {
    [key: number]: bigint
}