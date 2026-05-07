import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVacationApproverComment1748000000000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE vacation_requests
        ADD COLUMN IF NOT EXISTS approver_comment TEXT NULL;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE vacation_requests
        DROP COLUMN IF EXISTS approver_comment;
    `);
  }
}
