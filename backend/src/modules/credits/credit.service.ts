import {
  Injectable, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Credit, CreditTransaction } from '../../database/entities/credit.entity';

export const CREDIT_COSTS = {
  OCR:         2,  // 이미지 1장 → 텍스트
  AI_CLASSIFY: 1,  // AI 업무 분류
  AI_ANALYZE:  3,  // AI 계약서 분석
  AI_REPORT:   3,  // AI 보고서 초안
} as const;

// 개인 일일 최대 사용 크레딧
const DAILY_USER_LIMIT = 20;

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(
    @InjectRepository(Credit) private creditRepo: Repository<Credit>,
    @InjectRepository(CreditTransaction) private txRepo: Repository<CreditTransaction>,
    private dataSource: DataSource,
  ) {}

  // ─── 잔액 조회 ─────────────────────────────────────
  async getBalance(companyId: string): Promise<{ balance: number; monthlyGrant: number; lastGrantAt: Date | null }> {
    let credit = await this.creditRepo.findOne({ where: { companyId } });
    if (!credit) {
      credit = await this.creditRepo.save(this.creditRepo.create({ companyId, balance: 20, monthlyGrant: 20 }));
    }
    return { balance: credit.balance, monthlyGrant: credit.monthlyGrant, lastGrantAt: credit.lastGrantAt };
  }

  // ─── 크레딧 차감 ────────────────────────────────────
  async deduct(
    companyId: string,
    userId: string,
    amount: number,
    type: string,
    description: string,
    refId?: string,
  ): Promise<void> {
    // 일일 개인 사용량 체크
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUsed = await this.txRepo
      .createQueryBuilder('t')
      .select('SUM(ABS(t.amount))', 'total')
      .where('t.company_id = :cid AND t.user_id = :uid AND t.amount < 0 AND t.created_at >= :today', {
        cid: companyId, uid: userId, today,
      })
      .getRawOne();
    const usedToday = parseInt(todayUsed?.total ?? '0') || 0;
    if (usedToday + amount > DAILY_USER_LIMIT) {
      throw new BadRequestException(
        `일일 크레딧 사용 한도(${DAILY_USER_LIMIT}크레딧)를 초과했습니다. (오늘 사용: ${usedToday}크레딧)`,
      );
    }

    // 트랜잭션으로 잔액 차감
    await this.dataSource.transaction(async (em) => {
      const credit = await em.findOne(Credit, { where: { companyId }, lock: { mode: 'pessimistic_write' } });
      if (!credit) throw new BadRequestException('크레딧 정보가 없습니다.');
      if (credit.balance < amount) {
        throw new BadRequestException(`크레딧이 부족합니다. 현재 잔액: ${credit.balance}크레딧, 필요: ${amount}크레딧`);
      }
      credit.balance -= amount;
      await em.save(credit);

      const tx = em.create(CreditTransaction, {
        companyId, userId,
        amount: -amount,
        balanceAfter: credit.balance,
        type, description,
        refId: refId ?? null,
      });
      await em.save(tx);
    });
  }

  // ─── 크레딧 충전 (구매/수동) ────────────────────────
  async charge(
    companyId: string,
    amount: number,
    type: 'purchase' | 'manual_adjust' | 'monthly_grant',
    description: string,
    userId?: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      let credit = await em.findOne(Credit, { where: { companyId }, lock: { mode: 'pessimistic_write' } });
      if (!credit) {
        credit = em.create(Credit, { companyId, balance: 0, monthlyGrant: 20 });
      }
      credit.balance += amount;
      if (type === 'monthly_grant') credit.lastGrantAt = new Date();
      await em.save(credit);

      const tx = em.create(CreditTransaction, {
        companyId,
        userId: userId ?? null,
        amount,
        balanceAfter: credit.balance,
        type, description,
      });
      await em.save(tx);
    });
  }

  // ─── 이력 조회 ─────────────────────────────────────
  async getHistory(companyId: string, limit = 50) {
    return this.txRepo.find({
      where: { companyId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ─── 크레딧 패키지 목록 ─────────────────────────────
  getCreditPackages() {
    return [
      { id: 'pack_10',  credits: 10,  priceKrw: 1000,  label: '10 크레딧',  perUnit: '₩100/크레딧' },
      { id: 'pack_50',  credits: 50,  priceKrw: 4500,  label: '50 크레딧',  perUnit: '₩90/크레딧', badge: '10% 할인' },
      { id: 'pack_200', credits: 200, priceKrw: 16000, label: '200 크레딧', perUnit: '₩80/크레딧', badge: '20% 할인' },
    ];
  }

  // ─── 월 크레딧 자동 지급 (매월 1일 9시) ─────────────
  @Cron('0 9 1 * *')
  async grantMonthlyCredits() {
    this.logger.log('월 크레딧 자동 지급 시작');
    const credits = await this.creditRepo.find();
    for (const c of credits) {
      await this.charge(
        c.companyId, c.monthlyGrant,
        'monthly_grant', `월 무료 크레딧 ${c.monthlyGrant}크레딧 지급`,
      );
    }
    this.logger.log(`${credits.length}개 회사에 월 크레딧 지급 완료`);
  }
}
