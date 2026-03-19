import { MigrationInterface, QueryRunner } from 'typeorm';

export class FilesTable1741910402000 implements MigrationInterface {
  name = 'FilesTable1741910402000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "files" (
        "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"      UUID          NOT NULL,
        "uploaded_by"     UUID          NOT NULL,
        "original_name"   VARCHAR(500)  NOT NULL,
        "file_key"        TEXT          NOT NULL,
        "bucket"          VARCHAR(100)  NOT NULL,
        "content_type"    VARCHAR(100)  NOT NULL,
        "file_size_bytes" BIGINT,
        "feature"         VARCHAR(30)   NOT NULL,
        "status"          VARCHAR(20)   NOT NULL DEFAULT 'pending',
        "s3_deleted"      BOOLEAN       NOT NULL DEFAULT false,
        "ref_type"        VARCHAR(20),
        "ref_id"          UUID,
        "thumb_key"       TEXT,
        "medium_key"      TEXT,
        "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "confirmed_at"    TIMESTAMPTZ,
        "deleted_at"      TIMESTAMPTZ,
        CONSTRAINT "PK_files" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_files_file_key" UNIQUE ("file_key"),
        CONSTRAINT "FK_files_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id"),
        CONSTRAINT "FK_files_uploader" FOREIGN KEY ("uploaded_by")
          REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_files_company_feature"
        ON "files" ("company_id", "feature")
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_files_ref"
        ON "files" ("ref_type", "ref_id")
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_files_pending_delete"
        ON "files" ("deleted_at")
        WHERE "s3_deleted" = false AND "deleted_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "files"`);
  }
}
