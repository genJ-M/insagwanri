import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 파트타임/아르바이트직 특화 기능
 *  - companies: 분 단위 반올림 정책, 지각 차감 단위, 근무 확인 SMS 활성화
 *  - users: hourly_rate (시급)
 *  - attendance_records: rounded_work_minutes, wage_amount
 */
export class AddPartTimeFeatures1745900000000 implements MigrationInterface {
  name = 'AddPartTimeFeatures1745900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── companies ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE companies
        ADD COLUMN IF NOT EXISTS part_time_rounding_unit    SMALLINT     NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS part_time_rounding_policy  VARCHAR(10)  NOT NULL DEFAULT 'floor',
        ADD COLUMN IF NOT EXISTS part_time_deduction_unit   SMALLINT     NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS work_confirm_sms_enabled   BOOLEAN      NOT NULL DEFAULT FALSE
    `);

    // ── users ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) NULL
    `);

    // ── attendance_records ──────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE attendance_records
        ADD COLUMN IF NOT EXISTS rounded_work_minutes SMALLINT      NULL,
        ADD COLUMN IF NOT EXISTS wage_amount          DECIMAL(10,2) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendance_records
        DROP COLUMN IF EXISTS rounded_work_minutes,
        DROP COLUMN IF EXISTS wage_amount
    `);
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS hourly_rate
    `);
    await queryRunner.query(`
      ALTER TABLE companies
        DROP COLUMN IF EXISTS part_time_rounding_unit,
        DROP COLUMN IF EXISTS part_time_rounding_policy,
        DROP COLUMN IF EXISTS part_time_deduction_unit,
        DROP COLUMN IF EXISTS work_confirm_sms_enabled
    `);
  }
}
