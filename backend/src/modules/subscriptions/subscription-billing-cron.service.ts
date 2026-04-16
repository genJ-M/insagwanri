import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../notifications/email.service';
import { format, addMonths, addYears } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 자동결제 실행 Cron
 *
 * 매일 04:00 KST (UTC 19:00 전일) 실행
 * 조건: next_billing_at <= NOW(), auto_renew = true, status = 'active'
 *
 * 성공 시: 구독 기간 연장, 결제 레코드 생성, 갱신 성공 알림
 * 실패 시: renewal_retry_count 증가, 72h 후 재시도 스케줄, 실패 알림
 *          3회 실패 시 구독 status = 'past_due' 로 변경
 */
@Injectable()
export class SubscriptionBillingCronService {
  private readonly logger = new Logger(SubscriptionBillingCronService.name);
  private readonly MAX_RETRY = 3;
  private readonly RETRY_INTERVAL_HOURS = 24; // 1일마다 재시도

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
  ) {}

  /** 매일 04:00 KST = UTC 19:00 (전일) */
  @Cron('0 19 * * *', { timeZone: 'UTC' })
  async runAutoRenewal(): Promise<void> {
    this.logger.log('자동결제 Cron 시작');

    // 결제 대상: next_billing_at이 현재 시각 이전이고 아직 미처리된 활성 구독
    const subscriptions = await this.dataSource.query(`
      SELECT
        s.id,
        s.company_id,
        s.plan_id,
        s.billing_cycle,
        s.default_payment_method_id,
        s.next_billing_at,
        s.current_period_end,
        s.quantity,
        COALESCE(s.renewal_retry_count, 0) AS renewal_retry_count,
        p.display_name AS plan_name,
        p.price_monthly_krw,
        p.price_yearly_krw,
        pm.pg_billing_key,
        u.id     AS owner_id,
        u.email  AS owner_email,
        u.name   AS owner_name,
        c.name   AS company_name
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      JOIN payment_methods pm
        ON pm.id = s.default_payment_method_id AND pm.is_active = true
      JOIN companies c ON c.id = s.company_id AND c.deleted_at IS NULL
      JOIN users u
        ON u.company_id = s.company_id AND u.role = 'owner' AND u.deleted_at IS NULL
      WHERE s.status IN ('active', 'past_due')
        AND s.auto_renew = true
        AND s.cancel_at_period_end = false
        AND s.next_billing_at <= NOW()
        AND COALESCE(s.renewal_retry_count, 0) < $1
    `, [this.MAX_RETRY]);

    this.logger.log(`자동결제 대상: ${subscriptions.length}건`);

    for (const sub of subscriptions) {
      await this.processRenewal(sub);
    }

    this.logger.log('자동결제 Cron 완료');
  }

  private async processRenewal(sub: any): Promise<void> {
    const amount = sub.billing_cycle === 'yearly'
      ? Number(sub.price_yearly_krw)
      : Number(sub.price_monthly_krw);
    const taxAmount    = Math.round(amount * 0.1);
    const totalAmount  = amount + taxAmount;

    const now      = new Date();
    const orderId  = `RENEW-${Date.now()}-${sub.company_id.slice(0, 8)}`;
    const invoiceNumber = `INV-${now.toISOString().slice(0, 7)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Toss 결제
    const billingKey = this.decryptBillingKey(sub.pg_billing_key);
    const tossResult = await this.chargeToss({
      billingKey,
      customerKey: sub.company_id,
      orderId,
      orderName: `관리왕 ${sub.plan_name} 구독 자동갱신`,
      amount: totalAmount,
    });

    if (tossResult.success) {
      await this.handleSuccess(sub, { orderId, invoiceNumber, amount, taxAmount, totalAmount, tossResult, now });
    } else {
      await this.handleFailure(sub, tossResult.failureReason ?? '결제 실패');
    }
  }

  // ──────────────────────────────────────────────
  // 결제 성공 처리
  // ──────────────────────────────────────────────
  private async handleSuccess(sub: any, opts: {
    orderId: string; invoiceNumber: string;
    amount: number; taxAmount: number; totalAmount: number;
    tossResult: any; now: Date;
  }): Promise<void> {
    const { orderId, invoiceNumber, amount, taxAmount, totalAmount, tossResult, now } = opts;

    // 다음 결제일 계산
    const nextPeriodEnd = sub.billing_cycle === 'yearly'
      ? addYears(new Date(sub.current_period_end), 1)
      : addMonths(new Date(sub.current_period_end), 1);

    await this.dataSource.transaction(async (em) => {
      // Payment 레코드 생성
      await em.query(`
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
        )
      `, [
        sub.company_id, sub.id, sub.default_payment_method_id, invoiceNumber,
        amount, taxAmount, totalAmount, sub.billing_cycle,
        tossResult.transactionId, orderId, JSON.stringify(tossResult.rawResponse),
      ]);

      // Subscription 기간 연장 + 재시도 카운터 초기화 + 발송 기록 초기화
      await em.query(`
        UPDATE subscriptions SET
          status                = 'active',
          current_period_start  = NOW(),
          current_period_end    = $2,
          next_billing_at       = $2,
          renewal_retry_count   = 0,
          renewal_last_failed_at = NULL,
          renewal_notified_days  = '[]'::jsonb,
          updated_at             = NOW()
        WHERE id = $1
      `, [sub.id, nextPeriodEnd]);
    });

    // 알림
    const billingDateStr = format(nextPeriodEnd, 'M월 d일', { locale: ko });
    const amountStr = `${totalAmount.toLocaleString('ko-KR')}원`;
    const body = `${sub.plan_name} 구독이 자동 갱신되었습니다. 청구 금액: ${amountStr}. 다음 결제일: ${billingDateStr}`;

    try {
      await this.notificationsService.dispatch({
        userId:    sub.owner_id,
        companyId: sub.company_id,
        type:      'subscription_renewed',
        title:     '[관리왕] 구독이 자동 갱신되었습니다',
        body,
        refType:   'subscription',
        refId:     sub.id,
      });

      await this.emailService.sendRaw({
        to: sub.owner_email,
        subject: '[관리왕] 구독 자동갱신 완료 안내',
        html: this.buildRenewedHtml({
          ownerName:    sub.owner_name,
          companyName:  sub.company_name,
          planName:     sub.plan_name,
          amount:       amountStr,
          invoiceNumber,
          nextDate:     billingDateStr,
        }),
      });
    } catch (err) {
      this.logger.warn(`갱신 성공 알림 실패 companyId=${sub.company_id}: ${err}`);
    }

    this.logger.log(`자동결제 성공 companyId=${sub.company_id} amount=${totalAmount}`);
  }

  // ──────────────────────────────────────────────
  // 결제 실패 처리
  // ──────────────────────────────────────────────
  private async handleFailure(sub: any, reason: string): Promise<void> {
    const newRetryCount = Number(sub.renewal_retry_count) + 1;
    const isTerminal    = newRetryCount >= this.MAX_RETRY;

    // 다음 재시도: RETRY_INTERVAL_HOURS 후
    const nextRetryAt = new Date();
    nextRetryAt.setHours(nextRetryAt.getHours() + this.RETRY_INTERVAL_HOURS);

    await this.dataSource.query(`
      UPDATE subscriptions SET
        status                 = $2,
        renewal_retry_count    = $3,
        renewal_last_failed_at = NOW(),
        next_billing_at        = CASE WHEN $4 THEN next_billing_at ELSE $5 END,
        updated_at             = NOW()
      WHERE id = $1
    `, [
      sub.id,
      isTerminal ? 'past_due' : 'past_due',  // 1회 실패부터 past_due
      newRetryCount,
      isTerminal,
      nextRetryAt,
    ]);

    const body = isTerminal
      ? `${sub.plan_name} 구독 결제가 ${this.MAX_RETRY}회 연속 실패하여 서비스가 일시 정지되었습니다. 결제 수단을 확인해 주세요.`
      : `${sub.plan_name} 구독 결제에 실패했습니다 (${newRetryCount}/${this.MAX_RETRY}회). 실패 사유: ${reason}. ${this.RETRY_INTERVAL_HOURS}시간 후 재시도됩니다.`;

    try {
      await this.notificationsService.dispatch({
        userId:    sub.owner_id,
        companyId: sub.company_id,
        type:      'subscription_renewal_failed',
        title:     isTerminal
          ? '[관리왕] 구독 결제 실패 — 서비스 일시 정지'
          : `[관리왕] 구독 결제 실패 (${newRetryCount}/${this.MAX_RETRY})`,
        body,
        refType:   'subscription',
        refId:     sub.id,
      });

      await this.emailService.sendRaw({
        to: sub.owner_email,
        subject: isTerminal
          ? '[관리왕] 구독 결제 최종 실패 안내'
          : `[관리왕] 구독 결제 실패 안내 (${newRetryCount}/${this.MAX_RETRY})`,
        html: this.buildFailedHtml({
          ownerName:    sub.owner_name,
          companyName:  sub.company_name,
          planName:     sub.plan_name,
          reason,
          retryCount:   newRetryCount,
          maxRetry:     this.MAX_RETRY,
          isTerminal,
          retryHours:   this.RETRY_INTERVAL_HOURS,
        }),
      });
    } catch (err) {
      this.logger.warn(`갱신 실패 알림 발송 오류 companyId=${sub.company_id}: ${err}`);
    }

    this.logger.warn(`자동결제 실패 companyId=${sub.company_id} retry=${newRetryCount}/${this.MAX_RETRY} reason=${reason}`);
  }

  // ──────────────────────────────────────────────
  // Toss 빌링 결제 (subscriptions.service.ts에서 공유하기 어려워 여기도 보유)
  // ──────────────────────────────────────────────
  private async chargeToss(params: {
    billingKey: string; customerKey: string;
    orderId: string; orderName: string; amount: number;
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
          amount:      params.amount,
          orderId:     params.orderId,
          orderName:   params.orderName,
        }),
      });
      const data = await res.json() as any;
      if (!res.ok) return { success: false, failureReason: data.message, rawResponse: data };
      return { success: true, transactionId: data.paymentKey, rawResponse: data };
    } catch {
      return { success: false, failureReason: '결제 서버 연결 오류' };
    }
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

  // ──────────────────────────────────────────────
  // 이메일 HTML 빌더
  // ──────────────────────────────────────────────
  private buildRenewedHtml(opts: {
    ownerName: string; companyName: string; planName: string;
    amount: string; invoiceNumber: string; nextDate: string;
  }): string {
    return `<!DOCTYPE html><html lang="ko"><body style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f4f4f6;padding:32px 0">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#10B981;padding:28px 32px">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700">관리왕</p>
    <p style="margin:4px 0 0;color:#D1FAE5;font-size:14px">구독 자동갱신 완료</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 20px;font-size:15px;color:#18181B">${opts.ownerName}님, 안녕하세요.</p>
    <div style="background:#F0FDF4;border-radius:8px;padding:20px;margin-bottom:24px">
      <p style="margin:0 0 8px;font-size:13px;color:#10B981;font-weight:600">결제 완료 내역</p>
      <table style="width:100%;font-size:14px;color:#18181B;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#52525B">플랜</td><td style="text-align:right;font-weight:600">${opts.planName}</td></tr>
        <tr><td style="padding:4px 0;color:#52525B">청구 금액</td><td style="text-align:right;font-weight:700;color:#10B981">${opts.amount} (VAT 포함)</td></tr>
        <tr><td style="padding:4px 0;color:#52525B">청구서 번호</td><td style="text-align:right;font-size:12px">${opts.invoiceNumber}</td></tr>
        <tr><td style="padding:4px 0;color:#52525B">다음 결제일</td><td style="text-align:right">${opts.nextDate}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#52525B">결제 영수증은 <strong>설정 → 구독 관리 → 결제 내역</strong>에서 확인하실 수 있습니다.</p>
  </div>
  <div style="padding:16px 32px 24px;border-top:1px solid #E4E4E7;text-align:center">
    <p style="margin:0;font-size:12px;color:#A1A1AA">${opts.companyName} · 관리왕 구독 관련 문의: support@insagwanri.com</p>
  </div>
</div></body></html>`;
  }

  private buildFailedHtml(opts: {
    ownerName: string; companyName: string; planName: string;
    reason: string; retryCount: number; maxRetry: number;
    isTerminal: boolean; retryHours: number;
  }): string {
    const headerColor = opts.isTerminal ? '#EF4444' : '#F59E0B';
    const headerLight = opts.isTerminal ? '#FEE2E2' : '#FEF3C7';
    const nextAction  = opts.isTerminal
      ? '서비스 이용을 재개하려면 결제 수단을 업데이트하고 구독을 다시 활성화해 주세요.'
      : `${opts.retryHours}시간 후 자동으로 재시도됩니다. 카드 정보를 확인하시거나 새 카드를 등록해 주세요.`;

    return `<!DOCTYPE html><html lang="ko"><body style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f4f4f6;padding:32px 0">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:${headerColor};padding:28px 32px">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700">관리왕</p>
    <p style="margin:4px 0 0;color:${headerLight};font-size:14px">구독 결제 ${opts.isTerminal ? '최종 실패' : '실패'} 안내</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 20px;font-size:15px;color:#18181B">${opts.ownerName}님, 안녕하세요.</p>
    <div style="background:${opts.isTerminal ? '#FEF2F2' : '#FFFBEB'};border-radius:8px;padding:20px;margin-bottom:24px">
      <p style="margin:0 0 8px;font-size:13px;color:${headerColor};font-weight:600">결제 실패 정보</p>
      <table style="width:100%;font-size:14px;color:#18181B;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#52525B">플랜</td><td style="text-align:right">${opts.planName}</td></tr>
        <tr><td style="padding:4px 0;color:#52525B">실패 사유</td><td style="text-align:right;color:${headerColor}">${opts.reason}</td></tr>
        <tr><td style="padding:4px 0;color:#52525B">시도 횟수</td><td style="text-align:right">${opts.retryCount} / ${opts.maxRetry}회</td></tr>
      </table>
    </div>
    <p style="font-size:14px;color:#52525B;line-height:1.6">${nextAction}</p>
    <div style="text-align:center;margin:28px 0">
      <a href="https://insagwanri-nine.vercel.app/settings?tab=subscription" style="display:inline-block;background:${headerColor};color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">결제 수단 관리 →</a>
    </div>
  </div>
  <div style="padding:16px 32px 24px;border-top:1px solid #E4E4E7;text-align:center">
    <p style="margin:0;font-size:12px;color:#A1A1AA">${opts.companyName} · 관리왕 구독 관련 문의: support@insagwanri.com</p>
  </div>
</div></body></html>`;
  }
}
