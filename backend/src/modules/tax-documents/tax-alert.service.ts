import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addDays, differenceInDays, format } from 'date-fns';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../../common/types/jwt-payload.type';

// 세무 마감일 (월, 일) 목록
const TAX_DEADLINES = [
  { month: 1,  day: 25, title: '부가세 확정신고 마감', body: '전년 7~12월 부가가치세 확정신고납부 기한 D-{d}일입니다.' },
  { month: 3,  day: 10, title: '연말정산 자료 제출 마감', body: '근로소득 연말정산 원천징수이행상황신고 기한 D-{d}일입니다.' },
  { month: 3,  day: 31, title: '법인세 신고 마감', body: '전년도 법인세 신고납부 기한 D-{d}일입니다.' },
  { month: 4,  day: 25, title: '부가세 예정신고 마감', body: '1기 부가가치세 예정신고납부 기한 D-{d}일입니다.' },
  { month: 5,  day: 31, title: '종합소득세 신고 마감', body: '전년도 종합소득세 신고납부 기한 D-{d}일입니다.' },
  { month: 7,  day: 25, title: '부가세 확정신고 마감', body: '1기 부가가치세 확정신고납부 기한 D-{d}일입니다.' },
  { month: 10, day: 25, title: '부가세 예정신고 마감', body: '2기 부가가치세 예정신고납부 기한 D-{d}일입니다.' },
];

@Injectable()
export class TaxAlertService {
  private readonly logger = new Logger(TaxAlertService.name);

  constructor(
    @InjectRepository(User)    private userRepo: Repository<User>,
    @InjectRepository(Company) private companyRepo: Repository<Company>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── 매일 오전 9시: 세무 마감 D-7, D-3 알림 ──────────────
  @Cron('0 9 * * *')
  async checkTaxDeadlines() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const year = now.getFullYear();

    for (const deadline of TAX_DEADLINES) {
      const dueDate = new Date(year, deadline.month - 1, deadline.day);
      const daysLeft = differenceInDays(dueDate, today);

      // D-7 또는 D-3에만 발송
      if (daysLeft !== 7 && daysLeft !== 3) continue;

      await this.notifyAllOwners(
        deadline.title,
        deadline.body.replace('{d}', String(daysLeft)),
        'tax_deadline',
        `/tax-documents`,
      );
    }

    // 원천세: 매월 10일 → D-5(5일), D-3(3일)에 알림
    const withholdingDue = new Date(year, now.getMonth(), 10);
    const withholdingDaysLeft = differenceInDays(withholdingDue, today);
    if (withholdingDaysLeft === 5 || withholdingDaysLeft === 3) {
      await this.notifyAllOwners(
        `${now.getMonth() + 1}월 원천세·4대보험 납부 D-${withholdingDaysLeft}`,
        `원천세 신고납부 및 4대보험료 납부 기한이 ${withholdingDaysLeft}일 남았습니다.`,
        'tax_deadline',
        `/tax-documents`,
      );
    }
  }

  // ── 매월 1일 오전 8시: 노무 이벤트 점검 ─────────────────
  @Cron('0 8 1 * *')
  async checkLaborEvents() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 입사 후 14일이 지났는데 4대보험 취득신고 알림 발송
    // (간단히: joinedAt이 13~14일 전인 직원 목록 → 해당 회사 owner에게 알림)
    const newHires = await this.userRepo
      .createQueryBuilder('u')
      .where('u.joined_at BETWEEN :from AND :to', {
        from: format(addDays(today, -14), 'yyyy-MM-dd'),
        to:   format(addDays(today, -13), 'yyyy-MM-dd'),
      })
      .getMany();

    for (const hire of newHires) {
      await this.notifyCompanyOwners(
        hire.companyId,
        `${hire.name} 4대보험 취득신고 기한 임박`,
        `${hire.name} 직원의 4대보험 취득신고 기한(입사 14일 이내)이 내일까지입니다.`,
        'labor_event',
        `/tax-documents?tab=insurance&userId=${hire.id}`,
      );
    }

    // 연차 소멸 30일 전 알림 (입사 기념일 기준)
    const allUsers = await this.userRepo.find({ select: ['id', 'name', 'companyId', 'joinedAt'] });
    for (const u of allUsers) {
      if (!u.joinedAt) continue;
      const joined = new Date(u.joinedAt);
      const anniversary = new Date(now.getFullYear(), joined.getMonth(), joined.getDate());
      if (anniversary < today) anniversary.setFullYear(now.getFullYear() + 1);
      const daysLeft = differenceInDays(anniversary, today);
      if (daysLeft === 30) {
        await this.notifyCompanyOwners(
          u.companyId,
          `${u.name} 연차 소멸 D-30`,
          `${u.name} 직원의 미사용 연차가 30일 후(${format(anniversary, 'M월 d일')}) 소멸됩니다.`,
          'labor_event',
          `/vacations`,
        );
      }
    }

    this.logger.log(`Labor events check completed`);
  }

  // ── 매년 1월 1일: 최저시급 인상 안내 ──────────────────────
  @Cron('0 9 1 1 *')
  async checkMinWageIncrease() {
    await this.notifyAllOwners(
      '새해 최저시급 적용 확인 필요',
      '올해부터 적용되는 최저시급을 확인하고 직원 급여에 반영해 주세요.',
      'labor_event',
      '/salary',
    );
    this.logger.log('Min wage increase notification sent');
  }

  // ─── 헬퍼: 전체 사업주에게 알림 ──────────────────────────
  private async notifyAllOwners(
    title: string,
    body: string,
    type: 'tax_deadline' | 'labor_event',
    actionUrl: string,
  ) {
    const owners = await this.userRepo.find({
      where: { role: UserRole.OWNER },
      select: ['id', 'companyId', 'email', 'name'],
    });

    for (const owner of owners) {
      await this.notificationsService.dispatch({
        userId: owner.id,
        companyId: owner.companyId,
        type: type as any,
        title,
        body,
      }).catch((e) => this.logger.warn(`알림 발송 실패 ${owner.id}: ${e.message}`));
    }
    this.logger.log(`Tax/labor alert sent to ${owners.length} owners: ${title}`);
  }

  // ─── 헬퍼: 특정 회사 사업주에게 알림 ────────────────────
  private async notifyCompanyOwners(
    companyId: string,
    title: string,
    body: string,
    type: 'tax_deadline' | 'labor_event',
    actionUrl: string,
  ) {
    const owners = await this.userRepo.find({
      where: { companyId, role: UserRole.OWNER },
      select: ['id', 'companyId'],
    });

    for (const owner of owners) {
      await this.notificationsService.dispatch({
        userId: owner.id,
        companyId,
        type: type as any,
        title,
        body,
      }).catch((e) => this.logger.warn(`알림 발송 실패 ${owner.id}: ${e.message}`));
    }
  }
}
