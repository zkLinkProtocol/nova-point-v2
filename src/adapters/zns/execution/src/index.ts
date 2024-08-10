import { UserTxData } from './sdk/types';
import { queryUserTxData } from "./sdk/lib";

export const getUserTransactionData = async (startBlock: number, endBlock: number): Promise<Array<UserTxData>> => {
    const userTransactionData = await queryUserTxData(startBlock, endBlock)

    return userTransactionData
};