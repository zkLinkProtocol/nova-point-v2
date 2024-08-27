import { UserTVLData } from "./types";
import axios from "axios"


export async function getUserTransactionData(blockNumber: number): Promise<UserTVLData[]> {

  const webUrl = 'https://api.predx.ai';
  const routeApi = '/v1/getAddressBalance';
  const params = {
    blockNumber: blockNumber
  };
  const response = await axios.get(webUrl + routeApi, { params });
  const data = response.data.data;
  const timestamp = response.data.time

  const tokenAddress = "0x2F8A25ac62179B31D62D7F80884AE57464699059";
  const poolAddress = "0x986Ca3A4F05AA7EA5733d81Da6649043f43cB9A8";

  const userTxData: UserTVLData[] = data?.map((item: any) => {
    return {
      blockNumber: blockNumber,
      userAddress: item.id,
      poolAddress: poolAddress,
      tokenAddress: tokenAddress,
      balance: item.usdc_in_micro,
      timestamp: timestamp
    };
  });

  return userTxData;
}
