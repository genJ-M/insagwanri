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

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private configService: ConfigService,
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
               s.trial_end_at, s.current_period_end,
               s.cancel_at_period_end, s.canceled_at,
               s.quantity, s.next_billing_at,
               p.name AS plan_name, p.display_name AS plan_display_name,
               p.price_monthly_krw, p.price_yearly_krw
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

    // 금액 계산
    const basePrice = dto.billingCycle === 'yearly'
      ? Number(plan.price_yearly_krw)
      : Number(plan.price_monthly_krw);

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
      // Payment 레코드 생성
      await em.query(`
        INSERT INTO payments (
          company_id, subscription_id, payment_method_id, invoice_number,
          status, supply_amount_krw, tax_amount_krw, total_amount_krw,
          discount_amount_krw, coupon_id, billing_period_start, billing_period_end,
          billing_cycle, pg_provider, pg_transaction_id, pg_order_id,
          pg_raw_response, paid_at, refundable_until
        )
        SELECT $1,
          (SELECT id FROM subscriptions WHERE company_id = $1),
          $2, $3, 'completed',
          $4, $5, $6, $7, $8,
          $9::date, $10::date, $11,
          'toss_payments', $12, $13, $14::jsonb,
          NOW(), NOW() + INTERVAL '7 days'
      `, [
        user.companyId, dto.paymentMethodId, invoiceNumber,
        supplyAmount, taxAmount, totalAmount, discountAmount,
        coupon?.id ?? null,
        now.toISOString().slice(0, 10),
        periodEnd.toISOString().slice(0, 10),
        dto.billingCycle,
        tossResult.transactionId, orderId,
        JSON.stringify(tossResult.rawResponse),
      ]);

      // Subscription 업데이트
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
          updated_at = NOW()
        WHERE company_id = $1
      `, [user.companyId, dto.planId, dto.billingCycle, periodEnd, dto.paymentMethodId]);

      // 쿠폰 사용 횟수 증가
      if (coupon) {
        await em.query(
          `UPDATE coupons SET current_total_uses = current_total_uses + 1 WHERE id = $1`,
          [coupon.id],
        );
      }
    });

    return {
      invoiceNumber,
      amount: totalAmount,
      plan: plan.display_name,
      billingCycle: dto.billingCycle,
      nextBillingAt: periodEnd,
    };
  }

  // ──────────────────────────────────────────────
  // Toss 빌링키 발급 (카드 등록)
  // ──────────────────────────────────────────────
  async issueBillingKey(dto: IssueBillingKeyDto, user: AuthenticatedUser) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('결제 수단 등록은 OWNER만 가능합니다.');
    }

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
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('결제 수단 삭제는 OWNER만 가능합니다.');
    }

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
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('애드온 구매는 OWNER만 가능합니다.');
    }

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

      await em.query(`
        INSERT INTO addon_purchases (
          company_id, subscription_id, addon_code, quantity,
          unit_price_krw, total_amount_krw, billing_cycle,
          status, payment_id, active_from, active_until
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'active', $8,
          $9::date, $10::date
        )
      `, [
        user.companyId, sub?.id ?? null, dto.addonCode, dto.quantity,
        unitPrice, totalAmount, dto.billingCycle,
        payment.id,
        now.toISOString().slice(0, 10),
        activeUntil.toISOString().slice(0, 10),
      ]);
    });

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
