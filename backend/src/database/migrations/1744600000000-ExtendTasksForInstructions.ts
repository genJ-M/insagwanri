import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendTasksForInstructions1744600000000 implements MigrationInterface {
  name = 'ExtendTasksForInstructions1744600000000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS scope TEXT NULL,
        ADD COLUMN IF NOT EXISTS due_datetime TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS template_id VARCHAR(60) NULL,
        ADD COLUMN IF NOT EXISTS time_adjust_status VARCHAR(20) NULL,
        ADD COLUMN IF NOT EXISTS time_adjust_proposed_datetime TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS time_adjust_message TEXT NULL,
        ADD COLUMN IF NOT EXISTS time_adjust_requested_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS time_adjust_responded_at TIMESTAMPTZ NULL
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE tasks
        DROP COLUMN IF EXISTS scope,
        DROP COLUMN IF EXISTS due_datetime,
        DROP COLUMN IF EXISTS template_id,
        DROP COLUMN IF EXISTS time_adjust_status,
        DROP COLUMN IF EXISTS time_adjust_proposed_datetime,
        DROP COLUMN IF EXISTS time_adjust_message,
        DROP COLUMN IF EXISTS time_adjust_requested_at,
        DROP COLUMN IF EXISTS time_adjust_responded_at
    `);
  }
}
