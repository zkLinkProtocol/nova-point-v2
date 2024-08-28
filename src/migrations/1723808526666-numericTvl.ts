import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1723808526666 implements MigrationInterface {
  name = "numericTvl1723808526666";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `alter table "protocolDau"
    alter column amount type numeric using amount::numeric;`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
