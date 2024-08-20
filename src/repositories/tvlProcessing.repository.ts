import { Injectable } from "@nestjs/common";
import { LrtUnitOfWork } from "../unitOfWork";
import { BaseRepository } from "./base.repository";
import { TvlProcessingStatus } from "../entities";


@Injectable()
export class TvlProcessingRepository extends BaseRepository<TvlProcessingStatus> {
  public constructor(unitOfWork: LrtUnitOfWork) {
    super(TvlProcessingStatus, unitOfWork);
  }

  public async upsertStatus(updateData: Partial<TvlProcessingStatus>): Promise<TvlProcessingStatus> {
    const entityManager = this.unitOfWork.getTransactionManager();
    const result = await entityManager.upsert(
      TvlProcessingStatus,
      updateData,
      ['projectName', 'blockNumber']
    );

    return result.raw[0]
  }
}
