import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 개인정보보호법 / 통신비밀보호법 대응 — AES-256-GCM 암호화 컬럼 추가
 *
 * users 테이블:
 *   - email_hash      VARCHAR(64) NULLABLE  — HMAC-SHA256, WHERE/UNIQUE 인덱스용
 *   - email_encrypted TEXT        NULLABLE  — AES-256-GCM 암호화 이메일
 *   - name_encrypted  TEXT        NULLABLE  — AES-256-GCM 암호화 이름
 *
 * 기존 UNIQUE 제약 (email, company_id) → (email_hash, company_id) 로 교체
 *
 * ⚠ 마이그레이션 실행 후 백필 필요:
 *   기존 users 레코드의 email/name을 암호화하여 email_hash/email_encrypted/name_encrypted에 저장.
 *   앱 서버 기동 시 CryptoMigrationService가 자동으로 처리합니다.
 */
export class AddEncryptedColumns1741910419000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 새 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "email_hash"      VARCHAR(64),
        ADD COLUMN IF NOT EXISTS "email_encrypted" TEXT,
        ADD COLUMN IF NOT EXISTS "name_encrypted"  TEXT
    `);

    // 2. 기존 UNIQUE 제약 제거 (TypeORM이 생성한 이름으로 시도, 없으면 무시)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_b7a1540e23f1dc7a9b7cbc04f28";
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_users_email_company";
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // 3. email 컬럼 nullable 허용 (암호화 후 원문을 null로 처리할 수 있도록)
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL
    `);

    // 4. 새 UNIQUE 인덱스 추가 (email_hash + company_id)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email_hash_company"
        ON "users" ("email_hash", "company_id")
        WHERE "email_hash" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_email_hash_company"`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "email_hash",
        DROP COLUMN IF EXISTS "email_encrypted",
        DROP COLUMN IF EXISTS "name_encrypted"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_b7a1540e23f1dc7a9b7cbc04f28"
        ON "users" ("email", "company_id")
    `);
  }
}
