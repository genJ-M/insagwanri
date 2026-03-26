import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCalendarEventsTable1741910411000 implements MigrationInterface {
  name = 'CreateCalendarEventsTable1741910411000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "calendar_event_scope_enum" AS ENUM ('company', 'team', 'personal')
    `);

    await queryRunner.query(`
      CREATE TABLE "calendar_events" (
        "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
        "company_id"        UUID         NOT NULL,
        "creator_id"        UUID         NOT NULL,
        "scope"             "calendar_event_scope_enum" NOT NULL DEFAULT 'personal',
        "target_department" VARCHAR(50),
        "title"             VARCHAR(200) NOT NULL,
        "description"       TEXT,
        "start_date"        DATE         NOT NULL,
        "end_date"          DATE         NOT NULL,
        "all_day"           BOOLEAN      NOT NULL DEFAULT true,
        "color"             VARCHAR(20),
        "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "PK_calendar_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ce_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ce_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id")     ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_ce_company_dates" ON "calendar_events" ("company_id", "start_date", "end_date")`);
    await queryRunner.query(`CREATE INDEX "IDX_ce_company_scope" ON "calendar_events" ("company_id", "scope")`);
    await queryRunner.query(`CREATE INDEX "IDX_ce_creator"       ON "calendar_events" ("company_id", "creator_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_ce_creator"`);
    await queryRunner.query(`DROP INDEX "IDX_ce_company_scope"`);
    await queryRunner.query(`DROP INDEX "IDX_ce_company_dates"`);
    await queryRunner.query(`DROP TABLE "calendar_events"`);
    await queryRunner.query(`DROP TYPE "calendar_event_scope_enum"`);
  }
}
