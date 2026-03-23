import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSalaryTable1741910405000 implements MigrationInterface {
  name = 'CreateSalaryTable1741910405000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "salary_status_enum" AS ENUM ('draft', 'confirmed', 'paid')
    `);

    await queryRunner.query(`
      CREATE TABLE "salaries" (
        "id"                    UUID              NOT NULL DEFAULT gen_random_uuid(),
        "company_id"            UUID              NOT NULL,
        "user_id"               UUID              NOT NULL,
        "year"                  INTEGER           NOT NULL,
        "month"                 INTEGER           NOT NULL,
        "base_salary"           INTEGER           NOT NULL DEFAULT 0,
        "overtime_pay"          INTEGER           NOT NULL DEFAULT 0,
        "holiday_pay"           INTEGER           NOT NULL DEFAULT 0,
        "bonus"                 INTEGER           NOT NULL DEFAULT 0,
        "meal_allowance"        INTEGER           NOT NULL DEFAULT 0,
        "transport_allowance"   INTEGER           NOT NULL DEFAULT 0,
        "other_allowance"       INTEGER           NOT NULL DEFAULT 0,
        "income_tax"            INTEGER           NOT NULL DEFAULT 0,
        "local_tax"             INTEGER           NOT NULL DEFAULT 0,
        "national_pension"      INTEGER           NOT NULL DEFAULT 0,
        "health_insurance"      INTEGER           NOT NULL DEFAULT 0,
        "care_insurance"        INTEGER           NOT NULL DEFAULT 0,
        "employment_insurance"  INTEGER           NOT NULL DEFAULT 0,
        "other_deduction"       INTEGER           NOT NULL DEFAULT 0,
        "status"                "salary_status_enum" NOT NULL DEFAULT 'draft',
        "paid_at"               TIMESTAMPTZ,
        "work_days"             INTEGER,
        "work_minutes"          INTEGER,
        "note"                  TEXT,
        "created_by"            UUID,
        "created_at"            TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "updated_at"            TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "deleted_at"            TIMESTAMPTZ,
        CONSTRAINT "PK_salaries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_salaries_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_salaries_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_salary_company_user_ym"
          UNIQUE ("company_id", "user_id", "year", "month")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_salaries_company_ym"
        ON "salaries" ("company_id", "year", "month")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_salaries_company_ym"`);
    await queryRunner.query(`DROP TABLE "salaries"`);
    await queryRunner.query(`DROP TYPE "salary_status_enum"`);
  }
}
