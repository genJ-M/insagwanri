import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCareSessionLocation1748100000000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE care_sessions
        ADD COLUMN IF NOT EXISTS planned_end_at  TIMESTAMPTZ   NULL,
        ADD COLUMN IF NOT EXISTS checkin_lat     DECIMAL(10,7) NULL,
        ADD COLUMN IF NOT EXISTS checkin_lng     DECIMAL(10,7) NULL;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE care_sessions
        DROP COLUMN IF EXISTS planned_end_at,
        DROP COLUMN IF EXISTS checkin_lat,
        DROP COLUMN IF EXISTS checkin_lng;
    `);
  }
}
