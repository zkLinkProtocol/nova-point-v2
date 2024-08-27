import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1723808522029 implements MigrationInterface {
  name = "Migrations1723808522029";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "protocolDau" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "name" character varying NOT NULL, "amount" integer NOT NULL, "date" date NOT NULL, "type" smallint NOT NULL DEFAULT '1', CONSTRAINT "UQ_1aaab071aea8a9562cb547fd5b5" UNIQUE ("date", "name", "type"), CONSTRAINT "PK_20d32ec3e9e341c3fcaa9f3d267" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
