import { JsonRpcProvider } from 'ethers';
import { UserTVLData } from "./types";
import axios from "axios"

export const getTimestampAtBlock = async (blockNumber: number) => {
  const provider = new JsonRpcProvider("https://rpc.zklink.io");
  const block = await provider.getBlock(blockNumber);
  return Number(block?.timestamp);
};
  
export async function getUserTVLData(blockNumber: number):Promise<UserTVLData[]>  {

  const response = (await axios.get("https://api.desyn.io/zklink/points_gateway/points/get_zklink_balance_list?blockNumber=" + blockNumber));
  const data = response.data.list;

  const userTxData: UserTVLData[] = data.map((item: any) => {
    return {
      blockNumber: blockNumber,
      userAddress: item.userAddress,
      poolAddress: item.poolAddress,
      tokenAddress: item.tokenAddress,
      balance: item.balance,
      timestamp: item.timestamp
    };
  });

  return userTxData;
}