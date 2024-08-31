import { Injectable, Logger } from "@nestjs/common";
import { Worker } from "../common/worker";
import { Cron } from "@nestjs/schedule";
import {
  PointsRepository,
  BlockRepository,
  BalanceRepository,
  BlockTokenPriceRepository,
  BlockAddressPointRepository,
  AddressFirstDepositRepository,
  DirectHoldProcessingStatusRepository,
  ProjectRepository,
} from "../repositories";
import { TokenMultiplier, TokenService } from "../token/token.service";
import BigNumber from "bignumber.js";
import { ConfigService } from "@nestjs/config";
import { BaseDataService, getETHPrice, getTokenPrice, STABLE_COIN_TYPE } from "./baseData.service";
import addressMultipliers from "../config/addressMultipliers";
import waitFor from "src/utils/waitFor";
import { LrtUnitOfWork } from "src/unitOfWork";
import { Balance } from "src/entities";

export const LOYALTY_BOOSTER_FACTOR: BigNumber = new BigNumber(0.005);
type BlockAddressTvl = {
  tvl: BigNumber;
  holdBasePoint: BigNumber;
};

const AQUA_VAULT = "0x4AC97E2727B0e92AE32F5796b97b7f98dc47F059".toLocaleLowerCase();

@Injectable()
export class DirectPointService extends Worker {
  private readonly logger: Logger;
  private readonly pointsPhase1StartTime: Date;
  private readonly addressMultipliersCache: Map<string, TokenMultiplier[]>;
  private readonly withdrawStartTime: Date;

  public constructor(
    private readonly tokenService: TokenService,
    private readonly pointsRepository: PointsRepository,
    private readonly blockTokenPriceRepository: BlockTokenPriceRepository,
    private readonly blockAddressPointRepository: BlockAddressPointRepository,
    private readonly balanceRepository: BalanceRepository,
    private readonly blockRepository: BlockRepository,
    private readonly addressFirstDepositRepository: AddressFirstDepositRepository,
    private readonly directHoldProcessingStatusRepository: DirectHoldProcessingStatusRepository,
    private readonly baseDataService: BaseDataService,
    private readonly unitOfWork: LrtUnitOfWork,
    private readonly configService: ConfigService,
    private readonly projectRepository: ProjectRepository
  ) {
    super();
    this.logger = new Logger(DirectPointService.name);
    this.pointsPhase1StartTime = new Date(this.configService.get<string>("points.pointsPhase1StartTime"));
    this.addressMultipliersCache = new Map<string, TokenMultiplier[]>();
    for (const m of addressMultipliers) {
      this.addressMultipliersCache.set(m.address.toLowerCase(), m.multipliers);
    }
    const endDate = new Date(this.pointsPhase1StartTime);
    this.withdrawStartTime = new Date(endDate.setMonth(endDate.getMonth() + 1));
  }

  @Cron("0 2,10,18 * * *")
  public async saveBlockNumber(): Promise<void> {
    const currentBlockNumber = await this.balanceRepository.getLatesBlockNumber();
    if (!currentBlockNumber) {
      this.logger.log(`Wait for the next hold point statistical block`);
      return;
    }
    const currentStatisticalBlock = await this.blockRepository.getLastBlock({
      where: {
        number: currentBlockNumber,
      },
    });
    if (!currentStatisticalBlock) {
      this.logger.error(`No block found for block number: ${currentBlockNumber}`);
      return;
    }
    await this.baseDataService.updateTokenPrice(currentStatisticalBlock);
    await this.directHoldProcessingStatusRepository.upsertStatus({
      blockNumber: currentBlockNumber,
      pointProcessed: false,
    });
  }

  public async runProcess(): Promise<void> {
    const blockNumbers = await this.directHoldProcessingStatusRepository.getUnprocessedBlockNumber();

    this.logger.log(`Start to calculate hold point, ${JSON.stringify(blockNumbers)}`);
    if (blockNumbers.length > 0) {
      for (const blockNumber of blockNumbers) {
        try {
          await this.handleHoldPoint(blockNumber.blockNumber);
        } catch (error) {
          this.logger.error("Failed to calculate hold point", error.stack);
        }
      }
      await waitFor(() => !this.currentProcessPromise, 60000, 60000);
      if (!this.currentProcessPromise) {
        return;
      }
    }
    return this.runProcess();
  }

  async handleHoldPoint(currentBlockNumber: number) {
    const currentStatisticalBlock = await this.blockRepository.getLastBlock({
      where: {
        number: currentBlockNumber,
      },
    });

    const statisticStartTime = new Date();
    const earlyBirdMultiplier = this.getEarlyBirdMultiplier(currentStatisticalBlock.timestamp);
    this.logger.log(`blockNumber:${currentStatisticalBlock.number}, Early bird multiplier: ${earlyBirdMultiplier}`);
    const tokenPriceMap = await this.getTokenPriceMap(currentStatisticalBlock.number);
    const blockTs = currentStatisticalBlock.timestamp.getTime();

    const addressBalances = await this.balanceRepository.getAllAccountBalancesByBlock(currentStatisticalBlock.number);
    const addressBalancesMap: Map<string, Balance[]> = new Map();
    for (const item of addressBalances) {
      const address = item.address;
      if (addressBalancesMap.has(address)) {
        addressBalancesMap.get(address).push(item);
      } else {
        addressBalancesMap.set(address, [item]);
      }
    }
    let page = 0;
    while (true) {
      const addressHoldPoints: {
        address: string;
        holdPoint: number;
        blockNumber: number;
      }[] = [];

      const addressList = await this.getAddressPaging(currentStatisticalBlock.number, page);
      if (addressList.length == 0) {
        this.logger.error(`blockNumber:${currentStatisticalBlock.number}, page:${page}, addressList is empty`);
        break;
      }
      const addressTvlMap = await this.getAddressTvlMap(
        currentStatisticalBlock.number,
        blockTs,
        tokenPriceMap,
        addressList,
        addressBalancesMap
      );
      if (addressTvlMap.size == 0) {
        page++;
        continue;
      }
      const addresses = Array.from(addressTvlMap.keys());
      this.logger.log(
        `Start loop address, blockNumber:${currentStatisticalBlock.number}, address count: ${addresses.length}`
      );
      // get all first deposit time
      const addressFirstDepositMap = await this.addressFirstDepositRepository.getFirstDepositMapForAddresses(addresses);
      for (const address of addresses) {
        const addressTvl = addressTvlMap.get(address);
        // const addressMultiplier = this.getAddressMultiplier(address, blockTs);

        // get the last multiplier before the block timestamp
        // const addressFirstDepositTime = addressFirstDepositMap.get(address.toLowerCase());
        let groupBooster = new BigNumber(1);
        // const loyaltyBooster = this.getLoyaltyBooster(blockTs, addressFirstDepositTime?.getTime());
        // NOVA Point = sum_all tokens in activity list (Early_Bird_Multiplier * Token Multiplier * Address Multiplier * Token Amount * Token Price * (1 + Group Booster + Growth Booster) * Loyalty Booster / ETH_Price )
        // const newHoldPoint = addressTvl.holdBasePoint
        //   .multipliedBy(earlyBirdMultiplier)
        //   .multipliedBy(groupBooster)
        //   .multipliedBy(addressMultiplier)
        //   .multipliedBy(loyaltyBooster);
        // addressHoldPoints.push({
        //   address,
        //   holdPoint: newHoldPoint.toNumber(),
        //   blockNumber: currentStatisticalBlock.number,
        // });
      }
      this.logger.log(`Finishloop address, blockNumber:${currentStatisticalBlock.number}`);
      // await this.updateHoldPoint(addressHoldPoints, currentStatisticalBlock.number);
      this.logger.log(`Finish page: ${page} for blockNumber: ${currentStatisticalBlock.number}`);
      page++;
    }

    await this.directHoldProcessingStatusRepository.upsertStatus({
      blockNumber: currentStatisticalBlock.number,
      pointProcessed: true,
    });
    this.logger.log(`Finish directHolding point statistic for block: ${currentStatisticalBlock.number}`);
    const statisticEndTime = new Date();
    const statisticElapsedTime = statisticEndTime.getTime() - statisticStartTime.getTime();
    this.logger.log(
      `Finish hold point statistic for block: ${currentStatisticalBlock.number}, elapsed time: ${
        statisticElapsedTime / 1000
      } seconds`
    );
  }

  async getAddressPaging(blockNumber: number, page = 0): Promise<string[]> {
    return await this.balanceRepository.getAllAddressesByBlock(blockNumber, page);
  }

  async getAddressTvlMap(
    blockNumber: number,
    blockTs: number,
    tokenPriceMap: Map<string, BigNumber>,
    addressList: string[],
    addressBalancesMap: Map<string, Balance[]>
  ): Promise<Map<string, BlockAddressTvl>> {
    const addressTvlMap: Map<string, BlockAddressTvl> = new Map();
    let existAddressList = await this.blockAddressPointRepository.getAllAddress(blockNumber);
    let pairAddressList = await this.projectRepository.getAllPairAddresses();
    pairAddressList.push(AQUA_VAULT);
    existAddressList = existAddressList.concat(pairAddressList);
    const existAddressListSet = new Set(existAddressList);
    const finalAddressList = addressList.filter((value) => !existAddressListSet.has(value));
    for (const address of finalAddressList) {
      const addressBalancesTmp = addressBalancesMap.get(address);
      if (!addressBalancesTmp || addressBalancesTmp.length == 0) {
        continue;
      }
      const addressTvl = await this.calculateAddressTvl(tokenPriceMap, blockTs, addressBalancesTmp);
      // if (addressTvl.tvl.gt(new BigNumber(0))) {
      //   this.logger.log(`Address ${address}: [tvl: ${addressTvl.tvl}, holdBasePoint: ${addressTvl.holdBasePoint}]`);
      // }
      addressTvlMap.set(address, addressTvl);
    }
    this.logger.log(
      `The address list length: ${addressList.length}, the final address length: ${finalAddressList.length}， addressTvlMap length: ${addressTvlMap.size}`
    );
    return addressTvlMap;
  }

  public getAddressMultiplier(address: string, blockTs: number): BigNumber {
    const multipliers = this.addressMultipliersCache.get(address.toLowerCase());
    if (!multipliers || multipliers.length == 0) {
      return new BigNumber(1);
    }
    multipliers.sort((a, b) => b.timestamp - a.timestamp);
    for (const m of multipliers) {
      if (blockTs >= m.timestamp * 1000) {
        return new BigNumber(m.multiplier);
      }
    }
    return new BigNumber(multipliers[multipliers.length - 1].multiplier);
  }

  async calculateAddressTvl(
    tokenPrices: Map<string, BigNumber>,
    blockTs: number,
    addressBalances: Balance[]
  ): Promise<BlockAddressTvl> {
    let tvl: BigNumber = new BigNumber(0);
    let holdBasePoint: BigNumber = new BigNumber(0);
    for (const addressBalance of addressBalances) {
      // filter not support token
      const tokenAddress: string = addressBalance.tokenAddress;
      const tokenInfo = this.tokenService.getSupportToken(tokenAddress);
      if (!tokenInfo) {
        continue;
      }
      const tokenPrice = getTokenPrice(tokenInfo, tokenPrices);
      const ethPrice = getETHPrice(tokenPrices);
      const tokenAmount = new BigNumber(addressBalance.balance).dividedBy(new BigNumber(10).pow(tokenInfo.decimals));
      const tokenTvl = tokenAmount.multipliedBy(tokenPrice).dividedBy(ethPrice);
      // base point = Token Multiplier * Token Amount * Token Price / ETH_Price
      const tokenMultiplier = this.tokenService.getTokenMultiplier(tokenInfo, blockTs);
      const tokenHoldBasePoint = tokenTvl.multipliedBy(new BigNumber(tokenMultiplier));
      tvl = tvl.plus(tokenTvl);
      holdBasePoint = holdBasePoint.plus(tokenHoldBasePoint);
    }
    return {
      tvl,
      holdBasePoint,
    };
  }

  async getTokenPriceMap(blockNumber: number): Promise<Map<string, BigNumber>> {
    const allSupportTokens = this.tokenService.getAllSupportTokens();
    const allPriceIds: Set<string> = new Set();
    // do not need to get the price of stable coin(they are default 1 usd)
    allSupportTokens.map((t) => {
      if (t.type !== STABLE_COIN_TYPE) {
        allPriceIds.add(t.cgPriceId);
      }
    });
    const tokenPrices: Map<string, BigNumber> = new Map();
    for (const priceId of allPriceIds) {
      const blockTokenPrice = await this.blockTokenPriceRepository.getBlockTokenPrice(blockNumber, priceId);
      if (!blockTokenPrice) {
        throw new Error(`Token ${priceId} price not found at blocknumber:${blockNumber}`);
      }
      tokenPrices.set(priceId, new BigNumber(blockTokenPrice.usdPrice));
    }
    return tokenPrices;
  }

  async updateHoldPoint(
    addressHoldPoints: { address: string; holdPoint: number; blockNumber: number }[],
    blockNumber: number
  ) {
    const blockAddressPointsMap = new Map<string, number>();
    const blockAddressPoints = [];
    const addresses = [];
    const newAddressPoints = [];
    for (const item of addressHoldPoints) {
      blockAddressPointsMap.set(item.address, item.holdPoint);
      addresses.push(item.address);
      blockAddressPoints.push({
        blockNumber: item.blockNumber,
        address: item.address,
        depositPoint: 0,
        refPoint: 0,
        holdPoint: item.holdPoint,
      });
      newAddressPoints.push(this.pointsRepository.createDefaultPoint(item.address, item.holdPoint));
    }
    const addressPoints = await this.pointsRepository.getPoints();
    const addressPointsMap = new Map<string, number>();
    // for (const item of addressPoints) {
    //   addressPointsMap.set(item.address, item.stakePoint);
    // }
    // for (const item of newAddressPoints) {
    //   const holdPoint = addressPointsMap.get(item.address);
    //   if (!holdPoint) {
    //     continue;
    //   }
    //   item.stakePoint = Number(item.stakePoint) + Number(holdPoint);
    // }
    // // await new Promise<void>(async (resolve, reject) => {
    // // await this.unitOfWork.useTransaction(async () => {
    // try {
    //   this.logger.log(`Start insert directHolding point into db for block: ${blockNumber}`);
    //   await this.blockAddressPointRepository.addManyIgnoreConflicts(blockAddressPoints);
    //   this.logger.log(
    //     `Finish directHolding blockAddressPoints for block: ${blockNumber}, length: ${blockAddressPoints.length}`
    //   );
    //   await this.pointsRepository.addManyOrUpdate(newAddressPoints, ["stakePoint"], ["address"]);
    //   this.logger.log(
    //     `Finish directHolding newAddressPoints for block: ${blockNumber}, length: ${newAddressPoints.length}`
    //   );
    //   // resolve();
    // } catch (error) {
    //   this.logger.error(`Failed to update hold points for block ${blockNumber}: ${error.stack}`);
    //   // reject(error);
    // }
    // // });
    // // });
  }

  isWithdrawStartPhase(blockTs: number): boolean {
    return blockTs >= this.withdrawStartTime.getTime();
  }

  getLoyaltyBooster(blockTs: number, firstDepositTs: number | null): BigNumber {
    if (!this.isWithdrawStartPhase(blockTs)) {
      return new BigNumber(1);
    }

    if (!firstDepositTs) {
      return new BigNumber(1);
    }

    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const diffInMilliseconds = blockTs - firstDepositTs;
    const loyaltyDays = new BigNumber(Math.floor(diffInMilliseconds / millisecondsPerDay));
    let loyaltyBooster = loyaltyDays.multipliedBy(LOYALTY_BOOSTER_FACTOR);
    loyaltyBooster = BigNumber.min(0.5, loyaltyBooster);
    return loyaltyBooster.plus(1);
  }

  getEarlyBirdMultiplier(blockTs: Date): BigNumber {
    // 1st week: 2,second week:1.5,third,forth week ~ within 1 month :1.2,1 month later: 1,
    const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
    const startDate = this.pointsPhase1StartTime;
    const diffInMilliseconds = blockTs.getTime() - startDate.getTime();
    const diffInWeeks = Math.floor(diffInMilliseconds / millisecondsPerWeek);
    if (diffInWeeks < 1) {
      return new BigNumber(2);
    } else if (diffInWeeks < 2) {
      return new BigNumber(1.5);
    } else if (!this.isWithdrawStartPhase(blockTs.getTime())) {
      return new BigNumber(1.2);
    } else {
      return new BigNumber(1);
    }
  }
}
