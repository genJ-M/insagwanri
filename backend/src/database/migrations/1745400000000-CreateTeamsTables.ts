import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeamsTables1745400000000 implements MigrationInterface {
  name = 'CreateTeamsTables1745400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. teams 테이블 ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id"           UUID                     NOT NULL DEFAULT gen_random_uuid(),
        "company_id"   UUID                     NOT NULL,
        "name"         VARCHAR(100)             NOT NULL,
        "description"  TEXT,
        "color"        VARCHAR(7),
        "leader_id"    UUID,
        "channel_id"   UUID,
        "created_at"   TIMESTAMPTZ              NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ              NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMPTZ,
        CONSTRAINT "PK_teams" PRIMARY KEY ("id"),
        CONSTRAINT "FK_teams_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_teams_leader"
          FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_teams_channel"
          FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_teams_company_id" ON "teams" ("company_id")`);

    // ── 2. team_members 테이블 ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "team_members" (
        "team_id"         UUID                 NOT NULL,
        "user_id"         UUID                 NOT NULL,
        "membership_type" VARCHAR(20)          NOT NULL DEFAULT 'primary',
        "joined_at"       TIMESTAMPTZ          NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_members" PRIMARY KEY ("team_id", "user_id"),
        CONSTRAINT "FK_team_members_team"
          FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_members_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_team_members_team_id" ON "team_members" ("team_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_team_members_user_id" ON "team_members" ("user_id")`);

    // ── 3. channels 테이블에 team_id 컬럼 추가 ────────────────────────
    await queryRunner.query(`
      ALTER TABLE "channels"
        ADD COLUMN IF NOT EXISTS "team_id" UUID
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "channels" DROP COLUMN IF EXISTS "team_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_members_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_members_team_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_members"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_teams_company_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teams"`);
  }
}
