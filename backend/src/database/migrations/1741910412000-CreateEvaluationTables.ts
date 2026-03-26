import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEvaluationTables1741910412000 implements MigrationInterface {
  name = 'CreateEvaluationTables1741910412000';

  async up(qr: QueryRunner): Promise<void> {
    // evaluation_cycles
    await qr.query(`
      CREATE TYPE eval_cycle_status_enum AS ENUM ('draft', 'active', 'closed');
      CREATE TYPE result_visibility_enum AS ENUM ('evaluatee_only', 'dept_manager', 'all_managers');
      CREATE TYPE answer_visibility_enum AS ENUM ('none', 'evaluatee', 'managers_only');

      CREATE TABLE evaluation_cycles (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id      UUID NOT NULL,
        created_by      UUID NOT NULL,
        name            VARCHAR(100) NOT NULL,
        description     TEXT,
        status          eval_cycle_status_enum NOT NULL DEFAULT 'draft',
        start_date      DATE NOT NULL,
        end_date        DATE NOT NULL,
        is_published    BOOLEAN NOT NULL DEFAULT FALSE,
        is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
        result_visibility result_visibility_enum NOT NULL DEFAULT 'dept_manager',
        answer_visibility answer_visibility_enum NOT NULL DEFAULT 'managers_only',
        include_self    BOOLEAN NOT NULL DEFAULT TRUE,
        include_peer    BOOLEAN NOT NULL DEFAULT FALSE,
        include_manager BOOLEAN NOT NULL DEFAULT TRUE,
        published_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at      TIMESTAMPTZ,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX idx_eval_cycles_company_status ON evaluation_cycles(company_id, status);
    `);

    // evaluations
    await qr.query(`
      CREATE TYPE eval_type_enum   AS ENUM ('self', 'peer', 'manager');
      CREATE TYPE eval_status_enum AS ENUM ('pending', 'in_progress', 'submitted');

      CREATE TABLE evaluations (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cycle_id      UUID NOT NULL,
        company_id    UUID NOT NULL,
        evaluatee_id  UUID NOT NULL,
        evaluator_id  UUID NOT NULL,
        type          eval_type_enum   NOT NULL,
        status        eval_status_enum NOT NULL DEFAULT 'pending',
        total_score   NUMERIC(4,2),
        submitted_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (cycle_id, evaluatee_id, evaluator_id),
        FOREIGN KEY (cycle_id)     REFERENCES evaluation_cycles(id) ON DELETE CASCADE,
        FOREIGN KEY (evaluatee_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_evals_cycle_evaluatee ON evaluations(cycle_id, evaluatee_id);
      CREATE INDEX idx_evals_cycle_evaluator ON evaluations(cycle_id, evaluator_id);
      CREATE INDEX idx_evals_cycle_status    ON evaluations(cycle_id, status);
    `);

    // evaluation_answers
    await qr.query(`
      CREATE TYPE eval_category_enum AS ENUM (
        'performance', 'competency', 'collaboration', 'growth', 'leadership', 'comment'
      );

      CREATE TABLE evaluation_answers (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        evaluation_id  UUID NOT NULL,
        category       eval_category_enum NOT NULL,
        score          SMALLINT CHECK (score >= 1 AND score <= 5),
        comment        TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (evaluation_id, category),
        FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE
      );
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS evaluation_answers`);
    await qr.query(`DROP TABLE IF EXISTS evaluations`);
    await qr.query(`DROP TABLE IF EXISTS evaluation_cycles`);
    await qr.query(`DROP TYPE IF EXISTS eval_category_enum`);
    await qr.query(`DROP TYPE IF EXISTS eval_status_enum`);
    await qr.query(`DROP TYPE IF EXISTS eval_type_enum`);
    await qr.query(`DROP TYPE IF EXISTS answer_visibility_enum`);
    await qr.query(`DROP TYPE IF EXISTS result_visibility_enum`);
    await qr.query(`DROP TYPE IF EXISTS eval_cycle_status_enum`);
  }
}
