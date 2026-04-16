import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrentSessionId1746300000000 implements MigrationInterface {
  name = 'AddCurrentSessionId1746300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "current_session_id" UUID
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "current_session_id"
    `);
  }
}
