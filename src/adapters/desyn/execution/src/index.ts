import { UserTVLData } from './sdk/types';
import { getUserTVLData } from './sdk/lib';


export const getUserTransactionData = async (blockNumber: number): Promise<UserTVLData[]> => {
  return await getUserTVLData(blockNumber);
};

