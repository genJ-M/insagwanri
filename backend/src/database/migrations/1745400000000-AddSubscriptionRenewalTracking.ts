import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 구독 자동갱신 추적 컬럼 추가
 *
 * subscriptions 테이블:
 *   - renewal_retry_count      INTEGER DEFAULT 0         — 연속 결제 실패 횟수 (3회 초과 시 past_due)
 *   - renewal_last_failed_at   TIMESTAMPTZ NULL          — 마지막 결제 실패 시각
 *   - renewal_notified_days    JSONB DEFAULT '[]'        — 사전 알림 발송 완료된 D-N 기록 (중복 방지)
 *
 * subscriptions status ENUM: 'past_due' 추가 (기존: active, trialing, canceled, paused)
 */
export class AddSubscriptionRenewalTracking1745400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS renewal_retry_count    INTEGER     NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS renewal_last_failed_at TIMESTAMPTZ          DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS renewal_notified_days  JSONB       NOT NULL DEFAULT '[]'::jsonb
    `);

    // status 컬럼은 VARCHAR — past_due는 추가 DDL 없이 문자열로 저장 가능
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE subscriptions
        DROP COLUMN IF EXISTS renewal_retry_count,
        DROP COLUMN IF EXISTS renewal_last_failed_at,
        DROP COLUMN IF EXISTS renewal_notified_days
    `);
  }
}
