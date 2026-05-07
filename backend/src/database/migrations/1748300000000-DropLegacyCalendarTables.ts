import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase C cleanup — Phase A 에서 데이터를 schedules 도메인으로 이전한 뒤,
 * 옛 calendar_* 테이블과 schedules.legacy_calendar_event_id 임시 컬럼을 제거한다.
 *
 *  ⚠️ 데이터 영구 삭제. 적용 전 Phase A 검증이 끝나야 한다.
 *  - calendar_share_requests / calendar_event_shares / calendar_events DROP
 *  - schedules.legacy_calendar_event_id 컬럼 DROP
 *
 *  down() 은 의도적으로 막혀 있다 (데이터 복원 불가) — 백업에서 복원할 것.
 */
export class DropLegacyCalendarTables1748300000000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    // FK 의존성 순서대로 DROP — share/request → events
    await qr.query(`DROP TABLE IF EXISTS calendar_share_requests CASCADE;`);
    await qr.query(`DROP TABLE IF EXISTS calendar_event_shares CASCADE;`);
    await qr.query(`DROP TABLE IF EXISTS calendar_events CASCADE;`);

    // schedules.legacy_calendar_event_id 컬럼 제거
    await qr.query(`
      ALTER TABLE schedules
        DROP COLUMN IF EXISTS legacy_calendar_event_id;
    `);
  }

  async down(_qr: QueryRunner): Promise<void> {
    throw new Error(
      'DropLegacyCalendarTables1748300000000 cannot be reverted — ' +
      '옛 calendar_* 테이블 데이터는 영구 삭제됨. 백업에서 복원이 필요합니다.',
    );
  }
}
