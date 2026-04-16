import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { format } from 'date-fns';
import { ShiftSchedule } from '../../database/entities/shift-schedule.entity';
import { User } from '../../database/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * 근무표 미작성 알림 Cron
 * - 주간: 토요일(D-2), 일요일(D-1) — 다음 주 근무표 미작성 시 관리자 알림
 * - 월간: 월말 2일 전, 1일 전 — 다음 달 첫 주 근무표 미작성 시 관리자 알림
 * 대상: 최근 60일 내 근무표 활동이 있는 회사 (비활성 회사 스팸 방지)
 */
@Injectable()
export class ShiftReminderCronService {
  private readonly logger = new Logger(ShiftReminderCronService.name);

  constructor(
    @InjectRepository(ShiftSchedule) private schedRepo: Repository<ShiftSchedule>,
    @InjectRepository(User)          private userRepo:  Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  @Cron('0 0 * * *', { name: 'shift-schedule-reminder', timeZone: 'UTC' }) // 09:00 KST
  async checkMissingSchedules() {
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const dow        = nowKst.getDay();      // 0=일, 6=토
    const dayOfMonth = nowKst.getDate();
    const daysInMonth = new Date(nowKst.getFullYear(), nowKst.getMonth() + 1, 0).getDate();

    // 주간 알림 (토=D-2, 일=D-1)
    if (dow === 6 || dow === 0) {
      const daysToMonday = dow === 6 ? 2 : 1;
      const nextMonday   = new Date(nowKst);
      nextMonday.setDate(nowKst.getDate() + daysToMonday);
      const nextMondayStr = nextMonday.toISOString().slice(0, 10);
      await this.notifyWeekly(nextMondayStr, daysToMonday);
    }

    // 월간 알림 (월말 2일 전 또는 마지막 날)
    if (dayOfMonth === daysInMonth - 1 || dayOfMonth === daysInMonth) {
      const nextMonth    = new Date(nowKst.getFullYear(), nowKst.getMonth() + 1, 1);
      const nextMonthDow = nextMonth.getDay(); // 0=일, 1=월
      // 다음 달 첫 번째 월요일 계산
      const firstMonday  = new Date(nextMonth);
      if (nextMonthDow !== 1) {
        firstMonday.setDate(1 + (nextMonthDow === 0 ? 1 : 8 - nextMonthDow));
      }
      const firstMondayStr = firstMonday.toISOString().slice(0, 10);
      const daysLeft       = daysInMonth - dayOfMonth + 1;
      await this.notifyMonthly(firstMondayStr, daysLeft, nextMonth);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  private async notifyWeekly(nextMondayStr: string, daysLeft: number) {
    this.logger.log(`[ShiftReminder] 주간 확인 — 다음 월요일: ${nextMondayStr} (D-${daysLeft})`);
    const companies = await this.activeCompanies();

    for (const { companyId } of companies) {
      const exists = await this.schedRepo.findOne({ where: { companyId, weekStart: nextMondayStr } });
      if (exists) continue; // 이미 작성됨

      const body = daysLeft === 2
        ? `${nextMondayStr} 시작 주 근무표가 작성되지 않았습니다. 2일 후 새 주가 시작됩니다.`
        : `내일(월요일)부터 새 주가 시작됩니다. 근무표를 빠르게 작성해주세요.`;

      await this.dispatchToManagers(companyId, `다음 주 근무표 미작성 (D-${daysLeft})`, body);
    }
  }

  private async notifyMonthly(firstMondayStr: string, daysLeft: number, nextMonth: Date) {
    const label = `${nextMonth.getFullYear()}년 ${nextMonth.getMonth() + 1}월`;
    this.logger.log(`[ShiftReminder] 월간 확인 — ${label} 첫 주: ${firstMondayStr} (D-${daysLeft})`);
    const companies = await this.activeCompanies();

    for (const { companyId } of companies) {
      const exists = await this.schedRepo.findOne({ where: { companyId, weekStart: firstMondayStr } });
      if (exists) continue;

      await this.dispatchToManagers(
        companyId,
        `${label} 근무표 미작성 (D-${daysLeft})`,
        `${label} 첫 주 근무표가 아직 작성되지 않았습니다. 월이 시작되기 전에 작성해주세요.`,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  /** 최근 60일 내 근무표 활동이 있는 회사 목록 */
  private async activeCompanies(): Promise<{ companyId: string }[]> {
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const sinceStr = format(since, 'yyyy-MM-dd');

    return this.schedRepo
      .createQueryBuilder('s')
      .select('DISTINCT s.company_id', 'companyId')
      .where('s.week_start >= :since', { since: sinceStr })
      .getRawMany<{ companyId: string }>();
  }

  /** 해당 회사의 owner/manager 모두에게 알림 발송 */
  private async dispatchToManagers(companyId: string, title: string, body: string) {
    const managers = await this.userRepo
      .createQueryBuilder('u')
      .select('u.id')
      .where('u.company_id = :cid', { cid: companyId })
      .andWhere('u.deleted_at IS NULL')
      .andWhere('u.role IN (:...roles)', { roles: ['owner', 'manager'] })
      .getMany();

    if (!managers.length) return;

    await Promise.all(
      managers.map((m) =>
        this.notificationsService.dispatch({
          companyId,
          userId: m.id,
          type:   'schedule_missing_warning' as any,
          title,
          body,
        }).catch(() => {}),
      ),
    );

    this.logger.log(`[ShiftReminder] 회사 ${companyId}: 관리자 ${managers.length}명 알림 발송`);
  }
}
