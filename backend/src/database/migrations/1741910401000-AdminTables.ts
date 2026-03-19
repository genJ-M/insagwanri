import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin 시스템 테이블 (Phase 4 대비)
 * - admin_users, plans, features, plan_features
 * 시드 데이터는 별도 seed 스크립트로 주입
 */
export class AdminTables1741910401000 implements MigrationInterface {
  name = 'AdminTables1741910401000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. admin_users ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "admin_users" (
        "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "email"         VARCHAR(255)  NOT NULL,
        "password_hash" VARCHAR(255)  NOT NULL,
        "name"          VARCHAR(100)  NOT NULL,
        "role"          VARCHAR(30)   NOT NULL DEFAULT 'readonly',
        "is_active"     BOOLEAN       NOT NULL DEFAULT true,
        "last_login_at" TIMESTAMPTZ,
        "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "deleted_at"    TIMESTAMPTZ,
        CONSTRAINT "PK_admin_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_admin_users_email" UNIQUE ("email")
      )
    `);

    // ── 2. plans ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "plans" (
        "id"                  UUID            NOT NULL DEFAULT gen_random_uuid(),
        "name"                VARCHAR(50)     NOT NULL,
        "display_name"        VARCHAR(100)    NOT NULL,
        "price_monthly_krw"   DECIMAL(12,2)   NOT NULL DEFAULT 0,
        "price_yearly_krw"    DECIMAL(12,2)   NOT NULL DEFAULT 0,
        "yearly_discount_rate" DECIMAL(5,2)   NOT NULL DEFAULT 0,
        "max_employees"       INTEGER         NOT NULL DEFAULT 5,
        "ai_requests_per_day" INTEGER         NOT NULL DEFAULT 10,
        "storage_limit_gb"    DECIMAL(10,2)   NOT NULL DEFAULT 1,
        "trial_days"          INTEGER         NOT NULL DEFAULT 0,
        "is_public"           BOOLEAN         NOT NULL DEFAULT true,
        "is_active"           BOOLEAN         NOT NULL DEFAULT true,
        "sort_order"          INTEGER         NOT NULL DEFAULT 0,
        "created_at"          TIMESTAMPTZ     NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMPTZ     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plans" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_plans_name" UNIQUE ("name")
      )
    `);

    // ── 3. features (마스터) ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "feature_type_enum" AS ENUM ('boolean', 'limit', 'config')
    `);
    await queryRunner.query(`
      CREATE TABLE "features" (
        "id"              UUID               NOT NULL DEFAULT gen_random_uuid(),
        "key"             VARCHAR(100)       NOT NULL,
        "category"        VARCHAR(50)        NOT NULL,
        "feature_type"    feature_type_enum  NOT NULL DEFAULT 'boolean',
        "name"            VARCHAR(100)       NOT NULL,
        "default_enabled" BOOLEAN            NOT NULL DEFAULT false,
        "default_config"  JSONB              NOT NULL DEFAULT '{}',
        "is_active"       BOOLEAN            NOT NULL DEFAULT true,
        "sort_order"      INTEGER            NOT NULL DEFAULT 0,
        CONSTRAINT "PK_features" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_features_key" UNIQUE ("key")
      )
    `);

    // ── 4. plan_features ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "plan_features" (
        "plan_id"      UUID    NOT NULL,
        "feature_id"   UUID    NOT NULL,
        "is_enabled"   BOOLEAN NOT NULL DEFAULT false,
        "limit_value"  INTEGER,
        "config_value" JSONB,
        CONSTRAINT "PK_plan_features" PRIMARY KEY ("plan_id", "feature_id"),
        CONSTRAINT "FK_plan_features_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_plan_features_feature" FOREIGN KEY ("feature_id")
          REFERENCES "features"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "plan_features"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "features"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "feature_type_enum"`);
  }
}
