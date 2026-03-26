import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApprovalsTables1741910409000 implements MigrationInterface {
  name = 'CreateApprovalsTables1741910409000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "approval_doc_type_enum" AS ENUM (
        'general', 'vacation', 'expense', 'overtime', 'business_trip', 'hr'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "approval_doc_status_enum" AS ENUM (
        'draft', 'in_progress', 'approved', 'rejected', 'cancelled'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "approval_step_status_enum" AS ENUM (
        'pending', 'approved', 'rejected'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "approval_documents" (
        "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"   UUID          NOT NULL,
        "author_id"    UUID          NOT NULL,
        "type"         "approval_doc_type_enum"    NOT NULL DEFAULT 'general',
        "title"        VARCHAR(200)  NOT NULL,
        "content"      TEXT          NOT NULL,
        "status"       "approval_doc_status_enum"  NOT NULL DEFAULT 'draft',
        "current_step" INT           NOT NULL DEFAULT 0,
        "submitted_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "created_at"   TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMPTZ,
        CONSTRAINT "PK_approval_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ad_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ad_author"  FOREIGN KEY ("author_id")  REFERENCES "users"("id")     ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ad_company_author" ON "approval_documents" ("company_id", "author_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_ad_company_status" ON "approval_documents" ("company_id", "status")`);

    await queryRunner.query(`
      CREATE TABLE "approval_steps" (
        "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
        "document_id" UUID         NOT NULL,
        "approver_id" UUID         NOT NULL,
        "step"        INT          NOT NULL,
        "status"      "approval_step_status_enum" NOT NULL DEFAULT 'pending',
        "comment"     TEXT,
        "acted_at"    TIMESTAMPTZ,
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_approval_steps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_as_document" FOREIGN KEY ("document_id") REFERENCES "approval_documents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_as_approver" FOREIGN KEY ("approver_id") REFERENCES "users"("id")              ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_as_document_step" ON "approval_steps" ("document_id", "step")`);
    await queryRunner.query(`CREATE INDEX "IDX_as_approver"      ON "approval_steps" ("approver_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_as_approver"`);
    await queryRunner.query(`DROP INDEX "IDX_as_document_step"`);
    await queryRunner.query(`DROP TABLE "approval_steps"`);
    await queryRunner.query(`DROP INDEX "IDX_ad_company_status"`);
    await queryRunner.query(`DROP INDEX "IDX_ad_company_author"`);
    await queryRunner.query(`DROP TABLE "approval_documents"`);
    await queryRunner.query(`DROP TYPE "approval_step_status_enum"`);
    await queryRunner.query(`DROP TYPE "approval_doc_status_enum"`);
    await queryRunner.query(`DROP TYPE "approval_doc_type_enum"`);
  }
}
