import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateDirectPointProcessingStatus1723791731000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            UPDATE "directHoldProcessingStatus"
            SET "pointProcessed" = false
            WHERE "blockNumber" in (5017738, 5031056, 5044499, 5057860, 5071248,5084649,5098001,5111404,5151346,5164714,5178043,5191389,5204744,5218073);
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
