import { UserTxData } from './sdk/types';
import { queryUserTxData } from "./sdk/lib";

export const getUserTransactionData = async (): Promise<Array<UserTxData>> => {
    const userTransactionData = await queryUserTxData(0, 38321929)

    return userTransactionData
};