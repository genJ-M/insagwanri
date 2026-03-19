import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1741910400000 implements MigrationInterface {
  name = 'InitialSchema1741910400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. companies ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "companies" (
        "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
        "name"                VARCHAR(100)  NOT NULL,
        "business_number"     VARCHAR(20)   UNIQUE,
        "industry"            VARCHAR(50),
        "address"             TEXT,
        "phone"               VARCHAR(20),
        "logo_url"            TEXT,
        "plan"                VARCHAR(20)   NOT NULL DEFAULT 'free',
        "plan_started_at"     TIMESTAMPTZ,
        "plan_expires_at"     TIMESTAMPTZ,
        "max_members"         SMALLINT      NOT NULL DEFAULT 5,
        "work_start_time"     TIME          NOT NULL DEFAULT '09:00',
        "work_end_time"       TIME          NOT NULL DEFAULT '18:00',
        "late_threshold_min"  SMALLINT      NOT NULL DEFAULT 10,
        "timezone"            VARCHAR(50)   NOT NULL DEFAULT 'Asia/Seoul',
        "work_days"           SMALLINT[]    NOT NULL DEFAULT '{1,2,3,4,5}',
        "status"              VARCHAR(20)   NOT NULL DEFAULT 'active',
        "gps_enabled"         BOOLEAN       NOT NULL DEFAULT false,
        "gps_lat"             DECIMAL(10,7),
        "gps_lng"             DECIMAL(10,7),
        "gps_radius_m"        SMALLINT      NOT NULL DEFAULT 100,
        "gps_strict_mode"     BOOLEAN       NOT NULL DEFAULT false,
        "created_at"          TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMPTZ,
        CONSTRAINT "PK_companies" PRIMARY KEY ("id")
      )
    `);

    // ── 2. users ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"          UUID          NOT NULL,
        "email"               VARCHAR(255)  NOT NULL,
        "password_hash"       TEXT          NOT NULL,
        "refresh_token_hash"  TEXT,
        "name"                VARCHAR(50)   NOT NULL,
        "phone"               VARCHAR(20),
        "profile_image_url"   TEXT,
        "employee_number"     VARCHAR(30),
        "department"          VARCHAR(50),
        "position"            VARCHAR(50),
        "role"                VARCHAR(20)   NOT NULL DEFAULT 'employee',
        "custom_work_start"   TIME,
        "custom_work_end"     TIME,
        "status"              VARCHAR(20)   NOT NULL DEFAULT 'active',
        "joined_at"           DATE,
        "last_login_at"       TIMESTAMPTZ,
        "created_at"          TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMPTZ,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email_company" UNIQUE ("email", "company_id"),
        CONSTRAINT "FK_users_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_company_id" ON "users" ("company_id")`);

    // ── 3. attendance_records ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "attendance_records" (
        "id"                    UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"            UUID          NOT NULL,
        "user_id"               UUID          NOT NULL,
        "work_date"             DATE          NOT NULL,
        "clock_in_at"           TIMESTAMPTZ,
        "clock_out_at"          TIMESTAMPTZ,
        "clock_in_lat"          DECIMAL(10,7),
        "clock_in_lng"          DECIMAL(10,7),
        "clock_out_lat"         DECIMAL(10,7),
        "clock_out_lng"         DECIMAL(10,7),
        "clock_in_distance_m"   INTEGER,
        "clock_in_out_of_range" BOOLEAN       NOT NULL DEFAULT false,
        "gps_bypassed"          BOOLEAN       NOT NULL DEFAULT false,
        "status"                VARCHAR(20)   NOT NULL DEFAULT 'pending',
        "is_late"               BOOLEAN       NOT NULL DEFAULT false,
        "late_minutes"          SMALLINT,
        "total_work_minutes"    SMALLINT,
        "note"                  TEXT,
        "approved_by"           UUID,
        "approved_at"           TIMESTAMPTZ,
        "created_at"            TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"            TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attendance_records" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_attendance_user_date" UNIQUE ("user_id", "work_date"),
        CONSTRAINT "FK_attendance_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id"),
        CONSTRAINT "FK_attendance_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id"),
        CONSTRAINT "FK_attendance_approver" FOREIGN KEY ("approved_by")
          REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_attendance_company_date" ON "attendance_records" ("company_id", "work_date")`);
    await queryRunner.query(`CREATE INDEX "IDX_attendance_company_status_date" ON "attendance_records" ("company_id", "status", "work_date")`);

    // ── 4. invite_tokens ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "invite_tokens" (
        "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"      UUID          NOT NULL,
        "invited_by"      UUID          NOT NULL,
        "email"           VARCHAR(255)  NOT NULL,
        "role"            VARCHAR(20)   NOT NULL DEFAULT 'employee',
        "token"           VARCHAR(64)   NOT NULL,
        "status"          VARCHAR(20)   NOT NULL DEFAULT 'pending',
        "expires_at"      TIMESTAMPTZ   NOT NULL,
        "accepted_at"     TIMESTAMPTZ,
        "created_user_id" UUID,
        "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invite_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_invite_token" UNIQUE ("token"),
        CONSTRAINT "FK_invite_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invite_inviter" FOREIGN KEY ("invited_by")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_invite_email" ON "invite_tokens" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_invite_token" ON "invite_tokens" ("token")`);

    // ── 5. email_verifications ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "email_verifications" (
        "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"     UUID          NOT NULL,
        "email"       VARCHAR(255)  NOT NULL,
        "token"       VARCHAR(64)   NOT NULL,
        "expires_at"  TIMESTAMPTZ   NOT NULL,
        "verified_at" TIMESTAMPTZ,
        "created_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_verifications" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_verification_token" UNIQUE ("token"),
        CONSTRAINT "FK_email_verification_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // ── 6. tasks ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"      UUID          NOT NULL,
        "title"           VARCHAR(200)  NOT NULL,
        "description"     TEXT,
        "creator_id"      UUID          NOT NULL,
        "assignee_id"     UUID,
        "priority"        VARCHAR(10)   NOT NULL DEFAULT 'normal',
        "category"        VARCHAR(50),
        "status"          VARCHAR(20)   NOT NULL DEFAULT 'pending',
        "start_date"      DATE,
        "due_date"        DATE,
        "completed_at"    TIMESTAMPTZ,
        "attachment_urls" TEXT[]        NOT NULL DEFAULT '{}',
        "parent_task_id"  UUID,
        "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMPTZ,
        CONSTRAINT "PK_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tasks_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id"),
        CONSTRAINT "FK_tasks_creator" FOREIGN KEY ("creator_id")
          REFERENCES "users"("id"),
        CONSTRAINT "FK_tasks_assignee" FOREIGN KEY ("assignee_id")
          REFERENCES "users"("id"),
        CONSTRAINT "FK_tasks_parent" FOREIGN KEY ("parent_task_id")
          REFERENCES "tasks"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_company_status" ON "tasks" ("company_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_assignee_status" ON "tasks" ("assignee_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_company_due_date" ON "tasks" ("company_id", "due_date")`);

    // ── 7. task_reports ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_reports" (
        "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"       UUID          NOT NULL,
        "task_id"          UUID          NOT NULL,
        "user_id"          UUID          NOT NULL,
        "content"          TEXT          NOT NULL,
        "progress_percent" SMALLINT,
        "attachment_urls"  TEXT[]        NOT NULL DEFAULT '{}',
        "is_ai_assisted"   BOOLEAN       NOT NULL DEFAULT false,
        "feedback"         TEXT,
        "feedback_by"      UUID,
        "feedback_at"      TIMESTAMPTZ,
        "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_task_reports_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id"),
        CONSTRAINT "FK_task_reports_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id"),
        CONSTRAINT "FK_task_reports_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id"),
        CONSTRAINT "FK_task_reports_feedback_user" FOREIGN KEY ("feedback_by")
          REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_task_reports_task_created" ON "task_reports" ("task_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_task_reports_user_created" ON "task_reports" ("user_id", "created_at")`);

    // ── 8. schedules ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "schedules" (
        "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"       UUID          NOT NULL,
        "creator_id"       UUID          NOT NULL,
        "title"            VARCHAR(200)  NOT NULL,
        "description"      TEXT,
        "location"         VARCHAR(200),
        "target_user_id"   UUID,
        "start_at"         TIMESTAMPTZ   NOT NULL,
        "end_at"           TIMESTAMPTZ   NOT NULL,
        "is_all_day"       BOOLEAN       NOT NULL DEFAULT false,
        "type"             VARCHAR(20)   NOT NULL DEFAULT 'general',
        "recurrence_rule"  TEXT,
        "recurrence_end_at" DATE,
        "notify_before_min" SMALLINT,
        "color"            VARCHAR(7),
        "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "deleted_at"       TIMESTAMPTZ,
        CONSTRAINT "PK_schedules" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_schedules_end_after_start" CHECK ("end_at" > "start_at"),
        CONSTRAINT "FK_schedules_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id"),
        CONSTRAINT "FK_schedules_creator" FOREIGN KEY ("creator_id")
          REFERENCES "users"("id"),
        CONSTRAINT "FK_schedules_target_user" FOREIGN KEY ("target_user_id")
          REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_schedules_company_start_end" ON "schedules" ("company_id", "start_at", "end_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_schedules_target_user_start" ON "schedules" ("target_user_id", "start_at")`);

    // ── 9. channels ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "channels" (
        "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id" UUID          NOT NULL,
        "name"       VARCHAR(100),
        "type"       VARCHAR(20)   NOT NULL,
        "is_private" BOOLEAN       NOT NULL DEFAULT false,
        "creator_id" UUID,
        "created_at" TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_channels" PRIMARY KEY ("id"),
        CONSTRAINT "FK_channels_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id"),
        CONSTRAINT "FK_channels_creator" FOREIGN KEY ("creator_id")
          REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_channels_company_id" ON "channels" ("company_id")`);

    // ── 10. channel_members ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "channel_members" (
        "channel_id"   UUID        NOT NULL,
        "user_id"      UUID        NOT NULL,
        "joined_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        "last_read_at" TIMESTAMPTZ,
        CONSTRAINT "PK_channel_members" PRIMARY KEY ("channel_id", "user_id"),
        CONSTRAINT "FK_channel_members_channel" FOREIGN KEY ("channel_id")
          REFERENCES "channels"("id"),
        CONSTRAINT "FK_channel_members_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
      )
    `);

    // ── 11. messages ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id"                UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"        UUID          NOT NULL,
        "channel_id"        UUID          NOT NULL,
        "user_id"           UUID          NOT NULL,
        "content"           TEXT          NOT NULL,
        "content_type"      VARCHAR(20)   NOT NULL DEFAULT 'text',
        "attachment_url"    TEXT,
        "attachment_name"   VARCHAR(255),
        "attachment_size"   INTEGER,
        "parent_message_id" UUID,
        "is_edited"         BOOLEAN       NOT NULL DEFAULT false,
        "edited_at"         TIMESTAMPTZ,
        "deleted_at"        TIMESTAMPTZ,
        "created_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id"),
        CONSTRAINT "FK_messages_channel" FOREIGN KEY ("channel_id")
          REFERENCES "channels"("id"),
        CONSTRAINT "FK_messages_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id"),
        CONSTRAINT "FK_messages_parent" FOREIGN KEY ("parent_message_id")
          REFERENCES "messages"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_messages_channel_created" ON "messages" ("channel_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_messages_parent" ON "messages" ("parent_message_id")`);

    // ── 12. notifications ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id" UUID          NOT NULL,
        "user_id"    UUID          NOT NULL,
        "type"       VARCHAR(50)   NOT NULL,
        "title"      VARCHAR(200)  NOT NULL,
        "body"       TEXT          NOT NULL,
        "ref_type"   VARCHAR(20),
        "ref_id"     UUID,
        "is_read"    BOOLEAN       NOT NULL DEFAULT false,
        "read_at"    TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_user_read" ON "notifications" ("user_id", "is_read")`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("user_id", "created_at")`);

    // ── 13. notification_settings ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "notification_settings" (
        "user_id"             UUID        NOT NULL,
        "company_id"          UUID        NOT NULL,
        "push_enabled"        BOOLEAN     NOT NULL DEFAULT true,
        "email_enabled"       BOOLEAN     NOT NULL DEFAULT true,
        "push_task"           BOOLEAN     NOT NULL DEFAULT true,
        "push_message"        BOOLEAN     NOT NULL DEFAULT true,
        "push_schedule"       BOOLEAN     NOT NULL DEFAULT true,
        "push_attendance"     BOOLEAN     NOT NULL DEFAULT true,
        "email_task"          BOOLEAN     NOT NULL DEFAULT false,
        "email_weekly_report" BOOLEAN     NOT NULL DEFAULT true,
        "dnd_enabled"         BOOLEAN     NOT NULL DEFAULT false,
        "dnd_start_time"      TIME        NOT NULL DEFAULT '22:00',
        "dnd_end_time"        TIME        NOT NULL DEFAULT '08:00',
        "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_settings" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_notification_settings_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notification_settings_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE
      )
    `);

    // ── 14. device_tokens ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "device_tokens" (
        "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"      UUID          NOT NULL,
        "company_id"   UUID          NOT NULL,
        "token"        VARCHAR(200)  NOT NULL,
        "platform"     VARCHAR(10)   NOT NULL,
        "device_name"  VARCHAR(100),
        "app_version"  VARCHAR(20),
        "is_active"    BOOLEAN       NOT NULL DEFAULT true,
        "last_used_at" TIMESTAMPTZ,
        "registered_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_device_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_device_token_user_token" UNIQUE ("user_id", "token"),
        CONSTRAINT "FK_device_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_device_tokens_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_device_tokens_user_id" ON "device_tokens" ("user_id")`);

    // ── 15. ai_requests ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ai_requests" (
        "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"          UUID          NOT NULL,
        "user_id"             UUID          NOT NULL,
        "feature"             VARCHAR(50)   NOT NULL,
        "input_text"          TEXT          NOT NULL,
        "output_text"         TEXT,
        "prompt_tokens"       INTEGER,
        "completion_tokens"   INTEGER,
        "total_tokens"        INTEGER,
        "ref_type"            VARCHAR(20),
        "ref_id"              UUID,
        "status"              VARCHAR(20)   NOT NULL DEFAULT 'pending',
        "error_message"       TEXT,
        "estimated_cost_usd"  DECIMAL(10,6),
        "disclaimer_shown"    BOOLEAN       NOT NULL DEFAULT true,
        "model_name"          VARCHAR(50),
        "created_at"          TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_requests_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id"),
        CONSTRAINT "FK_ai_requests_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ai_requests_company_created" ON "ai_requests" ("company_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_ai_requests_user_created" ON "ai_requests" ("user_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_ai_requests_company_feature_created" ON "ai_requests" ("company_id", "feature", "created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "device_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "channel_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "channels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "schedules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_reports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_verifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invite_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "companies"`);
  }
}
