import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserProfileTables1741910413000 implements MigrationInterface {
  name = 'CreateUserProfileTables1741910413000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // user_careers
    await queryRunner.query(`
      CREATE TABLE user_careers (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id   UUID NOT NULL,
        user_id      UUID NOT NULL,
        company_name VARCHAR(200) NOT NULL,
        position     VARCHAR(100),
        department   VARCHAR(100),
        start_date   DATE NOT NULL,
        end_date     DATE,
        is_current   BOOLEAN NOT NULL DEFAULT FALSE,
        description  TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_user_careers_user_id ON user_careers(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_careers_company_id ON user_careers(company_id)`);

    // user_educations
    await queryRunner.query(`
      CREATE TABLE user_educations (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id  UUID NOT NULL,
        user_id     UUID NOT NULL,
        school_name VARCHAR(200) NOT NULL,
        major       VARCHAR(150),
        degree      VARCHAR(20) NOT NULL DEFAULT 'bachelor',
        start_date  DATE NOT NULL,
        end_date    DATE,
        is_current  BOOLEAN NOT NULL DEFAULT FALSE,
        status      VARCHAR(20) NOT NULL DEFAULT 'graduated',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_user_educations_user_id ON user_educations(user_id)`);

    // user_documents
    await queryRunner.query(`
      CREATE TABLE user_documents (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id    UUID NOT NULL,
        user_id       UUID NOT NULL,
        uploaded_by   UUID NOT NULL,
        type          VARCHAR(30) NOT NULL DEFAULT 'other',
        display_name  VARCHAR(255) NOT NULL,
        file_url      TEXT NOT NULL,
        original_name VARCHAR(255),
        file_size     BIGINT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_user_documents_user_id ON user_documents(user_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_documents`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_educations`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_careers`);
  }
}
