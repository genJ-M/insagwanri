import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShiftScheduleAndTemplates1744700000000 implements MigrationInterface {
  name = 'AddShiftScheduleAndTemplates1744700000000';

  async up(runner: QueryRunner): Promise<void> {
    // ── 커스텀 템플릿 ──────────────────────────────────────────────────────────
    await runner.query(`
      CREATE TABLE "custom_templates" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id"      UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
        "creator_id"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type"            VARCHAR(20) NOT NULL,
        "name"            VARCHAR(200) NOT NULL,
        "description"     TEXT,
        "category"        VARCHAR(100),
        "fields"          JSONB NOT NULL DEFAULT '{}',
        "is_company_wide" BOOLEAN NOT NULL DEFAULT false,
        "use_count"       INTEGER NOT NULL DEFAULT 0,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMPTZ
      )
    `);
    await runner.query(`CREATE INDEX "IDX_custom_templates_company_type"    ON "custom_templates"("company_id","type")`);
    await runner.query(`CREATE INDEX "IDX_custom_templates_company_creator" ON "custom_templates"("company_id","creator_id")`);

    // ── 직원 가용시간 ──────────────────────────────────────────────────────────
    await runner.query(`
      CREATE TABLE "employee_availability" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id"      UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
        "user_id"         UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "day_of_week"     SMALLINT,
        "specific_date"   DATE,
        "start_time"      VARCHAR(5) NOT NULL,
        "end_time"        VARCHAR(5) NOT NULL,
        "is_available"    BOOLEAN NOT NULL DEFAULT true,
        "note"            TEXT,
        "effective_from"  DATE,
        "effective_until" DATE,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_availability_time" CHECK ("end_time" > "start_time")
      )
    `);
    await runner.query(`CREATE INDEX "IDX_employee_availability_user"       ON "employee_availability"("company_id","user_id")`);
    await runner.query(`CREATE INDEX "IDX_employee_availability_dow"        ON "employee_availability"("company_id","day_of_week")`);

    // ── 팀 근무표 ─────────────────────────────────────────────────────────────
    await runner.query(`
      CREATE TABLE "shift_schedules" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id"   UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
        "creator_id"   UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title"        VARCHAR(200) NOT NULL,
        "department"   VARCHAR(100),
        "week_start"   DATE NOT NULL,
        "status"       VARCHAR(20) NOT NULL DEFAULT 'draft',
        "note"         TEXT,
        "published_at" TIMESTAMPTZ,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMPTZ
      )
    `);
    await runner.query(`CREATE INDEX "IDX_shift_schedules_week"   ON "shift_schedules"("company_id","week_start")`);
    await runner.query(`CREATE INDEX "IDX_shift_schedules_dept"   ON "shift_schedules"("company_id","department")`);

    // ── 근무 배정 ─────────────────────────────────────────────────────────────
    await runner.query(`
      CREATE TABLE "shift_assignments" (
        "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "shift_schedule_id" UUID NOT NULL REFERENCES "shift_schedules"("id") ON DELETE CASCADE,
        "company_id"        UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
        "user_id"           UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "date"              DATE NOT NULL,
        "start_time"        VARCHAR(5),
        "end_time"          VARCHAR(5),
        "shift_type"        VARCHAR(20) NOT NULL DEFAULT 'office',
        "location"          VARCHAR(300),
        "note"              TEXT,
        "is_confirmed"      BOOLEAN NOT NULL DEFAULT false,
        "confirmed_at"      TIMESTAMPTZ,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await runner.query(`CREATE INDEX "IDX_shift_assignments_schedule_user" ON "shift_assignments"("shift_schedule_id","user_id")`);
    await runner.query(`CREATE INDEX "IDX_shift_assignments_date"          ON "shift_assignments"("company_id","date")`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE IF EXISTS "shift_assignments"`);
    await runner.query(`DROP TABLE IF EXISTS "shift_schedules"`);
    await runner.query(`DROP TABLE IF EXISTS "employee_availability"`);
    await runner.query(`DROP TABLE IF EXISTS "custom_templates"`);
  }
}
