import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminSchema1741910500000 implements MigrationInterface {
  name = 'AdminSchema1741910500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── admin_users ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email           VARCHAR(255) NOT NULL,
        password_hash   VARCHAR(255) NOT NULL,
        name            VARCHAR(100) NOT NULL,
        role            VARCHAR(30) NOT NULL DEFAULT 'readonly',
        is_active       BOOLEAN NOT NULL DEFAULT true,
        totp_secret     VARCHAR(64),
        totp_enabled    BOOLEAN NOT NULL DEFAULT false,
        last_login_at   TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at      TIMESTAMPTZ,
        CONSTRAINT uq_admin_users_email UNIQUE (email)
      )
    `);

    // ── admin_audit_logs (불변 — UPDATE/DELETE 금지) ──────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id              BIGSERIAL PRIMARY KEY,
        admin_user_id   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        action          VARCHAR(100) NOT NULL,
        target_type     VARCHAR(50) NOT NULL,
        target_id       UUID,
        before_data     JSONB,
        after_data      JSONB,
        reason          TEXT,
        ip_address      INET NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_audit_admin ON admin_audit_logs (admin_user_id, created_at)`);
    await queryRunner.query(`CREATE INDEX idx_audit_target ON admin_audit_logs (target_type, target_id)`);

    // ── plans (Customer DB에 이미 있는 경우 SKIP) ──────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name                  VARCHAR(50) NOT NULL,
        display_name          VARCHAR(100) NOT NULL,
        price_monthly_krw     DECIMAL(12,2) NOT NULL DEFAULT 0,
        price_yearly_krw      DECIMAL(12,2) NOT NULL DEFAULT 0,
        yearly_discount_rate  DECIMAL(5,2) NOT NULL DEFAULT 0,
        max_employees         INT NOT NULL DEFAULT 5,
        ai_requests_per_day   INT NOT NULL DEFAULT 10,
        storage_limit_gb      DECIMAL(10,2) NOT NULL DEFAULT 1,
        features              JSONB NOT NULL DEFAULT '{}',
        trial_days            INT NOT NULL DEFAULT 0,
        is_public             BOOLEAN NOT NULL DEFAULT true,
        is_active             BOOLEAN NOT NULL DEFAULT true,
        sort_order            INT NOT NULL DEFAULT 0,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_plans_name UNIQUE (name)
      )
    `);

    // ── features (마스터) ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS features (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key             VARCHAR(100) NOT NULL,
        category        VARCHAR(50) NOT NULL,
        feature_type    VARCHAR(20) NOT NULL,
        name            VARCHAR(100) NOT NULL,
        default_enabled BOOLEAN NOT NULL DEFAULT false,
        default_config  JSONB NOT NULL DEFAULT '{}',
        is_active       BOOLEAN NOT NULL DEFAULT true,
        sort_order      INT NOT NULL DEFAULT 0,
        CONSTRAINT uq_features_key UNIQUE (key)
      )
    `);

    // ── plan_features ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS plan_features (
        plan_id      UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        feature_id   UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
        is_enabled   BOOLEAN NOT NULL DEFAULT false,
        limit_value  INT,
        config_value JSONB,
        PRIMARY KEY (plan_id, feature_id)
      )
    `);

    // ── contracts ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id                  UUID NOT NULL,
        contract_number             VARCHAR(60) NOT NULL,
        type                        VARCHAR(30) NOT NULL DEFAULT 'standard',
        status                      VARCHAR(20) NOT NULL DEFAULT 'draft',
        start_date                  DATE NOT NULL,
        end_date                    DATE NOT NULL,
        plan_id                     UUID NOT NULL REFERENCES plans(id),
        custom_price_monthly_krw    DECIMAL(12,2),
        custom_max_employees        INT,
        contract_value_krw          DECIMAL(15,2),
        payment_terms               VARCHAR(50) NOT NULL DEFAULT 'monthly',
        sla_uptime_percent          DECIMAL(5,2) NOT NULL DEFAULT 99.9,
        signed_at                   TIMESTAMPTZ,
        file_url                    TEXT,
        admin_user_id               UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_contracts_number UNIQUE (contract_number),
        CONSTRAINT chk_contracts_dates CHECK (end_date > start_date)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_contracts_company ON contracts (company_id, status)`);

    // ── subscriptions ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id                UUID NOT NULL,
        plan_id                   UUID NOT NULL REFERENCES plans(id),
        contract_id               UUID REFERENCES contracts(id) ON DELETE SET NULL,
        status                    VARCHAR(30) NOT NULL DEFAULT 'active',
        billing_cycle             VARCHAR(10) NOT NULL DEFAULT 'monthly',
        current_period_start      TIMESTAMPTZ NOT NULL,
        current_period_end        TIMESTAMPTZ NOT NULL,
        trial_start_at            TIMESTAMPTZ,
        trial_end_at              TIMESTAMPTZ,
        quantity                  INT NOT NULL DEFAULT 1,
        discount_type             VARCHAR(20) NOT NULL DEFAULT 'none',
        discount_rate             DECIMAL(5,2) NOT NULL DEFAULT 0,
        discount_amount_krw       DECIMAL(12,2) NOT NULL DEFAULT 0,
        default_payment_method_id UUID,
        auto_renew                BOOLEAN NOT NULL DEFAULT true,
        next_billing_at           TIMESTAMPTZ,
        past_due_since            TIMESTAMPTZ,
        retry_count               INT NOT NULL DEFAULT 0,
        next_retry_at             TIMESTAMPTZ,
        cancel_at_period_end      BOOLEAN NOT NULL DEFAULT false,
        canceled_at               TIMESTAMPTZ,
        cancel_reason             TEXT,
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_subscriptions_company UNIQUE (company_id)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_subscriptions_status ON subscriptions (status, next_billing_at)`);

    // ── billing_profiles ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS billing_profiles (
        id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id                      UUID NOT NULL,
        entity_type                     VARCHAR(20) NOT NULL,
        legal_name                      VARCHAR(200) NOT NULL,
        representative_name             VARCHAR(100),
        business_registration_number    VARCHAR(20),
        corporate_registration_number   VARCHAR(20),
        business_type                   VARCHAR(100),
        business_item                   VARCHAR(100),
        address_postal_code             VARCHAR(10),
        address_line1                   VARCHAR(200),
        address_line2                   VARCHAR(200),
        tax_invoice_required            BOOLEAN NOT NULL DEFAULT false,
        tax_invoice_email               VARCHAR(255),
        tax_invoice_issue_type          VARCHAR(20) NOT NULL DEFAULT 'on_payment',
        billing_email                   VARCHAR(255),
        billing_phone                   VARCHAR(30),
        is_verified                     BOOLEAN NOT NULL DEFAULT false,
        verified_at                     TIMESTAMPTZ,
        created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_billing_profiles_company UNIQUE (company_id),
        CONSTRAINT uq_billing_profiles_brn UNIQUE (business_registration_number)
      )
    `);

    // ── payment_methods ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id            UUID NOT NULL,
        method_type           VARCHAR(20) NOT NULL,
        card_type             VARCHAR(20),
        card_number_masked    VARCHAR(25),
        card_holder_name      VARCHAR(100),
        card_issuer           VARCHAR(50),
        card_brand            VARCHAR(20),
        card_expiry_year      CHAR(4),
        card_expiry_month     CHAR(2),
        pg_billing_key        VARCHAR(500),
        account_type          VARCHAR(30),
        bank_code             VARCHAR(10),
        bank_name             VARCHAR(50),
        account_number_masked VARCHAR(25),
        account_holder_name   VARCHAR(100),
        account_business_number VARCHAR(20),
        is_default            BOOLEAN NOT NULL DEFAULT false,
        is_active             BOOLEAN NOT NULL DEFAULT true,
        registered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        verified_at           TIMESTAMPTZ,
        deactivated_at        TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_payment_methods_company ON payment_methods (company_id, is_active)`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_payment_methods_default
        ON payment_methods (company_id)
        WHERE is_default = true AND is_active = true
    `);

    // ── coupons ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code                    VARCHAR(50) NOT NULL,
        name                    VARCHAR(100) NOT NULL,
        description             TEXT,
        discount_type           VARCHAR(20) NOT NULL,
        discount_value          DECIMAL(10,2) NOT NULL,
        max_discount_amount_krw DECIMAL(12,2),
        applicable_plans        UUID[] NOT NULL DEFAULT '{}',
        applicable_billing_cycles VARCHAR(20) NOT NULL DEFAULT 'all',
        min_amount_krw          DECIMAL(12,2) NOT NULL DEFAULT 0,
        max_total_uses          INT,
        max_uses_per_company    INT NOT NULL DEFAULT 1,
        current_total_uses      INT NOT NULL DEFAULT 0,
        valid_from              TIMESTAMPTZ NOT NULL,
        valid_until             TIMESTAMPTZ,
        is_active               BOOLEAN NOT NULL DEFAULT true,
        is_public               BOOLEAN NOT NULL DEFAULT false,
        created_by              UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_coupons_code UNIQUE (code)
      )
    `);

    // ── payments ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id            UUID NOT NULL,
        subscription_id       UUID NOT NULL REFERENCES subscriptions(id),
        payment_method_id     UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
        invoice_number        VARCHAR(60) NOT NULL,
        status                VARCHAR(30) NOT NULL DEFAULT 'pending',
        supply_amount_krw     DECIMAL(12,2) NOT NULL,
        tax_amount_krw        DECIMAL(12,2) NOT NULL,
        total_amount_krw      DECIMAL(12,2) NOT NULL,
        discount_amount_krw   DECIMAL(12,2) NOT NULL DEFAULT 0,
        coupon_id             UUID REFERENCES coupons(id) ON DELETE SET NULL,
        billing_period_start  DATE NOT NULL,
        billing_period_end    DATE NOT NULL,
        billing_cycle         VARCHAR(10) NOT NULL,
        pg_provider           VARCHAR(30) NOT NULL DEFAULT 'toss_payments',
        pg_transaction_id     VARCHAR(200),
        pg_order_id           VARCHAR(200),
        pg_raw_response       JSONB,
        paid_at               TIMESTAMPTZ,
        failure_code          VARCHAR(100),
        failure_reason        TEXT,
        refundable_until      TIMESTAMPTZ,
        refunded_amount_krw   DECIMAL(12,2) NOT NULL DEFAULT 0,
        refunded_at           TIMESTAMPTZ,
        refund_reason         TEXT,
        refund_type           VARCHAR(30),
        refund_pg_transaction_id VARCHAR(200),
        tax_invoice_id        UUID,
        admin_memo            TEXT,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_payments_invoice UNIQUE (invoice_number),
        CONSTRAINT uq_payments_pg_tx UNIQUE (pg_transaction_id),
        CONSTRAINT chk_payments_total CHECK (total_amount_krw = supply_amount_krw + tax_amount_krw - discount_amount_krw),
        CONSTRAINT chk_payments_refund CHECK (refunded_amount_krw <= total_amount_krw)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_payments_company ON payments (company_id, created_at)`);
    await queryRunner.query(`CREATE INDEX idx_payments_status ON payments (status, created_at)`);

    // ── tax_invoices ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tax_invoices (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id                  UUID NOT NULL,
        payment_id                  UUID REFERENCES payments(id) ON DELETE SET NULL,
        billing_profile_id          UUID REFERENCES billing_profiles(id) ON DELETE SET NULL,
        invoice_number              VARCHAR(60) NOT NULL,
        status                      VARCHAR(20) NOT NULL DEFAULT 'pending',
        supplier_name               VARCHAR(200),
        supplier_business_number    VARCHAR(20),
        supplier_representative     VARCHAR(100),
        recipient_name              VARCHAR(200),
        recipient_business_number   VARCHAR(20),
        recipient_email             VARCHAR(255),
        supply_date                 DATE,
        item_name                   VARCHAR(200),
        supply_amount_krw           DECIMAL(12,2) NOT NULL DEFAULT 0,
        tax_amount_krw              DECIMAL(12,2) NOT NULL DEFAULT 0,
        total_amount_krw            DECIMAL(12,2) NOT NULL DEFAULT 0,
        e_invoice_provider          VARCHAR(30),
        nts_confirmation_number     VARCHAR(50),
        nts_submitted_at            TIMESTAMPTZ,
        issued_at                   TIMESTAMPTZ,
        original_invoice_id         UUID REFERENCES tax_invoices(id) ON DELETE SET NULL,
        canceled_at                 TIMESTAMPTZ,
        cancel_reason               TEXT,
        provider_raw_response       JSONB,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_tax_invoices_number UNIQUE (invoice_number)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_tax_invoices_company ON tax_invoices (company_id, created_at)`);

    // ── service_usage ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS service_usage (
        id                    BIGSERIAL PRIMARY KEY,
        company_id            UUID NOT NULL,
        subscription_id       UUID NOT NULL REFERENCES subscriptions(id),
        period_year           SMALLINT NOT NULL,
        period_month          SMALLINT NOT NULL,
        active_employee_count INT NOT NULL DEFAULT 0,
        ai_request_count      INT NOT NULL DEFAULT 0,
        ai_request_success    INT NOT NULL DEFAULT 0,
        ai_estimated_cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0,
        storage_used_mb       DECIMAL(12,2) NOT NULL DEFAULT 0,
        plan_employee_limit   INT NOT NULL DEFAULT 0,
        snapshot_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_service_usage UNIQUE (company_id, period_year, period_month)
      )
    `);

    // ── export_logs ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS export_logs (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        requested_by    UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        company_id      UUID,
        export_type     VARCHAR(50) NOT NULL,
        period_start    DATE,
        period_end      DATE,
        filters         JSONB NOT NULL DEFAULT '{}',
        status          VARCHAR(20) NOT NULL DEFAULT 'pending',
        file_format     VARCHAR(10) NOT NULL DEFAULT 'xlsx',
        file_url        TEXT,
        file_size_bytes BIGINT,
        row_count       INT,
        requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at      TIMESTAMPTZ,
        completed_at    TIMESTAMPTZ,
        expires_at      TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_export_logs_requested ON export_logs (requested_by, requested_at)`);

    // ── company_features (override) ───────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS company_features (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id      UUID NOT NULL,
        feature_id      UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
        override_type   VARCHAR(30) NOT NULL,
        is_enabled      BOOLEAN,
        limit_value     INT,
        config_value    JSONB,
        reason          TEXT NOT NULL,
        applied_by      UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        expires_at      TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_company_features UNIQUE (company_id, feature_id)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_company_features_company ON company_features (company_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS company_features`);
    await queryRunner.query(`DROP TABLE IF EXISTS export_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS service_usage`);
    await queryRunner.query(`DROP TABLE IF EXISTS tax_invoices`);
    await queryRunner.query(`DROP TABLE IF EXISTS payments`);
    await queryRunner.query(`DROP TABLE IF EXISTS coupons`);
    await queryRunner.query(`DROP TABLE IF EXISTS payment_methods`);
    await queryRunner.query(`DROP TABLE IF EXISTS billing_profiles`);
    await queryRunner.query(`DROP TABLE IF EXISTS subscriptions`);
    await queryRunner.query(`DROP TABLE IF EXISTS contracts`);
    await queryRunner.query(`DROP TABLE IF EXISTS plan_features`);
    await queryRunner.query(`DROP TABLE IF EXISTS features`);
    await queryRunner.query(`DROP TABLE IF EXISTS plans`);
    await queryRunner.query(`DROP TABLE IF EXISTS admin_audit_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS admin_users`);
  }
}
