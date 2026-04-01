import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyTypeAndUserPermissions1741910422000 implements MigrationInterface {
  name = 'AddCompanyTypeAndUserPermissions1741910422000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── companies 테이블 ─────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "companies"
        ADD COLUMN IF NOT EXISTS "company_type"       VARCHAR(20) NOT NULL DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS "corporate_number"   VARCHAR(20),
        ADD COLUMN IF NOT EXISTS "representative_name" VARCHAR(50),
        ADD COLUMN IF NOT EXISTS "business_type"      VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "business_item"      VARCHAR(100)
    `);

    // ── users 테이블 ─────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "managed_departments" JSONB,
        ADD COLUMN IF NOT EXISTS "permissions"         JSONB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "permissions",
        DROP COLUMN IF EXISTS "managed_departments"
    `);
    await queryRunner.query(`
      ALTER TABLE "companies"
        DROP COLUMN IF EXISTS "business_item",
        DROP COLUMN IF EXISTS "business_type",
        DROP COLUMN IF EXISTS "representative_name",
        DROP COLUMN IF EXISTS "corporate_number",
        DROP COLUMN IF EXISTS "company_type"
    `);
  }
}
