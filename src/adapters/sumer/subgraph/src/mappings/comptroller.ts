/* eslint-disable prefer-const */ // to satisfy AS compiler

import {
  MarketEntered,
  MarketExited,
  NewCloseFactor,
  // NewCollateralFactor,
  NewLiquidationIncentive,
  // NewMaxAssets,
  NewPriceOracle,
  MarketListed,
} from "../../generated/Comptroller/Comptroller";
import { CToken } from "../../generated/templates";
import { Market, Comptroller, Account } from "../../generated/schema";
import {
  mantissaFactorBD,
  updateCommonCTokenStats,
  createAccount,
} from "./helpers";
import { createMarket } from "./markets";

export function handleMarketListed(event: MarketListed): void {
  // Dynamically index all new listed tokens
  CToken.create(event.params.cToken);
  // Create the market for this token, since it's now been listed.
  let market = createMarket(
    event.params.cToken.toHexString(),
    event.block.number
  );
  market.save();
}

export function handleMarketEntered(event: MarketEntered): void {
  let market = Market.load(event.params.cToken.toHexString());
  // Null check needed to avoid crashing on a new market added. Ideally when dynamic data
  // sources can source from the contract creation block and not the time the
  // comptroller adds the market, we can avoid this altogether
  if (market != null) {
    let accountID = event.params.account.toHex();
    let account = Account.load(accountID);
    if (account == null) {
      createAccount(accountID);
    }

    let cTokenStats = updateCommonCTokenStats(
      market.id,
      market.symbol,
      accountID,
      event.transaction.hash,
      event.block.timestamp,
      event.block.number,
      event.logIndex
    );
    cTokenStats.enteredMarket = true;
    cTokenStats.save();
  }
}

export function handleMarketExited(event: MarketExited): void {
  let market = Market.load(event.params.cToken.toHexString());
  // Null check needed to avoid crashing on a new market added. Ideally when dynamic data
  // sources can source from the contract creation block and not the time the
  // comptroller adds the market, we can avoid this altogether
  if (market != null) {
    let accountID = event.params.account.toHex();
    let account = Account.load(accountID);
    if (account == null) {
      createAccount(accountID);
    }

    let cTokenStats = updateCommonCTokenStats(
      market.id,
      market.symbol,
      accountID,
      event.transaction.hash,
      event.block.timestamp,
      event.block.number,
      event.logIndex
    );
    cTokenStats.enteredMarket = false;
    cTokenStats.save();
  }
}

export function handleNewCloseFactor(event: NewCloseFactor): void {
  let comptroller = Comptroller.load("1");
  if (comptroller) {
    comptroller.closeFactor = event.params.newCloseFactorMantissa;
    comptroller.save();
  }
}

// export function handleNewCollateralFactor(event: NewCollateralFactor): void {
//   let market = Market.load(event.params.cToken.toHexString());
//   // Null check needed to avoid crashing on a new market added. Ideally when dynamic data
//   // sources can source from the contract creation block and not the time the
//   // comptroller adds the market, we can avoid this altogether
//   if (market != null) {
//     market.collateralFactor = event.params.newCollateralFactorMantissa
//       .toBigDecimal()
//       .div(mantissaFactorBD);
//     market.save();
//   }
// }

// This should be the first event acccording to bscscan but it isn't.... price oracle is. weird
export function handleNewLiquidationIncentive(
  event: NewLiquidationIncentive
): void {
  let comptroller = Comptroller.load("1");
  if (comptroller) {
    comptroller.homoLiquidationIncentive = event.params.newHomoIncentive;
    comptroller.heteroLiquidationIncentive = event.params.newHeteroIncentive;
    comptroller.sutokenLiquidationIncentive = event.params.newSutokenIncentive;
    comptroller.save();
  }
}

// export function handleNewMaxAssets(event: NewMaxAssets): void {
//   let comptroller = Comptroller.load("1");
//   if (comptroller == null) {
//     comptroller = new Comptroller("1");
//   }
//   comptroller.maxAssets = event.params.newMaxAssets;
//   comptroller.save();
// }

export function handleNewPriceOracle(event: NewPriceOracle): void {
  let comptroller = Comptroller.load("1");
  // This is the first event used in this mapping, so we use it to create the entity
  if (comptroller == null) {
    comptroller = new Comptroller("1");
  }
  comptroller.priceOracle = event.params.newPriceOracle;
  comptroller.save();
}
