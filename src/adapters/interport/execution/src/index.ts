import { UserTransfersData, UserTVLData } from './sdk/types';
import {
  getUserPositionsAtBlock, getUserTransactionsData
} from './sdk/lib';

export const getUserTVLData = async (blockNumber: number): Promise<UserTVLData[]> => {
  const res: UserTVLData[] = await getUserPositionsAtBlock(blockNumber);

  return res.map(item => ({ ...item, blockNumber: blockNumber }));
};

export const getUserTransactionData = (startBlock: number, endBlock: number): Promise<UserTransfersData[]> => {
  return getUserTransactionsData(startBlock, endBlock);
};
