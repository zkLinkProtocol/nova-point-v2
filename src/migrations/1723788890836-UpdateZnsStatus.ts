import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateZnsStatus1723788890836 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "txProcessingStatus"
            SET "blockNumberStart" = 3977092, 
                "blockNumberEnd" = 5225169, 
                "adapterProcessed" = false, 
                "pointProcessed" = false
            WHERE "projectName" = 'zns';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
