import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHrNotesTable1741910406000 implements MigrationInterface {
  name = 'CreateHrNotesTable1741910406000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "hr_note_category_enum" AS ENUM (
        'consult', 'warning', 'praise', 'assignment', 'other'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "hr_notes" (
        "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
        "company_id"     UUID         NOT NULL,
        "target_user_id" UUID         NOT NULL,
        "author_id"      UUID         NOT NULL,
        "category"       "hr_note_category_enum" NOT NULL DEFAULT 'other',
        "title"          VARCHAR(255) NOT NULL,
        "content"        TEXT         NOT NULL,
        "is_private"     BOOLEAN      NOT NULL DEFAULT false,
        "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "deleted_at"     TIMESTAMPTZ,
        CONSTRAINT "PK_hr_notes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hr_notes_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hr_notes_target"
          FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hr_notes_author"
          FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_hr_notes_company_target"
        ON "hr_notes" ("company_id", "target_user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_hr_notes_company_author"
        ON "hr_notes" ("company_id", "author_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_hr_notes_company_author"`);
    await queryRunner.query(`DROP INDEX "IDX_hr_notes_company_target"`);
    await queryRunner.query(`DROP TABLE "hr_notes"`);
    await queryRunner.query(`DROP TYPE "hr_note_category_enum"`);
  }
}
