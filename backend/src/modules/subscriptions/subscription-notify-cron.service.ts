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
      this.expireTrialsAndNotify(),
      this.notifyDataPurgeSoon(),    // D-7 사전 알림
      this.purgeExpiredCompanies(),  // 60일 경과 시 데이터 삭제 (soft)
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
  // 2-2. 체험 기간 만료 처리 + 차단 알림
  // status='trialing' AND trial_end_at <= NOW() → status='expired' 변경 + 알림
  // 자동 결제는 하지 않음 (정책)
  // ──────────────────────────────────────────────
  private async expireTrialsAndNotify(): Promise<void> {
    const expired = await this.dataSource.query(`
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
        AND s.trial_end_at <= NOW()
        AND NOT (COALESCE(s.renewal_notified_days, '[]'::jsonb) @> '["trial_expired"]'::jsonb)
    `);

    for (const sub of expired) {
      const endDateStr = format(new Date(sub.trial_end_at), 'M월 d일', { locale: ko });
      const title = '[관리왕] 무료 체험이 종료되어 서비스가 일시 정지되었습니다';
      const body = `${sub.plan_name} 무료 체험이 ${endDateStr}에 종료되었습니다. 결제 또는 무료 플랜 전환 후 다시 사용하실 수 있습니다.`;

      try {
        // 1) status를 expired로 변경
        await this.dataSource.query(`
          UPDATE subscriptions
             SET status                = 'expired',
                 renewal_notified_days = COALESCE(renewal_notified_days, '[]'::jsonb) || '["trial_expired"]'::jsonb,
                 updated_at            = NOW()
           WHERE id = $1
        `, [sub.id]);

        // 2) 인앱 알림
        await this.notificationsService.dispatch({
          userId:    sub.owner_id,
          companyId: sub.company_id,
          type:      'trial_expired',
          title,
          body,
          refType:   'subscription',
          refId:     sub.id,
        });

        // 3) 이메일
        await this.emailService.sendRaw({
          to: sub.owner_email,
          subject: title,
          html: this.buildTrialExpiredHtml({
            ownerName:   sub.owner_name,
            companyName: sub.company_name,
            planName:    sub.plan_name,
            endDate:     endDateStr,
          }),
        });

        this.logger.log(`체험 만료 처리 + 차단 알림 companyId=${sub.company_id}`);
      } catch (err) {
        this.logger.warn(`체험 만료 처리 실패 subscriptionId=${sub.id}: ${err}`);
      }
    }
  }

  // ──────────────────────────────────────────────
  // 2-3. 데이터 삭제 D-7 사전 알림
  //   expired 상태에서 53일이 지난 회사에 "7일 후 데이터 삭제" 메일 발송
  // ──────────────────────────────────────────────
  private async notifyDataPurgeSoon(): Promise<void> {
    const candidates = await this.dataSource.query(`
      SELECT s.id AS sub_id, s.company_id, s.trial_end_at,
             c.name AS company_name,
             u.id AS owner_id, u.email AS owner_email, u.name AS owner_name,
             COALESCE(s.renewal_notified_days, '[]'::jsonb) AS notified_days
        FROM subscriptions s
        JOIN companies c ON c.id = s.company_id AND c.deleted_at IS NULL
        JOIN users u ON u.company_id = s.company_id AND u.role = 'owner' AND u.deleted_at IS NULL
       WHERE s.status = 'expired'
         AND s.trial_end_at < NOW() - INTERVAL '53 days'
         AND s.trial_end_at >= NOW() - INTERVAL '60 days'
         AND NOT (COALESCE(s.renewal_notified_days, '[]'::jsonb) @> '["purge_d7"]'::jsonb)
    `);

    for (const c of candidates) {
      try {
        await this.notificationsService.dispatch({
          userId:    c.owner_id,
          companyId: c.company_id,
          type:      'trial_expired',
          title:     '[관리왕] 7일 후 회사 데이터가 삭제됩니다',
          body:      '결제하거나 무료 플랜으로 전환하지 않으면 7일 후 회사 데이터가 모두 삭제됩니다.',
          refType:   'subscription',
          refId:     c.sub_id,
        });
        await this.emailService.sendRaw({
          to: c.owner_email,
          subject: '[관리왕] 7일 후 회사 데이터가 영구 삭제됩니다',
          html: this.buildDataPurgeSoonHtml({
            ownerName: c.owner_name,
            companyName: c.company_name,
          }),
        });
        await this.dataSource.query(`
          UPDATE subscriptions
             SET renewal_notified_days = COALESCE(renewal_notified_days, '[]'::jsonb) || '["purge_d7"]'::jsonb,
                 updated_at = NOW()
           WHERE id = $1
        `, [c.sub_id]);
        this.logger.log(`삭제 D-7 알림 companyId=${c.company_id}`);
      } catch (err) {
        this.logger.warn(`삭제 D-7 알림 실패 subscriptionId=${c.sub_id}: ${err}`);
      }
    }
  }

  // ──────────────────────────────────────────────
  // 2-4. 60일 경과 회사 soft delete + 최종 알림
  // ──────────────────────────────────────────────
  private async purgeExpiredCompanies(): Promise<void> {
    const candidates = await this.dataSource.query(`
      SELECT s.id AS sub_id, s.company_id, s.trial_end_at,
             c.name AS company_name,
             u.id AS owner_id, u.email AS owner_email, u.name AS owner_name
        FROM subscriptions s
        JOIN companies c ON c.id = s.company_id AND c.deleted_at IS NULL
        JOIN users u ON u.company_id = s.company_id AND u.role = 'owner' AND u.deleted_at IS NULL
       WHERE s.status = 'expired'
         AND s.trial_end_at < NOW() - INTERVAL '60 days'
    `);

    for (const c of candidates) {
      try {
        await this.dataSource.transaction(async (em) => {
          // 회사 soft delete — 모든 child 데이터는 외래키 cascade로 처리되거나 deleted_at로 함께 무효화
          await em.query(
            `UPDATE companies SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [c.company_id],
          );
          // 구독을 canceled로 마킹
          await em.query(`
            UPDATE subscriptions
               SET status      = 'canceled',
                   canceled_at = NOW(),
                   updated_at  = NOW()
             WHERE id = $1
          `, [c.sub_id]);
        });

        // 최종 알림은 회사 삭제 후 — 인앱은 의미 없으므로 메일만
        await this.emailService.sendRaw({
          to: c.owner_email,
          subject: '[관리왕] 회사 데이터 삭제 완료 안내',
          html: this.buildDataPurgedHtml({
            ownerName: c.owner_name,
            companyName: c.company_name,
          }),
        });

        this.logger.log(`60일 경과 회사 삭제 companyId=${c.company_id}`);
      } catch (err) {
        this.logger.error(`회사 삭제 실패 companyId=${c.company_id}: ${err}`);
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

  private buildTrialExpiredHtml(opts: {
    ownerName: string; companyName: string; planName: string; endDate: string;
  }): string {
    return `<!DOCTYPE html><html lang="ko"><body style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f4f4f6;padding:32px 0">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#EF4444;padding:28px 32px">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700">관리왕</p>
    <p style="margin:4px 0 0;color:#FEE2E2;font-size:14px">무료 체험 종료 — 서비스 일시 정지</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;font-size:15px;color:#18181B">${opts.ownerName}님, 안녕하세요.</p>
    <div style="background:#FEF2F2;border-radius:8px;padding:18px;margin-bottom:20px">
      <p style="margin:0 0 8px;font-size:13px;color:#EF4444;font-weight:600">서비스 사용이 일시 정지되었습니다</p>
      <p style="margin:0;font-size:14px;color:#18181B;line-height:1.6">
        ${opts.planName} 무료 체험이 <strong>${opts.endDate}</strong>에 종료되어, 자동결제 정책에 따라 결제 없이 사용이 정지되었습니다.
      </p>
    </div>
    <p style="font-size:14px;color:#52525B;line-height:1.7">
      다음 중 하나를 선택하시면 서비스를 다시 이용하실 수 있습니다.
    </p>
    <ul style="font-size:14px;color:#18181B;line-height:1.8;padding-left:18px">
      <li><strong>유료 플랜으로 전환</strong> — 카드 등록 후 베이직 또는 프로 결제</li>
      <li><strong>무료 플랜으로 전환</strong> — 직원 1명까지 카드 등록 없이 무료 사용</li>
    </ul>
    <div style="text-align:center;margin:28px 0">
      <a href="https://insagwanri-nine.vercel.app/billing" style="display:inline-block;background:#EF4444;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">결제 관리 페이지로 이동 →</a>
    </div>
    <p style="font-size:12px;color:#A1A1AA;line-height:1.6;margin-top:24px;border-top:1px solid #F4F4F5;padding-top:16px">
      체험 기간 중 등록한 데이터는 <strong>60일간</strong> 안전하게 보관됩니다. 그 안에 결제 또는 무료 플랜 전환 시 즉시 복원되며, 60일이 지나면 영구 삭제됩니다.
    </p>
  </div>
  <div style="padding:16px 32px 24px;border-top:1px solid #E4E4E7;text-align:center">
    <p style="margin:0;font-size:12px;color:#A1A1AA">${opts.companyName} · 관리왕 구독 관련 문의: support@insagwanri.com</p>
  </div>
</div></body></html>`;
  }

  private buildDataPurgeSoonHtml(opts: {
    ownerName: string; companyName: string;
  }): string {
    return `<!DOCTYPE html><html lang="ko"><body style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f4f4f6;padding:32px 0">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#DC2626;padding:28px 32px">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700">관리왕</p>
    <p style="margin:4px 0 0;color:#FECACA;font-size:14px">7일 후 회사 데이터 영구 삭제</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;font-size:15px;color:#18181B">${opts.ownerName}님, 안녕하세요.</p>
    <div style="background:#FEF2F2;border-radius:8px;padding:18px;margin-bottom:20px;border-left:4px solid #DC2626">
      <p style="margin:0;font-size:14px;color:#18181B;line-height:1.6">
        <strong>${opts.companyName}</strong>의 무료 체험 종료 후 53일이 경과했습니다.<br />
        <strong>7일 후 회사 데이터가 영구 삭제됩니다.</strong>
      </p>
    </div>
    <p style="font-size:14px;color:#52525B;line-height:1.7">
      삭제를 원하지 않으시면 7일 안에 다음 중 하나를 진행해 주세요.
    </p>
    <ul style="font-size:14px;color:#18181B;line-height:1.8;padding-left:18px">
      <li>유료 플랜으로 전환 — 카드 등록 후 결제</li>
      <li>무료 플랜으로 전환 — 직원 1명까지 카드 없이 무료</li>
    </ul>
    <div style="text-align:center;margin:28px 0">
      <a href="https://insagwanri-nine.vercel.app/billing" style="display:inline-block;background:#DC2626;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">결제 관리 페이지로 이동 →</a>
    </div>
    <p style="font-size:12px;color:#A1A1AA;line-height:1.6;margin-top:24px;border-top:1px solid #F4F4F5;padding-top:16px">
      삭제된 데이터는 복구되지 않습니다. 출퇴근·근무·급여 등 모든 기록이 함께 사라지므로 이 기간 안에 처리해 주세요.
    </p>
  </div>
  <div style="padding:16px 32px 24px;border-top:1px solid #E4E4E7;text-align:center">
    <p style="margin:0;font-size:12px;color:#A1A1AA">${opts.companyName} · 관리왕 구독 관련 문의: support@insagwanri.com</p>
  </div>
</div></body></html>`;
  }

  private buildDataPurgedHtml(opts: {
    ownerName: string; companyName: string;
  }): string {
    return `<!DOCTYPE html><html lang="ko"><body style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f4f4f6;padding:32px 0">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#52525B;padding:28px 32px">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700">관리왕</p>
    <p style="margin:4px 0 0;color:#D4D4D8;font-size:14px">회사 데이터 삭제 완료</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;font-size:15px;color:#18181B">${opts.ownerName}님, 안녕하세요.</p>
    <p style="font-size:15px;color:#18181B;line-height:1.7">
      <strong>${opts.companyName}</strong>의 무료 체험 종료 후 60일이 경과하여,
      관리왕 정책에 따라 회사 데이터를 안전하게 삭제하였음을 알려드립니다.
    </p>
    <p style="font-size:14px;color:#52525B;line-height:1.6;margin-top:20px">
      그동안 관리왕을 이용해 주셔서 감사합니다. 다시 시작하고 싶으시면 언제든 회원가입을 통해 새로 시작하실 수 있습니다.
    </p>
    <div style="text-align:center;margin:28px 0">
      <a href="https://insagwanri-nine.vercel.app/" style="display:inline-block;background:#7C3AED;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">관리왕 다시 시작하기</a>
    </div>
  </div>
  <div style="padding:16px 32px 24px;border-top:1px solid #E4E4E7;text-align:center">
    <p style="margin:0;font-size:12px;color:#A1A1AA">관리왕 구독 관련 문의: support@insagwanri.com</p>
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
