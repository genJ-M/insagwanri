import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 결제 위임 계정 — 한 회사에 OWNER 외 1명까지 결제 권한 부여
 *  - companies.billing_delegate_user_id : 위임받은 user.id (NULL = 위임자 없음)
 */
export class AddBillingDelegate1747300000000 implements MigrationInterface {
  name = 'AddBillingDelegate1747300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies"
        ADD COLUMN IF NOT EXISTS "billing_delegate_user_id" UUID
    `);
    // FK는 ON DELETE SET NULL — 위임자 탈퇴 시 자동 해제
    await queryRunner.query(`
      ALTER TABLE "companies"
        ADD CONSTRAINT "FK_companies_billing_delegate"
        FOREIGN KEY ("billing_delegate_user_id")
        REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_companies_billing_delegate"
        ON "companies" ("billing_delegate_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_companies_billing_delegate"`);
    await queryRunner.query(`
      ALTER TABLE "companies"
        DROP CONSTRAINT IF EXISTS "FK_companies_billing_delegate"
    `);
    await queryRunner.query(`
      ALTER TABLE "companies"
        DROP COLUMN IF EXISTS "billing_delegate_user_id"
    `);
  }
}
