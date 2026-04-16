import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * IT/스타트업 특화 근태 기능
 *  - attendance_records: work_location, late_exempted
 *  - companies: late_night_exemption_enabled, late_night_threshold_hour, overtime_approval_required
 */
export class AddItWorkFeatures1745600000000 implements MigrationInterface {
  name = 'AddItWorkFeatures1745600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── attendance_records ──────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE attendance_records
        ADD COLUMN IF NOT EXISTS work_location VARCHAR(20) NOT NULL DEFAULT 'office',
        ADD COLUMN IF NOT EXISTS late_exempted  BOOLEAN     NOT NULL DEFAULT FALSE
    `);

    // ── companies ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE companies
        ADD COLUMN IF NOT EXISTS late_night_exemption_enabled BOOLEAN  NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS late_night_threshold_hour    SMALLINT NOT NULL DEFAULT 22,
        ADD COLUMN IF NOT EXISTS late_night_grace_minutes     SMALLINT NOT NULL DEFAULT 60,
        ADD COLUMN IF NOT EXISTS overtime_approval_required   BOOLEAN  NOT NULL DEFAULT TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendance_records
        DROP COLUMN IF EXISTS work_location,
        DROP COLUMN IF EXISTS late_exempted
    `);
    await queryRunner.query(`
      ALTER TABLE companies
        DROP COLUMN IF EXISTS late_night_exemption_enabled,
        DROP COLUMN IF EXISTS late_night_threshold_hour,
        DROP COLUMN IF EXISTS late_night_grace_minutes,
        DROP COLUMN IF EXISTS overtime_approval_required
    `);
  }
}
