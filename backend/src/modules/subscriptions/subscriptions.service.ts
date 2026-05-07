import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  UpgradeSubscriptionDto, IssueBillingKeyDto, CancelSubscriptionDto,
  ToggleAutoRenewDto, PurchaseAddonDto,
} from './dto/subscription.dto';
import { ADDON_CATALOG, findAddon } from './addon-catalog.constant';
import {
  calcMonthlyTotal,
  calcSeatsKrw,
  calcProration,
  EXTRA_LOCATION_PRICE_KRW,
  type PlanName,
} from './pricing.constant';
import { FeatureModulesService } from '../feature-modules/feature-modules.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private configService: ConfigService,
    private featureModulesService: FeatureModulesService,
  ) {}

  // ──────────────────────────────────────────────
  // 공개 플랜 목록 + 현재 구독 정보
  // ──────────────────────────────────────────────
  async getPlans(user: AuthenticatedUser) {
    const [plans, subscription] = await Promise.all([
      this.dataSource.query(`
        SELECT id, name, display_name, price_monthly_krw, price_yearly_krw,
               yearly_discount_rate, max_employees, ai_requests_per_day,
               storage_limit_gb, features, trial_days, sort_order
        FROM plans
        WHERE is_public = true AND is_active = true
        ORDER BY sort_order ASC
      `),
      this.dataSource.query(`
        SELECT s.id, s.status, s.billing_cycle,
               s.trial_end_at, s.current_period_start, s.current_period_end,
               s.cancel_at_period_end, s.canceled_at,
               s.quantity, s.seat_count, s.extra_locations, s.last_billed_amount_krw,
               s.pending_seat_count, s.pending_extra_locations, s.pending_changes_apply_at,
               s.next_billing_at, s.auto_renew,
               p.id AS plan_id, p.name AS plan_name, p.display_name AS plan_display_name,
               p.price_monthly_krw, p.price_yearly_krw, p.max_employees
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.company_id = $1
      `, [user.companyId]),
    ]);

    const sub = subscription[0] ?? null;
    let daysRemaining: number | null = null;
    if (sub?.trial_end_at) {
      daysRemaining = Math.max(0, Math.ceil(
        (new Date(sub.trial_end_at).getTime() - Date.now()) / 86400000,
      ));
    }

    return {
      currentSubscription: sub ? { ...sub, daysRemaining } : null,
      plans,
    };
  }

  // ──────────────────────────────────────────────
  // 구독 업그레이드 (체험 → 유료 or 플랜 변경)
  // ──────────────────────────────────────────────
  async upgrade(dto: UpgradeSubscriptionDto, user: AuthenticatedUser) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('플랜 변경은 OWNER만 가능합니다.');
    }

    // 플랜 조회
    const [plan] = await this.dataSource.query(
      `SELECT * FROM plans WHERE id = $1 AND is_active = true AND is_public = true`,
      [dto.planId],
    );
    if (!plan) throw new NotFoundException('유효하지 않은 플랜입니다.');

    // 결제 수단 조회
    const [paymentMethod] = await this.dataSource.query(
      `SELECT * FROM payment_methods WHERE id = $1 AND company_id = $2 AND is_active = true`,
      [dto.paymentMethodId, user.companyId],
    );
    if (!paymentMethod) throw new NotFoundException('유효하지 않은 결제 수단입니다.');

    // 쿠폰 조회 (선택)
    let coupon: any = null;
    if (dto.couponCode) {
      const [c] = await this.dataSource.query(
        `SELECT * FROM coupons
         WHERE code = $1 AND is_active = true
         AND (valid_until IS NULL OR valid_until > NOW())
         AND (max_total_uses IS NULL OR current_total_uses < max_total_uses)`,
        [dto.couponCode],
      );
      if (!c) throw new BadRequestException('유효하지 않은 쿠폰 코드입니다.');
      coupon = c;
    }

    // ── 금액 계산 (per-seat pricing 모델) ─────────────────────────
    const seatCount = Math.max(1, dto.seatCount ?? 1);
    const extraLocations = Math.max(0, dto.extraLocations ?? 0);
    const planName = plan.name as PlanName;

    // 월 합계 (베이스 + 인원 + 지점) — DB 기본료 우선, 코드 상수 폴백
    const monthly = calcMonthlyTotal(
      planName,
      seatCount,
      extraLocations,
      Number(plan.price_monthly_krw) || undefined,
    );

    // 연간일 경우 17% 할인 적용 (10개월 가격)
    const billingMultiplier = dto.billingCycle === 'yearly' ? 12 * 0.83 : 1;
    const baseFeeKrw     = Math.round(monthly.baseFeeKrw * billingMultiplier);
    const seatFeeKrw     = Math.round(monthly.seatFeeKrw * billingMultiplier);
    const locationFeeKrw = Math.round(monthly.locationFeeKrw * billingMultiplier);
    const basePrice      = baseFeeKrw + seatFeeKrw + locationFeeKrw;

    let discountAmount = 0;
    if (coupon) {
      if (coupon.discount_type === 'percentage') {
        discountAmount = Math.min(
          Math.round(basePrice * coupon.discount_value / 100),
          coupon.max_discount_amount_krw ?? Infinity,
        );
      } else {
        discountAmount = Math.min(Number(coupon.discount_value), basePrice);
      }
    }

    const supplyAmount = basePrice - discountAmount;
    const taxAmount = Math.round(supplyAmount * 0.1);
    const totalAmount = supplyAmount + taxAmount;

    // 기간 계산
    const now = new Date();
    const periodEnd = new Date(now);
    if (dto.billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const invoiceNumber = `INV-${now.toISOString().slice(0, 7)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const orderId = `ORDER-${Date.now()}-${user.companyId.slice(0, 8)}`;

    // Toss 결제 실행
    const billingKey = this.decryptBillingKey(paymentMethod.pg_billing_key);
    const tossResult = await this.chargeToss({
      billingKey,
      customerKey: user.companyId,
      orderId,
      orderName: `관리왕 ${plan.display_name} 구독료`,
      amount: totalAmount,
    });

    if (!tossResult.success) {
      throw new BadRequestException(
        tossResult.failureReason ?? '결제에 실패했습니다. 카드사에 문의해 주세요.',
      );
    }

    // DB 트랜잭션으로 구독 + 결제 동시 업데이트
    await this.dataSource.transaction(async (em) => {
      // Payment 레코드 생성 (per-seat pricing 컬럼 포함)
      await em.query(`
        INSERT INTO payments (
          company_id, subscription_id, payment_method_id, invoice_number,
          status, supply_amount_krw, tax_amount_krw, total_amount_krw,
          discount_amount_krw, coupon_id, billing_period_start, billing_period_end,
          billing_cycle, pg_provider, pg_transaction_id, pg_order_id,
          pg_raw_response, paid_at, refundable_until,
          base_fee_krw, seat_fee_krw, location_fee_krw, seat_count, payment_type
        )
        SELECT $1,
          (SELECT id FROM subscriptions WHERE company_id = $1),
          $2, $3, 'completed',
          $4, $5, $6, $7, $8,
          $9::date, $10::date, $11,
          'toss_payments', $12, $13, $14::jsonb,
          NOW(), NOW() + INTERVAL '7 days',
          $15, $16, $17, $18, 'subscription'
      `, [
        user.companyId, dto.paymentMethodId, invoiceNumber,
        supplyAmount, taxAmount, totalAmount, discountAmount,
        coupon?.id ?? null,
        now.toISOString().slice(0, 10),
        periodEnd.toISOString().slice(0, 10),
        dto.billingCycle,
        tossResult.transactionId, orderId,
        JSON.stringify(tossResult.rawResponse),
        baseFeeKrw, seatFeeKrw, locationFeeKrw, seatCount,
      ]);

      // Subscription 업데이트 (seat_count, extra_locations 포함)
      await em.query(`
        UPDATE subscriptions SET
          plan_id = $2,
          status = 'active',
          billing_cycle = $3,
          current_period_start = NOW(),
          current_period_end = $4,
          trial_end_at = NULL,
          default_payment_method_id = $5,
          auto_renew = true,
          next_billing_at = $4,
          cancel_at_period_end = false,
          seat_count = $6,
          extra_locations = $7,
          quantity = $6,
          last_billed_amount_krw = $8,
          updated_at = NOW()
        WHERE company_id = $1
      `, [
        user.companyId, dto.planId, dto.billingCycle, periodEnd, dto.paymentMethodId,
        seatCount, extraLocations, totalAmount,
      ]);

      // 쿠폰 사용 횟수 증가
      if (coupon) {
        await em.query(
          `UPDATE coupons SET current_total_uses = current_total_uses + 1 WHERE id = $1`,
          [coupon.id],
        );
      }
    });

    // 플랜 변경 후 모듈 자동 동기화
    await this.featureModulesService.syncModulesForPlan(user.companyId, plan.name);

    return {
      invoiceNumber,
      amount: totalAmount,
      plan: plan.display_name,
      billingCycle: dto.billingCycle,
      nextBillingAt: periodEnd,
      breakdown: {
        baseFeeKrw, seatFeeKrw, locationFeeKrw,
        seatCount, extraLocations,
        seatBreakdown: monthly.seatBreakdown,
      },
    };
  }

  // ──────────────────────────────────────────────
  // Toss 빌링키 발급 (카드 등록)
  // ──────────────────────────────────────────────
  async issueBillingKey(dto: IssueBillingKeyDto, user: AuthenticatedUser) {
    await this.assertCanManageBilling(user);

    const secretKey = this.configService.get<string>('TOSS_PAYMENTS_SECRET_KEY', '');
    const response = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authKey: dto.authKey,
        customerKey: dto.customerKey,
      }),
    });

    const data = await response.json() as any;
    if (!response.ok) {
      throw new BadRequestException(`카드 등록 실패: ${data.message}`);
    }

    // 빌링키 AES-256 암호화
    const encryptedBillingKey = this.encryptBillingKey(data.billingKey);

    // payment_methods 레코드 생성
    const [saved] = await this.dataSource.query(`
      INSERT INTO payment_methods (
        company_id, method_type, card_type, card_number_masked,
        card_holder_name, card_issuer, card_brand,
        card_expiry_year, card_expiry_month, pg_billing_key,
        is_default, is_active, registered_at
      ) VALUES ($1, 'card', $2, $3, $4, $5, $6, $7, $8, $9,
        -- 첫 번째 카드면 default로
        NOT EXISTS (SELECT 1 FROM payment_methods WHERE company_id = $1 AND is_active = true),
        true, NOW()
      )
      RETURNING id, method_type, card_number_masked, card_issuer, card_brand,
                card_expiry_year, card_expiry_month, is_default
    `, [
      user.companyId,
      data.card?.cardType,
      data.card?.number,        // 마스킹된 카드번호
      data.card?.ownerName,
      data.card?.issuerCode,
      data.card?.brand,
      data.card?.expirationYear,
      data.card?.expirationMonth,
      encryptedBillingKey,
    ]);

    return saved;
  }

  // ──────────────────────────────────────────────
  // Toss clientKey + customerKey 반환 (위젯 초기화용)
  // ──────────────────────────────────────────────
  getTossClientKey(user: AuthenticatedUser) {
    return {
      clientKey: this.configService.get<string>('TOSS_PAYMENTS_CLIENT_KEY', ''),
      customerKey: user.companyId, // 회사 단위로 Toss 고객 식별
    };
  }

  // ──────────────────────────────────────────────
  // 결제 수단 목록
  // ──────────────────────────────────────────────
  async getPaymentMethods(user: AuthenticatedUser) {
    return this.dataSource.query(`
      SELECT id, method_type, card_number_masked, card_holder_name,
             card_issuer, card_brand, card_expiry_year, card_expiry_month,
             is_default, registered_at
      FROM payment_methods
      WHERE company_id = $1 AND is_active = true
      ORDER BY is_default DESC, registered_at DESC
    `, [user.companyId]);
  }

  // ──────────────────────────────────────────────
  // 결제 수단 삭제 (default 변경 포함)
  // ──────────────────────────────────────────────
  async deletePaymentMethod(methodId: string, user: AuthenticatedUser) {
    await this.assertCanManageBilling(user);

    const [method] = await this.dataSource.query(
      `SELECT * FROM payment_methods WHERE id = $1 AND company_id = $2 AND is_active = true`,
      [methodId, user.companyId],
    );
    if (!method) throw new NotFoundException('결제 수단을 찾을 수 없습니다.');

    // 구독 default 결제 수단이면 삭제 불가
    const [sub] = await this.dataSource.query(
      `SELECT id FROM subscriptions WHERE company_id = $1 AND default_payment_method_id = $2 AND status = 'active'`,
      [user.companyId, methodId],
    );
    if (sub) {
      throw new BadRequestException('현재 구독에 연결된 결제 수단은 삭제할 수 없습니다. 다른 카드를 먼저 등록하세요.');
    }

    await this.dataSource.query(
      `UPDATE payment_methods SET is_active = false, deactivated_at = NOW() WHERE id = $1`,
      [methodId],
    );
  }

  // ──────────────────────────────────────────────
  // 인보이스 목록
  // ──────────────────────────────────────────────
  async getInvoices(user: AuthenticatedUser) {
    return this.dataSource.query(`
      SELECT id, invoice_number, status, total_amount_krw, supply_amount_krw,
             tax_amount_krw, discount_amount_krw, billing_cycle,
             billing_period_start, billing_period_end, paid_at,
             refunded_amount_krw, refunded_at, pg_provider
      FROM payments
      WHERE company_id = $1
      ORDER BY created_at DESC
      LIMIT 24
    `, [user.companyId]);
  }

  // ──────────────────────────────────────────────
  // 자동결제 토글
  // ──────────────────────────────────────────────
  async toggleAutoRenew(dto: ToggleAutoRenewDto, user: AuthenticatedUser) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('자동결제 설정은 OWNER만 변경할 수 있습니다.');
    }

    const [sub] = await this.dataSource.query(
      `SELECT id, status FROM subscriptions WHERE company_id = $1`,
      [user.companyId],
    );
    if (!sub) throw new NotFoundException('구독 정보를 찾을 수 없습니다.');
    if (sub.status === 'canceled') throw new BadRequestException('이미 해지된 구독입니다.');

    await this.dataSource.query(
      `UPDATE subscriptions SET auto_renew = $2, updated_at = NOW() WHERE id = $1`,
      [sub.id, dto.autoRenew],
    );
    return { autoRenew: dto.autoRenew };
  }

  // ──────────────────────────────────────────────
  // 애드온 카탈로그 조회
  // ──────────────────────────────────────────────
  getAddonCatalog() {
    return ADDON_CATALOG;
  }

  // ──────────────────────────────────────────────
  // 활성 애드온 조회
  // ──────────────────────────────────────────────
  async getActiveAddons(user: AuthenticatedUser) {
    return this.dataSource.query(`
      SELECT ap.id, ap.addon_code, ap.quantity, ap.unit_price_krw, ap.total_amount_krw,
             ap.billing_cycle, ap.status, ap.active_from, ap.active_until, ap.created_at
      FROM addon_purchases ap
      WHERE ap.company_id = $1 AND ap.status = 'active'
      ORDER BY ap.created_at DESC
    `, [user.companyId]);
  }

  // ──────────────────────────────────────────────
  // 애드온 구매
  // ──────────────────────────────────────────────
  async purchaseAddon(dto: PurchaseAddonDto, user: AuthenticatedUser) {
    await this.assertCanManageBilling(user);

    const addon = findAddon(dto.addonCode);
    if (!addon) throw new NotFoundException('유효하지 않은 애드온입니다.');

    // 결제 수단 조회
    const [paymentMethod] = await this.dataSource.query(
      `SELECT * FROM payment_methods WHERE id = $1 AND company_id = $2 AND is_active = true`,
      [dto.paymentMethodId, user.companyId],
    );
    if (!paymentMethod) throw new NotFoundException('유효하지 않은 결제 수단입니다.');

    // 금액 계산
    const unitPrice = dto.billingCycle === 'yearly' ? addon.priceYearlyKrw : addon.priceMonthlyKrw;
    const supplyAmount = unitPrice * dto.quantity;
    const taxAmount = Math.round(supplyAmount * 0.1);
    const totalAmount = supplyAmount + taxAmount;

    // 기간 계산
    const now = new Date();
    const activeUntil = new Date(now);
    if (dto.billingCycle === 'yearly') {
      activeUntil.setFullYear(activeUntil.getFullYear() + 1);
    } else {
      activeUntil.setMonth(activeUntil.getMonth() + 1);
    }

    const orderId = `ADDON-${Date.now()}-${user.companyId.slice(0, 8)}`;
    const invoiceNumber = `ADD-${now.toISOString().slice(0, 7)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Toss 결제
    const billingKey = this.decryptBillingKey(paymentMethod.pg_billing_key);
    const tossResult = await this.chargeToss({
      billingKey,
      customerKey: user.companyId,
      orderId,
      orderName: `관리왕 ${addon.name} (x${dto.quantity})`,
      amount: totalAmount,
    });

    if (!tossResult.success) {
      throw new BadRequestException(tossResult.failureReason ?? '결제에 실패했습니다.');
    }

    // 구독 ID 조회
    const [sub] = await this.dataSource.query(
      `SELECT id FROM subscriptions WHERE company_id = $1`,
      [user.companyId],
    );

    // 트랜잭션: payment + addon_purchase 생성
    let addonPurchaseId: string | null = null;
    await this.dataSource.transaction(async (em) => {
      const [payment] = await em.query(`
        INSERT INTO payments (
          company_id, subscription_id, payment_method_id, invoice_number,
          status, supply_amount_krw, tax_amount_krw, total_amount_krw,
          billing_cycle, pg_provider, pg_transaction_id, pg_order_id,
          pg_raw_response, paid_at, refundable_until
        ) VALUES (
          $1, $2, $3, $4, 'completed',
          $5, $6, $7, $8,
          'toss_payments', $9, $10, $11::jsonb,
          NOW(), NOW() + INTERVAL '7 days'
        ) RETURNING id
      `, [
        user.companyId, sub?.id ?? null, dto.paymentMethodId, invoiceNumber,
        supplyAmount, taxAmount, totalAmount, dto.billingCycle,
        tossResult.transactionId, orderId, JSON.stringify(tossResult.rawResponse),
      ]);

      const [addonRow] = await em.query(`
        INSERT INTO addon_purchases (
          company_id, subscription_id, addon_code, quantity,
          unit_price_krw, total_amount_krw, billing_cycle,
          status, payment_id, active_from, active_until
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'active', $8,
          $9::date, $10::date
        ) RETURNING id
      `, [
        user.companyId, sub?.id ?? null, dto.addonCode, dto.quantity,
        unitPrice, totalAmount, dto.billingCycle,
        payment.id,
        now.toISOString().slice(0, 10),
        activeUntil.toISOString().slice(0, 10),
      ]);
      addonPurchaseId = addonRow?.id ?? null;
    });

    // 모듈형 애드온이면 해당 모듈 활성화 (비모듈형 애드온은 내부에서 자동 무시)
    await this.featureModulesService.activateFromAddon(
      user.companyId,
      dto.addonCode,
      addonPurchaseId ?? '',
    );

    return {
      addonCode: dto.addonCode,
      addonName: addon.name,
      quantity: dto.quantity,
      totalAmount,
      billingCycle: dto.billingCycle,
      activeUntil,
    };
  }

  // ──────────────────────────────────────────────
  // 구독 해지 예약
  // ──────────────────────────────────────────────
  async cancel(dto: CancelSubscriptionDto, user: AuthenticatedUser) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('구독 해지는 OWNER만 가능합니다.');
    }

    const [sub] = await this.dataSource.query(
      `SELECT id, status FROM subscriptions WHERE company_id = $1`,
      [user.companyId],
    );
    if (!sub) throw new NotFoundException('구독 정보를 찾을 수 없습니다.');
    if (sub.status === 'canceled') throw new BadRequestException('이미 해지된 구독입니다.');

    const cancelAtPeriodEnd = dto.cancelAtPeriodEnd !== false; // 기본 기간 만료 후 해지

    await this.dataSource.query(`
      UPDATE subscriptions SET
        cancel_at_period_end = $2,
        canceled_at = CASE WHEN $2 = false THEN NOW() ELSE NULL END,
        status = CASE WHEN $2 = false THEN 'canceled' ELSE status END,
        cancel_reason = $3,
        updated_at = NOW()
      WHERE id = $1
    `, [sub.id, cancelAtPeriodEnd, dto.reason]);

    return {
      message: cancelAtPeriodEnd
        ? '현재 구독 기간 종료 후 해지됩니다.'
        : '구독이 즉시 해지되었습니다.',
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // [Per-seat] 인원 추가/변경 — 일할 계산 미리보기 + 실제 결제
  // ────────────────────────────────────────────────────────────────────

  // ────────────────────────────────────────────────────────────────────
  // 권한 체크 헬퍼
  // ────────────────────────────────────────────────────────────────────

  /** OWNER 또는 결제 위임받은 계정인지 확인 — 결제 가능 액션에 사용 */
  private async assertCanManageBilling(user: AuthenticatedUser): Promise<void> {
    if (user.role === UserRole.OWNER) return;
    const [company] = await this.dataSource.query(
      `SELECT billing_delegate_user_id FROM companies WHERE id = $1`,
      [user.companyId],
    );
    if (company?.billing_delegate_user_id !== user.id) {
      throw new ForbiddenException('결제 권한이 없습니다. (사업주 또는 결제 위임 계정만 가능)');
    }
  }

  /** 결제 위임 계정 조회 (UI용) */
  async getBillingDelegate(user: AuthenticatedUser) {
    const [row] = await this.dataSource.query(`
      SELECT c.billing_delegate_user_id, u.id AS user_id, u.name, u.email, u.role
        FROM companies c
        LEFT JOIN users u ON u.id = c.billing_delegate_user_id AND u.deleted_at IS NULL
       WHERE c.id = $1
    `, [user.companyId]);
    if (!row || !row.user_id) return { delegate: null };
    return {
      delegate: {
        userId: row.user_id, name: row.name, email: row.email, role: row.role,
      },
    };
  }

  /** 결제 위임 계정 지정/변경 (OWNER 전용) */
  async setBillingDelegate(targetUserId: string | null, user: AuthenticatedUser) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('위임 지정·해제는 OWNER만 가능합니다.');
    }
    if (targetUserId !== null) {
      // 같은 회사의 active user여야 함
      const [target] = await this.dataSource.query(
        `SELECT id, role FROM users
          WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
        [targetUserId, user.companyId],
      );
      if (!target) {
        throw new NotFoundException('해당 사용자는 같은 회사에 속해 있지 않거나 비활성 상태입니다.');
      }
      if (target.role === UserRole.OWNER) {
        throw new BadRequestException('OWNER는 위임 대상으로 지정할 수 없습니다. (이미 결제 권한 보유)');
      }
    }
    await this.dataSource.query(
      `UPDATE companies SET billing_delegate_user_id = $2, updated_at = NOW() WHERE id = $1`,
      [user.companyId, targetUserId],
    );
    return { delegateUserId: targetUserId };
  }

  /** 현재 active 구독을 plans 조인으로 조회 (seat 변경/proration용 공통) */
  private async getActiveSubscription(companyId: string) {
    const [sub] = await this.dataSource.query(`
      SELECT s.id, s.status, s.billing_cycle, s.seat_count, s.extra_locations,
             s.pending_seat_count, s.pending_extra_locations, s.pending_changes_apply_at,
             s.current_period_start, s.current_period_end,
             s.default_payment_method_id,
             p.id AS plan_id, p.name AS plan_name, p.display_name AS plan_display_name,
             p.price_monthly_krw, p.max_employees
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
       WHERE s.company_id = $1
    `, [companyId]);
    return sub ?? null;
  }

  /**
   * 인원 변경 미리보기 — 증가는 일할 즉시 결제 정보, 감소는 다음 주기 적용 정보 반환
   * @returns { type: 'increase' | 'decrease' | 'noop', ... }
   */
  async previewSeatChange(newSeatCount: number, user: AuthenticatedUser) {
    const sub = await this.getActiveSubscription(user.companyId);
    if (!sub) throw new NotFoundException('활성 구독이 없습니다.');
    if (sub.status !== 'active' && sub.status !== 'trialing') {
      throw new BadRequestException(`현재 구독 상태(${sub.status})에서는 인원 변경이 불가합니다.`);
    }
    if (sub.plan_name === 'free' || sub.plan_name === 'enterprise') {
      throw new BadRequestException('이 플랜은 인원 변경 기능이 적용되지 않습니다.');
    }
    if (newSeatCount > Number(sub.max_employees)) {
      throw new BadRequestException(`현재 플랜의 최대 인원(${sub.max_employees}명)을 초과합니다.`);
    }
    if (newSeatCount < 1) {
      throw new BadRequestException('인원은 1명 이상이어야 합니다.');
    }

    const periodEnd = new Date(sub.current_period_end);

    // 변경 없음
    if (newSeatCount === sub.seat_count) {
      return {
        type: 'noop' as const,
        currentSeatCount: sub.seat_count,
        newSeatCount,
        message: '현재와 동일한 인원입니다.',
      };
    }

    // 감소 — 다음 청구주기 예약
    if (newSeatCount < sub.seat_count) {
      return {
        type: 'decrease' as const,
        currentSeatCount: sub.seat_count,
        newSeatCount,
        removedSeats: sub.seat_count - newSeatCount,
        applyAt: periodEnd,
        message: `다음 청구주기(${periodEnd.toISOString().slice(0, 10)})부터 ${newSeatCount}명으로 변경됩니다.`,
      };
    }

    // 증가 — 즉시 일할 결제
    const planName = sub.plan_name as PlanName;
    const oldSeatFeeKrw = calcSeatsKrw(planName, sub.seat_count);
    const newSeatFeeKrw = calcSeatsKrw(planName, newSeatCount);
    const monthlyDelta = newSeatFeeKrw - oldSeatFeeKrw;

    const periodStart = new Date(sub.current_period_start);
    const proration   = calcProration(monthlyDelta, periodStart, periodEnd);

    const tax = Math.round(proration.amountKrw * 0.1);
    const total = proration.amountKrw + tax;

    return {
      type: 'increase' as const,
      currentSeatCount:  sub.seat_count,
      newSeatCount,
      addedSeats:        newSeatCount - sub.seat_count,
      monthlyDeltaKrw:   monthlyDelta,
      prorationFactor:   proration.factor,
      totalDays:         proration.totalDays,
      daysRemaining:     proration.daysRemaining,
      supplyAmountKrw:   proration.amountKrw,
      taxAmountKrw:      tax,
      totalAmountKrw:    total,
      periodStart, periodEnd,
    };
  }

  /** 감원 예약 — 다음 청구주기에 적용 (FOR UPDATE 락) */
  async scheduleSeatDecrease(newSeatCount: number, user: AuthenticatedUser) {
    await this.assertCanManageBilling(user);
    if (newSeatCount < 1) throw new BadRequestException('인원은 1명 이상이어야 합니다.');

    let result: any;
    await this.dataSource.transaction(async (em) => {
      const [sub] = await em.query(
        `SELECT seat_count, current_period_end FROM subscriptions WHERE company_id = $1 FOR UPDATE`,
        [user.companyId],
      );
      if (!sub) throw new NotFoundException('활성 구독이 없습니다.');
      if (newSeatCount >= sub.seat_count) {
        throw new BadRequestException('감원 예약은 현재 인원보다 적어야 합니다. (증원은 즉시 결제)');
      }
      const applyAt = new Date(sub.current_period_end);
      await em.query(`
        UPDATE subscriptions
           SET pending_seat_count       = $2,
               pending_changes_apply_at = $3,
               updated_at               = NOW()
         WHERE company_id = $1
      `, [user.companyId, newSeatCount, applyAt]);
      result = {
        currentSeatCount: sub.seat_count,
        newSeatCount,
        removedSeats: sub.seat_count - newSeatCount,
        applyAt,
      };
    });
    return result;
  }

  /** 인원 추가 즉시 결제 + 구독 갱신 (증가 전용) — SELECT FOR UPDATE로 동시성 보호 */
  async addSeats(
    dto: { newSeatCount: number; paymentMethodId: string },
    user: AuthenticatedUser,
  ) {
    await this.assertCanManageBilling(user);

    let result: any;
    await this.dataSource.transaction(async (em) => {
      // 1. SELECT FOR UPDATE — 같은 회사의 다른 결제 트랜잭션을 차단
      const [sub] = await em.query(`
        SELECT s.id, s.status, s.billing_cycle, s.seat_count, s.extra_locations,
               s.current_period_start, s.current_period_end,
               p.name AS plan_name, p.display_name AS plan_display_name,
               p.price_monthly_krw, p.max_employees
          FROM subscriptions s
          JOIN plans p ON p.id = s.plan_id
         WHERE s.company_id = $1
         FOR UPDATE OF s
      `, [user.companyId]);

      if (!sub) throw new NotFoundException('활성 구독이 없습니다.');
      if (sub.status !== 'active' && sub.status !== 'trialing') {
        throw new BadRequestException(`현재 구독 상태(${sub.status})에서는 인원 변경이 불가합니다.`);
      }
      if (sub.plan_name === 'free' || sub.plan_name === 'enterprise') {
        throw new BadRequestException('이 플랜은 인원 변경 기능이 적용되지 않습니다.');
      }
      if (dto.newSeatCount > Number(sub.max_employees)) {
        throw new BadRequestException(`현재 플랜의 최대 인원(${sub.max_employees}명)을 초과합니다.`);
      }
      if (dto.newSeatCount <= sub.seat_count) {
        throw new BadRequestException('증원만 가능합니다. (감원은 예약 엔드포인트 사용)');
      }

      // 2. 일할 비용 재계산 (락 안에서 — 누군가 방금 seat_count를 늘렸을 수 있음)
      const planName = sub.plan_name as PlanName;
      const oldSeatFeeKrw = calcSeatsKrw(planName, sub.seat_count);
      const newSeatFeeKrw = calcSeatsKrw(planName, dto.newSeatCount);
      const monthlyDelta = newSeatFeeKrw - oldSeatFeeKrw;
      const periodStart = new Date(sub.current_period_start);
      const periodEnd   = new Date(sub.current_period_end);
      const proration   = calcProration(monthlyDelta, periodStart, periodEnd);
      const supplyAmountKrw = proration.amountKrw;
      const taxAmountKrw    = Math.round(supplyAmountKrw * 0.1);
      const totalAmountKrw  = supplyAmountKrw + taxAmountKrw;

      // 3. 0원 결제 — Toss 호출 없이 DB만 갱신
      if (totalAmountKrw <= 0) {
        await em.query(
          `UPDATE subscriptions SET seat_count = $2, quantity = $2, updated_at = NOW() WHERE company_id = $1`,
          [user.companyId, dto.newSeatCount],
        );
        result = {
          type: 'increase' as const, charged: false, invoiceNumber: null,
          currentSeatCount: sub.seat_count, newSeatCount: dto.newSeatCount,
          addedSeats: dto.newSeatCount - sub.seat_count,
          monthlyDeltaKrw: monthlyDelta,
          prorationFactor: proration.factor,
          totalDays: proration.totalDays, daysRemaining: proration.daysRemaining,
          supplyAmountKrw, taxAmountKrw, totalAmountKrw,
          periodStart, periodEnd,
        };
        return;
      }

      // 4. 결제 수단 검증
      const [paymentMethod] = await em.query(
        `SELECT * FROM payment_methods WHERE id = $1 AND company_id = $2 AND is_active = true`,
        [dto.paymentMethodId, user.companyId],
      );
      if (!paymentMethod) throw new NotFoundException('유효하지 않은 결제 수단입니다.');

      // 5. Toss 결제 — 트랜잭션 안에서 호출하여 일관성 유지 (실패 시 자동 롤백)
      const now = new Date();
      const invoiceNumber = `SEAT-${now.toISOString().slice(0, 7)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const orderId = `SEAT-${Date.now()}-${user.companyId.slice(0, 8)}`;

      const billingKey = this.decryptBillingKey(paymentMethod.pg_billing_key);
      const tossResult = await this.chargeToss({
        billingKey,
        customerKey: user.companyId,
        orderId,
        orderName: `관리왕 인원 추가 (+${dto.newSeatCount - sub.seat_count}명, 일할)`,
        amount: totalAmountKrw,
      });
      if (!tossResult.success) {
        throw new BadRequestException(tossResult.failureReason ?? '결제에 실패했습니다.');
      }

      // 6. payment + subscription 갱신
      await em.query(`
        INSERT INTO payments (
          company_id, subscription_id, payment_method_id, invoice_number,
          status, supply_amount_krw, tax_amount_krw, total_amount_krw,
          billing_period_start, billing_period_end, billing_cycle,
          pg_provider, pg_transaction_id, pg_order_id, pg_raw_response,
          paid_at, refundable_until,
          base_fee_krw, seat_fee_krw, location_fee_krw, seat_count,
          proration_factor, payment_type
        ) VALUES (
          $1, $2, $3, $4, 'completed',
          $5, $6, $7,
          $8::date, $9::date, $10,
          'toss_payments', $11, $12, $13::jsonb,
          NOW(), NOW() + INTERVAL '7 days',
          0, $5, 0, $14, $15, 'seat_addition'
        )
      `, [
        user.companyId, sub.id, dto.paymentMethodId, invoiceNumber,
        supplyAmountKrw, taxAmountKrw, totalAmountKrw,
        periodStart.toISOString().slice(0, 10),
        periodEnd.toISOString().slice(0, 10),
        sub.billing_cycle,
        tossResult.transactionId, orderId, JSON.stringify(tossResult.rawResponse),
        dto.newSeatCount, proration.factor,
      ]);

      await em.query(`
        UPDATE subscriptions
           SET seat_count = $2, quantity = $2, updated_at = NOW()
         WHERE company_id = $1
      `, [user.companyId, dto.newSeatCount]);

      result = {
        type: 'increase' as const, charged: true, invoiceNumber,
        currentSeatCount: sub.seat_count, newSeatCount: dto.newSeatCount,
        addedSeats: dto.newSeatCount - sub.seat_count,
        monthlyDeltaKrw: monthlyDelta,
        prorationFactor: proration.factor,
        totalDays: proration.totalDays, daysRemaining: proration.daysRemaining,
        supplyAmountKrw, taxAmountKrw, totalAmountKrw,
        periodStart, periodEnd,
      };
    });

    return result;
  }

  // ────────────────────────────────────────────────────────────────────
  // [Per-seat] 추가 지점 변경 — 일할 계산 미리보기 + 실제 결제
  // ────────────────────────────────────────────────────────────────────

  async previewLocationChange(newExtraLocations: number, user: AuthenticatedUser) {
    const sub = await this.getActiveSubscription(user.companyId);
    if (!sub) throw new NotFoundException('활성 구독이 없습니다.');
    if (sub.status !== 'active' && sub.status !== 'trialing') {
      throw new BadRequestException(`현재 구독 상태(${sub.status})에서는 지점 변경이 불가합니다.`);
    }
    if (newExtraLocations < 0) {
      throw new BadRequestException('지점 수는 0 이상이어야 합니다.');
    }

    const periodEnd = new Date(sub.current_period_end);

    if (newExtraLocations === sub.extra_locations) {
      return {
        type: 'noop' as const,
        currentExtraLocations: sub.extra_locations,
        newExtraLocations,
        message: '현재와 동일한 지점 수입니다.',
      };
    }

    if (newExtraLocations < sub.extra_locations) {
      return {
        type: 'decrease' as const,
        currentExtraLocations: sub.extra_locations,
        newExtraLocations,
        removedLocations: sub.extra_locations - newExtraLocations,
        applyAt: periodEnd,
        message: `다음 청구주기(${periodEnd.toISOString().slice(0, 10)})부터 추가 지점이 ${newExtraLocations}개로 변경됩니다.`,
      };
    }

    const addedLocations = newExtraLocations - sub.extra_locations;
    const monthlyDelta = addedLocations * EXTRA_LOCATION_PRICE_KRW;
    const periodStart = new Date(sub.current_period_start);
    const proration   = calcProration(monthlyDelta, periodStart, periodEnd);

    const tax = Math.round(proration.amountKrw * 0.1);
    const total = proration.amountKrw + tax;

    return {
      type: 'increase' as const,
      currentExtraLocations: sub.extra_locations,
      newExtraLocations,
      addedLocations,
      unitPriceKrw:        EXTRA_LOCATION_PRICE_KRW,
      monthlyDeltaKrw:     monthlyDelta,
      prorationFactor:     proration.factor,
      totalDays:           proration.totalDays,
      daysRemaining:       proration.daysRemaining,
      supplyAmountKrw:     proration.amountKrw,
      taxAmountKrw:        tax,
      totalAmountKrw:      total,
      periodStart, periodEnd,
    };
  }

  /** 지점 감소 예약 — 다음 청구주기에 적용 (FOR UPDATE 락) */
  async scheduleLocationDecrease(newExtraLocations: number, user: AuthenticatedUser) {
    await this.assertCanManageBilling(user);
    if (newExtraLocations < 0) throw new BadRequestException('지점 수는 0 이상이어야 합니다.');

    let result: any;
    await this.dataSource.transaction(async (em) => {
      const [sub] = await em.query(
        `SELECT extra_locations, current_period_end FROM subscriptions WHERE company_id = $1 FOR UPDATE`,
        [user.companyId],
      );
      if (!sub) throw new NotFoundException('활성 구독이 없습니다.');
      if (newExtraLocations >= sub.extra_locations) {
        throw new BadRequestException('지점 감소 예약은 현재 추가 지점 수보다 적어야 합니다.');
      }
      const applyAt = new Date(sub.current_period_end);
      await em.query(`
        UPDATE subscriptions
           SET pending_extra_locations  = $2,
               pending_changes_apply_at = $3,
               updated_at               = NOW()
         WHERE company_id = $1
      `, [user.companyId, newExtraLocations, applyAt]);
      result = {
        currentExtraLocations: sub.extra_locations,
        newExtraLocations,
        removedLocations: sub.extra_locations - newExtraLocations,
        applyAt,
      };
    });
    return result;
  }

  // ────────────────────────────────────────────────────────────────────
  // Free 플랜 다운그레이드 — 카드 등록 없이도 가능
  // 정책: 직원 1명 이하 + 결제 수단 없어도 가능
  // ────────────────────────────────────────────────────────────────────
  async downgradeToFree(user: AuthenticatedUser) {
    await this.assertCanManageBilling(user);

    let result: any;
    await this.dataSource.transaction(async (em) => {
      // 1) 락 + 현재 구독 조회
      const [sub] = await em.query(`
        SELECT s.id, s.status, s.plan_id, s.seat_count, p.name AS plan_name
          FROM subscriptions s
          JOIN plans p ON p.id = s.plan_id
         WHERE s.company_id = $1
         FOR UPDATE OF s
      `, [user.companyId]);
      if (!sub) throw new NotFoundException('활성 구독이 없습니다.');
      if (sub.plan_name === 'free') {
        throw new BadRequestException('이미 무료 플랜을 사용 중입니다.');
      }

      // 2) 회사 active user 수 카운트 — Free는 1명까지만
      const [{ count }] = await em.query(`
        SELECT COUNT(*)::int AS count
          FROM users
         WHERE company_id = $1 AND deleted_at IS NULL
      `, [user.companyId]);
      if (Number(count) > 1) {
        throw new BadRequestException(
          `무료 플랜은 직원 1명까지만 가능합니다. 현재 ${count}명 — 먼저 직원을 비활성화하거나 유료 플랜을 유지하세요.`,
        );
      }

      // 3) free 플랜 ID 조회
      const [freePlan] = await em.query(
        `SELECT id FROM plans WHERE name = 'free' AND is_active = true LIMIT 1`,
      );
      if (!freePlan) throw new NotFoundException('무료 플랜이 정의되어 있지 않습니다.');

      // 4) subscriptions 업데이트 — 카드 없이도 동작
      const periodEnd = new Date();
      periodEnd.setFullYear(periodEnd.getFullYear() + 1); // 명목상 1년 주기

      await em.query(`
        UPDATE subscriptions SET
          plan_id                  = $2,
          status                   = 'active',
          billing_cycle            = 'monthly',
          seat_count               = 1,
          extra_locations          = 0,
          quantity                 = 1,
          last_billed_amount_krw   = 0,
          trial_end_at             = NULL,
          current_period_start     = NOW(),
          current_period_end       = $3,
          next_billing_at          = $3,
          pending_seat_count       = NULL,
          pending_extra_locations  = NULL,
          pending_changes_apply_at = NULL,
          renewal_retry_count      = 0,
          renewal_last_failed_at   = NULL,
          renewal_notified_days    = '[]'::jsonb,
          cancel_at_period_end     = false,
          canceled_at              = NULL,
          updated_at               = NOW()
        WHERE id = $1
      `, [sub.id, freePlan.id, periodEnd]);

      result = { previousPlan: sub.plan_name, newPlan: 'free' };
    });

    // 5) 모듈 권한 동기화 (트랜잭션 외부)
    await this.featureModulesService.syncModulesForPlan(user.companyId, 'free');

    return result;
  }

  /** 예약된 인원/지점 변경 모두 취소 (FOR UPDATE 락) */
  async cancelScheduledChanges(user: AuthenticatedUser) {
    await this.assertCanManageBilling(user);

    let result: any;
    await this.dataSource.transaction(async (em) => {
      const [sub] = await em.query(
        `SELECT pending_seat_count, pending_extra_locations FROM subscriptions WHERE company_id = $1 FOR UPDATE`,
        [user.companyId],
      );
      if (!sub) throw new NotFoundException('활성 구독이 없습니다.');
      await em.query(`
        UPDATE subscriptions
           SET pending_seat_count       = NULL,
               pending_extra_locations  = NULL,
               pending_changes_apply_at = NULL,
               updated_at               = NOW()
         WHERE company_id = $1
      `, [user.companyId]);
      result = {
        pendingSeatCount: sub.pending_seat_count,
        pendingExtraLocations: sub.pending_extra_locations,
        canceled: true,
      };
    });
    return result;
  }

  async addLocations(
    dto: { newExtraLocations: number; paymentMethodId: string },
    user: AuthenticatedUser,
  ) {
    await this.assertCanManageBilling(user);

    let result: any;
    await this.dataSource.transaction(async (em) => {
      const [sub] = await em.query(`
        SELECT s.id, s.status, s.billing_cycle, s.seat_count, s.extra_locations,
               s.current_period_start, s.current_period_end,
               p.name AS plan_name
          FROM subscriptions s
          JOIN plans p ON p.id = s.plan_id
         WHERE s.company_id = $1
         FOR UPDATE OF s
      `, [user.companyId]);

      if (!sub) throw new NotFoundException('활성 구독이 없습니다.');
      if (sub.status !== 'active' && sub.status !== 'trialing') {
        throw new BadRequestException(`현재 구독 상태(${sub.status})에서는 지점 변경이 불가합니다.`);
      }
      if (dto.newExtraLocations <= sub.extra_locations) {
        throw new BadRequestException('지점 증가만 가능합니다. (감소는 예약 엔드포인트 사용)');
      }

      const addedLocations = dto.newExtraLocations - sub.extra_locations;
      const monthlyDelta = addedLocations * EXTRA_LOCATION_PRICE_KRW;
      const periodStart = new Date(sub.current_period_start);
      const periodEnd   = new Date(sub.current_period_end);
      const proration   = calcProration(monthlyDelta, periodStart, periodEnd);
      const supplyAmountKrw = proration.amountKrw;
      const taxAmountKrw    = Math.round(supplyAmountKrw * 0.1);
      const totalAmountKrw  = supplyAmountKrw + taxAmountKrw;

      if (totalAmountKrw <= 0) {
        await em.query(
          `UPDATE subscriptions SET extra_locations = $2, updated_at = NOW() WHERE company_id = $1`,
          [user.companyId, dto.newExtraLocations],
        );
        result = {
          type: 'increase' as const, charged: false, invoiceNumber: null,
          currentExtraLocations: sub.extra_locations, newExtraLocations: dto.newExtraLocations,
          addedLocations, unitPriceKrw: EXTRA_LOCATION_PRICE_KRW,
          monthlyDeltaKrw: monthlyDelta,
          prorationFactor: proration.factor,
          totalDays: proration.totalDays, daysRemaining: proration.daysRemaining,
          supplyAmountKrw, taxAmountKrw, totalAmountKrw,
          periodStart, periodEnd,
        };
        return;
      }

      const [paymentMethod] = await em.query(
        `SELECT * FROM payment_methods WHERE id = $1 AND company_id = $2 AND is_active = true`,
        [dto.paymentMethodId, user.companyId],
      );
      if (!paymentMethod) throw new NotFoundException('유효하지 않은 결제 수단입니다.');

      const now = new Date();
      const invoiceNumber = `LOC-${now.toISOString().slice(0, 7)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const orderId = `LOC-${Date.now()}-${user.companyId.slice(0, 8)}`;

      const billingKey = this.decryptBillingKey(paymentMethod.pg_billing_key);
      const tossResult = await this.chargeToss({
        billingKey,
        customerKey: user.companyId,
        orderId,
        orderName: `관리왕 지점 추가 (+${addedLocations}개, 일할)`,
        amount: totalAmountKrw,
      });
      if (!tossResult.success) {
        throw new BadRequestException(tossResult.failureReason ?? '결제에 실패했습니다.');
      }

      await em.query(`
        INSERT INTO payments (
          company_id, subscription_id, payment_method_id, invoice_number,
          status, supply_amount_krw, tax_amount_krw, total_amount_krw,
          billing_period_start, billing_period_end, billing_cycle,
          pg_provider, pg_transaction_id, pg_order_id, pg_raw_response,
          paid_at, refundable_until,
          base_fee_krw, seat_fee_krw, location_fee_krw, seat_count,
          proration_factor, payment_type
        ) VALUES (
          $1, $2, $3, $4, 'completed',
          $5, $6, $7,
          $8::date, $9::date, $10,
          'toss_payments', $11, $12, $13::jsonb,
          NOW(), NOW() + INTERVAL '7 days',
          0, 0, $5, $14, $15, 'location_addition'
        )
      `, [
        user.companyId, sub.id, dto.paymentMethodId, invoiceNumber,
        supplyAmountKrw, taxAmountKrw, totalAmountKrw,
        periodStart.toISOString().slice(0, 10),
        periodEnd.toISOString().slice(0, 10),
        sub.billing_cycle,
        tossResult.transactionId, orderId, JSON.stringify(tossResult.rawResponse),
        sub.seat_count, proration.factor,
      ]);

      await em.query(`
        UPDATE subscriptions
           SET extra_locations = $2, updated_at = NOW()
         WHERE company_id = $1
      `, [user.companyId, dto.newExtraLocations]);

      result = {
        type: 'increase' as const, charged: true, invoiceNumber,
        currentExtraLocations: sub.extra_locations, newExtraLocations: dto.newExtraLocations,
        addedLocations, unitPriceKrw: EXTRA_LOCATION_PRICE_KRW,
        monthlyDeltaKrw: monthlyDelta,
        prorationFactor: proration.factor,
        totalDays: proration.totalDays, daysRemaining: proration.daysRemaining,
        supplyAmountKrw, taxAmountKrw, totalAmountKrw,
        periodStart, periodEnd,
      };
    });

    return result;
  }

  // ──────────────────────────────────────────────
  // 내부 유틸
  // ──────────────────────────────────────────────
  private async chargeToss(params: {
    billingKey: string;
    customerKey: string;
    orderId: string;
    orderName: string;
    amount: number;
  }): Promise<{ success: boolean; transactionId?: string; failureReason?: string; rawResponse?: any }> {
    try {
      const secretKey = this.configService.get<string>('TOSS_PAYMENTS_SECRET_KEY', '');
      const res = await fetch(`https://api.tosspayments.com/v1/billing/${params.billingKey}`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerKey: params.customerKey,
          amount: params.amount,
          orderId: params.orderId,
          orderName: params.orderName,
        }),
      });
      const data = await res.json() as any;
      if (!res.ok) return { success: false, failureReason: data.message, rawResponse: data };
      return { success: true, transactionId: data.paymentKey, rawResponse: data };
    } catch {
      return { success: false, failureReason: '결제 서버 연결 오류' };
    }
  }

  private encryptBillingKey(billingKey: string): string {
    const key = Buffer.from(
      this.configService.get<string>('BILLING_KEY_ENCRYPTION_KEY', '0'.repeat(64)),
      'hex',
    );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(billingKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decryptBillingKey(encrypted: string): string {
    const key = Buffer.from(
      this.configService.get<string>('BILLING_KEY_ENCRYPTION_KEY', '0'.repeat(64)),
      'hex',
    );
    const [ivHex, encryptedData] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
