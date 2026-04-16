import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 현장직/교대근무직 특화 기능
 *  - attendance_records: is_long_work, night_work_minutes
 *  - companies: shift_long_work_threshold_hours, night_work_start_hour, night_work_end_hour, night_pay_rate
 *  - shift_handovers: 교대 인수인계 양방 서명 테이블 (신규)
 */
export class AddShiftWorkerFeatures1745800000000 implements MigrationInterface {
  name = 'AddShiftWorkerFeatures1745800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── attendance_records ──────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE attendance_records
        ADD COLUMN IF NOT EXISTS is_long_work       BOOLEAN  NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS night_work_minutes SMALLINT NOT NULL DEFAULT 0
    `);

    // ── companies ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE companies
        ADD COLUMN IF NOT EXISTS shift_long_work_threshold_hours SMALLINT        NOT NULL DEFAULT 12,
        ADD COLUMN IF NOT EXISTS night_work_start_hour           SMALLINT        NOT NULL DEFAULT 22,
        ADD COLUMN IF NOT EXISTS night_work_end_hour             SMALLINT        NOT NULL DEFAULT 6,
        ADD COLUMN IF NOT EXISTS night_pay_rate                  DECIMAL(4,2)    NOT NULL DEFAULT 1.50
    `);

    // ── shift_handovers (신규) ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shift_handovers (
        id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id       UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        from_user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assignment_id    UUID         REFERENCES shift_assignments(id) ON DELETE SET NULL,
        shift_date       DATE         NOT NULL,
        handover_time    VARCHAR(5),
        status           VARCHAR(20)  NOT NULL DEFAULT 'pending',
        from_note        TEXT,
        to_note          TEXT,
        dispute_reason   TEXT,
        from_signed_at   TIMESTAMPTZ,
        to_signed_at     TIMESTAMPTZ,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_shift_handovers_company_date ON shift_handovers(company_id, shift_date)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_shift_handovers_from_user   ON shift_handovers(from_user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_shift_handovers_to_user     ON shift_handovers(to_user_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS shift_handovers`);
    await queryRunner.query(`
      ALTER TABLE attendance_records
        DROP COLUMN IF EXISTS is_long_work,
        DROP COLUMN IF EXISTS night_work_minutes
    `);
    await queryRunner.query(`
      ALTER TABLE companies
        DROP COLUMN IF EXISTS shift_long_work_threshold_hours,
        DROP COLUMN IF EXISTS night_work_start_hour,
        DROP COLUMN IF EXISTS night_work_end_hour,
        DROP COLUMN IF EXISTS night_pay_rate
    `);
  }
}
