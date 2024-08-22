export interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

export type UserTVLData = {
    userAddress: string,
    poolAddress: string
    tokenAddress: string
    blockNumber: number
    balance: bigint
    timestamp: number
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

export type Response = {
    accountCTokens: Array<{
        cTokenBalance: string,
        market: {
            id: string;
            decimals: string;
            totalSupply: string;
            cash: string;
            underlyingAddress: string;
        },
        account: {
            id: string
        }
    }>
}