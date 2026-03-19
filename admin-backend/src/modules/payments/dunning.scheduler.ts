import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Subscription, SubscriptionStatus } from '../../database/entities/subscription.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import { PaymentMethod } from '../../database/entities/payment-method.entity';
import { TossPaymentsService } from './toss-payments.service';
import * as crypto from 'crypto';

// Dunning 재시도 일정 (결제 실패 후)
const RETRY_SCHEDULE_DAYS = [1, 3, 7]; // D+1, D+3, D+7

@Injectable()
export class DunningScheduler {
  private readonly logger = new Logger(DunningScheduler.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,

    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,

    @InjectRepository(PaymentMethod)
    private paymentMethodRepository: Repository<PaymentMethod>,

    private tossPaymentsService: TossPaymentsService,
    private configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────
  // 매일 00:05 — 구독 갱신 (기간 만료된 active 구독)
  // ──────────────────────────────────────────────
  @Cron('5 0 * * *', { timeZone: 'Asia/Seoul' })
  async handleSubscriptionRenewal() {
    this.logger.log('구독 갱신 스케줄러 시작');

    const now = new Date();
    const expiredSubs = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        currentPeriodEnd: LessThanOrEqual(now),
      },
      relations: ['plan'],
    });

    this.logger.log(`갱신 대상 구독: ${expiredSubs.length}건`);

    for (const sub of expiredSubs) {
      await this.chargeSubscription(sub);
    }
  }

  // ──────────────────────────────────────────────
  // 매시간 — Dunning 재시도 (next_retry_at 도달)
  // ──────────────────────────────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async handleDunningRetry() {
    const now = new Date();
    const pastDueSubs = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        nextRetryAt: LessThanOrEqual(now),
      },
      relations: ['plan'],
    });

    if (pastDueSubs.length === 0) return;

    this.logger.log(`Dunning 재시도 대상: ${pastDueSubs.length}건`);

    for (const sub of pastDueSubs) {
      await this.chargeSubscription(sub);
    }
  }

  // ──────────────────────────────────────────────
  // D+7 초과 → 서비스 정지
  // ──────────────────────────────────────────────
  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  async handleFinalSuspend() {
    const maxRetryDays = RETRY_SCHEDULE_DAYS[RETRY_SCHEDULE_DAYS.length - 1];
    const suspendThreshold = new Date();
    suspendThreshold.setDate(suspendThreshold.getDate() - (maxRetryDays + 1));

    const toSuspend = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        pastDueSince: LessThanOrEqual(suspendThreshold),
      },
    });

    for (const sub of toSuspend) {
      await this.subscriptionRepository.update(sub.id, {
        status: SubscriptionStatus.SUSPENDED,
      });
      this.logger.warn(`구독 정지: companyId=${sub.companyId}`);
    }
  }

  // ──────────────────────────────────────────────
  // 내부: 실제 결제 시도
  // ──────────────────────────────────────────────
  private async chargeSubscription(sub: Subscription) {
    const paymentMethod = sub.defaultPaymentMethodId
      ? await this.paymentMethodRepository.findOne({
          where: { id: sub.defaultPaymentMethodId, isActive: true },
        })
      : null;

    if (!paymentMethod?.pgBillingKey) {
      this.logger.warn(`결제 수단 없음: companyId=${sub.companyId}`);
      await this.markPastDue(sub);
      return;
    }

    // 결제 금액 계산
    const plan = sub.plan;
    const supplyAmount = sub.billingCycle === 'yearly'
      ? Math.round(plan.priceYearlyKrw * (1 - plan.yearlyDiscountRate / 100))
      : plan.priceMonthlyKrw;

    const taxAmount = Math.round(supplyAmount * 0.1);
    const totalAmount = supplyAmount + taxAmount - sub.discountAmountKrw;

    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 7).replace('-', '-')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const orderId = `ORDER-${Date.now()}-${sub.companyId.slice(0, 8)}`;

    // Payment 레코드 생성 (pending)
    const periodEnd = sub.currentPeriodEnd;
    const nextPeriodEnd = new Date(periodEnd);
    if (sub.billingCycle === 'yearly') {
      nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
    } else {
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
    }

    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
        companyId: sub.companyId,
        subscriptionId: sub.id,
        paymentMethodId: paymentMethod.id,
        invoiceNumber,
        status: PaymentStatus.PROCESSING,
        supplyAmountKrw: supplyAmount,
        taxAmountKrw: taxAmount,
        totalAmountKrw: totalAmount,
        discountAmountKrw: sub.discountAmountKrw,
        billingPeriodStart: periodEnd.toISOString().slice(0, 10),
        billingPeriodEnd: nextPeriodEnd.toISOString().slice(0, 10),
        billingCycle: sub.billingCycle,
        pgOrderId: orderId,
      }),
    );

    // 빌링키로 결제 시도
    // pgBillingKey는 AES-256 암호화 저장 — 실제 사용 전 복호화 필요
    const decryptedBillingKey = this.decryptBillingKey(paymentMethod.pgBillingKey);

    const result = await this.tossPaymentsService.chargeWithBillingKey({
      billingKey: decryptedBillingKey,
      customerKey: sub.companyId,
      orderId,
      orderName: `관리왕 ${plan.displayName} 구독료`,
      amount: totalAmount,
    });

    if (result.success) {
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.COMPLETED,
        pgTransactionId: result.transactionId,
        pgRawResponse: result.rawResponse,
        paidAt: result.paidAt,
        refundableUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일
      });

      // 구독 갱신
      await this.subscriptionRepository.update(sub.id, {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodEnd,
        currentPeriodEnd: nextPeriodEnd,
        nextBillingAt: nextPeriodEnd,
        pastDueSince: null as any,
        retryCount: 0,
        nextRetryAt: null as any,
      });

      this.logger.log(`결제 성공: companyId=${sub.companyId}, amount=${totalAmount}`);
    } else {
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.FAILED,
        failureCode: result.failureCode,
        failureReason: result.failureReason,
        pgRawResponse: result.rawResponse,
      });

      await this.markPastDue(sub);
      this.logger.warn(`결제 실패: companyId=${sub.companyId}, code=${result.failureCode}`);
    }
  }

  private async markPastDue(sub: Subscription) {
    const retryCount = (sub.retryCount ?? 0) + 1;
    const retryDayOffset = RETRY_SCHEDULE_DAYS[sub.retryCount] ?? null;

    const nextRetryAt = retryDayOffset
      ? new Date(Date.now() + retryDayOffset * 24 * 60 * 60 * 1000)
      : null;

    await this.subscriptionRepository.update(sub.id, {
      status: SubscriptionStatus.PAST_DUE,
      pastDueSince: sub.pastDueSince ?? new Date(),
      retryCount,
      nextRetryAt: nextRetryAt as any,
    });
  }

  // AES-256-CBC 복호화
  private decryptBillingKey(encrypted: string): string {
    const key = Buffer.from(
      this.configService.get<string>('BILLING_KEY_ENCRYPTION_KEY', ''),
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
