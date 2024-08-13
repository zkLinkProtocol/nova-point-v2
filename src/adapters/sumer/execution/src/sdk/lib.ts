import { UserTVLData, Response } from "./types";
import { JsonRpcProvider } from "ethers";
import BigNumber from "bignumber.js";
import path from "path";
import { fetchGraphQLData } from "./fetch";
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const getAllUserPosition = async (blockNumber: number) => {
  let result: UserTVLData[] = [];
  let skip = 0;
  const pageSize = 1000;
  let fetchNext = true;

  while (fetchNext) {
    const query = `
      query MyQuery(
        $skip: Int = ${skip},
        $first: Int = ${pageSize},
        $number: Int = ${blockNumber}
      ) {
        accountCTokens(first: $first, skip: $skip,  block: {number: $number}) {
          cTokenBalance
          market {
            id
            decimals
            exchangeRate
            underlyingAddress
            underlyingSymbol
          }
          account {
            id
          }
        }
      }`;

    const data = await fetchGraphQLData<Response>(query);

    const { accountCTokens } = data;

    const timestamp = await getTimestampAtBlock(blockNumber)
    
    const res = accountCTokens.map((data) => {
      const userAddress = data.account.id;
      const poolAddress = data.market.id;
      const tokenAddress = data.market.underlyingAddress;
      // const symbol = data.market.underlyingSymbol;
      const balance = new BigNumber(data.cTokenBalance).times(`1e${data.market.decimals}`).times(data.market.exchangeRate).toFixed(0)


      return {
        userAddress,
        poolAddress,
        tokenAddress,
        blockNumber,
        balance: BigInt(balance),
        timestamp
      }
    });

    result.push(...res.flat());

    if (accountCTokens.length < pageSize) {
      fetchNext = false;
    } else {
      console.log(`GET DATA FROM ${skip}`);
      skip += pageSize;
    }
  }

  return result;
};

export const getUserPositionsAtBlock = async (blockNumber: number): Promise<UserTVLData[]> => {
  const result = await getAllUserPosition(blockNumber);
  
  return result;
};

export const getTimestampAtBlock = async (blockNumber: number) => {
  const provider = new JsonRpcProvider("https://rpc.zklink.io");
  const block = await provider.getBlock(blockNumber);
  return Number(block?.timestamp);
};
