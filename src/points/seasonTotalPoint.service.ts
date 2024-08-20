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
} from "../repositories";
import { ConfigService } from "@nestjs/config";
import seasonConfig from "../config/season";
import { OTHER_HASH_64, ZERO_HASH_64 } from "src/constants";
import { SeasonTotalPoint } from "src/entities";
import { OtherPointRepository } from "src/repositories/otherPoint.repository";

interface seasonTotalPoint {
  userAddress: string;
  pairAddress: string;
  point: number;
  type: string;
}

@Injectable()
export class SeasonTotalPointService extends Worker {
  private readonly logger: Logger;

  public constructor(
    private readonly referralPointsRepository: ReferralPointsRepository,
    private readonly blockAddressPointOfLpRepository: BlockAddressPointOfLpRepository,
    private readonly blockAddressPointRepository: BlockAddressPointRepository,
    private readonly invitesRepository: InvitesRepository,
    private readonly seasonTotalPointRepository: SeasonTotalPointRepository,
    private readonly otherPointRepository: OtherPointRepository,
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

  async handlePoint() {
    const seasonTime = this.getCurrentSeasonTime();
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
    await this.seasonTotalPointRepository.addManyOrUpdate(
      data,
      ["point", "userName"],
      ["userAddress", "pairAddress", "type", "season"]
    );
  }

  async handleOtherPoint() {
    const seasonTime = this.getCurrentSeasonTime();
    if (!seasonTime) {
      this.logger.log("No season time");
      return;
    }
    const { startTime, endTime } = seasonTime;
    const allPointList = await this.getOtherPoint(startTime, endTime);
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
  public getCurrentSeasonTime(): {
    startTime: string;
    endTime: string;
    startBlockNumber: number;
    endBlockNumber: number;
    season: number;
  } {
    const now = new Date();
    for (const season of seasonConfig) {
      if (now >= new Date(season.startTime) && now < new Date(season.endTime)) {
        return season;
      }
    }
    return null;
  }

  // get all address's hold point
  private async getDirectHoldPoint(startBlockNumber: number, endBlockNumber: number): Promise<seasonTotalPoint[]> {
    const holdPointMap = new Map<string, number>();
    const result = await this.blockAddressPointRepository.getAllAddressTotalPoint(startBlockNumber, endBlockNumber);
    return result.map((item) => {
      return {
        userAddress: item.address,
        pairAddress: ZERO_HASH_64,
        point: item.totalPoint,
        type: "directHold",
      };
    });
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
    const result = await this.otherPointRepository.getOtherPointByAddress(startTime, endTime);
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

  private async getUsername(userAddresses: string[]): Promise<Map<string, string>> {
    const usernameMap = new Map<string, string>();
    const result = await this.invitesRepository.getInvitesByUserAddresses(userAddresses);
    for (const item of result) {
      usernameMap.set(item.address, item.userName ? item.userName : "user-" + item.code);
    }
    return usernameMap;
  }
}
