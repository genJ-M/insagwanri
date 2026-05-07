import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 인원/지점 감소 예약 컬럼 추가
 *  - pending_seat_count       : 다음 청구주기에 적용할 새 직원 수 (NULL = 변경 없음)
 *  - pending_extra_locations  : 다음 청구주기에 적용할 새 추가 지점 수 (NULL = 변경 없음)
 *  - pending_changes_apply_at : 적용 예정 시각 (보통 current_period_end와 동일)
 *
 * 정책: 증가는 즉시 (proration), 감소는 다음 청구주기에 자동 적용.
 */
export class AddPendingSubscriptionChanges1747200000000 implements MigrationInterface {
  name = 'AddPendingSubscriptionChanges1747200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        ADD COLUMN IF NOT EXISTS "pending_seat_count"       INTEGER,
        ADD COLUMN IF NOT EXISTS "pending_extra_locations"  INTEGER,
        ADD COLUMN IF NOT EXISTS "pending_changes_apply_at" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        DROP COLUMN IF EXISTS "pending_changes_apply_at",
        DROP COLUMN IF EXISTS "pending_extra_locations",
        DROP COLUMN IF EXISTS "pending_seat_count"
    `);
  }
}
