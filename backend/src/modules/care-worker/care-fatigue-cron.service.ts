import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CareSession } from '../../database/entities/care-session.entity';
import { Company } from '../../database/entities/company.entity';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * 주간 누적 피로도 경고 Cron — 매주 월요일 09:00 KST
 * 전 주 세션 총 시간이 임계값 초과 시 해당 직원 + 관리자에게 알림
 */
@Injectable()
export class CareFatigueCronService {
  constructor(
    @InjectRepository(CareSession)
    private readonly sessionRepo: Repository<CareSession>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** 매주 월요일 00:00 UTC = 09:00 KST */
  @Cron('0 0 * * 1', { timeZone: 'UTC' })
  async checkWeeklyFatigue() {
    // 지난 주 월~일 (전 주)
    const today   = new Date();
    const lastMon = new Date(today);
    lastMon.setDate(today.getDate() - 7);
    const lastSun = new Date(today);
    lastSun.setDate(today.getDate() - 1);

    const startDate = lastMon.toISOString().slice(0, 10);
    const endDate   = lastSun.toISOString().slice(0, 10);

    const companies = await this.companyRepo.find({
      where: { deletedAt: IsNull() },
      select: ['id', 'careFatigueThresholdHours'],
    });

    for (const company of companies) {
      const threshold = (company.careFatigueThresholdHours ?? 52) * 60; // 분 단위

      const rows: { userId: string; totalMin: string }[] = await this.sessionRepo
        .createQueryBuilder('s')
        .select('s.user_id', 'userId')
        .addSelect('SUM(s.duration_min)', 'totalMin')
        .where('s.company_id = :cid', { cid: company.id })
        .andWhere('s.session_date >= :sd', { sd: startDate })
        .andWhere('s.session_date <= :ed', { ed: endDate })
        .andWhere('s.ended_at IS NOT NULL')
        .groupBy('s.user_id')
        .getRawMany();

      for (const row of rows) {
        const totalMin = parseInt(row.totalMin, 10);
        if (totalMin < threshold) continue;

        const hours = Math.round((totalMin / 60) * 10) / 10;
        await this.notificationsService.dispatch({
          companyId: company.id,
          userId:    row.userId,
          type:      'care_fatigue_warning',
          title:     '누적 피로도 경고',
          body:      `지난 주 누적 돌봄·근무 ${hours}시간으로 기준(${company.careFatigueThresholdHours}h)을 초과했습니다. 충분한 휴식이 필요합니다.`,
          refType:   'care_session',
        });
      }
    }
  }
}
