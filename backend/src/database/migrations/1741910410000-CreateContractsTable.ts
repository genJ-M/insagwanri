import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContractsTable1741910410000 implements MigrationInterface {
  name = 'CreateContractsTable1741910410000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "contract_type_enum" AS ENUM (
        'employment', 'part_time', 'contract', 'nda', 'other'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "contract_status_enum" AS ENUM (
        'active', 'expired', 'terminated'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "contracts" (
        "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
        "company_id"       UUID         NOT NULL,
        "user_id"          UUID         NOT NULL,
        "type"             "contract_type_enum"   NOT NULL,
        "title"            VARCHAR(200) NOT NULL,
        "start_date"       DATE         NOT NULL,
        "end_date"         DATE,
        "status"           "contract_status_enum" NOT NULL DEFAULT 'active',
        "file_url"         TEXT,
        "file_name"        VARCHAR(255),
        "note"             TEXT,
        "terminated_at"    TIMESTAMPTZ,
        "terminate_reason" TEXT,
        "created_by"       UUID,
        "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "deleted_at"       TIMESTAMPTZ,
        CONSTRAINT "PK_contracts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ct_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ct_user"    FOREIGN KEY ("user_id")    REFERENCES "users"("id")     ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ct_company_user"    ON "contracts" ("company_id", "user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_ct_company_status"  ON "contracts" ("company_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_ct_company_enddate" ON "contracts" ("company_id", "end_date")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_ct_company_enddate"`);
    await queryRunner.query(`DROP INDEX "IDX_ct_company_status"`);
    await queryRunner.query(`DROP INDEX "IDX_ct_company_user"`);
    await queryRunner.query(`DROP TABLE "contracts"`);
    await queryRunner.query(`DROP TYPE "contract_status_enum"`);
    await queryRunner.query(`DROP TYPE "contract_type_enum"`);
  }
}
