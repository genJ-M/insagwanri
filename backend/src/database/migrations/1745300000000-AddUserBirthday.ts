import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserBirthday1745300000000 implements MigrationInterface {
  name = 'AddUserBirthday1745300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "birthday" DATE NULL
    `);

    // 생일월/일 기반 조회 성능을 위한 인덱스
    // (생일 연도는 무시하고 매년 같은 월/일로 검색)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_birthday_month_day"
        ON "users" (
          EXTRACT(MONTH FROM birthday),
          EXTRACT(DAY   FROM birthday)
        )
        WHERE birthday IS NOT NULL AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_birthday_month_day"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "birthday"`);
  }
}
