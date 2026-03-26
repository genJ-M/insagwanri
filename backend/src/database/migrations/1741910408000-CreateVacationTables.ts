import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVacationTables1741910408000 implements MigrationInterface {
  name = 'CreateVacationTables1741910408000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ENUM 타입
    await queryRunner.query(`
      CREATE TYPE "vacation_type_enum" AS ENUM (
        'annual', 'half_day_am', 'half_day_pm',
        'sick', 'event', 'maternity', 'paternity', 'other'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "vacation_status_enum" AS ENUM (
        'pending', 'approved', 'rejected', 'cancelled'
      )
    `);

    // vacation_requests
    await queryRunner.query(`
      CREATE TABLE "vacation_requests" (
        "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"    UUID          NOT NULL,
        "user_id"       UUID          NOT NULL,
        "type"          "vacation_type_enum"   NOT NULL,
        "start_date"    DATE          NOT NULL,
        "end_date"      DATE          NOT NULL,
        "days"          NUMERIC(5,1)  NOT NULL,
        "reason"        TEXT,
        "status"        "vacation_status_enum" NOT NULL DEFAULT 'pending',
        "approver_id"   UUID,
        "approved_at"   TIMESTAMPTZ,
        "rejected_at"   TIMESTAMPTZ,
        "reject_reason" TEXT,
        "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "deleted_at"    TIMESTAMPTZ,
        CONSTRAINT "PK_vacation_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vr_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_vr_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_vr_approver"
          FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_vr_company_user"   ON "vacation_requests" ("company_id", "user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_vr_company_status" ON "vacation_requests" ("company_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_vr_company_dates"  ON "vacation_requests" ("company_id", "start_date", "end_date")`);

    // vacation_balances
    await queryRunner.query(`
      CREATE TABLE "vacation_balances" (
        "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
        "company_id"  UUID         NOT NULL,
        "user_id"     UUID         NOT NULL,
        "year"        INT          NOT NULL,
        "total_days"  NUMERIC(5,1) NOT NULL DEFAULT 0,
        "used_days"   NUMERIC(5,1) NOT NULL DEFAULT 0,
        "adjust_days" NUMERIC(5,1) NOT NULL DEFAULT 0,
        "note"        TEXT,
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vacation_balances" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vb_company_user_year" UNIQUE ("company_id", "user_id", "year"),
        CONSTRAINT "FK_vb_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_vb_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_vb_company_year" ON "vacation_balances" ("company_id", "year")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_vb_company_year"`);
    await queryRunner.query(`DROP TABLE "vacation_balances"`);
    await queryRunner.query(`DROP INDEX "IDX_vr_company_dates"`);
    await queryRunner.query(`DROP INDEX "IDX_vr_company_status"`);
    await queryRunner.query(`DROP INDEX "IDX_vr_company_user"`);
    await queryRunner.query(`DROP TABLE "vacation_requests"`);
    await queryRunner.query(`DROP TYPE "vacation_status_enum"`);
    await queryRunner.query(`DROP TYPE "vacation_type_enum"`);
  }
}
