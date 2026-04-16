import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, IsNull, Between, DataSource } from 'typeorm';
import { CareLicense } from '../../database/entities/care-license.entity';
import { CareSession } from '../../database/entities/care-session.entity';
import { Company } from '../../database/entities/company.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateCareLicenseDto, UpdateCareLicenseDto, LicenseQueryDto,
  StartCareSessionDto, EndCareSessionDto, CareSessionQueryDto,
  HolidayPayQueryDto, UpdateCareWorkerSettingsDto,
} from './dto/care-worker.dto';
import { isHolidayForPay } from './korean-holidays.constant';

function kstDateString(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** 두 시각 사이에 야간(22:00~06:00 KST) 분이 몇 분인지 계산 */
function nightMinutesBetween(start: Date, end: Date): number {
  const totalMin = Math.min(Math.round((end.getTime() - start.getTime()) / 60000), 48 * 60);
  let night = 0;
  const t = new Date(start);
  for (let i = 0; i < totalMin; i++) {
    const h = (t.getUTCHours() + 9) % 24;
    if (h >= 22 || h < 6) night++;
    t.setTime(t.getTime() + 60000);
  }
  return night;
}

@Injectable()
export class CareWorkerService {
  constructor(
    @InjectRepository(CareLicense)
    private readonly licenseRepo: Repository<CareLicense>,
    @InjectRepository(CareSession)
    private readonly sessionRepo: Repository<CareSession>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly notificationsService: NotificationsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ──────────────────────────────────────────────────────────────
  // 플랜 게이트: care-worker 기능은 Pro 이상 필요
  // ──────────────────────────────────────────────────────────────
  private async assertProPlan(companyId: string): Promise<void> {
    const [sub] = await this.dataSource.query(`
      SELECT p.name FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.company_id = $1 AND s.status IN ('active', 'trialing')
    `, [companyId]);
    const planName: string = sub?.name ?? 'free';
    if (planName !== 'pro' && planName !== 'enterprise') {
      throw new ForbiddenException(
        '돌봄·의료 관리 기능은 Pro 플랜 이상에서 사용할 수 있습니다.',
      );
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 자격증/면허 관리
  // ──────────────────────────────────────────────────────────────

  async createLicense(user: AuthenticatedUser, dto: CreateCareLicenseDto, targetUserId?: string) {
    await this.assertProPlan(user.companyId);
    const userId = targetUserId ?? user.id;
    if (userId !== user.id && user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('본인 자격증만 등록할 수 있습니다.');
    }
    const license = this.licenseRepo.create({
      companyId:     user.companyId,
      userId,
      type:          dto.type,
      licenseNumber: dto.licenseNumber ?? null,
      label:         dto.label ?? null,
      issuedAt:      dto.issuedAt ?? null,
      expiresAt:     dto.expiresAt ?? null,
      issuer:        dto.issuer ?? null,
      fileUrl:       dto.fileUrl ?? null,
    });
    return this.licenseRepo.save(license);
  }

  async listLicenses(user: AuthenticatedUser, query: LicenseQueryDto) {
    await this.assertProPlan(user.companyId);
    const userId = query.userId ?? user.id;
    if (userId !== user.id && user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('본인 자격증만 조회할 수 있습니다.');
    }

    const qb = this.licenseRepo.createQueryBuilder('l')
      .leftJoinAndSelect('l.user', 'u')
      .where('l.company_id = :cid', { cid: user.companyId })
      .andWhere('l.user_id = :uid', { uid: userId })
      .andWhere('l.deleted_at IS NULL');

    if (query.expiringWithinDays) {
      const limit = new Date();
      limit.setDate(limit.getDate() + query.expiringWithinDays);
      const limitStr = kstDateString(limit);
      const today    = kstDateString();
      qb.andWhere('l.expires_at IS NOT NULL')
        .andWhere('l.expires_at >= :today', { today })
        .andWhere('l.expires_at <= :limit', { limit: limitStr });
    }

    return qb.orderBy('l.expires_at', 'ASC', 'NULLS LAST').getMany();
  }

  async updateLicense(user: AuthenticatedUser, id: string, dto: UpdateCareLicenseDto) {
    const license = await this.licenseRepo.findOne({
      where: { id, companyId: user.companyId },
    });
    if (!license) throw new NotFoundException('자격증을 찾을 수 없습니다.');
    if (license.userId !== user.id && user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException();
    }
    Object.assign(license, dto);
    return this.licenseRepo.save(license);
  }

  async deleteLicense(user: AuthenticatedUser, id: string) {
    const license = await this.licenseRepo.findOne({
      where: { id, companyId: user.companyId },
    });
    if (!license) throw new NotFoundException('자격증을 찾을 수 없습니다.');
    await this.licenseRepo.softDelete(id);
    return { success: true };
  }

  /** 만료 임박 자격증 전체 조회 (관리자용 대시보드) */
  async getExpiringLicenses(user: AuthenticatedUser, days = 30) {
    const today  = kstDateString();
    const limit  = kstDateString(new Date(Date.now() + days * 86400000));
    return this.licenseRepo.createQueryBuilder('l')
      .leftJoinAndSelect('l.user', 'u')
      .where('l.company_id = :cid', { cid: user.companyId })
      .andWhere('l.deleted_at IS NULL')
      .andWhere('l.expires_at IS NOT NULL')
      .andWhere('l.expires_at >= :today', { today })
      .andWhere('l.expires_at <= :limit', { limit })
      .orderBy('l.expires_at', 'ASC')
      .getMany();
  }

  // ──────────────────────────────────────────────────────────────
  // 돌봄 세션
  // ──────────────────────────────────────────────────────────────

  async startSession(user: AuthenticatedUser, dto: StartCareSessionDto) {
    await this.assertProPlan(user.companyId);
    // 진행 중인 동일 수급자 세션 있으면 거부
    if (dto.recipientId) {
      const open = await this.sessionRepo.findOne({
        where: {
          userId: user.id,
          recipientId: dto.recipientId,
          endedAt: IsNull(),
        },
      });
      if (open) throw new BadRequestException('해당 수급자의 진행 중인 세션이 있습니다. 먼저 종료해주세요.');
    }

    const sessionDate = dto.sessionDate ?? kstDateString();
    const isHoliday   = isHolidayForPay(sessionDate);

    const session = this.sessionRepo.create({
      companyId:           user.companyId,
      userId:              user.id,
      sessionDate,
      type:                dto.type,
      recipientName:       dto.recipientName,
      recipientId:         dto.recipientId ?? null,
      voucherCode:         dto.voucherCode ?? null,
      startedAt:           new Date(),
      isHoliday,
      attendanceRecordId:  dto.attendanceRecordId ?? null,
    });
    return this.sessionRepo.save(session);
  }

  async endSession(user: AuthenticatedUser, sessionId: string, dto: EndCareSessionDto) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) throw new NotFoundException('세션을 찾을 수 없습니다.');
    if (session.endedAt) throw new BadRequestException('이미 종료된 세션입니다.');

    const now = new Date();
    session.endedAt    = now;
    session.durationMin = Math.round((now.getTime() - session.startedAt.getTime()) / 60000);
    session.note       = dto.note ?? null;

    // 야간 포함 여부
    const nightMin = nightMinutesBetween(session.startedAt, now);
    session.hasNightHours = nightMin > 0;

    // 가산 배율 결정 (회사 설정 조회)
    const company = await this.companyRepo.findOne({
      where: { id: user.companyId },
      select: ['careHolidayPayRate', 'nightPayRate'],
    });
    const nightRate   = Number(company?.nightPayRate   ?? 1.5);
    const holidayRate = Number(company?.careHolidayPayRate ?? 1.5);

    if (session.isHoliday && session.hasNightHours) {
      session.payRate = Math.max(nightRate, holidayRate); // 중복 시 높은 배율 적용
    } else if (session.isHoliday) {
      session.payRate = holidayRate;
    } else if (session.hasNightHours) {
      session.payRate = nightRate;
    } else {
      session.payRate = 1.00;
    }

    return this.sessionRepo.save(session);
  }

  async getSessions(user: AuthenticatedUser, query: CareSessionQueryDto) {
    const userId = query.userId ?? user.id;
    if (userId !== user.id && user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('본인 기록만 조회할 수 있습니다.');
    }

    const qb = this.sessionRepo.createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .where('s.company_id = :cid', { cid: user.companyId })
      .andWhere('s.user_id = :uid', { uid: userId });

    if (query.date) {
      qb.andWhere('s.session_date = :date', { date: query.date });
    } else {
      if (query.startDate) qb.andWhere('s.session_date >= :sd', { sd: query.startDate });
      if (query.endDate)   qb.andWhere('s.session_date <= :ed', { ed: query.endDate });
    }
    if (query.recipientId) qb.andWhere('s.recipient_id = :rid', { rid: query.recipientId });

    return qb.orderBy('s.started_at', 'DESC').getMany();
  }

  /** 일별 세션 요약 */
  async getDailySummary(user: AuthenticatedUser, userId: string, date: string) {
    if (userId !== user.id && user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException();
    }
    const sessions = await this.sessionRepo.find({
      where: { companyId: user.companyId, userId, sessionDate: date },
      order: { startedAt: 'ASC' },
    });

    const totalMin    = sessions.reduce((s, r) => s + (r.durationMin ?? 0), 0);
    const recipients  = [...new Set(sessions.map(s => s.recipientName))];
    const nightSessions = sessions.filter(s => s.hasNightHours).length;
    const holidaySessions = sessions.filter(s => s.isHoliday).length;

    return { date, userId, sessions, totalMin, recipientCount: recipients.length, nightSessions, holidaySessions };
  }

  // ──────────────────────────────────────────────────────────────
  // 가산수당 계산 (기간별)
  // ──────────────────────────────────────────────────────────────

  async getHolidayPayReport(user: AuthenticatedUser, query: HolidayPayQueryDto) {
    const userId = query.userId ?? user.id;
    if (userId !== user.id && user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException();
    }

    const sessions = await this.sessionRepo.find({
      where: {
        companyId:   user.companyId,
        userId,
        sessionDate: Between(query.startDate, query.endDate),
      },
      order: { sessionDate: 'ASC' },
    });

    const regular  = sessions.filter(s => !s.isHoliday && !s.hasNightHours);
    const night    = sessions.filter(s => s.hasNightHours && !s.isHoliday);
    const holiday  = sessions.filter(s => s.isHoliday && !s.hasNightHours);
    const combined = sessions.filter(s => s.isHoliday && s.hasNightHours);

    const sum = (arr: CareSession[]) => arr.reduce((a, s) => a + (s.durationMin ?? 0), 0);

    return {
      period:       { startDate: query.startDate, endDate: query.endDate },
      userId,
      totalSessions: sessions.length,
      regular:       { count: regular.length,  totalMin: sum(regular),  payRate: 1.0  },
      night:         { count: night.length,    totalMin: sum(night),    payRate: sessions[0]?.payRate ?? 1.5 },
      holiday:       { count: holiday.length,  totalMin: sum(holiday),  payRate: sessions[0]?.payRate ?? 1.5 },
      combined:      { count: combined.length, totalMin: sum(combined), payRate: Math.max(...combined.map(s => Number(s.payRate)), 1.5) },
      sessions,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // 누적 피로도 (주간 근무시간)
  // ──────────────────────────────────────────────────────────────

  async getFatigueStatus(user: AuthenticatedUser, userId?: string) {
    const uid = userId ?? user.id;
    if (uid !== user.id && user.role === UserRole.EMPLOYEE) throw new ForbiddenException();

    const company = await this.companyRepo.findOne({
      where: { id: user.companyId },
      select: ['careFatigueThresholdHours'],
    });
    const threshold = company?.careFatigueThresholdHours ?? 52;

    // 이번 주 월요일 ~ 오늘
    const today = new Date();
    const dow   = today.getDay(); // 0=일
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    const startDate = kstDateString(monday);
    const endDate   = kstDateString(today);

    const sessions = await this.sessionRepo.find({
      where: { companyId: user.companyId, userId: uid, sessionDate: Between(startDate, endDate) },
    });
    const weeklyMin   = sessions.reduce((s, r) => s + (r.durationMin ?? 0), 0);
    const weeklyHours = Math.round((weeklyMin / 60) * 10) / 10;

    return {
      userId:   uid,
      weeklyHours,
      threshold,
      isOverThreshold: weeklyHours >= threshold,
      period:   { startDate, endDate },
    };
  }

  // ──────────────────────────────────────────────────────────────
  // 설정
  // ──────────────────────────────────────────────────────────────

  async updateSettings(user: AuthenticatedUser, dto: UpdateCareWorkerSettingsDto) {
    if (user.role !== UserRole.OWNER) throw new ForbiddenException('소유자만 설정을 변경할 수 있습니다.');
    const update: Partial<Company> = {};
    if (dto.careHolidayPayRate        !== undefined) update.careHolidayPayRate        = dto.careHolidayPayRate;
    if (dto.careFatigueThresholdHours !== undefined) update.careFatigueThresholdHours = dto.careFatigueThresholdHours;
    if (dto.careLicenseWarnDays       !== undefined) update.careLicenseWarnDays       = dto.careLicenseWarnDays;
    await this.companyRepo.update(user.companyId, update);
    return { success: true };
  }
}
