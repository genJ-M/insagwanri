import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendInviteTokens1745100000000 implements MigrationInterface {
  name = 'ExtendInviteTokens1745100000000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE invite_tokens
        ADD COLUMN IF NOT EXISTS link_kind   VARCHAR(10)  NOT NULL DEFAULT 'group',
        ADD COLUMN IF NOT EXISTS department  VARCHAR(100),
        ADD COLUMN IF NOT EXISTS position    VARCHAR(100),
        ADD COLUMN IF NOT EXISTS note        VARCHAR(500);
    `);
    // invite_type 기본값을 'link' 로 허용 (이미 enum이 있으므로 check 없음)
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE invite_tokens
        DROP COLUMN IF EXISTS link_kind,
        DROP COLUMN IF EXISTS department,
        DROP COLUMN IF EXISTS position,
        DROP COLUMN IF EXISTS note;
    `);
  }
}
