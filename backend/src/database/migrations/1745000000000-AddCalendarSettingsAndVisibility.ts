import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCalendarSettingsAndVisibility1745000000000 implements MigrationInterface {
  name = 'AddCalendarSettingsAndVisibility1745000000000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS recurring_calendar_events (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        created_by_id   UUID NOT NULL REFERENCES users(id),
        title           VARCHAR(200) NOT NULL,
        description     TEXT,
        category        VARCHAR(30) NOT NULL DEFAULT 'custom',
        department      VARCHAR(100),
        color           VARCHAR(7),
        recurrence_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
        day_of_month    SMALLINT,
        day_of_week     SMALLINT,
        month_of_year   JSONB,
        notify_before_days JSONB NOT NULL DEFAULT '[]',
        notify_emails   JSONB NOT NULL DEFAULT '[]',
        notify_by_push  BOOLEAN NOT NULL DEFAULT true,
        is_active       BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at      TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_rce_company_active ON recurring_calendar_events(company_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_rce_company_dept   ON recurring_calendar_events(company_id, department);
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS department_page_visibility (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        department    VARCHAR(100) NOT NULL,
        page_key      VARCHAR(100) NOT NULL,
        is_visible    BOOLEAN NOT NULL DEFAULT true,
        updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(company_id, department, page_key)
      );
      CREATE INDEX IF NOT EXISTS idx_dpv_company_dept ON department_page_visibility(company_id, department);
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS department_page_visibility;`);
    await qr.query(`DROP TABLE IF EXISTS recurring_calendar_events;`);
  }
}
