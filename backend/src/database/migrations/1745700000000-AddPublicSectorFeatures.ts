import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 공공기관/준공무원 특화 근태 기능
 *  - attendance_records: flex_type (유연근무 유형)
 *  - vacation_requests: business_trip, external_training 타입 허용 (varchar이므로 별도 DDL 불필요)
 *  - companies: flex_work_enabled, annual_leave_force_enabled, annual_leave_force_threshold
 */
export class AddPublicSectorFeatures1745700000000 implements MigrationInterface {
  name = 'AddPublicSectorFeatures1745700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── attendance_records ──────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE attendance_records
        ADD COLUMN IF NOT EXISTS flex_type VARCHAR(30) NOT NULL DEFAULT 'regular'
    `);

    // ── companies ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE companies
        ADD COLUMN IF NOT EXISTS flex_work_enabled           BOOLEAN  NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS annual_leave_force_enabled  BOOLEAN  NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS annual_leave_force_threshold SMALLINT NOT NULL DEFAULT 5
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendance_records
        DROP COLUMN IF EXISTS flex_type
    `);
    await queryRunner.query(`
      ALTER TABLE companies
        DROP COLUMN IF EXISTS flex_work_enabled,
        DROP COLUMN IF EXISTS annual_leave_force_enabled,
        DROP COLUMN IF EXISTS annual_leave_force_threshold
    `);
  }
}
