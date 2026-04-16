import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CareLicense } from '../../database/entities/care-license.entity';
import { Company } from '../../database/entities/company.entity';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * 자격증 만료 임박 + 누적 피로도 경고 Cron
 */
@Injectable()
export class CareLicenseCronService {
  constructor(
    @InjectRepository(CareLicense)
    private readonly licenseRepo: Repository<CareLicense>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** 매일 09:00 KST (00:00 UTC) — 자격증 만료 임박 알림 */
  @Cron('0 0 * * *', { timeZone: 'UTC' })
  async checkLicenseExpiry() {
    const today = new Date();

    // 회사별 경고 설정 로드
    const companies = await this.companyRepo.find({
      where: { deletedAt: IsNull() },
      select: ['id', 'careLicenseWarnDays'],
    });

    for (const company of companies) {
      const warnDays = company.careLicenseWarnDays ?? 30;
      const limitDate = new Date(today);
      limitDate.setDate(limitDate.getDate() + warnDays);

      const todayStr  = today.toISOString().slice(0, 10);
      const limitStr  = limitDate.toISOString().slice(0, 10);

      // 만료일이 [오늘 ~ warnDays일 후] 이고 아직 경고 미발송이거나 30일 이상 전에 발송된 것
      const licenses = await this.licenseRepo
        .createQueryBuilder('l')
        .where('l.company_id = :cid', { cid: company.id })
        .andWhere('l.deleted_at IS NULL')
        .andWhere('l.is_active = TRUE')
        .andWhere('l.expires_at IS NOT NULL')
        .andWhere('l.expires_at >= :today', { today: todayStr })
        .andWhere('l.expires_at <= :limit', { limit: limitStr })
        .andWhere(
          `(l.expiry_warned_at IS NULL OR l.expiry_warned_at < NOW() - INTERVAL '25 days')`,
        )
        .getMany();

      for (const lic of licenses) {
        const daysLeft = Math.ceil(
          (new Date(lic.expiresAt!).getTime() - today.getTime()) / 86400000,
        );
        const typeLabel = lic.label ?? lic.type;

        await this.notificationsService.dispatch({
          companyId: company.id,
          userId:    lic.userId,
          type:      'care_license_expiring',
          title:     '자격증 만료 임박',
          body:      `${typeLabel} 자격증이 ${daysLeft}일 후 만료됩니다. 갱신을 확인해주세요.`,
          refId:     lic.id,
          refType:   'care_license',
        });

        // 경고 발송 시각 기록 (중복 방지)
        await this.licenseRepo.update(lic.id, { expiryWarnedAt: new Date() });
      }
    }
  }
}
