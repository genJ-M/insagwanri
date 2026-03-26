import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTrainingTables1741910415000 implements MigrationInterface {
  name = 'CreateTrainingTables1741910415000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ENUM 타입
    await queryRunner.query(`
      CREATE TYPE "training_status_enum" AS ENUM (
        'planned', 'ongoing', 'completed', 'canceled'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "enrollment_status_enum" AS ENUM (
        'enrolled', 'completed', 'dropped'
      )
    `);

    // trainings 테이블
    await queryRunner.query(`
      CREATE TABLE "trainings" (
        "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
        "company_id"        UUID         NOT NULL,
        "title"             VARCHAR(200) NOT NULL,
        "description"       TEXT,
        "category"          VARCHAR(100),
        "target_department" VARCHAR(100),
        "start_date"        DATE,
        "end_date"          DATE,
        "max_participants"  INT,
        "status"            "training_status_enum" NOT NULL DEFAULT 'planned',
        "created_by"        UUID         NOT NULL,
        "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trainings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trainings_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_trainings_creator"
          FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_trainings_company_status" ON "trainings" ("company_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_trainings_company_dates"  ON "trainings" ("company_id", "start_date", "end_date")`);

    // training_enrollments 테이블
    await queryRunner.query(`
      CREATE TABLE "training_enrollments" (
        "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
        "company_id"   UUID         NOT NULL,
        "training_id"  UUID         NOT NULL,
        "user_id"      UUID         NOT NULL,
        "status"       "enrollment_status_enum" NOT NULL DEFAULT 'enrolled',
        "completed_at" TIMESTAMPTZ,
        "note"         TEXT,
        "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_training_enrollments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_enrollment_training_user" UNIQUE ("company_id", "training_id", "user_id"),
        CONSTRAINT "FK_enrollment_training"
          FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_enrollment_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_enrollment_company_training" ON "training_enrollments" ("company_id", "training_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_enrollment_company_user"     ON "training_enrollments" ("company_id", "user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_enrollment_company_user"`);
    await queryRunner.query(`DROP INDEX "IDX_enrollment_company_training"`);
    await queryRunner.query(`DROP TABLE "training_enrollments"`);
    await queryRunner.query(`DROP INDEX "IDX_trainings_company_dates"`);
    await queryRunner.query(`DROP INDEX "IDX_trainings_company_status"`);
    await queryRunner.query(`DROP TABLE "trainings"`);
    await queryRunner.query(`DROP TYPE "enrollment_status_enum"`);
    await queryRunner.query(`DROP TYPE "training_status_enum"`);
  }
}
