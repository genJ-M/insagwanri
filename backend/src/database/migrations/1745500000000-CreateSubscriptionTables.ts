import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 구독·결제 관련 테이블 생성
 * - subscriptions, payment_methods, payments, coupons, addon_purchases
 * plans 테이블은 AdminTables(1741910401000)에서 이미 생성됨
 */
export class CreateSubscriptionTables1745500000000 implements MigrationInterface {
  name = 'CreateSubscriptionTables1745500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // plans 테이블에 features JSONB 컬럼 추가 (기존 테이블에 없으면)
    await queryRunner.query(`
      ALTER TABLE "plans"
        ADD COLUMN IF NOT EXISTS "features" JSONB NOT NULL DEFAULT '[]'
    `);

    // ── 1. payment_methods ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_methods" (
        "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"          UUID          NOT NULL,
        "method_type"         VARCHAR(20)   NOT NULL DEFAULT 'card',
        "card_type"           VARCHAR(20),
        "card_number_masked"  VARCHAR(20),
        "card_holder_name"    VARCHAR(50),
        "card_issuer"         VARCHAR(50),
        "card_brand"          VARCHAR(30),
        "card_expiry_year"    VARCHAR(4),
        "card_expiry_month"   VARCHAR(2),
        "pg_billing_key"      TEXT,
        "is_default"          BOOLEAN       NOT NULL DEFAULT false,
        "is_active"           BOOLEAN       NOT NULL DEFAULT true,
        "registered_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "deactivated_at"      TIMESTAMPTZ,
        CONSTRAINT "PK_payment_methods" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_methods_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_methods_company" ON "payment_methods" ("company_id")
    `);

    // ── 2. subscriptions ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id"                          UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"                  UUID          NOT NULL,
        "plan_id"                     UUID          NOT NULL,
        "status"                      VARCHAR(20)   NOT NULL DEFAULT 'trialing',
        "billing_cycle"               VARCHAR(20)   NOT NULL DEFAULT 'monthly',
        "trial_end_at"                TIMESTAMPTZ,
        "current_period_start"        TIMESTAMPTZ,
        "current_period_end"          TIMESTAMPTZ,
        "default_payment_method_id"   UUID,
        "auto_renew"                  BOOLEAN       NOT NULL DEFAULT true,
        "cancel_at_period_end"        BOOLEAN       NOT NULL DEFAULT false,
        "canceled_at"                 TIMESTAMPTZ,
        "cancel_reason"               TEXT,
        "quantity"                    INTEGER       NOT NULL DEFAULT 1,
        "next_billing_at"             TIMESTAMPTZ,
        "created_at"                  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"                  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_subscriptions_company" UNIQUE ("company_id"),
        CONSTRAINT "FK_subscriptions_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_subscriptions_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans"("id"),
        CONSTRAINT "FK_subscriptions_payment_method" FOREIGN KEY ("default_payment_method_id")
          REFERENCES "payment_methods"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_subscriptions_status" ON "subscriptions" ("status")
    `);

    // ── 3. coupons ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coupons" (
        "id"                      UUID          NOT NULL DEFAULT gen_random_uuid(),
        "code"                    VARCHAR(50)   NOT NULL,
        "discount_type"           VARCHAR(20)   NOT NULL DEFAULT 'percentage',
        "discount_value"          DECIMAL(10,2) NOT NULL,
        "max_discount_amount_krw" DECIMAL(12,2),
        "is_active"               BOOLEAN       NOT NULL DEFAULT true,
        "valid_until"             TIMESTAMPTZ,
        "max_total_uses"          INTEGER,
        "current_total_uses"      INTEGER       NOT NULL DEFAULT 0,
        "created_at"              TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coupons" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_coupons_code" UNIQUE ("code")
      )
    `);

    // ── 4. payments ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id"                    UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"            UUID          NOT NULL,
        "subscription_id"       UUID,
        "payment_method_id"     UUID,
        "invoice_number"        VARCHAR(50)   NOT NULL,
        "status"                VARCHAR(20)   NOT NULL DEFAULT 'completed',
        "supply_amount_krw"     DECIMAL(12,2) NOT NULL,
        "tax_amount_krw"        DECIMAL(12,2) NOT NULL DEFAULT 0,
        "total_amount_krw"      DECIMAL(12,2) NOT NULL,
        "discount_amount_krw"   DECIMAL(12,2) NOT NULL DEFAULT 0,
        "coupon_id"             UUID,
        "billing_period_start"  DATE,
        "billing_period_end"    DATE,
        "billing_cycle"         VARCHAR(20),
        "pg_provider"           VARCHAR(30),
        "pg_transaction_id"     VARCHAR(100),
        "pg_order_id"           VARCHAR(100),
        "pg_raw_response"       JSONB,
        "paid_at"               TIMESTAMPTZ,
        "refundable_until"      TIMESTAMPTZ,
        "refunded_amount_krw"   DECIMAL(12,2),
        "refunded_at"           TIMESTAMPTZ,
        "created_at"            TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payments_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payments_subscription" FOREIGN KEY ("subscription_id")
          REFERENCES "subscriptions"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_payments_payment_method" FOREIGN KEY ("payment_method_id")
          REFERENCES "payment_methods"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_payments_coupon" FOREIGN KEY ("coupon_id")
          REFERENCES "coupons"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payments_company_created" ON "payments" ("company_id", "created_at")
    `);

    // ── 5. addon_purchases ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "addon_purchases" (
        "id"                UUID          NOT NULL DEFAULT gen_random_uuid(),
        "company_id"        UUID          NOT NULL,
        "subscription_id"   UUID,
        "addon_code"        VARCHAR(50)   NOT NULL,
        "quantity"          INTEGER       NOT NULL DEFAULT 1,
        "unit_price_krw"    DECIMAL(12,2) NOT NULL,
        "total_amount_krw"  DECIMAL(12,2) NOT NULL,
        "billing_cycle"     VARCHAR(20)   NOT NULL DEFAULT 'monthly',
        "status"            VARCHAR(20)   NOT NULL DEFAULT 'active',
        "payment_id"        UUID,
        "active_from"       DATE,
        "active_until"      DATE,
        "created_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_addon_purchases" PRIMARY KEY ("id"),
        CONSTRAINT "FK_addon_purchases_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_addon_purchases_subscription" FOREIGN KEY ("subscription_id")
          REFERENCES "subscriptions"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_addon_purchases_payment" FOREIGN KEY ("payment_id")
          REFERENCES "payments"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_addon_purchases_company" ON "addon_purchases" ("company_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "addon_purchases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "coupons"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_methods"`);
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN IF EXISTS "features"`);
  }
}
