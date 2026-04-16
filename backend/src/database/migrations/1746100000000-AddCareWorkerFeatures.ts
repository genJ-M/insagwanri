import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCareWorkerFeatures1746100000000 implements MigrationInterface {
  name = 'AddCareWorkerFeatures1746100000000';

  async up(qr: QueryRunner): Promise<void> {
    /* ── 1. care_licenses ───────────────────────────────────── */
    await qr.query(`
      CREATE TABLE "care_licenses" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id"       UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
        "user_id"          UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type"             VARCHAR(40) NOT NULL,
        "license_number"   VARCHAR(100),
        "label"            VARCHAR(100),
        "issued_at"        DATE,
        "expires_at"       DATE,
        "issuer"           VARCHAR(100),
        "file_url"         TEXT,
        "expiry_warned_at" TIMESTAMPTZ,
        "is_active"        BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ
      )
    `);
    await qr.query(`CREATE INDEX "IDX_care_licenses_company_user"
      ON "care_licenses"("company_id", "user_id")`);
    await qr.query(`CREATE INDEX "IDX_care_licenses_company_expires"
      ON "care_licenses"("company_id", "expires_at")`);

    /* ── 2. care_sessions ────────────────────────────────────── */
    await qr.query(`
      CREATE TABLE "care_sessions" (
        "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id"           UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
        "user_id"              UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "session_date"         DATE NOT NULL,
        "type"                 VARCHAR(30) NOT NULL DEFAULT 'elderly_care',
        "recipient_id"         VARCHAR(100),
        "recipient_name"       VARCHAR(50) NOT NULL,
        "voucher_code"         VARCHAR(100),
        "started_at"           TIMESTAMPTZ NOT NULL,
        "ended_at"             TIMESTAMPTZ,
        "duration_min"         SMALLINT,
        "has_night_hours"      BOOLEAN NOT NULL DEFAULT FALSE,
        "is_holiday"           BOOLEAN NOT NULL DEFAULT FALSE,
        "pay_rate"             DECIMAL(4,2) NOT NULL DEFAULT 1.00,
        "note"                 TEXT,
        "attendance_record_id" UUID,
        "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await qr.query(`CREATE INDEX "IDX_care_sessions_company_user_date"
      ON "care_sessions"("company_id", "user_id", "session_date")`);
    await qr.query(`CREATE INDEX "IDX_care_sessions_company_recipient"
      ON "care_sessions"("company_id", "recipient_id")`);

    /* ── 3. companies: 의료·돌봄직 설정 컬럼 추가 ──────────── */
    await qr.query(`
      ALTER TABLE "companies"
        ADD COLUMN IF NOT EXISTS "care_holiday_pay_rate"        DECIMAL(4,2) NOT NULL DEFAULT 1.50,
        ADD COLUMN IF NOT EXISTS "care_fatigue_threshold_hours" SMALLINT     NOT NULL DEFAULT 52,
        ADD COLUMN IF NOT EXISTS "care_license_warn_days"       SMALLINT     NOT NULL DEFAULT 30
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "companies"
      DROP COLUMN IF EXISTS "care_holiday_pay_rate",
      DROP COLUMN IF EXISTS "care_fatigue_threshold_hours",
      DROP COLUMN IF EXISTS "care_license_warn_days"`);
    await qr.query(`DROP TABLE IF EXISTS "care_sessions"`);
    await qr.query(`DROP TABLE IF EXISTS "care_licenses"`);
  }
}
