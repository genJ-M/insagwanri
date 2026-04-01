import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendInviteTokensAndPhoneOtp1741910421000 implements MigrationInterface {
  name = 'ExtendInviteTokensAndPhoneOtp1741910421000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. invite_tokens 테이블 확장 ──────────────────────────────────────────

    // email NOT NULL → NULL 허용 (전화번호·링크 초대 지원)
    await queryRunner.query(`
      ALTER TABLE invite_tokens
        ALTER COLUMN email DROP NOT NULL,
        ALTER COLUMN email SET DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE invite_tokens
        ADD COLUMN IF NOT EXISTS recipient_phone  VARCHAR(20),
        ADD COLUMN IF NOT EXISTS recipient_name   VARCHAR(100),
        ADD COLUMN IF NOT EXISTS invite_type      VARCHAR(10) NOT NULL DEFAULT 'email',
        ADD COLUMN IF NOT EXISTS max_uses         INT,
        ADD COLUMN IF NOT EXISTS used_count       INT NOT NULL DEFAULT 0
    `);

    // ── 2. phone_otps 테이블 생성 ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS phone_otps (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone        VARCHAR(20) NOT NULL,
        code         VARCHAR(6)  NOT NULL,
        purpose      VARCHAR(30) NOT NULL DEFAULT 'password_reset',
        expires_at   TIMESTAMPTZ NOT NULL,
        used_at      TIMESTAMPTZ,
        verified_at  TIMESTAMPTZ,
        reset_token  VARCHAR(64) UNIQUE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps(phone)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS phone_otps`);

    await queryRunner.query(`
      ALTER TABLE invite_tokens
        DROP COLUMN IF EXISTS recipient_phone,
        DROP COLUMN IF EXISTS recipient_name,
        DROP COLUMN IF EXISTS invite_type,
        DROP COLUMN IF EXISTS max_uses,
        DROP COLUMN IF EXISTS used_count
    `);

    await queryRunner.query(`
      ALTER TABLE invite_tokens
        ALTER COLUMN email SET NOT NULL,
        ALTER COLUMN email DROP DEFAULT
    `);
  }
}
