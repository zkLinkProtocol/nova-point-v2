import { UserTVLData } from './sdk/types';
import { getUserTransactionData } from './sdk/lib';


export const getUserTVLData = async (blockNumber: number): Promise<UserTVLData[]> => {
  return await getUserTransactionData(blockNumber);
};
