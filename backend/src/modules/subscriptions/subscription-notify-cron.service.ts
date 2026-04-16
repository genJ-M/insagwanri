import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../notifications/email.service';
import { format, addDays, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 구독 갱신 사전 알림 Cron
 *
 * 매일 10:00 KST (UTC 01:00) 실행
 * - D-7, D-3, D-1 자동결제 예정 구독 → owner에게 인앱 알림 + 이메일
 * - D-3, D-1 체험 기간 만료 예정 구독 → owner에게 알림
 * - 당월 만료 카드 보유 구독 → owner에게 알림 (1일 1회)
 *
 * 중복 발송 방지: subscriptions.renewal_notified_days JSONB 배열에 이미 발송된 D-N 기록
 */
@Injectable()
export class SubscriptionNotifyCronService {
  private readonly logger = new Logger(SubscriptionNotifyCronService.name);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
  ) {}

  /** 매일 10:00 KST = UTC 01:00 */
  @Cron('0 1 * * *', { timeZone: 'UTC' })
  async runDailyNotifications(): Promise<void> {
    this.logger.log('구독 사전 알림 Cron 시작');
    await Promise.allSettled([
      this.notifyRenewalSoon(),
      this.notifyTrialEnding(),
      this.notifyExpiringCard(),
    ]);
    this.logger.log('구독 사전 알림 Cron 완료');
  }

  // ──────────────────────────────────────────────
  // 1. 자동결제 예정 D-7 / D-3 / D-1 알림
  // ──────────────────────────────────────────────
  private async notifyRenewalSoon(): Promise<void> {
    const TARGET_DAYS = [7, 3, 1];

    for (const daysAhead of TARGET_DAYS) {
      const targetDate = addDays(startOfDay(new Date()), daysAhead);
      const dateStr = format(targetDate, 'yyyy-MM-dd');

      // renewal_notified_days에 해당 D-N이 이미 기록된 구독 제외
      const subscriptions = await this.dataSource.query(`
        SELECT
          s.id,
          s.company_id,
          s.billing_cycle,
          s.next_billing_at,
          p.display_name AS plan_name,
          p.price_monthly_krw,
          p.price_yearly_krw,
          pm.card_number_masked,
          pm.card_brand,
          u.id AS owner_id,
          u.email AS owner_email,
          u.name  AS owner_name,
          c.name  AS company_name,
          COALESCE(s.renewal_notified_days, '[]'::jsonb) AS notified_days
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        LEFT JOIN payment_methods pm ON pm.id = s.default_payment_method_id AND pm.is_active = true
        JOIN companies c ON c.id = s.company_id AND c.deleted_at IS NULL
        JOIN users u ON u.company_id = s.company_id AND u.role = 'owner' AND u.deleted_at IS NULL
        WHERE s.status = 'active'
          AND s.auto_renew = true
          AND s.cancel_at_period_end = false
          AND DATE(s.next_billing_at AT TIME ZONE 'Asia/Seoul') = $1::date
          AND NOT (COALESCE(s.renewal_notified_days, '[]'::jsonb) @> $2::jsonb)
      `, [dateStr, JSON.stringify([daysAhead])]);

      for (const sub of subscriptions) {
        const amount = sub.billing_cycle === 'yearly'
          ? Number(sub.price_yearly_krw)
          : Number(sub.price_monthly_krw);
        const amountVat = Math.round(amount * 1.1);
        const amountStr = `${amountVat.toLocaleString('ko-KR')}원`;
        const billingDateStr = format(new Date(sub.next_billing_at), 'M월 d일', { locale: ko });
        const cardSuffix = sub.card_number_masked
          ? ` (${sub.card_brand ?? ''} ${sub.card_number_masked.slice(-4)})`
          : '';

        const title = `[관리왕] 자동결제 예정 안내 — D-${daysAhead}`;
        const body = `${billingDateStr}에 ${sub.plan_name} 구독료 ${amountStr}이 자동 청구됩니다.${cardSuffix}`;

        try {
          // 인앱 알림
          await this.notificationsService.dispatch({
            userId:    sub.owner_id,
            companyId: sub.company_id,
            type:      'subscription_renewing_soon',
            title,
            body,
            refType:   'subscription',
            refId:     sub.id,
          });

          // 이메일
          await this.emailService.sendRaw({
            to: sub.owner_email,
            subject: title,
            html: this.buildRenewalSoonHtml({
              ownerName:    sub.owner_name,
              companyName:  sub.company_name,
              planName:     sub.plan_name,
              billingDate:  billingDateStr,
              amount:       amountStr,
              cardSuffix,
              daysAhead,
            }),
          });

          // 발송 완료 기록 (중복 방지)
          await this.dataSource.query(`
            UPDATE subscriptions
            SET renewal_notified_days =
              COALESCE(renewal_notified_days, '[]'::jsonb) || $2::jsonb,
                updated_at = NOW()
            WHERE id = $1
          `, [sub.id, JSON.stringify([daysAhead])]);

          this.logger.log(`갱신 사전 알림 D-${daysAhead} companyId=${sub.company_id}`);
        } catch (err) {
          this.logger.warn(`갱신 사전 알림 실패 subscriptionId=${sub.id}: ${err}`);
        }
      }
    }
  }

  // ──────────────────────────────────────────────
  // 2. 체험 기간 만료 임박 D-3 / D-1 알림
  // ──────────────────────────────────────────────
  private async notifyTrialEnding(): Promise<void> {
    const TARGET_DAYS = [3, 1];

    for (const daysAhead of TARGET_DAYS) {
      const targetDate = addDays(startOfDay(new Date()), daysAhead);
      const dateStr = format(targetDate, 'yyyy-MM-dd');

      const trials = await this.dataSource.query(`
        SELECT
          s.id, s.company_id, s.trial_end_at,
          p.display_name AS plan_name,
          u.id AS owner_id, u.email AS owner_email, u.name AS owner_name,
          c.name AS company_name,
          COALESCE(s.renewal_notified_days, '[]'::jsonb) AS notified_days
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        JOIN companies c ON c.id = s.company_id AND c.deleted_at IS NULL
        JOIN users u ON u.company_id = s.company_id AND u.role = 'owner' AND u.deleted_at IS NULL
        WHERE s.status = 'trialing'
          AND DATE(s.trial_end_at AT TIME ZONE 'Asia/Seoul') = $1::date
          AND NOT (COALESCE(s.renewal_notified_days, '[]'::jsonb) @> $2::jsonb)
      `, [dateStr, JSON.stringify([`trial_${daysAhead}`])]);

      for (const sub of trials) {
        const endDateStr = format(new Date(sub.trial_end_at), 'M월 d일', { locale: ko });
        const title = `[관리왕] 무료 체험이 ${daysAhead}일 후 종료됩니다`;
        const body = `${endDateStr}에 ${sub.plan_name} 무료 체험이 종료됩니다. 지금 바로 구독을 시작하세요.`;

        try {
          await this.notificationsService.dispatch({
            userId:    sub.owner_id,
            companyId: sub.company_id,
            type:      'trial_ending_soon',
            title,
            body,
            refType:   'subscription',
            refId:     sub.id,
          });

          await this.emailService.sendRaw({
            to: sub.owner_email,
            subject: title,
            html: this.buildTrialEndingHtml({
              ownerName:   sub.owner_name,
              companyName: sub.company_name,
              planName:    sub.plan_name,
              endDate:     endDateStr,
              daysAhead,
            }),
          });

          await this.dataSource.query(`
            UPDATE subscriptions
            SET renewal_notified_days =
              COALESCE(renewal_notified_days, '[]'::jsonb) || $2::jsonb,
                updated_at = NOW()
            WHERE id = $1
          `, [sub.id, JSON.stringify([`trial_${daysAhead}`])]);

          this.logger.log(`체험 만료 알림 D-${daysAhead} companyId=${sub.company_id}`);
        } catch (err) {
          this.logger.warn(`체험 만료 알림 실패 subscriptionId=${sub.id}: ${err}`);
        }
      }
    }
  }

  // ──────────────────────────────────────────────
  // 3. 카드 유효기간 당월 만료 알림 (매월 1일에 발송)
  // ──────────────────────────────────────────────
  private async notifyExpiringCard(): Promise<void> {
    const now = new Date();
    // 1일에만 실행 (DB에서 중복 방지하기보다 날짜로 간단 제어)
    if (now.getDate() !== 1) return;

    const thisYear  = now.getFullYear().toString();
    const thisMonth = String(now.getMonth() + 1).padStart(2, '0');

    const methods = await this.dataSource.query(`
      SELECT
        pm.id, pm.card_number_masked, pm.card_brand,
        pm.card_expiry_year, pm.card_expiry_month,
        pm.company_id,
        u.id AS owner_id, u.email AS owner_email, u.name AS owner_name,
        c.name AS company_name
      FROM payment_methods pm
      JOIN companies c ON c.id = pm.company_id AND c.deleted_at IS NULL
      JOIN users u ON u.company_id = pm.company_id AND u.role = 'owner' AND u.deleted_at IS NULL
      WHERE pm.is_active = true
        AND pm.card_expiry_year  = $1
        AND pm.card_expiry_month = $2
    `, [thisYear, thisMonth]);

    for (const pm of methods) {
      const title = '[관리왕] 등록 카드 유효기간 만료 안내';
      const card  = `${pm.card_brand ?? ''} ${pm.card_number_masked?.slice(-4) ?? ''}`.trim();
      const body  = `등록된 카드(${card})의 유효기간이 이번 달 만료됩니다. 자동결제 오류를 방지하려면 새 카드를 등록해 주세요.`;

      try {
        await this.notificationsService.dispatch({
          userId:    pm.owner_id,
          companyId: pm.company_id,
          type:      'subscription_payment_method_expiring',
          title,
          body,
        });

        await this.emailService.sendRaw({
          to: pm.owner_email,
          subject: title,
          html: this.buildCardExpiringHtml({
            ownerName:   pm.owner_name,
            companyName: pm.company_name,
            card,
          }),
        });

        this.logger.log(`카드 만료 알림 companyId=${pm.company_id}`);
      } catch (err) {
        this.logger.warn(`카드 만료 알림 실패 pmId=${pm.id}: ${err}`);
      }
    }
  }

  // ──────────────────────────────────────────────
  // 이메일 HTML 빌더
  // ──────────────────────────────────────────────
  private buildRenewalSoonHtml(opts: {
    ownerName: string; companyName: string; planName: string;
    billingDate: string; amount: string; cardSuffix: string; daysAhead: number;
  }): string {
    return `<!DOCTYPE html><html lang="ko"><body style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f4f4f6;padding:32px 0">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#7C3AED;padding:28px 32px">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700">관리왕</p>
    <p style="margin:4px 0 0;color:#DDD6FE;font-size:14px">구독 자동결제 예정 안내</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 20px;font-size:15px;color:#18181B">${opts.ownerName}님, 안녕하세요.</p>
    <div style="background:#F5F3FF;border-radius:8px;padding:20px;margin-bottom:24px">
      <p style="margin:0 0 8px;font-size:13px;color:#7C3AED;font-weight:600">결제 예정 정보</p>
      <table style="width:100%;font-size:14px;color:#18181B;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#52525B">플랜</td><td style="text-align:right;font-weight:600">${opts.planName}</td></tr>
        <tr><td style="padding:4px 0;color:#52525B">결제 예정일</td><td style="text-align:right;font-weight:600">${opts.billingDate} (D-${opts.daysAhead})</td></tr>
        <tr><td style="padding:4px 0;color:#52525B">청구 금액</td><td style="text-align:right;font-weight:700;color:#7C3AED">${opts.amount} (VAT 포함)</td></tr>
        ${opts.cardSuffix ? `<tr><td style="padding:4px 0;color:#52525B">결제 카드</td><td style="text-align:right">${opts.cardSuffix.trim()}</td></tr>` : ''}
      </table>
    </div>
    <p style="font-size:13px;color:#52525B;line-height:1.6">자동결제를 원하지 않으시면 결제일 전에 <strong>설정 → 구독 관리</strong>에서 자동결제를 해제하거나 구독을 해지해 주세요.</p>
  </div>
  <div style="padding:16px 32px 24px;border-top:1px solid #E4E4E7;text-align:center">
    <p style="margin:0;font-size:12px;color:#A1A1AA">${opts.companyName} · 관리왕 구독 관련 문의: support@insagwanri.com</p>
  </div>
</div></body></html>`;
  }

  private buildTrialEndingHtml(opts: {
    ownerName: string; companyName: string; planName: string;
    endDate: string; daysAhead: number;
  }): string {
    return `<!DOCTYPE html><html lang="ko"><body style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f4f4f6;padding:32px 0">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#7C3AED;padding:28px 32px">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700">관리왕</p>
    <p style="margin:4px 0 0;color:#DDD6FE;font-size:14px">무료 체험 종료 안내</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 20px;font-size:15px;color:#18181B">${opts.ownerName}님, 안녕하세요.</p>
    <p style="font-size:15px;color:#18181B;line-height:1.7">${opts.planName} 무료 체험 기간이 <strong>${opts.endDate} (${opts.daysAhead}일 후)</strong>에 종료됩니다.</p>
    <p style="font-size:14px;color:#52525B;line-height:1.6">지금 구독을 시작하시면 서비스를 끊김 없이 계속 이용하실 수 있습니다.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="https://insagwanri-nine.vercel.app/settings?tab=subscription" style="display:inline-block;background:#7C3AED;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">지금 구독 시작하기 →</a>
    </div>
  </div>
  <div style="padding:16px 32px 24px;border-top:1px solid #E4E4E7;text-align:center">
    <p style="margin:0;font-size:12px;color:#A1A1AA">${opts.companyName} · 관리왕 구독 관련 문의: support@insagwanri.com</p>
  </div>
</div></body></html>`;
  }

  private buildCardExpiringHtml(opts: {
    ownerName: string; companyName: string; card: string;
  }): string {
    return `<!DOCTYPE html><html lang="ko"><body style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f4f4f6;padding:32px 0">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#F59E0B;padding:28px 32px">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700">관리왕</p>
    <p style="margin:4px 0 0;color:#FEF3C7;font-size:14px">카드 유효기간 만료 안내</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;font-size:15px;color:#18181B">${opts.ownerName}님, 안녕하세요.</p>
    <p style="font-size:15px;color:#18181B;line-height:1.7">등록된 카드 <strong>${opts.card}</strong>의 유효기간이 이번 달 만료됩니다.</p>
    <p style="font-size:14px;color:#52525B;line-height:1.6">자동결제가 정상적으로 처리되려면 새 카드를 등록해 주세요.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="https://insagwanri-nine.vercel.app/settings?tab=subscription" style="display:inline-block;background:#F59E0B;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">결제 수단 관리 →</a>
    </div>
  </div>
  <div style="padding:16px 32px 24px;border-top:1px solid #E4E4E7;text-align:center">
    <p style="margin:0;font-size:12px;color:#A1A1AA">${opts.companyName} · 관리왕 구독 관련 문의: support@insagwanri.com</p>
  </div>
</div></body></html>`;
  }
}
