import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompanyModules1747000000000 implements MigrationInterface {
  name = 'CreateCompanyModules1747000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. company_modules 테이블 ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_modules" (
        "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
        "company_id"        UUID        NOT NULL,
        "module_id"         VARCHAR(50) NOT NULL,
        "is_active"         BOOLEAN     NOT NULL DEFAULT true,
        "source"            VARCHAR(20) NOT NULL DEFAULT 'plan',
        "addon_purchase_id" UUID,
        "activated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_modules" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_modules_company_module" UNIQUE ("company_id", "module_id"),
        CONSTRAINT "FK_company_modules_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_company_modules_addon" FOREIGN KEY ("addon_purchase_id")
          REFERENCES "addon_purchases"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_company_modules_company"
        ON "company_modules" ("company_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_company_modules_active"
        ON "company_modules" ("company_id", "is_active")
    `);

    // ── 2. 기존 회사에 FREE 플랜 모듈 기본 적용 ─────────────────────────────
    // 현재 가입된 모든 회사에 FREE 플랜 5개 모듈 자동 활성화
    // 이미 구독이 있는 회사는 Phase 2 서비스에서 플랜 기반으로 업데이트됨
    await queryRunner.query(`
      INSERT INTO "company_modules" ("company_id", "module_id", "source")
      SELECT c."id", m."module_id", 'plan'
      FROM "companies" c
      CROSS JOIN (
        VALUES
          ('attendance'),
          ('tasks'),
          ('calendar'),
          ('vacations'),
          ('schedules')
      ) AS m("module_id")
      ON CONFLICT ("company_id", "module_id") DO NOTHING
    `);

    // ── 3. basic 플랜 구독 중인 회사에 BASIC 모듈 추가 적용 ─────────────────
    await queryRunner.query(`
      INSERT INTO "company_modules" ("company_id", "module_id", "source")
      SELECT s."company_id", m."module_id", 'plan'
      FROM "subscriptions" s
      JOIN "plans" p ON p."id" = s."plan_id"
      CROSS JOIN (
        VALUES
          ('attendance_methods'),
          ('locations'),
          ('contracts'),
          ('salary'),
          ('shift_schedule'),
          ('shift_swap'),
          ('approvals'),
          ('collaboration'),
          ('tax_documents'),
          ('calendar_settings')
      ) AS m("module_id")
      WHERE LOWER(p."name") = 'basic'
        AND s."status" IN ('active', 'trialing')
      ON CONFLICT ("company_id", "module_id") DO NOTHING
    `);

    // ── 4. pro 플랜 구독 중인 회사에 PRO 모듈 추가 적용 ────────────────────
    await queryRunner.query(`
      INSERT INTO "company_modules" ("company_id", "module_id", "source")
      SELECT s."company_id", m."module_id", 'plan'
      FROM "subscriptions" s
      JOIN "plans" p ON p."id" = s."plan_id"
      CROSS JOIN (
        VALUES
          ('attendance_methods'),
          ('locations'),
          ('contracts'),
          ('salary'),
          ('shift_schedule'),
          ('shift_swap'),
          ('approvals'),
          ('collaboration'),
          ('tax_documents'),
          ('calendar_settings'),
          ('ai'),
          ('field_visits'),
          ('hr_notes'),
          ('evaluations'),
          ('training'),
          ('search'),
          ('custom_templates'),
          ('activity_logs_view'),
          ('credits')
      ) AS m("module_id")
      WHERE LOWER(p."name") = 'pro'
        AND s."status" IN ('active', 'trialing')
      ON CONFLICT ("company_id", "module_id") DO NOTHING
    `);

    // ── 5. enterprise 구독 회사에 전체 모듈 적용 ────────────────────────────
    await queryRunner.query(`
      INSERT INTO "company_modules" ("company_id", "module_id", "source")
      SELECT s."company_id", m."module_id", 'plan'
      FROM "subscriptions" s
      JOIN "plans" p ON p."id" = s."plan_id"
      CROSS JOIN (
        VALUES
          ('attendance'), ('tasks'), ('calendar'), ('vacations'), ('schedules'),
          ('attendance_methods'), ('locations'), ('contracts'), ('salary'),
          ('shift_schedule'), ('shift_swap'), ('approvals'), ('collaboration'),
          ('tax_documents'), ('calendar_settings'),
          ('ai'), ('field_visits'), ('hr_notes'), ('evaluations'), ('training'),
          ('search'), ('custom_templates'), ('activity_logs_view'), ('credits'),
          ('care_worker')
      ) AS m("module_id")
      WHERE LOWER(p."name") = 'enterprise'
        AND s."status" IN ('active', 'trialing')
      ON CONFLICT ("company_id", "module_id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "company_modules"`);
  }
}
