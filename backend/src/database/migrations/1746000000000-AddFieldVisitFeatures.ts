import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFieldVisitFeatures1746000000000 implements MigrationInterface {
  name = 'AddFieldVisitFeatures1746000000000';

  async up(qr: QueryRunner): Promise<void> {
    /* ── 1. field_locations 테이블 ─────────────────────────── */
    await qr.query(`
      CREATE TABLE "field_locations" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id"  UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
        "name"        VARCHAR(200) NOT NULL,
        "address"     TEXT,
        "lat"         DECIMAL(10,7) NOT NULL,
        "lng"         DECIMAL(10,7) NOT NULL,
        "radius_m"    SMALLINT NOT NULL DEFAULT 300,
        "category"    VARCHAR(20) NOT NULL DEFAULT 'customer',
        "is_active"   BOOLEAN NOT NULL DEFAULT TRUE,
        "note"        TEXT,
        "created_by"  UUID REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMPTZ
      )
    `);
    await qr.query(`CREATE INDEX "IDX_field_locations_company_active"
      ON "field_locations"("company_id", "is_active")`);

    /* ── 2. field_visits 테이블 ──────────────────────────────── */
    await qr.query(`
      CREATE TABLE "field_visits" (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id"          UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
        "user_id"             UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "visit_date"          DATE NOT NULL,
        "field_location_id"   UUID REFERENCES "field_locations"("id") ON DELETE SET NULL,
        "checked_in_at"       TIMESTAMPTZ NOT NULL,
        "checked_out_at"      TIMESTAMPTZ,
        "in_lat"              DECIMAL(10,7) NOT NULL,
        "in_lng"              DECIMAL(10,7) NOT NULL,
        "out_lat"             DECIMAL(10,7),
        "out_lng"             DECIMAL(10,7),
        "in_distance_m"       SMALLINT,
        "is_out_of_range"     BOOLEAN NOT NULL DEFAULT FALSE,
        "purpose"             TEXT,
        "linked_task_id"      UUID,
        "vehicle_events"      JSONB NOT NULL DEFAULT '[]',
        "route_points"        JSONB NOT NULL DEFAULT '[]',
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await qr.query(`CREATE INDEX "IDX_field_visits_company_user_date"
      ON "field_visits"("company_id", "user_id", "visit_date")`);
    await qr.query(`CREATE INDEX "IDX_field_visits_user_checkin"
      ON "field_visits"("user_id", "checked_in_at")`);

    /* ── 3. companies: 현장외근 설정 컬럼 추가 ────────────────── */
    await qr.query(`
      ALTER TABLE "companies"
        ADD COLUMN IF NOT EXISTS "field_visit_auto_task"   BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS "field_visit_task_title"  VARCHAR(200)
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "companies"
      DROP COLUMN IF EXISTS "field_visit_auto_task",
      DROP COLUMN IF EXISTS "field_visit_task_title"`);
    await qr.query(`DROP TABLE IF EXISTS "field_visits"`);
    await qr.query(`DROP TABLE IF EXISTS "field_locations"`);
  }
}
