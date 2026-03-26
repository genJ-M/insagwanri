import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 통신비밀보호법 — 사용자 활동 로그 테이블 생성
 *
 * - 로그인/로그아웃/페이지방문 기록 (90일 보관 후 자동 삭제)
 * - ip_address_encrypted: AES-256-GCM 암호화 IP
 */
export class CreateActivityLogsTable1741910420000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_activity_logs" (
        "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
        "user_id"               UUID        NULL,
        "company_id"            UUID        NULL,
        "action"                VARCHAR(30) NOT NULL,
        "ip_address_encrypted"  TEXT        NULL,
        "user_agent"            TEXT        NULL,
        "path"                  VARCHAR(500) NULL,
        "method"                VARCHAR(10)  NULL,
        "status_code"           INTEGER      NULL,
        "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_user_activity_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_activity_logs_user_created"
        ON "user_activity_logs" ("user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_activity_logs_company_created"
        ON "user_activity_logs" ("company_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_activity_logs_created"
        ON "user_activity_logs" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_activity_logs"`);
  }
}
