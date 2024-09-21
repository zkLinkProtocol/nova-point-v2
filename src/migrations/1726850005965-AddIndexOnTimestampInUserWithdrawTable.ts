import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexOnTimestampInUserWithdrawTable1726850005965 implements MigrationInterface {
    name = 'AddIndexOnTimestampInUserWithdrawTable1726850005965'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_a91e8ea398150485c88e909b41" ON "userWithdraw" ("timestamp") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_a91e8ea398150485c88e909b41"`);
    }

}
