import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceContracts1744400000000 implements MigrationInterface {
  name = 'EnhanceContracts1744400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 크레딧 잔액 테이블
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credits" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id"    VARCHAR NOT NULL UNIQUE,
        "balance"       INTEGER NOT NULL DEFAULT 0,
        "monthly_grant" INTEGER NOT NULL DEFAULT 20,
        "last_grant_at" TIMESTAMPTZ,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 크레딧 트랜잭션 이력 테이블
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credit_transactions" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id"    VARCHAR NOT NULL,
        "user_id"       UUID REFERENCES users(id) ON DELETE SET NULL,
        "amount"        INTEGER NOT NULL,
        "balance_after" INTEGER NOT NULL,
        "type"          VARCHAR(30) NOT NULL,
        "description"   VARCHAR(200),
        "ref_id"        UUID,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ct_company_user"
        ON "credit_transactions" ("company_id", "user_id", "created_at")
    `);

    // 계약 테이블 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "contracts"
        ADD COLUMN IF NOT EXISTS "job_category"    VARCHAR(30),
        ADD COLUMN IF NOT EXISTS "job_description" TEXT,
        ADD COLUMN IF NOT EXISTS "work_location"   VARCHAR(200),
        ADD COLUMN IF NOT EXISTS "monthly_salary"  BIGINT,
        ADD COLUMN IF NOT EXISTS "annual_salary"   BIGINT,
        ADD COLUMN IF NOT EXISTS "salary_detail"   JSONB,
        ADD COLUMN IF NOT EXISTS "weekly_hours"    SMALLINT,
        ADD COLUMN IF NOT EXISTS "template_id"     VARCHAR(50),
        ADD COLUMN IF NOT EXISTS "ocr_text"        TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credits"`);
    await queryRunner.query(`
      ALTER TABLE "contracts"
        DROP COLUMN IF EXISTS "job_category",
        DROP COLUMN IF EXISTS "job_description",
        DROP COLUMN IF EXISTS "work_location",
        DROP COLUMN IF EXISTS "monthly_salary",
        DROP COLUMN IF EXISTS "annual_salary",
        DROP COLUMN IF EXISTS "salary_detail",
        DROP COLUMN IF EXISTS "weekly_hours",
        DROP COLUMN IF EXISTS "template_id",
        DROP COLUMN IF EXISTS "ocr_text"
    `);
  }
}
