import { JsonRpcProvider } from 'ethers';
import { UserTVLData } from "./types";
import axios from "axios"

export const getTimestampAtBlock = async (blockNumber: number) => {
  const provider = new JsonRpcProvider("https://rpc.zklink.io");
  const block = await provider.getBlock(blockNumber);
  return Number(block?.timestamp);
};
  
export async function getUserTransactionData(blockNumber: number):Promise<UserTVLData[]>  {

  const response = (await axios.get("https://api.desyn.io/zklink/points_gateway/points/get_zklink_balance_list?blockNumber=" + blockNumber));
  const data = response.data.list;

  const userTxData: UserTVLData[] = data.map((item: any) => {
    return {
      blockNumber: blockNumber,
      userAddress: item.userAddress,
      poolAddress: item.poolAddress,
      lpAddress: item.lpAddress,
      tokenAddress: item.tokenAddress,
      balance: item.balance,
      decimals: item.decimals,
      timestamp: item.timestamp
    };
  });

  return userTxData;
}