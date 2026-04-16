import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessLocations1746200000000 implements MigrationInterface {
  name = 'AddBusinessLocations1746200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. business_locations 테이블
    await queryRunner.query(`
      CREATE TABLE "business_locations" (
        "id"              UUID              DEFAULT gen_random_uuid() NOT NULL,
        "company_id"      UUID              NOT NULL,
        "name"            VARCHAR(100)      NOT NULL,
        "address"         VARCHAR(300),
        "phone"           VARCHAR(20),
        "manager_user_id" UUID,
        "is_active"       BOOLEAN           NOT NULL DEFAULT true,
        "note"            TEXT,
        "created_at"      TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMPTZ,
        CONSTRAINT "PK_business_locations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bl_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_bl_manager"
          FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bl_company_id" ON "business_locations" ("company_id")
    `);

    // 2. user_locations 조인 테이블 (직원 ↔ 지점)
    await queryRunner.query(`
      CREATE TABLE "user_locations" (
        "user_id"       UUID        NOT NULL,
        "location_id"   UUID        NOT NULL,
        "is_primary"    BOOLEAN     NOT NULL DEFAULT false,
        "assigned_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_locations" PRIMARY KEY ("user_id", "location_id"),
        CONSTRAINT "FK_ul_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ul_location"
          FOREIGN KEY ("location_id") REFERENCES "business_locations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ul_location_id" ON "user_locations" ("location_id")
    `);

    // 3. shift_schedules 에 location_id 컬럼 추가 (nullable)
    await queryRunner.query(`
      ALTER TABLE "shift_schedules"
        ADD COLUMN "location_id" UUID,
        ADD CONSTRAINT "FK_ss_location"
          FOREIGN KEY ("location_id") REFERENCES "business_locations"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shift_schedules" DROP CONSTRAINT "FK_ss_location"`);
    await queryRunner.query(`ALTER TABLE "shift_schedules" DROP COLUMN "location_id"`);
    await queryRunner.query(`DROP TABLE "user_locations"`);
    await queryRunner.query(`DROP TABLE "business_locations"`);
  }
}
