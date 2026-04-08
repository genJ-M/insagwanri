import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnnouncementTargeting1744900000000 implements MigrationInterface {
  name = 'AddAnnouncementTargeting1744900000000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS target_type          VARCHAR(20)  NOT NULL DEFAULT 'all',
        ADD COLUMN IF NOT EXISTS target_department    VARCHAR(100),
        ADD COLUMN IF NOT EXISTS target_user_ids      JSONB,
        ADD COLUMN IF NOT EXISTS is_private_recipients BOOLEAN     NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS linked_schedule_id   UUID
          REFERENCES schedules(id) ON DELETE SET NULL;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE messages
        DROP COLUMN IF EXISTS target_type,
        DROP COLUMN IF EXISTS target_department,
        DROP COLUMN IF EXISTS target_user_ids,
        DROP COLUMN IF EXISTS is_private_recipients,
        DROP COLUMN IF EXISTS linked_schedule_id;
    `);
  }
}
