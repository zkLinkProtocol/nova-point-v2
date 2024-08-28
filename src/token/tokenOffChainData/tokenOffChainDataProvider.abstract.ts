import { Token } from "../token.service";

export interface ITokenOffChainData {
  l1Address?: string;
  l2Address?: string;
  liquidity?: number;
  usdPrice?: number;
  iconURL?: string;
  priceId?: string;
}

export interface ITokenCurrentPrice {
  priceId?: string;
  usdPrice?: number;
}

export interface ITokenMarketChartProviderResponse {
  prices: number[][];
  market_caps: number[][];
  total_volumes: number[][];
}

// ignore unused properties
export interface ITokenHistoryProviderResponse {
  id: string;
  symbol: string;
  name: string;
  market_data: {
    current_price: {
      usd: number;
    };
  };
}

export abstract class TokenOffChainDataProvider {
  abstract getTokensOffChainData: (supportTokens: Token[]) => Promise<ITokenOffChainData[]>;
  abstract getTokenPriceByBlock: (tokenId: string, blockTs: number) => Promise<number>;
  abstract getTokensCurrentPrice: (tokens: string[]) => Promise<ITokenCurrentPrice[]>;
  abstract getTokensMarketChart: (tokenId: string, getDate: Date) => Promise<ITokenMarketChartProviderResponse>;
  abstract getTokenPriceByDate: (cgPriceId: string, date: Date) => Promise<ITokenHistoryProviderResponse>;
}
