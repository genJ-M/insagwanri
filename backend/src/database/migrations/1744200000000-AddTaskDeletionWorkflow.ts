import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskDeletionWorkflow1744200000000 implements MigrationInterface {
  name = 'AddTaskDeletionWorkflow1744200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
        ADD COLUMN IF NOT EXISTS "deletion_requested_at"    TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "deletion_requested_by"    UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "deletion_requester_role"  VARCHAR(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
        DROP COLUMN IF EXISTS "deletion_requested_at",
        DROP COLUMN IF EXISTS "deletion_requested_by",
        DROP COLUMN IF EXISTS "deletion_requester_role"
    `);
  }
}
