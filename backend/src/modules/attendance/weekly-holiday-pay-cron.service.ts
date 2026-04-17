import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsService } from '../../common/sms/sms.service';

/**
 * 주휴수당 자동 발생 알림 Cron (파트타임/아르바이트 특화)
 *
 * 매주 월요일 09:00 KST 실행 — 직전 주 근무 시간 집계
 * 주 15시간 이상 근무한 직원에게 주휴수당 발생 알림
 *
 * 주휴수당 = 1일 평균 소정근로시간 × 시급 (근로기준법 제55조)
 * 조건: 소정근로일 개근 + 주 15h 이상
 */
@Injectable()
export class WeeklyHolidayPayCronService {
  private readonly logger = new Logger(WeeklyHolidayPayCronService.name);

  constructor(
    @InjectRepository(AttendanceRecord) private attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(User)             private userRepo:       Repository<User>,
    @InjectRepository(Company)          private companyRepo:    Repository<Company>,
    private notificationsService: NotificationsService,
    private smsService: SmsService,
  ) {}

  /** 매주 월요일 00:00 UTC = 09:00 KST */
  @Cron('0 0 * * 1', { name: 'weekly-holiday-pay', timeZone: 'UTC' })
  async checkWeeklyHolidayPay() {
    this.logger.log('[WeeklyHolidayPay Cron] 주휴수당 자동 계산 시작');

    // 직전 주 월~일 날짜 범위 (KST 기준, 현재 UTC 월요일 00시 = KST 월요일 09시)
    const now = new Date();
    const thisMon = new Date(now);
    thisMon.setDate(now.getDate()); // 오늘(UTC 월요일)
    thisMon.setHours(0, 0, 0, 0);
    const lastMon = new Date(thisMon);
    lastMon.setDate(thisMon.getDate() - 7);
    const lastSun = new Date(thisMon);
    lastSun.setDate(thisMon.getDate() - 1);

    const startDate = lastMon.toISOString().split('T')[0];
    const endDate   = lastSun.toISOString().split('T')[0];

    this.logger.log(`[WeeklyHolidayPay Cron] 대상 기간: ${startDate} ~ ${endDate}`);

    // 직전 주 모든 근태 기록 집계 (roundedWorkMinutes 사용)
    const records = await this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.work_date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('a.clock_in_at IS NOT NULL')
      .select([
        'a.userId',
        'a.companyId',
        'SUM(COALESCE(a.rounded_work_minutes, a.total_work_minutes, 0)) AS weekMinutes',
        'COUNT(*) AS workDays',
        'AVG(COALESCE(a.rounded_work_minutes, a.total_work_minutes, 0)) AS avgMinutes',
      ])
      .groupBy('a.userId, a.companyId')
      .getRawMany();

    // 주 15시간(900분) 이상인 직원 필터
    const qualified = records.filter(r => Number(r.weekMinutes) >= 900);

    if (!qualified.length) {
      this.logger.log('[WeeklyHolidayPay Cron] 주휴수당 발생 대상 없음');
      return;
    }

    this.logger.log(`[WeeklyHolidayPay Cron] 대상 ${qualified.length}명`);

    // 직원 및 회사 정보 일괄 조회
    const userIds    = [...new Set(qualified.map(r => r.a_user_id))];
    const companyIds = [...new Set(qualified.map(r => r.a_company_id))];

    const [users, companies] = await Promise.all([
      this.userRepo.find({ where: { id: In(userIds) }, select: ['id', 'name', 'hourlyRate', 'phone'] as any }),
      this.companyRepo.find({ where: { id: In(companyIds) }, select: ['id', 'name', 'workConfirmSmsEnabled'] as any }),
    ]);

    const userMap    = new Map(users.map(u => [u.id, u]));
    const companyMap = new Map(companies.map(c => [c.id, c]));

    for (const row of qualified) {
      const userId    = row.a_user_id;
      const companyId = row.a_company_id;
      const user      = userMap.get(userId);
      const company   = companyMap.get(companyId);

      const weekMinutes = Number(row.weekMinutes);
      const avgMinutes  = Number(row.avgMinutes);
      const weekHours   = Math.round(weekMinutes / 60 * 10) / 10;

      // 주휴수당 계산
      const hourlyRate = (user as any)?.hourlyRate ? Number((user as any).hourlyRate) : null;
      const holidayPay = hourlyRate
        ? Math.round((avgMinutes / 60) * hourlyRate)
        : null;

      // 인앱 알림
      await this.notificationsService.dispatch({
        companyId,
        userId,
        type:  'weekly_holiday_pay' as any,
        title: '주휴수당 발생 알림',
        body:  holidayPay
          ? `지난 주 ${weekHours}시간 근무 완료 → 주휴수당 약 ${holidayPay.toLocaleString()}원이 발생했습니다.`
          : `지난 주 ${weekHours}시간 근무 완료 → 주휴수당 지급 대상입니다.`,
      });

      // SMS 발송 (회사 설정 활성화 + 전화번호 있을 때)
      const phone = (user as any)?.phone as string | null;
      if ((company as any)?.workConfirmSmsEnabled && phone && hourlyRate) {
        const msg = `[관리왕] 주휴수당 알림\n지난주(${startDate}~${endDate}) ${weekHours}시간 근무하셨습니다.\n주휴수당 약 ${holidayPay?.toLocaleString() ?? '—'}원이 발생했습니다.`;
        this.smsService.send(phone, msg).catch(() => {});
      }
    }

    this.logger.log('[WeeklyHolidayPay Cron] 완료');
  }
}
