import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { VacationBalance } from '../../database/entities/vacation-balance.entity';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../../common/types/jwt-payload.type';

/**
 * 연가 소진 강제화 알림 서비스 (공공기관 특화)
 *
 * 실행 일정:
 *   - 11월 1일 09:00 KST  — 연말 D-60 사전 경고
 *   - 12월 1일 09:00 KST  — 연말 D-30 경고
 *   - 12월 15일 09:00 KST — 연말 D-15 최종 경고
 *
 * annualLeaveForceEnabled = true 인 회사만 발송
 * 잔여 연가 ≥ annualLeaveForceThreshold(기본 5) 인 직원에게 알림
 */
@Injectable()
export class VacationLeaveAlertService {
  private readonly logger = new Logger(VacationLeaveAlertService.name);

  constructor(
    @InjectRepository(VacationBalance) private balanceRepo: Repository<VacationBalance>,
    @InjectRepository(User)            private userRepo: Repository<User>,
    @InjectRepository(Company)         private companyRepo: Repository<Company>,
    private notificationsService: NotificationsService,
  ) {}

  /** 11월 1일 09:00 KST (UTC 00:00) */
  @Cron('0 0 1 11 *')
  async alertNovember() {
    await this.sendAnnualLeaveAlerts('D-60 연말 경고', 60);
  }

  /** 12월 1일 09:00 KST */
  @Cron('0 0 1 12 *')
  async alertDecember1() {
    await this.sendAnnualLeaveAlerts('D-30 연말 경고', 30);
  }

  /** 12월 15일 09:00 KST */
  @Cron('0 0 15 12 *')
  async alertDecember15() {
    await this.sendAnnualLeaveAlerts('D-15 최종 경고', 15);
  }

  private async sendAnnualLeaveAlerts(phase: string, daysLeft: number): Promise<void> {
    const year = new Date().getFullYear();

    // annualLeaveForceEnabled 회사만 처리
    const companies = await this.companyRepo.find({
      where: { annualLeaveForceEnabled: true, deletedAt: IsNull() } as any,
      select: ['id', 'annualLeaveForceThreshold'] as any,
    });

    for (const company of companies) {
      const threshold = (company as any).annualLeaveForceThreshold ?? 5;

      // 해당 회사 직원의 연가 잔액 조회
      const balances = await this.balanceRepo.find({
        where: { companyId: company.id, year },
        relations: ['user'],
      });

      // 관리자(owner/manager) 목록 — 부하 직원 알림용
      const managers = await this.userRepo.find({
        where: { companyId: company.id, deletedAt: IsNull() } as any,
        select: ['id', 'role'] as any,
      }).then(us => us.filter(u => [UserRole.OWNER, UserRole.MANAGER].includes((u as any).role)));

      for (const bal of balances) {
        const remaining = Math.max(0,
          Number(bal.totalDays) + Number(bal.adjustDays) - Number(bal.usedDays),
        );
        if (remaining < threshold) continue; // 이미 충분히 사용

        const user = bal.user;
        if (!user || (user as any).deletedAt) continue;

        const body = `연말까지 ${daysLeft}일 남았습니다. 잔여 연차 ${remaining}일을 소진해 주세요.`;

        // 직원 본인 알림
        try {
          await this.notificationsService.dispatch({
            userId:    user.id,
            companyId: company.id,
            type:      'annual_leave_expiry_warning',
            title:     `연차 소진 독촉 [${phase}]`,
            body,
          });
        } catch (err) {
          this.logger.warn(`연차 알림 실패 userId=${user.id}: ${err}`);
        }

        // 관리자에게도 알림 (직원명 포함)
        for (const mgr of managers) {
          try {
            await this.notificationsService.dispatch({
              userId:    mgr.id,
              companyId: company.id,
              type:      'annual_leave_expiry_warning',
              title:     `연차 소진 독촉 [${phase}]`,
              body:      `${(user as any).name} 직원의 잔여 연차가 ${remaining}일 남아있습니다. (연말 D-${daysLeft})`,
            });
          } catch { /* 관리자 알림 실패는 무시 */ }
        }
      }
    }

    this.logger.log(`연가 소진 알림 완료 [${phase}] year=${year}`);
  }
}
