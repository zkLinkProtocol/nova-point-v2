import { Injectable, Logger } from "@nestjs/common";
import { Worker } from "../common/worker";
import { Cron } from "@nestjs/schedule";
import waitFor from "../utils/waitFor";
import {
  BlockAddressPointOfLpRepository,
  BlockAddressPointRepository,
  InvitesRepository,
  SeasonTotalPointRepository,
  ReferralPointsRepository,
  SupplementPointRepository,
  PointsOfLpRepository,
  ProjectRepository,
} from "../repositories";
import { ConfigService } from "@nestjs/config";
import seasonConfig from "../config/season";
import { OTHER_HASH_64, ZERO_HASH_64 } from "src/constants";
import { SeasonTotalPoint } from "src/entities";
import { OtherPointRepository } from "src/repositories/otherPoint.repository";
import { ProjectTvlService } from "./projectTvl.service";
import { LrtUnitOfWork } from "src/unitOfWork";

interface seasonTotalPoint {
  userAddress: string;
  pairAddress: string;
  point: number;
  type: string;
}

const BULLISHS = "bullishs";

@Injectable()
export class SeasonTotalPointService extends Worker {
  private readonly logger: Logger;

  public constructor(
    private readonly referralPointsRepository: ReferralPointsRepository,
    private readonly blockAddressPointOfLpRepository: BlockAddressPointOfLpRepository,
    private readonly blockAddressPointRepository: BlockAddressPointRepository,
    private readonly invitesRepository: InvitesRepository,
    private readonly pointsOfLpRepository: PointsOfLpRepository,
    private readonly seasonTotalPointRepository: SeasonTotalPointRepository,
    private readonly otherPointRepository: OtherPointRepository,
    private readonly supplementPointRepository: SupplementPointRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectTvlService: ProjectTvlService,
    private readonly lrtUnitwork: LrtUnitOfWork,
    private readonly configService: ConfigService
  ) {
    super();
    this.logger = new Logger(SeasonTotalPointService.name);
  }

  @Cron("0 3,11,19 * * *")
  protected async runHoldProcess(): Promise<void> {
    try {
      this.logger.log("Start to calculate season point");
      await this.handlePoint();
      this.logger.log("End to calculate season point");
    } catch (error) {
      this.logger.error("Failed to calculate season point", error.stack);
    }
  }

  protected async runProcess(): Promise<void> {
    try {
      this.logger.log("Start to calculate other point");
      await this.handleOtherPoint();
      this.logger.log("End to calculate other point");
    } catch (error) {
      this.logger.error("Failed to calculate other point", error.stack);
    }

    await waitFor(() => !this.currentProcessPromise, 1 * 1000, 1 * 1000);
    if (!this.currentProcessPromise) {
      return;
    }
    return this.runProcess();
  }

  async handlePoint(specialSeason?: number) {
    const seasonTime = this.getCurrentSeasonTime(specialSeason);
    if (!seasonTime) {
      this.logger.log("No season time");
      return;
    }
    const { startBlockNumber, endBlockNumber, season } = seasonTime;
    const directHoldPointList = await this.getDirectHoldPoint(startBlockNumber, endBlockNumber);
    const lpPointList = await this.getLpPoint(startBlockNumber, endBlockNumber);
    const referralPointList = await this.getReferralPoint(season);
    const allPointList = directHoldPointList.concat(lpPointList).concat(referralPointList);
    const userAddresses = [...new Set(allPointList.map((item) => item.userAddress))];
    const usernameMap = await this.getUsername(userAddresses);
    const data: SeasonTotalPoint[] = [];
    for (const item of allPointList) {
      const tmp = new SeasonTotalPoint();
      tmp.userAddress = item.userAddress;
      tmp.pairAddress = item.pairAddress;
      tmp.point = item.point;
      tmp.type = item.type;
      tmp.season = seasonTime.season;
      tmp.userName = usernameMap.get(item.userAddress) ?? "user-" + item.userAddress.slice(10);
      data.push(tmp);
    }
    await this.lrtUnitwork.useTransaction(async () => {
      await this.seasonTotalPointRepository.deleteBySeason(season);
      await this.seasonTotalPointRepository.addManyOrUpdate(
        data,
        ["point", "userName"],
        ["userAddress", "pairAddress", "type", "season"]
      );
    });
  }

  async handleOtherPoint() {
    const seasonTime = this.getCurrentSeasonTime();
    if (!seasonTime) {
      this.logger.log("No season time");
      return;
    }
    const { startTime, endTime, season } = seasonTime;
    const otherPointList = await this.getOtherPoint(startTime, endTime);
    const bullishsPointList = await this.getAllAddressBullishsPoinst(season);
    const allPointList = otherPointList.concat(bullishsPointList);

    const userAddresses = [...new Set(allPointList.map((item) => item.userAddress))];
    const usernameMap = await this.getUsername(userAddresses);
    const data: SeasonTotalPoint[] = [];
    for (const item of allPointList) {
      const tmp = new SeasonTotalPoint();
      tmp.userAddress = item.userAddress;
      tmp.pairAddress = item.pairAddress;
      tmp.point = item.point;
      tmp.type = item.type;
      tmp.season = seasonTime.season;
      tmp.userName = usernameMap.get(item.userAddress) ?? "user-" + item.userAddress.slice(10);
      data.push(tmp);
    }
    await this.seasonTotalPointRepository.addManyOrUpdate(
      data,
      ["point", "userName"],
      ["userAddress", "pairAddress", "type", "season"]
    );
  }

  // get current season time
  public getCurrentSeasonTime(specialSeason?: number): {
    startTime: string;
    endTime: string;
    startBlockNumber: number;
    endBlockNumber: number;
    season: number;
  } {
    // const now = new Date();
    // for (const season of seasonConfig) {
    //   if (now >= new Date(season.startTime) && now < new Date(season.endTime)) {
    //     return season;
    //   }
    // }
    if (specialSeason) {
      return seasonConfig.filter((item) => item.season === specialSeason)[0];
    } else {
      return seasonConfig[seasonConfig.length - 1];
    }
  }

  // get all address's hold point
  private async getDirectHoldPoint(startBlockNumber: number, endBlockNumber: number): Promise<seasonTotalPoint[]> {
    const result = await this.blockAddressPointRepository.getAllAddressTotalPoint(startBlockNumber, endBlockNumber);
    const projectValutAddress = await this.projectTvlService.getPairAddressValut();
    const projectValutAddressMap = new Map<string, boolean>(projectValutAddress.map((item) => [item, true]));
    const holdPointList = [];
    for (const item of result) {
      if (!projectValutAddressMap.has(item.address)) {
        holdPointList.push({
          userAddress: item.address,
          pairAddress: ZERO_HASH_64,
          point: item.totalPoint,
          type: "directHold",
        });
      }
    }
    return holdPointList;
  }

  // get all address's tvl point, tx num point, tx vol point, bridgeTxNum point
  private async getLpPoint(startBlockNumber: number, endBlockNumber: number): Promise<seasonTotalPoint[]> {
    const lpPointList = [];
    const result = await this.blockAddressPointOfLpRepository.getAllAddressTotalPoint(startBlockNumber, endBlockNumber);
    for (const item of result) {
      lpPointList.push({
        userAddress: item.address,
        pairAddress: item.pairAddress,
        point: item.totalPoint,
        type: item.type,
      });
    }
    return lpPointList;
  }

  // get all address's referral point
  private async getReferralPoint(season: number): Promise<seasonTotalPoint[]> {
    const referralPointList = [];
    const result = await this.referralPointsRepository.getAllAddressTotalPoint(season);
    for (const item of result) {
      referralPointList.push({
        userAddress: item.address,
        pairAddress: item.pairAddress,
        point: item.point,
        type: "referral",
      });
    }
    return referralPointList;
  }

  // get all address's other points
  private async getOtherPoint(startTime: string, endTime: string): Promise<seasonTotalPoint[]> {
    // get daily point
    const otherPointList = [];
    let result: { address: string; totalPoint: number }[] = [];
    const otherResult = await this.otherPointRepository.getOtherPointByAddress(startTime, endTime);
    const supplementResult = await this.supplementPointRepository.getSupplementPointByAddress(startTime, endTime);
    if (supplementResult.length > 0) {
      otherResult.push(...supplementResult);
      const _result = otherResult.reduce((acc, curr) => {
        const point = Number(curr.totalPoint);
        if (acc[curr.address]) {
          acc[curr.address].totalPoint += point;
        } else {
          acc[curr.address] = { address: curr.address, totalPoint: point };
        }
        return acc;
      }, {});
      result = Object.values(_result);
    } else {
      result = otherResult;
    }
    for (const item of result) {
      otherPointList.push({
        userAddress: item.address,
        pairAddress: OTHER_HASH_64,
        point: item.totalPoint,
        type: "other",
      });
    }
    return otherPointList;
  }

  private async getAllAddressBullishsPoinst(season: number): Promise<seasonTotalPoint[]> {
    const bullishsPointList = [];
    const projects = await this.projectRepository.find({ where: { name: BULLISHS } });
    if (!projects) {
      return bullishsPointList;
    }
    const pairAddresses = [];
    for (const item of projects) {
      pairAddresses.push(item.pairAddress);
    }
    if (pairAddresses.length === 0) {
      return bullishsPointList;
    }

    const totalLastSeasonRes =
      season > 4
        ? await this.seasonTotalPointRepository.getTotalLastSeasonPointByPairAddresses(pairAddresses, season)
        : [];
    const totalLastSeasonPointsMap = new Map();
    for (const item of totalLastSeasonRes) {
      totalLastSeasonPointsMap.set(`${item.userAddress}_${item.pairAddress}`, item.point);
    }

    const currentSeasonRes = await this.pointsOfLpRepository.getPointByPairAddresses(pairAddresses);
    for (const item of currentSeasonRes) {
      const key = `${item.address}_${item.pairAddress}`;
      const totalLastSeasonPoint = totalLastSeasonPointsMap.get(key) || 0;
      const totalCurrentSeasonPoints = item.stakePoint;
      const currentSeasonPoints = totalCurrentSeasonPoints - totalLastSeasonPoint;
      if (currentSeasonPoints < 0) {
        this.logger.log(
          `bullishs point less than 0, address: ${item.address}, pairAddress: ${item.pairAddress}, currentSeason: ${season}, totalLastSeasonPoint: ${totalLastSeasonPoint}, totalCurrentSeasonPoints: ${totalCurrentSeasonPoints}`
        );
        continue;
      }
      bullishsPointList.push({
        userAddress: item.address,
        pairAddress: item.pairAddress,
        point: currentSeasonPoints,
        type: "txNum",
      });
    }
    return bullishsPointList;
  }

  private async getUsername(userAddresses: string[]): Promise<Map<string, string>> {
    const usernameMap = new Map<string, string>();
    const result = await this.invitesRepository.getInvitesByUserAddresses(userAddresses);
    for (const item of result) {
      usernameMap.set(item.address, item.userName ? item.userName : "user-" + item.code);
    }
    return usernameMap;
  }
}
