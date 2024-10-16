import { Injectable, Logger } from "@nestjs/common";
import { Worker } from "../common/worker";
import {
  PointsOfLpRepository,
  ProjectRepository,
} from "../repositories";
import { LrtUnitOfWork } from "src/unitOfWork";
import waitFor from "src/utils/waitFor";
import { fetchAPIData } from "src/utils";

const bullishsEndPoint = "https://bullishs.io/api/award/21/zklink/list";

const projects = [{
  name: 'bullishs',
  pairAddress: '0xB8bBf9D00B0e3491afF57ea6E82F5823d5FB0C82'
}]

@Injectable()
export class CalApiPointService extends Worker {
  private readonly logger: Logger;

  public constructor(
    private readonly unitOfWork: LrtUnitOfWork,
    private readonly projectRepository: ProjectRepository,
    private readonly pointsOfLpRepository: PointsOfLpRepository,
  ) {
    super();
    this.logger = new Logger(CalApiPointService.name);
  }

  protected async runProcess(): Promise<void> {
    while (true) {
      try {
        await this.updateApiPointData();
      } catch (error) {
        this.logger.error("Failed to update api point data", error.stack);
      }

      await waitFor(() => !this.currentProcessPromise, 10000);
      if (!this.currentProcessPromise) {
        break;
      }

    }
  }

  async fetchBullishsPointsData() {
    let page = 1;
    let result: Array<{ address: string; amount: number }> = [];
    const pageSize = 50;
    let fetchNext = true;

    while (fetchNext) {
      const data = await fetchAPIData<Array<{ address: string; amount: number }>>(
        `${bullishsEndPoint}?page=${page}&pageSize=${pageSize}`
      );
      result.push(...data);
      if (data.length < pageSize) {
        fetchNext = false;
      } else {
        console.log(`GET ${bullishsEndPoint} FROM ${page}`);
        page += 1;
      }
    }
    this.logger.log(`fetch bullishs point length ${result.length}`)
    return result.map(item => ({
      id: 0,
      address: item.address,
      stakePoint: item.amount,
      pairAddress: '0xB8bBf9D00B0e3491afF57ea6E82F5823d5FB0C82'
    }));
  }

  async updateApiPointData() {
    const allPointsData = await this.fetchBullishsPointsData()
    return new Promise<void>((resolve) => {
      this.unitOfWork.useTransaction(async () => {
        await this.projectRepository.addManyIgnoreConflicts(projects)
        await this.pointsOfLpRepository.addManyOrUpdate(allPointsData, ["stakePoint"], ["address", "pairAddress"]);
        this.logger.log(`Finish txPoint from api, length: ${allPointsData.length}`);
        resolve();
      });
    });
  }
}
