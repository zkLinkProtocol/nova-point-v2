/* eslint-disable prefer-const */ // to satisfy AS compiler

// For each division by 10, add one to exponent to truncate one significant figure
import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { Market, Comptroller } from "../../generated/schema";
import { PriceOracle } from "../../generated/templates/CToken/PriceOracle";
import { BEP20 } from "../../generated/templates/CToken/BEP20";
import { CToken } from "../../generated/templates/CToken/CToken";

import {
  exponentToBigDecimal,
  mantissaFactor,
  mantissaFactorBD,
  zeroBD,
} from "./helpers";

const CNativeAddr = "0x54dfae480e33dc2befd42caa26a432b11b5a27bd";
// Used for all cBEP20 contracts
function getTokenPrice(
  blockNumber: BigInt,
  ctokenAddress: Address
): BigDecimal {
  let comptroller = Comptroller.load("1");
  if (!comptroller) {
    return BigDecimal.zero();
  }
  if (!comptroller.priceOracle) {
    return BigDecimal.zero();
  }
  let oracleAddress = Address.fromBytes(comptroller.priceOracle!);
  let underlyingPrice: BigDecimal;

  /* PriceOracle2 is used from starting of Comptroller.
   * This must use the cToken address.
   *
   * Note this returns the value without factoring in token decimals and wei, so we must divide
   * the number by (bnbDecimals - tokenDecimals) and again by the mantissa.
   */
  // let mantissaDecimalFactor = 18 - underlyingDecimals + 18
  let oracle = PriceOracle.bind(oracleAddress);
  let underlyingCall = oracle.try_getUnderlyingPrice(ctokenAddress);

  if (underlyingCall.reverted) {
    underlyingPrice = zeroBD;
  } else {
    underlyingPrice = underlyingCall.value.toBigDecimal().div(mantissaFactorBD);
  }

  return underlyingPrice;
}

export function createMarket(
  marketAddress: string,
  blockNumber: BigInt
): Market {
  let market: Market;
  let contract = CToken.bind(Address.fromString(marketAddress));
  // It is cCELO, which has a slightly different interface
  const decimals = contract.try_decimals();
  const underlyingPrice = getTokenPrice(
    blockNumber,
    Address.fromString(marketAddress)
  );
  if (marketAddress == CNativeAddr) {
    market = new Market(marketAddress);
    market.underlyingAddress = Address.fromString(marketAddress);
    market.underlyingDecimals = BigInt.fromI32(18);
    market.underlyingName = "Ether";
    market.underlyingSymbol = "ETH";
    market.underlyingPrice = underlyingPrice;
    market.decimals = BigInt.fromI32(decimals.value);
    // It is all other CBEP20 contracts
  } else {
    market = new Market(marketAddress);
    market.underlyingAddress = contract.underlying();
    let underlyingContract = BEP20.bind(
      Address.fromBytes(market.underlyingAddress)
    );
    market.underlyingDecimals = BigInt.fromI32(underlyingContract.decimals());
    market.underlyingName = underlyingContract.name();
    market.underlyingSymbol = underlyingContract.symbol();
    market.underlyingPrice = underlyingPrice;
    market.decimals = BigInt.fromI32(decimals.value);
  }

  let interestRateModelAddress = contract.try_interestRateModel();
  let reserveFactor = contract.try_reserveFactorMantissa();

  market.borrowRate = zeroBD;
  market.cash = zeroBD;
  market.collateralFactor = zeroBD;
  market.discountRate = zeroBD;
  market.exchangeRate = zeroBD;
  market.interestRateModelAddress = interestRateModelAddress.reverted
    ? Address.fromString("0x0000000000000000000000000000000000000000")
    : interestRateModelAddress.value;
  market.name = contract.name();
  market.reserves = zeroBD;
  market.supplyRate = zeroBD;
  market.symbol = contract.symbol();
  market.totalBorrows = zeroBD;
  market.totalSupply = zeroBD;

  market.accrualBlockNumber = BigInt.fromI32(0);
  market.blockTimestamp = BigInt.fromI32(0);
  market.borrowIndex = zeroBD;
  market.reserveFactor = reserveFactor.reverted
    ? BigInt.fromI32(0)
    : reserveFactor.value;

  return market;
}

export function updateMarket(
  marketAddress: Address,
  blockNumber: BigInt,
  blockTimestamp: BigInt
): Market {
  let marketID = marketAddress.toHexString();
  let market = Market.load(marketID);
  if (market == null) {
    market = createMarket(marketID, blockNumber);
  }

  // Only updateMarket if it has not been updated this block
  if (market.accrualBlockNumber != blockNumber) {
    let contractAddress = Address.fromString(market.id);
    let contract = CToken.bind(contractAddress);

    let tokenPriceUSD = getTokenPrice(blockNumber, contractAddress);
    market.underlyingPrice = tokenPriceUSD.truncate(18);

    market.accrualBlockNumber = contract.accrualBlockNumber();
    market.blockTimestamp = blockTimestamp;
    market.totalSupply = contract
      .totalSupply()
      .toBigDecimal()
      .div(exponentToBigDecimal(market.decimals.toI32()));

    /* Exchange rate explanation
       In Practice
        - If you call the vDAI contract on bscscan it comes back (2.0 * 10^26)
        - If you call the vUSDC contract on bscscan it comes back (2.0 * 10^14)
        - The real value is ~0.02. So vDAI is off by 10^28, and vUSDC 10^16
       How to calculate for tokens with different decimals
        - Must div by tokenDecimals, 10^market.underlyingDecimals
        - Must multiply by ctokenDecimals, 10^8
        - Must div by mantissa, 10^18
     */

    const tryExchangeRate = contract.try_exchangeRateStored()
    if (!tryExchangeRate.reverted) {
      market.exchangeRate = tryExchangeRate.value
      .toBigDecimal()
      .div(mantissaFactorBD)
      .truncate(mantissaFactor);
    }

    market.borrowIndex = contract
      .borrowIndex()
      .toBigDecimal()
      .div(mantissaFactorBD)
      .truncate(mantissaFactor);

    market.reserves = contract
      .totalReserves()
      .toBigDecimal()
      .div(exponentToBigDecimal(market.underlyingDecimals.toI32()))
      .truncate(market.underlyingDecimals.toI32());
    market.totalBorrows = contract
      .totalBorrows()
      .toBigDecimal()
      .div(exponentToBigDecimal(market.underlyingDecimals.toI32()))
      .truncate(market.underlyingDecimals.toI32());
    market.cash = contract
      .getCash()
      .toBigDecimal()
      .div(exponentToBigDecimal(market.underlyingDecimals.toI32()))
      .truncate(market.underlyingDecimals.toI32());

    // Must convert to BigDecimal, and remove 10^18 that is used for Exp in Chee Solidity
    market.borrowRate = contract
      .borrowRatePerBlock()
      .toBigDecimal()
      .div(mantissaFactorBD)
      .truncate(mantissaFactor);

    // This fails on only the first call to cZRX. It is unclear why, but otherwise it works.
    // So we handle it like this.
    let supplyRatePerBlock = contract.try_supplyRatePerBlock();
    if (supplyRatePerBlock.reverted) {
      log.info("***CALL FAILED*** : cBEP20 supplyRatePerBlock() reverted", []);
      market.supplyRate = zeroBD;
    } else {
      market.supplyRate = supplyRatePerBlock.value
        .toBigDecimal()
        .div(mantissaFactorBD)
        .truncate(mantissaFactor);
    }
    market.save();
  }
  return market as Market;
}
