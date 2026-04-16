import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ShiftAssignment } from '../../database/entities/shift-schedule.entity';
import { AttendanceRecord, AttendanceStatus } from '../../database/entities/attendance-record.entity';
import { Company } from '../../database/entities/company.entity';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * 교대 근무표 기반 자동 결근 감지 Cron
 * 매일 23:59 (KST) 실행 — 당일 근무 배정이 있으나 출근 기록이 없는 직원 결근 처리
 */
@Injectable()
export class ShiftAbsentCronService {
  private readonly logger = new Logger(ShiftAbsentCronService.name);

  constructor(
    @InjectRepository(ShiftAssignment)  private assignRepo:    Repository<ShiftAssignment>,
    @InjectRepository(AttendanceRecord) private attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(Company)          private companyRepo:   Repository<Company>,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * 매일 23:59 KST (= 14:59 UTC) 실행
   * 당일 근무 배정이 있는데 출근 기록이 없으면 ABSENT로 자동 처리 + 관리자 알림
   */
  @Cron('59 14 * * *', { name: 'shift-absent-detection', timeZone: 'UTC' })
  async detectShiftAbsent() {
    const today = new Date().toISOString().split('T')[0];
    this.logger.log(`[ShiftAbsent Cron] ${today} 교대 결근 감지 시작`);

    // 오늘 근무 배정 전체 조회 (published 근무표에 한정)
    const assignments = await this.assignRepo
      .createQueryBuilder('a')
      .innerJoin('a.shiftSchedule', 's')
      .where('a.date = :date', { date: today })
      .andWhere('s.status = :pub', { pub: 'published' })
      .select(['a.id', 'a.companyId', 'a.userId', 'a.date'])
      .getMany();

    if (!assignments.length) return;

    // 오늘 출근 기록 있는 userId 집합
    const companyIds = [...new Set(assignments.map(a => a.companyId))];
    const existingRecords = await this.attendanceRepo
      .createQueryBuilder('r')
      .where('r.work_date = :date', { date: today })
      .andWhere('r.company_id IN (:...cids)', { cids: companyIds })
      .andWhere('r.clock_in_at IS NOT NULL')
      .select(['r.userId', 'r.companyId'])
      .getMany();

    const presentSet = new Set(existingRecords.map(r => `${r.companyId}:${r.userId}`));

    // 출근 기록 없는 배정 → 결근 처리
    const absentAssignments = assignments.filter(
      a => !presentSet.has(`${a.companyId}:${a.userId}`),
    );

    if (!absentAssignments.length) {
      this.logger.log(`[ShiftAbsent Cron] 미출근자 없음`);
      return;
    }

    this.logger.log(`[ShiftAbsent Cron] 미출근자 ${absentAssignments.length}명 결근 처리`);

    for (const assignment of absentAssignments) {
      // 기존 PENDING 레코드가 있으면 ABSENT로 업데이트, 없으면 신규 생성
      let record = await this.attendanceRepo.findOne({
        where: { companyId: assignment.companyId, userId: assignment.userId, workDate: today },
      });

      if (!record) {
        record = this.attendanceRepo.create({
          companyId: assignment.companyId,
          userId:    assignment.userId,
          workDate:  today,
        });
      }

      if (record.clockInAt) continue; // 사이에 출근한 경우 스킵

      record.status = AttendanceStatus.ABSENT;
      await this.attendanceRepo.save(record);

      // 해당 회사 관리자(manager/owner)에게 결근 알림
      // 알림 시스템은 userId 단위이므로 회사의 manager/owner 조회 후 알림
      // 단순화: 회사 전체에 알림 (실무에서는 해당 팀 manager만)
      await this.notificationsService.dispatch({
        companyId: assignment.companyId,
        userId:    assignment.userId,
        type:      'attendance_absent',
        title:     '교대 근무 미출근 처리',
        body:      `${today} 교대 근무 배정이 있으나 출근 기록이 없어 결근으로 처리되었습니다.`,
        refId:     assignment.id,
        refType:   'shift_assignment',
      });
    }

    this.logger.log(`[ShiftAbsent Cron] 완료`);
  }
}
