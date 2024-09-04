import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateDirectPointProcessingStatus1723947331868 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            UPDATE "directHoldProcessingStatus"
            SET "pointProcessed" = false
            WHERE "blockNumber" in (5694730,5688827);
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
