export type Address = string;

export type UserTransfersData = {
    timestamp: number
    userAddress: string
    contractAddress: string
    tokenAddress: string
    decimals: number
    quantity: bigint
    txHash: string
    nonce: string
    blockNumber: number
}

export type UserTransfers = {
    transferEvents: UserTransfersData[];
}

export type UserTVLData = {
    userAddress: Address;
    tokenAddress: Address;
    poolAddress: Address;
    balance: bigint;
    blockNumber: number;
    timestamp: number;
}

export type StakeData = {
    id: string;
    user: Address;
    pid: string;
    amount: string;
    timestamp: string;
    blocknumber: string;
}

export type UserStakes = {
    userStakes: StakeData[];
}

export type Response<T> = {
    data: T;
}

export type Call = {
    target: string;
    callData: string;
};

export type MulticallResult = {
    success: boolean;
    returnData: string;
};
