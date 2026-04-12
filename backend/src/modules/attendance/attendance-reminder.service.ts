import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * 출근 미처리 알림 서비스
 *
 * 매 10분마다 실행되며, "개인/회사 출근 예정 시간 + 10분" 시점에
 * 아직 출근하지 않은 직원에게 알림을 발송합니다.
 *
 * - 개인 customWorkStart 우선, 없으면 회사 workStartTime (기본 '09:00')
 * - KST(UTC+9) 기준으로 비교 (서버 타임존이 UTC인 경우 +9h 보정)
 */
@Injectable()
export class AttendanceReminderService {
  private readonly logger = new Logger(AttendanceReminderService.name);

  constructor(
    @InjectRepository(AttendanceRecord)
    private attendanceRepo: Repository<AttendanceRecord>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(Company)
    private companyRepo: Repository<Company>,

    private notificationsService: NotificationsService,
  ) {}

  /**
   * 매 10분마다 실행.
   * 현재 KST 시각이 "workStart + 10분"에 해당하는 직원 중
   * 오늘 출근 기록이 없는 직원에게 알림 발송.
   */
  @Cron('0,10,20,30,40,50 * * * *')
  async sendClockInReminders(): Promise<void> {
    const nowUtc = new Date();
    // KST = UTC + 9h
    const nowKst = new Date(nowUtc.getTime() + 9 * 60 * 60 * 1000);

    const kstHour = nowKst.getHours();
    const kstMin  = nowKst.getMinutes();

    // 알림 시간대 제한: KST 07:00 ~ 14:00 사이에만 동작
    if (kstHour < 7 || kstHour >= 14) return;

    // "workStart + 10분"이 현재 시각(±5분 허용 윈도우)인지 확인
    // 즉 workStart의 분이 (kstMin - 10) ∈ [-5, +5] 에 해당
    const targetStartMin = kstHour * 60 + kstMin - 10; // 기준: 10분 전 출근이었어야
    const windowMin = 5; // ±5분 허용

    const todayKst = `${nowKst.getFullYear()}-${String(nowKst.getMonth() + 1).padStart(2, '0')}-${String(nowKst.getDate()).padStart(2, '0')}`;

    // 활성 회사 목록 조회
    const companies = await this.companyRepo.find({
      select: ['id', 'workStartTime'] as any,
      where: { deletedAt: IsNull() } as any,
    });

    for (const company of companies) {
      const companyStart = (company as any).workStartTime ?? '09:00';
      const [cH, cM]     = companyStart.split(':').map(Number);
      const companyStartMin = cH * 60 + cM;

      // 회사 기본 출근 시간이 targetStartMin 윈도우 안에 있는지 확인
      const companyMatch = Math.abs(companyStartMin - targetStartMin) <= windowMin;

      // 해당 회사의 활성 직원 조회 (soft-delete 제외)
      const users = await this.userRepo.find({
        where: { companyId: company.id, deletedAt: IsNull() } as any,
        select: ['id', 'name', 'customWorkStart'] as any,
      });

      for (const user of users) {
        const userStartRaw = (user as any).customWorkStart as string | null;

        // 개인 출근 시간이 있으면 개별 체크, 없으면 회사 기준 사용
        let shouldNotify = false;
        if (userStartRaw) {
          const [uH, uM] = userStartRaw.split(':').map(Number);
          const userStartMin = uH * 60 + uM;
          shouldNotify = Math.abs(userStartMin - targetStartMin) <= windowMin;
        } else {
          shouldNotify = companyMatch;
        }

        if (!shouldNotify) continue;

        // 오늘 출근 기록 확인
        const existing = await this.attendanceRepo.findOne({
          where: { userId: user.id, workDate: todayKst } as any,
          select: ['id', 'clockInAt'] as any,
        });

        if (existing?.clockInAt) continue; // 이미 출근함

        // 알림 발송
        const effectiveStart = userStartRaw ?? companyStart;
        try {
          await this.notificationsService.dispatch({
            userId:    user.id,
            companyId: company.id,
            type:      'attendance_clock_in_reminder',
            title:     '출근 확인',
            body:      `출근 예정 시간(${effectiveStart})이 지났습니다. 지금 바로 출근 처리를 해주세요.`,
          });
        } catch (err) {
          this.logger.warn(`출근 알림 발송 실패 userId=${user.id}: ${err}`);
        }
      }
    }
  }
}
