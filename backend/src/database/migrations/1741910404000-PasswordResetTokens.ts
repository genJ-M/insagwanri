import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordResetTokens1741910404000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"    UUID          NOT NULL,
        "token"      VARCHAR(64)   NOT NULL,
        "expires_at" TIMESTAMPTZ   NOT NULL,
        "used_at"    TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_password_reset_token" UNIQUE ("token"),
        CONSTRAINT "FK_password_reset_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_password_reset_user" ON "password_reset_tokens" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
  }
}
