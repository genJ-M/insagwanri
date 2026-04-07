import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCalendarSharing1744300000000 implements MigrationInterface {
  name = 'AddCalendarSharing1744300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 캘린더 이벤트 공유 테이블
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_event_shares" (
        "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_id"             UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
        "company_id"           VARCHAR NOT NULL,
        "shared_by"            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "recipient_type"       VARCHAR(20) NOT NULL CHECK (recipient_type IN ('user', 'department')),
        "recipient_user_id"    UUID REFERENCES users(id) ON DELETE SET NULL,
        "recipient_department" VARCHAR(100),
        "shared_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "revoked_at"           TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ces_event_revoked"
        ON "calendar_event_shares" ("event_id", "revoked_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ces_recipient_user"
        ON "calendar_event_shares" ("company_id", "recipient_user_id", "revoked_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ces_recipient_dept"
        ON "calendar_event_shares" ("company_id", "recipient_department", "revoked_at")
    `);

    // 팀 간 공유 요청 테이블 (팀장 승인 필요)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_share_requests" (
        "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_id"          UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
        "company_id"        VARCHAR NOT NULL,
        "requested_by"      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "target_department" VARCHAR(100) NOT NULL,
        "status"            VARCHAR(20) NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
        "decided_by"        UUID REFERENCES users(id) ON DELETE SET NULL,
        "decided_at"        TIMESTAMPTZ,
        "note"              TEXT,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_csr_event_status"
        ON "calendar_share_requests" ("event_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_share_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_event_shares"`);
  }
}
