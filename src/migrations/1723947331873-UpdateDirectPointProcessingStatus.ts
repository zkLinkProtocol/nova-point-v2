import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateDirectPointProcessingStatus1723947331873 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            UPDATE "directHoldProcessingStatus"
            SET "pointProcessed" = false
            WHERE "blockNumber" in (5802193,5807949);
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
