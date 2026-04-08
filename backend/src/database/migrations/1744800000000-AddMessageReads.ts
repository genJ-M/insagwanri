import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageReads1744800000000 implements MigrationInterface {
  name = 'AddMessageReads1744800000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE "message_reads" (
        "message_id" UUID NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
        "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "read_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY ("message_id", "user_id")
      )
    `);
    await runner.query(`CREATE INDEX "IDX_message_reads_message" ON "message_reads"("message_id")`);
    await runner.query(`CREATE INDEX "IDX_message_reads_user"    ON "message_reads"("user_id")`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE IF EXISTS "message_reads"`);
  }
}
