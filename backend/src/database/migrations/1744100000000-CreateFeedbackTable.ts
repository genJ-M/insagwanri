import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeedbackTable1744100000000 implements MigrationInterface {
  name = 'CreateFeedbackTable1744100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "feedbacks" (
        "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "type"           VARCHAR(20)  NOT NULL DEFAULT 'bug',
        "content"        TEXT,
        "context_json"   JSONB,
        "screenshot_url" TEXT,
        "status"         VARCHAR(20)  NOT NULL DEFAULT 'open',
        "company_id"     UUID REFERENCES companies(id) ON DELETE SET NULL,
        "user_id"        UUID REFERENCES users(id) ON DELETE SET NULL,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_feedbacks_company_id" ON "feedbacks" ("company_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_feedbacks_company_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feedbacks"`);
  }
}
