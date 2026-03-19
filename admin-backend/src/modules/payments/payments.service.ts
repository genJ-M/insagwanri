import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import { TossPaymentsService } from './toss-payments.service';
import { PaymentQueryDto, RefundDto } from './dto/payment.dto';
import { AdminJwtPayload } from '../../common/types/admin-jwt-payload.type';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,

    private tossPaymentsService: TossPaymentsService,
  ) {}

  // ──────────────────────────────────────────────
  // 결제 목록 조회
  // ──────────────────────────────────────────────
  async findAll(query: PaymentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.paymentRepository.createQueryBuilder('p');

    if (query.companyId) {
      qb.andWhere('p.company_id = :companyId', { companyId: query.companyId });
    }
    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }
    if (query.periodStart) {
      qb.andWhere('p.billing_period_start >= :start', { start: `${query.periodStart}-01` });
    }
    if (query.periodEnd) {
      qb.andWhere('p.billing_period_end <= :end', { end: `${query.periodEnd}-31` });
    }

    qb.orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  // ──────────────────────────────────────────────
  // 결제 상세
  // ──────────────────────────────────────────────
  async findOne(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('결제 내역을 찾을 수 없습니다.');
    return payment;
  }

  // ──────────────────────────────────────────────
  // 환불 처리
  // ──────────────────────────────────────────────
  async refund(paymentId: string, dto: RefundDto, actor: AdminJwtPayload): Promise<Payment> {
    const payment = await this.findOne(paymentId);

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('완료된 결제만 환불 가능합니다.');
    }

    if (payment.refundableUntil && payment.refundableUntil < new Date()) {
      throw new BadRequestException('환불 가능 기간이 지났습니다.');
    }

    const refundAmount = dto.amount ?? payment.totalAmountKrw;
    const alreadyRefunded = payment.refundedAmountKrw ?? 0;

    if (refundAmount + alreadyRefunded > payment.totalAmountKrw) {
      throw new BadRequestException('환불 금액이 결제 금액을 초과합니다.');
    }

    if (!payment.pgTransactionId) {
      throw new BadRequestException('PG 거래 ID가 없어 자동 환불이 불가합니다.');
    }

    const result = await this.tossPaymentsService.refund({
      paymentKey: payment.pgTransactionId,
      cancelReason: dto.reason,
      cancelAmount: dto.type === 'partial' ? refundAmount : undefined,
    });

    const isFullRefund = refundAmount + alreadyRefunded >= payment.totalAmountKrw;

    await this.paymentRepository.update(paymentId, {
      status: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIAL_REFUNDED,
      refundedAmountKrw: alreadyRefunded + refundAmount,
      refundedAt: new Date(),
      refundReason: dto.reason,
      refundType: dto.type,
      refundPgTransactionId: result.transactionId,
    });

    return this.findOne(paymentId);
  }

  // ──────────────────────────────────────────────
  // 월별 결제 통계
  // ──────────────────────────────────────────────
  async getMonthlySummary(year: number, month: number) {
    const periodStr = `${year}-${String(month).padStart(2, '0')}`;
    const result = await this.paymentRepository
      .createQueryBuilder('p')
      .select([
        'COUNT(*) FILTER (WHERE p.status = \'completed\') AS completed_count',
        'COUNT(*) FILTER (WHERE p.status = \'failed\') AS failed_count',
        'SUM(p.total_amount_krw) FILTER (WHERE p.status = \'completed\') AS total_revenue_krw',
        'SUM(p.refunded_amount_krw) AS total_refunded_krw',
      ])
      .where(`TO_CHAR(p.created_at, 'YYYY-MM') = :period`, { period: periodStr })
      .getRawOne();

    return result;
  }
}
