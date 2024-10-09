export class IToken {
  decimals: u8;
  address: string;
  symbol: string;

  constructor(decimals: u8, address: string, symbol: string) {
    this.decimals = decimals;
    this.address = address;
    this.symbol = symbol;
  }
}

export const STABLE_POOL_TOKENS: IToken[] = [
  new IToken(6, "0x2f8a25ac62179b31d62d7f80884ae57464699059", "USDT"),
  new IToken(6, "0x1a1a3b2ff016332e866787b311fcb63928464509", "USDC"),
];

export const NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
