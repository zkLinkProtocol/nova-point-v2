import { type TransactionResponse } from "ethers";

export interface ContractInteraction {
    transaction: TransactionResponse
    method: string
    value: bigint
    timestamp: number
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