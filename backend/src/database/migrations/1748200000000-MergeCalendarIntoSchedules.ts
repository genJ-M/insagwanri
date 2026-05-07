import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase A — calendar_events / calendar_event_shares / calendar_share_requests 의
 * 데이터를 schedules 도메인으로 이전한다.
 *
 *  - schedules 에 scope, target_department 컬럼 추가 + 기본값 채우기
 *  - schedule_shares, schedule_share_requests 테이블 신규 생성
 *  - calendar_events → schedules INSERT (날짜 단위 → 00:00 ~ 23:59 변환)
 *  - calendar_event_shares → schedule_shares INSERT (event_id → schedule_id 매핑)
 *  - calendar_share_requests → schedule_share_requests INSERT
 *  - 옛 calendar_* 테이블은 그대로 유지 — Phase C에서 검증 후 DROP.
 *
 * 매핑 보존을 위해 schedules.legacy_calendar_event_id 컬럼을 임시로 추가한다.
 * Phase C 에서 옛 테이블 DROP 시 이 컬럼도 함께 제거 예정.
 */
export class MergeCalendarIntoSchedules1748200000000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    // 1. schedules 컬럼 확장 ────────────────────────────────────────────
    await qr.query(`
      ALTER TABLE schedules
        ADD COLUMN IF NOT EXISTS scope             VARCHAR(20)  NOT NULL DEFAULT 'company',
        ADD COLUMN IF NOT EXISTS target_department VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS legacy_calendar_event_id UUID  NULL;
    `);

    // 2. 기존 schedules 행의 scope 정합성 — targetUserId 유무로 보정
    await qr.query(`
      UPDATE schedules
         SET scope = 'personal'
       WHERE target_user_id IS NOT NULL
         AND scope = 'company';
    `);

    // 3. schedules.scope 인덱스
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_schedules_company_scope
        ON schedules (company_id, scope);
    `);

    // 4. schedule_shares 테이블 ────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS schedule_shares (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        schedule_id          UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
        company_id           UUID NOT NULL,
        shared_by            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_type       VARCHAR(20) NOT NULL,
        recipient_user_id    UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        recipient_department VARCHAR(100) NULL,
        shared_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at           TIMESTAMPTZ NULL
      );
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_schedule_shares_schedule_revoked
        ON schedule_shares (schedule_id, revoked_at);
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_schedule_shares_company_recipient_user
        ON schedule_shares (company_id, recipient_user_id, revoked_at);
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_schedule_shares_company_recipient_dept
        ON schedule_shares (company_id, recipient_department, revoked_at);
    `);

    // 5. schedule_share_requests 테이블 ─────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS schedule_share_requests (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        schedule_id       UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
        company_id        UUID NOT NULL,
        requested_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_department VARCHAR(100) NOT NULL,
        status            VARCHAR(20) NOT NULL DEFAULT 'pending',
        decided_by        UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        decided_at        TIMESTAMPTZ NULL,
        note              TEXT NULL,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_schedule_share_req_schedule_status
        ON schedule_share_requests (schedule_id, status);
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_schedule_share_req_company_decided
        ON schedule_share_requests (company_id, decided_by);
    `);

    // 6. calendar_events → schedules 데이터 이전 ──────────────────────
    //    calendar_events 테이블이 존재하지 않으면 (신규 환경) 단계 건너뜀
    const hasCalendarEvents = await qr.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_events' LIMIT 1`,
    );
    if (hasCalendarEvents.length > 0) {
      // 프론트 캐시·기존 외부 참조 호환을 위해 calendar_events.id 를 그대로 schedules.id 로 보존
      await qr.query(`
        INSERT INTO schedules (
          id, company_id, creator_id,
          title, description, location,
          target_user_id, start_at, end_at, is_all_day,
          type, scope, target_department, color,
          created_at, updated_at, deleted_at,
          legacy_calendar_event_id
        )
        SELECT
          ce.id,
          ce.company_id, ce.creator_id,
          ce.title, ce.description, NULL,
          CASE WHEN ce.scope = 'personal' THEN ce.creator_id ELSE NULL END,
          (ce.start_date::text || ' 00:00:00')::timestamptz,
          (ce.end_date::text   || ' 23:59:59')::timestamptz,
          ce.all_day,
          'general', ce.scope, ce.target_department, ce.color,
          ce.created_at, ce.updated_at, ce.deleted_at,
          ce.id
        FROM calendar_events ce
        WHERE NOT EXISTS (
          SELECT 1 FROM schedules s WHERE s.id = ce.id
        );
      `);

      // 7. calendar_event_shares → schedule_shares
      const hasShares = await qr.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_event_shares' LIMIT 1`,
      );
      if (hasShares.length > 0) {
        await qr.query(`
          INSERT INTO schedule_shares (
            id, schedule_id, company_id, shared_by, recipient_type,
            recipient_user_id, recipient_department, shared_at, revoked_at
          )
          SELECT
            ces.id, s.id, ces.company_id, ces.shared_by, ces.recipient_type,
            ces.recipient_user_id, ces.recipient_department, ces.shared_at, ces.revoked_at
          FROM calendar_event_shares ces
          JOIN schedules s ON s.legacy_calendar_event_id = ces.event_id
          ON CONFLICT (id) DO NOTHING;
        `);
      }

      // 8. calendar_share_requests → schedule_share_requests
      const hasRequests = await qr.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_share_requests' LIMIT 1`,
      );
      if (hasRequests.length > 0) {
        await qr.query(`
          INSERT INTO schedule_share_requests (
            id, schedule_id, company_id, requested_by, target_department,
            status, decided_by, decided_at, note, created_at, updated_at
          )
          SELECT
            csr.id, s.id, csr.company_id, csr.requested_by, csr.target_department,
            csr.status, csr.decided_by, csr.decided_at, csr.note, csr.created_at, csr.updated_at
          FROM calendar_share_requests csr
          JOIN schedules s ON s.legacy_calendar_event_id = csr.event_id
          ON CONFLICT (id) DO NOTHING;
        `);
      }
    }
  }

  async down(qr: QueryRunner): Promise<void> {
    // 마이그레이션 시 추가된 schedules 행 삭제
    await qr.query(`DELETE FROM schedules WHERE legacy_calendar_event_id IS NOT NULL;`);

    await qr.query(`DROP TABLE IF EXISTS schedule_share_requests CASCADE;`);
    await qr.query(`DROP TABLE IF EXISTS schedule_shares CASCADE;`);

    await qr.query(`DROP INDEX IF EXISTS idx_schedules_company_scope;`);

    await qr.query(`
      ALTER TABLE schedules
        DROP COLUMN IF EXISTS legacy_calendar_event_id,
        DROP COLUMN IF EXISTS target_department,
        DROP COLUMN IF EXISTS scope;
    `);
  }
}
