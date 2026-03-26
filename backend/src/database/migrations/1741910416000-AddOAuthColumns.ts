import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOAuthColumns1741910416000 implements MigrationInterface {
  name = 'AddOAuthColumns1741910416000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. password_hash nullable 허용 (소셜 전용 계정 지원)
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL
    `);

    // 2. provider 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(20) NULL
    `);

    // 3. provider_account_id 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider_account_id" VARCHAR(255) NULL
    `);

    // 4. (provider, provider_account_id) 복합 유니크 인덱스 — 둘 다 NOT NULL인 경우만
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_provider_account"
      ON "users" ("provider", "provider_account_id")
      WHERE "provider" IS NOT NULL AND "provider_account_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_provider_account"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "provider_account_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "provider"`);
    // password_hash NOT NULL 복원 (기존 null 값이 없는 경우에만 안전)
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`);
  }
}
