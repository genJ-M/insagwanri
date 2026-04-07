import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovalTaskLinks1744500000000 implements MigrationInterface {
  name = 'AddApprovalTaskLinks1744500000000';

  async up(qr: QueryRunner): Promise<void> {
    // 연관 업무 ID 배열 (JSONB)
    await qr.query(`
      ALTER TABLE approval_documents
        ADD COLUMN IF NOT EXISTS related_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS template_id VARCHAR(60) NULL
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE approval_documents
        DROP COLUMN IF EXISTS related_task_ids,
        DROP COLUMN IF EXISTS template_id
    `);
  }
}
