import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-seat pricing 모델 도입에 필요한 컬럼 추가:
 *  - subscriptions: seat_count, extra_locations, last_billed_amount_krw
 *  - payments: base_fee_krw, seat_fee_krw, location_fee_krw, seat_count,
 *              proration_factor, payment_type
 *
 * 기존 데이터는 quantity → seat_count 로 보존 마이그레이션.
 */
export class AddPerSeatPricingColumns1747100000000 implements MigrationInterface {
  name = 'AddPerSeatPricingColumns1747100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── subscriptions ────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        ADD COLUMN IF NOT EXISTS "seat_count"             INTEGER       NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "extra_locations"        INTEGER       NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "last_billed_amount_krw" DECIMAL(12,2) NOT NULL DEFAULT 0
    `);

    // 기존 quantity 값을 seat_count로 옮김 (quantity가 직원 수로 사용되고 있었음)
    await queryRunner.query(`
      UPDATE "subscriptions"
         SET "seat_count" = GREATEST(1, COALESCE("quantity", 1))
       WHERE "seat_count" = 1 AND "quantity" IS NOT NULL AND "quantity" > 1
    `);

    // ── payments ─────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "payments"
        ADD COLUMN IF NOT EXISTS "base_fee_krw"      DECIMAL(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "seat_fee_krw"      DECIMAL(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "location_fee_krw"  DECIMAL(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "seat_count"        INTEGER,
        ADD COLUMN IF NOT EXISTS "proration_factor"  DECIMAL(6,4),
        ADD COLUMN IF NOT EXISTS "payment_type"      VARCHAR(30)   NOT NULL DEFAULT 'subscription'
    `);

    // payment_type 인덱스 (관리/리포팅 시 필터링)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payments_payment_type"
        ON "payments" ("payment_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_payment_type"`);
    await queryRunner.query(`
      ALTER TABLE "payments"
        DROP COLUMN IF EXISTS "payment_type",
        DROP COLUMN IF EXISTS "proration_factor",
        DROP COLUMN IF EXISTS "seat_count",
        DROP COLUMN IF EXISTS "location_fee_krw",
        DROP COLUMN IF EXISTS "seat_fee_krw",
        DROP COLUMN IF EXISTS "base_fee_krw"
    `);
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        DROP COLUMN IF EXISTS "last_billed_amount_krw",
        DROP COLUMN IF EXISTS "extra_locations",
        DROP COLUMN IF EXISTS "seat_count"
    `);
  }
}
