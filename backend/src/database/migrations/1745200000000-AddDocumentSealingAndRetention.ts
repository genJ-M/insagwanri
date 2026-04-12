import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentSealingAndRetention1745200000000 implements MigrationInterface {
  name = 'AddDocumentSealingAndRetention1745200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // approval_documents: 봉인·보존 컬럼
    await queryRunner.query(`
      ALTER TABLE "approval_documents"
        ADD COLUMN IF NOT EXISTS "is_sealed"     BOOLEAN         NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "sealed_at"     TIMESTAMPTZ     NULL,
        ADD COLUMN IF NOT EXISTS "content_hash"  VARCHAR(64)     NULL,
        ADD COLUMN IF NOT EXISTS "seal_hash"     VARCHAR(64)     NULL,
        ADD COLUMN IF NOT EXISTS "retain_until"  TIMESTAMPTZ     NULL,
        ADD COLUMN IF NOT EXISTS "snapshot"      JSONB           NULL
    `);

    // approval_steps: 단계별 해시 (체인)
    await queryRunner.query(`
      ALTER TABLE "approval_steps"
        ADD COLUMN IF NOT EXISTS "step_hash" VARCHAR(64) NULL
    `);

    // 인덱스: 보존 기한 만료 Cron 용
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_approval_docs_retain_until"
        ON "approval_documents" ("retain_until")
        WHERE "is_sealed" = TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_approval_docs_retain_until"`);
    await queryRunner.query(`
      ALTER TABLE "approval_steps"
        DROP COLUMN IF EXISTS "step_hash"
    `);
    await queryRunner.query(`
      ALTER TABLE "approval_documents"
        DROP COLUMN IF EXISTS "snapshot",
        DROP COLUMN IF EXISTS "retain_until",
        DROP COLUMN IF EXISTS "seal_hash",
        DROP COLUMN IF EXISTS "content_hash",
        DROP COLUMN IF EXISTS "sealed_at",
        DROP COLUMN IF EXISTS "is_sealed"
    `);
  }
}
