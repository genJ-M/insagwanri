import {
  Injectable, ConflictException, NotFoundException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, Not } from 'typeorm';
import { createHmac, createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AttendanceRecord, AttendanceStatus } from '../../database/entities/attendance-record.entity';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import { TeamsService } from '../teams/teams.service';
import { SmsService } from '../../common/sms/sms.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ClockInDto, ClockOutDto, UpdateAttendanceDto,
  AttendanceQueryDto, AttendanceReportQueryDto,
  AttendanceMethod, AuditLogQueryDto,
} from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private attendanceRepo: Repository<AttendanceRecord>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(Company)
    private companyRepo: Repository<Company>,

    private configService: ConfigService,
    private teamsService: TeamsService,
    private smsService: SmsService,
    private notificationsService: NotificationsService,
  ) {}

  // ─────────────────────────────────────────
  // 감사 대비 출퇴근 원본 로그 (공공기관 특화)
  // ─────────────────────────────────────────
  async getAuditLog(currentUser: AuthenticatedUser, query: AuditLogQueryDto) {
    const qb = this.attendanceRepo
      .createQueryBuilder('a')
      .leftJoin('a.user', 'u')
      .where('a.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('a.work_date BETWEEN :start AND :end', {
        start: query.start_date,
        end:   query.end_date,
      })
      .select([
        'a.id', 'a.workDate', 'a.userId',
        'a.clockInAt', 'a.clockOutAt',
        'a.clockInLat', 'a.clockInLng',
        'a.clockOutLat', 'a.clockOutLng',
        'a.clockInDistanceM', 'a.clockInOutOfRange',
        'a.clockInMethod', 'a.clockOutMethod',
        'a.workLocation', 'a.flexType',
        'a.isLate', 'a.lateMinutes',
        'a.lateExempted',
        'a.totalWorkMinutes', 'a.breakMinutes',
        'a.status', 'a.note',
        'a.approvedBy', 'a.approvedAt',
        'a.createdAt', 'a.updatedAt',
        'u.id', 'u.name', 'u.department', 'u.position',
      ]);

    if (query.user_id) {
      qb.andWhere('a.user_id = :uid', { uid: query.user_id });
    }

    qb.orderBy('a.work_date', 'ASC').addOrderBy('u.name', 'ASC');

    const records = await qb.getMany();

    // 원본 무결성 해시: 레코드별 SHA-256 (id + workDate + clockInAt + clockOutAt + status)
    const rows = records.map(r => {
      const raw = `${r.id}|${r.workDate}|${r.clockInAt?.toISOString() ?? ''}|${r.clockOutAt?.toISOString() ?? ''}|${r.status}`;
      const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
      return { ...r, integrityHash: hash };
    });

    // 전체 로그 해시 (체인 검증용)
    const chainInput = rows.map(r => r.integrityHash).join('');
    const chainHash  = createHash('sha256').update(chainInput).digest('hex');

    return {
      period:    { start: query.start_date, end: query.end_date },
      total:     rows.length,
      chainHash,
      generatedAt: new Date().toISOString(),
      records:   rows,
    };
  }

  // ─────────────────────────────────────────
  // 주간 근무시간 조회 (52시간 위젯용)
  // ─────────────────────────────────────────
  async getWeeklyHours(currentUser: AuthenticatedUser) {
    const now = new Date();
    // 이번 주 월요일 00:00 (KST 기준)
    const dayOfWeek = now.getDay(); // 0=일, 1=월...
    const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMon);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startDate = monday.toISOString().split('T')[0];
    const endDate   = sunday.toISOString().split('T')[0];

    const records = await this.attendanceRepo.find({
      where: {
        companyId: currentUser.companyId,
        userId:    currentUser.id,
        workDate:  Between(startDate, endDate) as any,
      },
      select: ['workDate', 'totalWorkMinutes', 'clockInAt', 'clockOutAt'] as any,
    });

    const weeklyMinutes = records.reduce((s, r) => s + (r.totalWorkMinutes ?? 0), 0);
    // 오늘 아직 퇴근 안 한 경우 — 현재 진행 중인 근무 시간도 포함
    const todayRecord = records.find(r => r.workDate === now.toISOString().split('T')[0]);
    let inProgressMinutes = 0;
    if (todayRecord?.clockInAt && !todayRecord?.clockOutAt) {
      inProgressMinutes = Math.floor((now.getTime() - new Date(todayRecord.clockInAt).getTime()) / 60000);
    }

    const totalMinutes    = weeklyMinutes + inProgressMinutes;
    const limitMinutes    = 52 * 60;
    const remainMinutes   = Math.max(0, limitMinutes - totalMinutes);
    const overtimeMinutes = Math.max(0, totalMinutes - limitMinutes);

    return {
      weekStart:       startDate,
      weekEnd:         endDate,
      totalMinutes,
      totalHours:      Math.round(totalMinutes / 60 * 10) / 10,
      limitMinutes,
      remainMinutes,
      remainHours:     Math.round(remainMinutes / 60 * 10) / 10,
      overtimeMinutes,
      overtimeHours:   Math.round(overtimeMinutes / 60 * 10) / 10,
      isOver52h:       totalMinutes > limitMinutes,
      percentage:      Math.min(100, Math.round(totalMinutes / limitMinutes * 100)),
      inProgress:      inProgressMinutes > 0,
      dailyRecords:    records.map(r => ({
        date:         r.workDate,
        minutes:      r.totalWorkMinutes ?? 0,
        clockInAt:    r.clockInAt,
        clockOutAt:   r.clockOutAt,
      })),
    };
  }

  // ─────────────────────────────────────────
  // 출퇴근 방식 목록 조회
  // ─────────────────────────────────────────
  async getAttendanceMethods(currentUser: AuthenticatedUser) {
    const company = await this.companyRepo.findOne({
      where: { id: currentUser.companyId },
      select: ['attendanceMethods'] as any,
    });

    const methods = company?.attendanceMethods;
    return {
      enabled: methods?.enabled ?? ['manual'],
      wifi: methods?.wifi ?? null,
      qr: methods?.qr ?? null,
    };
  }

  // ─────────────────────────────────────────
  // QR 코드 토큰 발급 (관리자용)
  // ─────────────────────────────────────────
  async getQrToken(currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('QR 코드 발급은 관리자만 가능합니다.');
    }

    const company = await this.companyRepo.findOne({
      where: { id: currentUser.companyId },
      select: ['attendanceMethods'] as any,
    });

    const windowMinutes = company?.attendanceMethods?.qr?.windowMinutes ?? 5;
    const token = this.generateQrToken(currentUser.companyId, windowMinutes);
    const windowMs = windowMinutes * 60_000;
    const expiresAt = new Date(Math.ceil(Date.now() / windowMs) * windowMs);

    return { token, windowMinutes, expiresAt };
  }

  // ─────────────────────────────────────────
  // 출근
  // ─────────────────────────────────────────
  async clockIn(currentUser: AuthenticatedUser, dto: ClockInDto) {
    const today = this.getTodayDate();

    // 이미 출근한 경우 — 멱등성: 기존 기록 반환 (first-wins)
    const existing = await this.attendanceRepo.findOne({
      where: { userId: currentUser.id, workDate: today },
    });

    if (existing?.clockInAt) {
      return { ...existing, alreadyClockedIn: true };
    }

    // 회사 설정 조회 (근무 시간 + GPS + 출퇴근 방식 + IT 특화 설정 + 파트타임 설정)
    const company = await this.companyRepo.findOne({
      where: { id: currentUser.companyId },
      select: [
        'workStartTime', 'lateThresholdMin', 'timezone',
        'gpsEnabled', 'gpsLat', 'gpsLng', 'gpsRadiusM',
        'attendanceMethods',
        'lateNightExemptionEnabled', 'lateNightThresholdHour', 'lateNightGraceMinutes',
        'workConfirmSmsEnabled',
      ] as any,
    });

    // 개인 근무 스케줄 조회 (customWorkStart/End/lateThresholdMinOverride)
    const userSchedule = await this.userRepo.findOne({
      where: { id: currentUser.id },
      select: ['customWorkStart', 'customWorkEnd', 'lateThresholdMinOverride', 'breakMinutes', 'phone'] as any,
    });

    // 출퇴근 방식 검증
    const method = await this.resolveAndValidateMethod(dto, company ?? {}, 'clock-in');

    const now = new Date();
    // 개인 스케줄 우선, 없으면 회사 기본값
    const effectiveSchedule = this.mergeSchedule(userSchedule, company ?? {});

    // ── 야근 면책 검사 ────────────────────────────────────────────────────────
    // 전날 퇴근 시간이 threshold(기본 22시) 이후면 지각 면책 적용
    const lateExempted = await this.checkLateNightExemption(currentUser.id, company ?? {}, now);
    const { isLate, lateMinutes } = lateExempted
      ? { isLate: false, lateMinutes: 0 }
      : this.calcLateStatus(now, effectiveSchedule);

    // GPS 검증 (gps 방식이거나 회사 GPS 활성화 시)
    const gpsResult = this.validateGps(dto.latitude ?? null, dto.longitude ?? null, dto.accuracyM ?? null, company ?? {});

    // ── 근무 위치 판단 (office | remote) ────────────────────────────────────
    // WiFi 방식이고 사내 SSID가 확인되면 office, 그 외 remote
    const workLocation = this.resolveWorkLocation(method, dto.wifiSsid ?? null, company ?? {});

    const clockInData = {
      clockInAt: now,
      clockInLat: dto.latitude ?? null,
      clockInLng: dto.longitude ?? null,
      clockInDistanceM: gpsResult.distanceM,
      clockInOutOfRange: gpsResult.outOfRange,
      gpsBypassed: gpsResult.bypassed,
      clockInMethod: method,
      workLocation,
      lateExempted,
      flexType: dto.flexType ?? 'regular',
      isLate,
      lateMinutes: isLate ? lateMinutes : null,
      status: isLate ? AttendanceStatus.LATE : AttendanceStatus.NORMAL,
    };

    if (existing) {
      Object.assign(existing, clockInData);
      const saved = await this.attendanceRepo.save(existing);
      await this.sendWorkConfirmSms('clock-in', saved, company ?? {}, userSchedule);
      return { ...saved, gps: gpsResult };
    }

    const record = this.attendanceRepo.create({
      companyId: currentUser.companyId,
      userId: currentUser.id,
      workDate: today,
      ...clockInData,
    });

    const saved = await this.attendanceRepo.save(record);
    await this.sendWorkConfirmSms('clock-in', saved, company ?? {}, userSchedule);
    return { ...saved, gps: gpsResult };
  }

  // ─────────────────────────────────────────
  // 퇴근
  // ─────────────────────────────────────────
  async clockOut(currentUser: AuthenticatedUser, dto: ClockOutDto) {
    const today = this.getTodayDate();

    const record = await this.attendanceRepo.findOne({
      where: { userId: currentUser.id, workDate: today },
    });

    if (!record?.clockInAt) {
      throw new BadRequestException('출근 기록이 없습니다. 먼저 출근 처리를 해주세요.');
    }

    // 이미 퇴근한 경우 — 멱등성: 기존 기록 반환 (first-wins)
    if (record.clockOutAt) {
      return { ...record, alreadyClockedOut: true };
    }

    const company = await this.companyRepo.findOne({
      where: { id: currentUser.companyId },
      select: ['workEndTime', 'attendanceMethods', 'workStartTime',
               'shiftLongWorkThresholdHours', 'nightWorkStartHour', 'nightWorkEndHour',
               'partTimeRoundingUnit', 'partTimeRoundingPolicy', 'partTimeDeductionUnit',
               'workConfirmSmsEnabled'] as any,
    });

    const userSchedule = await this.userRepo.findOne({
      where: { id: currentUser.id },
      select: ['customWorkStart', 'customWorkEnd', 'lateThresholdMinOverride', 'breakMinutes', 'hourlyRate', 'phone'] as any,
    });

    // 출퇴근 방식 검증
    const method = await this.resolveAndValidateMethod(dto, company ?? {}, 'clock-out');

    const now = new Date();
    const effectiveSchedule = this.mergeSchedule(userSchedule, company ?? {});

    // 총 근무시간 (출퇴근 사이) — 법정 휴게시간 차감
    const grossWorkMinutes = Math.floor(
      (now.getTime() - record.clockInAt.getTime()) / 60000,
    );
    const breakMinutes = this.calcEffectiveBreak(grossWorkMinutes, effectiveSchedule.breakMinutes);
    const totalWorkMinutes = Math.max(0, grossWorkMinutes - breakMinutes);

    const isEarlyLeave = this.isEarlyLeave(now, effectiveSchedule);

    // ── 야간 근무 시간 계산 (22시~06시 구간) ──────────────────────────────────
    const nightStartHour = (company as any)?.nightWorkStartHour ?? 22;
    const nightEndHour   = (company as any)?.nightWorkEndHour   ?? 6;
    const nightWorkMinutes = this.calcNightWorkMinutes(record.clockInAt!, now, nightStartHour, nightEndHour);

    // ── 연속 근무 경고 ────────────────────────────────────────────────────────
    const thresholdH  = (company as any)?.shiftLongWorkThresholdHours ?? 12;
    const isLongWork  = totalWorkMinutes >= thresholdH * 60;

    // ── 파트타임 임금 계산 ─────────────────────────────────────────────────────
    const roundingUnit   = (company as any)?.partTimeRoundingUnit   ?? 1;
    const roundingPolicy = (company as any)?.partTimeRoundingPolicy ?? 'floor';
    const deductionUnit  = (company as any)?.partTimeDeductionUnit  ?? 1;
    const hourlyRate     = (userSchedule as any)?.hourlyRate ? Number((userSchedule as any).hourlyRate) : null;

    // 지각 차감: lateMinutes를 deductionUnit 올림 단위로 차감
    const lateDeductMin = record.isLate && record.lateMinutes
      ? Math.ceil(record.lateMinutes / deductionUnit) * deductionUnit
      : 0;
    // 조퇴 차감: 실제 조퇴 시간 계산
    let earlyLeaveMin = 0;
    if (isEarlyLeave) {
      const [eh, em] = effectiveSchedule.workEndTime.split(':').map(Number);
      const scheduledEnd = new Date(now);
      scheduledEnd.setHours(eh, em, 0, 0);
      const rawEarlyMin = Math.max(0, Math.floor((scheduledEnd.getTime() - now.getTime()) / 60000));
      earlyLeaveMin = Math.ceil(rawEarlyMin / deductionUnit) * deductionUnit;
    }

    const netMinutes = Math.max(0, totalWorkMinutes - lateDeductMin - earlyLeaveMin);
    const roundedWorkMinutes = this.applyRounding(netMinutes, roundingUnit, roundingPolicy);
    const wageAmount = hourlyRate ? Math.round(roundedWorkMinutes / 60 * hourlyRate) : null;

    record.clockOutAt           = now;
    record.clockOutLat          = dto.latitude ?? null;
    record.clockOutLng          = dto.longitude ?? null;
    record.clockOutMethod       = method;
    record.totalWorkMinutes     = totalWorkMinutes;
    record.breakMinutes         = breakMinutes;
    record.nightWorkMinutes     = nightWorkMinutes;
    record.isLongWork           = isLongWork;
    record.roundedWorkMinutes   = roundedWorkMinutes;
    record.wageAmount           = wageAmount;

    if (isEarlyLeave && record.status === AttendanceStatus.NORMAL) {
      record.status = AttendanceStatus.EARLY_LEAVE;
    }

    const saved = await this.attendanceRepo.save(record);
    await this.sendWorkConfirmSms('clock-out', saved, company ?? {}, userSchedule);
    return saved;
  }

  // ─────────────────────────────────────────
  // 근태 목록 (관리자)
  // ─────────────────────────────────────────
  async getAttendanceList(currentUser: AuthenticatedUser, query: AttendanceQueryDto) {
    // 팀장(employee role)도 자신의 팀원 근태 조회 허용
    if (currentUser.role === UserRole.EMPLOYEE) {
      const memberIds = await this.teamsService.getLeaderTeamMemberIds(
        currentUser.id, currentUser.companyId,
      );
      if (!memberIds) {
        throw new ForbiddenException('근태 목록 조회 권한이 없습니다.');
      }
      // 팀장은 팀원 중에서만 조회 가능 (query.user_id가 팀원인지 검증)
      if (query.user_id && !memberIds.includes(query.user_id)) {
        throw new ForbiddenException('해당 직원의 근태를 조회할 권한이 없습니다.');
      }
      query = { ...query, _memberIds: memberIds } as any;
    }

    const { date, start_date, end_date, user_id, status, page, limit } = query;
    const skip = ((page ?? 1) - 1) * (limit ?? 20);

    const qb = this.attendanceRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'u')
      .where('a.company_id = :companyId', { companyId: currentUser.companyId })
      .select([
        'a.id', 'a.workDate', 'a.clockInAt', 'a.clockOutAt',
        'a.status', 'a.isLate', 'a.lateMinutes', 'a.totalWorkMinutes',
        'u.id', 'u.name', 'u.department',
      ]);

    // 팀장이면 팀원으로 범위 제한
    const memberIds = (query as any)._memberIds as string[] | undefined;
    if (memberIds) {
      qb.andWhere('a.user_id IN (:...memberIds)', { memberIds });
    }

    if (date) {
      qb.andWhere('a.work_date = :date', { date });
    } else if (start_date && end_date) {
      qb.andWhere('a.work_date BETWEEN :start AND :end', {
        start: start_date, end: end_date,
      });
    } else {
      // 기본: 오늘
      qb.andWhere('a.work_date = :today', { today: this.getTodayDate() });
    }

    if (user_id) qb.andWhere('a.user_id = :userId', { userId: user_id });
    if (status)  qb.andWhere('a.status = :status', { status });

    qb.orderBy('a.work_date', 'DESC').addOrderBy('a.clock_in_at', 'ASC');
    qb.offset(skip).limit(limit);

    const [records, total] = await qb.getManyAndCount();

    // 상태별 요약
    const summary = await this.attendanceRepo
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('a.company_id = :companyId', { companyId: currentUser.companyId })
      .andWhere('a.work_date = :today', { today: date || this.getTodayDate() })
      .groupBy('a.status')
      .getRawMany();

    return {
      records,
      meta: {
        page, limit, total,
        summary: summary.reduce((acc, s) => {
          acc[s.status] = parseInt(s.count);
          return acc;
        }, {}),
      },
    };
  }

  // ─────────────────────────────────────────
  // 내 근태 조회
  // ─────────────────────────────────────────
  async getMyAttendance(currentUser: AuthenticatedUser, query: AttendanceQueryDto) {
    const { start_date, end_date } = query;

    const where: any = { companyId: currentUser.companyId, userId: currentUser.id };

    if (start_date && end_date) {
      where.workDate = Between(start_date, end_date);
    }

    const records = await this.attendanceRepo.find({
      where,
      order: { workDate: 'DESC' },
    });

    const totalWorkDays   = records.filter(r => r.clockInAt).length;
    const totalLateDays   = records.filter(r => r.isLate).length;
    const totalAbsentDays = records.filter(r => r.status === AttendanceStatus.ABSENT).length;
    const totalWorkHours  = Math.floor(
      records.reduce((sum, r) => sum + (r.totalWorkMinutes || 0), 0) / 60,
    );

    return {
      records,
      meta: { totalWorkDays, totalLateDays, totalAbsentDays, totalWorkHours },
    };
  }

  // ─────────────────────────────────────────
  // 월별 리포트
  // ─────────────────────────────────────────
  async getMonthlyReport(currentUser: AuthenticatedUser, query: AttendanceReportQueryDto) {
    // 팀장도 허용
    let leaderMemberIds: string[] | null = null;
    if (currentUser.role === UserRole.EMPLOYEE) {
      leaderMemberIds = await this.teamsService.getLeaderTeamMemberIds(
        currentUser.id, currentUser.companyId,
      );
      if (!leaderMemberIds) {
        throw new ForbiddenException('월별 리포트 조회 권한이 없습니다.');
      }
    }

    const now = new Date();
    const year  = query.year  ?? now.getFullYear();
    const month = query.month ?? now.getMonth() + 1;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate   = this.getLastDayOfMonth(year, month);

    const qb = this.attendanceRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'u')
      .where('a.company_id = :companyId', { companyId: currentUser.companyId })
      .andWhere('a.work_date BETWEEN :start AND :end', { start: startDate, end: endDate });

    // 팀장이면 팀원으로 범위 제한
    if (leaderMemberIds) {
      qb.andWhere('a.user_id IN (:...memberIds)', { memberIds: leaderMemberIds });
    }

    if (query.user_id) qb.andWhere('a.user_id = :userId', { userId: query.user_id });

    const records = await qb.getMany();

    // 직원별 집계
    const userMap = new Map<string, any>();
    for (const r of records) {
      const uid = r.userId;
      if (!userMap.has(uid)) {
        userMap.set(uid, {
          user_id: uid,
          name: r.user?.name,
          work_days: 0, late_days: 0, absent_days: 0,
          total_work_minutes: 0, clock_in_times: [],
        });
      }
      const stat = userMap.get(uid);
      if (r.clockInAt)  stat.work_days++;
      if (r.isLate)     stat.late_days++;
      if (r.status === AttendanceStatus.ABSENT) stat.absent_days++;
      stat.total_work_minutes += r.totalWorkMinutes || 0;
      if (r.clockInAt) stat.clock_in_times.push(r.clockInAt);
    }

    const employees = Array.from(userMap.values()).map(s => ({
      ...s,
      avg_clock_in: this.calcAvgTime(s.clock_in_times),
      clock_in_times: undefined,
    }));

    const totalEmployees = employees.length;
    const avgWorkHours = totalEmployees
      ? employees.reduce((sum, e) => sum + e.total_work_minutes, 0) / totalEmployees / 60
      : 0;

    return {
      period: `${year}-${String(month).padStart(2, '0')}`,
      summary: {
        total_employees: totalEmployees,
        avg_work_hours: Math.round(avgWorkHours * 10) / 10,
        total_late_count:   employees.reduce((s, e) => s + e.late_days, 0),
        total_absent_count: employees.reduce((s, e) => s + e.absent_days, 0),
      },
      employees,
    };
  }

  // ─────────────────────────────────────────
  // 근태 수동 수정 (관리자)
  // ─────────────────────────────────────────
  async updateAttendance(
    id: string,
    currentUser: AuthenticatedUser,
    dto: UpdateAttendanceDto,
  ) {
    const record = await this.attendanceRepo.findOne({
      where: { id, companyId: currentUser.companyId },
    });

    if (!record) throw new NotFoundException('근태 기록을 찾을 수 없습니다.');

    if (dto.clock_in_at)  record.clockInAt  = new Date(dto.clock_in_at);
    if (dto.clock_out_at) record.clockOutAt = new Date(dto.clock_out_at);
    if (dto.status)       record.status     = dto.status as AttendanceStatus;
    if (dto.note !== undefined) record.note = dto.note;

    // 수정 시 근무시간 재계산 (휴게시간 포함)
    if (record.clockInAt && record.clockOutAt) {
      const userSchedule = await this.userRepo.findOne({
        where: { id: record.userId },
        select: ['customWorkStart', 'customWorkEnd', 'lateThresholdMinOverride', 'breakMinutes'] as any,
      });
      const company = await this.companyRepo.findOne({
        where: { id: currentUser.companyId },
        select: ['workStartTime', 'workEndTime', 'lateThresholdMin'] as any,
      });
      const effectiveSchedule = this.mergeSchedule(userSchedule, company ?? {});
      const grossWorkMinutes = Math.floor(
        (record.clockOutAt.getTime() - record.clockInAt.getTime()) / 60000,
      );
      record.breakMinutes = this.calcEffectiveBreak(grossWorkMinutes, effectiveSchedule.breakMinutes);
      record.totalWorkMinutes = Math.max(0, grossWorkMinutes - record.breakMinutes);
    }

    record.approvedBy = currentUser.id;
    record.approvedAt = new Date();

    return this.attendanceRepo.save(record);
  }

  // ─────────────────────────────────────────
  // 출퇴근 방식 결정 및 검증
  // ─────────────────────────────────────────
  /**
   * 클라이언트가 보낸 method + payload를 검증하여 실제 기록할 방식을 반환한다.
   * - 회사에서 활성화된 방식(enabled 배열) 중 첫 번째로 유효한 것이 기록 (first-wins)
   * - method 미전송 시 enabled[0] 방식으로 자동 처리 (fallback)
   */
  private async resolveAndValidateMethod(
    dto: { method?: AttendanceMethod; qrToken?: string; wifiSsid?: string },
    company: Partial<Company>,
    action: 'clock-in' | 'clock-out',
  ): Promise<string> {
    const enabled: AttendanceMethod[] = company.attendanceMethods?.enabled ?? ['manual'];
    const requestedMethod: AttendanceMethod = dto.method ?? enabled[0] ?? 'manual';

    // 회사에서 비활성화된 방식 거부
    if (!enabled.includes(requestedMethod)) {
      throw new BadRequestException(
        `'${requestedMethod}' 방식은 현재 사용할 수 없습니다. 허용 방식: ${enabled.join(', ')}`,
      );
    }

    switch (requestedMethod) {
      case 'qr':
        this.validateQrToken(dto.qrToken, company);
        break;
      case 'wifi':
        this.validateWifiSsid(dto.wifiSsid, company);
        break;
      case 'gps':
        // GPS 거리 검증은 validateGps()에서 처리 (flag-not-reject 정책 유지)
        break;
      case 'face':
        // 생체인증은 클라이언트(기기)에서 완료 후 호출하므로 서버 추가 검증 불필요
        break;
      case 'manual':
      default:
        break;
    }

    return requestedMethod;
  }

  // ─────────────────────────────────────────
  // QR 토큰 생성 / 검증 (HMAC-SHA256 stateless)
  // ─────────────────────────────────────────
  private generateQrToken(companyId: string, windowMinutes: number): string {
    const window = Math.floor(Date.now() / (windowMinutes * 60_000));
    return createHmac('sha256', this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'fallback')
      .update(`${companyId}:${window}`)
      .digest('hex')
      .slice(0, 24);
  }

  private validateQrToken(token: string | undefined, company: Partial<Company>): void {
    if (!token) {
      throw new BadRequestException('QR 토큰이 필요합니다.');
    }

    const companyId = (company as any).id as string | undefined;
    if (!companyId) throw new BadRequestException('회사 정보를 확인할 수 없습니다.');

    const windowMinutes = company.attendanceMethods?.qr?.windowMinutes ?? 5;
    // 현재 window + 이전 window 허용 (시계 오차 대응)
    const currentWindow  = Math.floor(Date.now() / (windowMinutes * 60_000));
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'fallback';

    const makeToken = (w: number) =>
      createHmac('sha256', secret)
        .update(`${companyId}:${w}`)
        .digest('hex')
        .slice(0, 24);

    const valid = [currentWindow, currentWindow - 1].some(w => makeToken(w) === token);
    if (!valid) {
      throw new BadRequestException('유효하지 않거나 만료된 QR 코드입니다.');
    }
  }

  // ─────────────────────────────────────────
  // WiFi SSID 검증
  // ─────────────────────────────────────────
  private validateWifiSsid(ssid: string | undefined, company: Partial<Company>): void {
    if (!ssid) {
      throw new BadRequestException('WiFi SSID가 필요합니다.');
    }

    const allowedSsids = company.attendanceMethods?.wifi?.ssids ?? [];
    if (allowedSsids.length === 0) {
      throw new BadRequestException('허용된 WiFi SSID가 설정되어 있지 않습니다.');
    }

    if (!allowedSsids.includes(ssid)) {
      throw new BadRequestException('허용된 사내 WiFi에 연결된 상태에서만 출퇴근할 수 있습니다.');
    }
  }

  // ─────────────────────────────────────────
  // GPS 검증 (Haversine)
  // ─────────────────────────────────────────
  private validateGps(
    lat: number | null,
    lng: number | null,
    accuracyM: number | null,
    company: Partial<Company>,
  ) {
    // GPS 비활성화 또는 회사 위치 미등록
    if (!company.gpsEnabled || !company.gpsLat || !company.gpsLng) {
      return { bypassed: true, outOfRange: false, distanceM: null, withinRadius: true };
    }
    // 좌표 없음 (GPS 권한 거부)
    if (lat == null || lng == null) {
      return { bypassed: true, outOfRange: false, distanceM: null, withinRadius: true };
    }

    const distanceM = this.haversineDistance(lat, lng, Number(company.gpsLat), Number(company.gpsLng));
    const radiusM   = company.gpsRadiusM ?? 100;

    // 정확도 보정: accuracy의 절반을 거리에서 차감 (유리한 방향으로)
    const effectiveDistanceM = accuracyM ? Math.max(0, distanceM - accuracyM * 0.5) : distanceM;
    const withinRadius = effectiveDistanceM <= radiusM;

    return {
      bypassed: false,
      outOfRange: !withinRadius,
      distanceM: Math.round(distanceM),
      withinRadius,
      radiusM,
      accuracyM,
    };
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ─────────────────────────────────────────
  // 유틸
  // ─────────────────────────────────────────
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getLastDayOfMonth(year: number, month: number): string {
    const d = new Date(year, month, 0);
    return d.toISOString().split('T')[0];
  }

  // ─────────────────────────────────────────
  // 개인 + 회사 스케줄 병합
  // ─────────────────────────────────────────
  private mergeSchedule(
    user: Partial<{ customWorkStart: string | null; customWorkEnd: string | null; lateThresholdMinOverride: number | null; breakMinutes: number | null }> | null,
    company: Partial<Company>,
  ): { workStartTime: string; workEndTime: string; lateThresholdMin: number; breakMinutes: number | null } {
    return {
      workStartTime: user?.customWorkStart ?? company.workStartTime ?? '09:00',
      workEndTime:   user?.customWorkEnd   ?? company.workEndTime   ?? '18:00',
      lateThresholdMin: user?.lateThresholdMinOverride ?? company.lateThresholdMin ?? 10,
      breakMinutes: user?.breakMinutes ?? null,  // null = 법정 최소 자동 계산
    };
  }

  // ─────────────────────────────────────────
  // 법정 휴게시간 계산 (근로기준법 제54조)
  // ─────────────────────────────────────────
  /**
   * 실 적용 휴게시간(분) 반환
   * - configuredBreak가 있으면 법정 최소와 비교해 큰 값 사용
   * - null이면 법정 최소 자동 계산
   *
   * 법정 기준:
   *   총 근무 4h 이상 → 최소 30분
   *   총 근무 8h 이상 → 최소 60분
   */
  calcEffectiveBreak(grossWorkMinutes: number, configuredBreak: number | null): number {
    const legalMin =
      grossWorkMinutes >= 480 ? 60 :
      grossWorkMinutes >= 240 ? 30 : 0;
    if (configuredBreak == null) return legalMin;
    return Math.max(legalMin, configuredBreak);
  }

  private calcLateStatus(now: Date, schedule: { workStartTime: string; lateThresholdMin: number }) {
    if (!schedule?.workStartTime) return { isLate: false, lateMinutes: 0 };

    const [h, m] = schedule.workStartTime.split(':').map(Number);
    const threshold = schedule.lateThresholdMin ?? 10;

    const workStart = new Date(now);
    workStart.setHours(h, m + threshold, 0, 0);

    const lateMinutes = Math.floor((now.getTime() - workStart.getTime()) / 60000);
    return { isLate: lateMinutes > 0, lateMinutes: Math.max(lateMinutes, 0) };
  }

  private isEarlyLeave(now: Date, schedule: { workEndTime: string }): boolean {
    if (!schedule?.workEndTime) return false;
    const [h, m] = schedule.workEndTime.split(':').map(Number);
    const workEnd = new Date(now);
    workEnd.setHours(h, m, 0, 0);
    return now < workEnd;
  }

  // ─────────────────────────────────────────
  // 근무 위치 판단
  // ─────────────────────────────────────────
  private resolveWorkLocation(
    method: string,
    wifiSsid: string | null,
    company: Partial<Company>,
  ): string {
    const allowedSsids = company.attendanceMethods?.wifi?.ssids ?? [];
    if (method === 'wifi' && wifiSsid && allowedSsids.includes(wifiSsid)) return 'office';
    if (method === 'qr' || method === 'face') return 'office';
    if (method === 'gps') {
      // GPS 방식이고 회사 위치 설정이 있으면 office로 간주
      if (company.gpsEnabled && company.gpsLat && company.gpsLng) return 'office';
    }
    // manual이거나 사내 WiFi 미감지 → remote
    if (method === 'wifi' && (!wifiSsid || !allowedSsids.includes(wifiSsid))) return 'remote';
    return 'office'; // 기본값: 사무실 (manual 등)
  }

  // ─────────────────────────────────────────
  // 야근 면책 검사
  // 전날 퇴근 시간이 threshold(기본 22시) 이후면 오늘 지각 면책
  // ─────────────────────────────────────────
  private async checkLateNightExemption(
    userId: string,
    company: Partial<Company>,
    now: Date,
  ): Promise<boolean> {
    if (!company.lateNightExemptionEnabled) return false;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const yesterdayRecord = await this.attendanceRepo.findOne({
      where: { userId, workDate: yesterdayStr },
      select: ['clockOutAt'] as any,
    });

    if (!yesterdayRecord?.clockOutAt) return false;

    const clockOut = new Date(yesterdayRecord.clockOutAt);
    const threshold = company.lateNightThresholdHour ?? 22;

    // KST 기준 시간 비교 (UTC+9)
    const clockOutKstHour = (clockOut.getUTCHours() + 9) % 24;
    const isLateNight = clockOutKstHour >= threshold;

    if (!isLateNight) return false;

    // 유예 시간(분) 이내에 출근했는지 확인
    const graceMins = company.lateNightGraceMinutes ?? 60;
    const [sh, sm] = (company.workStartTime ?? '09:00').split(':').map(Number);
    const workStart = new Date(now);
    workStart.setHours(sh, sm + graceMins, 0, 0);

    return now <= workStart;
  }

  private calcAvgTime(times: Date[]): string | null {
    if (!times.length) return null;
    const avg = times.reduce((sum, t) => sum + t.getHours() * 60 + t.getMinutes(), 0) / times.length;
    const h = Math.floor(avg / 60);
    const m = Math.round(avg % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // ─────────────────────────────────────────
  // 파트타임 임금 조회
  // ─────────────────────────────────────────
  /**
   * 기간 내 일별 임금 + 합계 반환 (파트타임 급여 확인용)
   * 본인 또는 관리자 조회 가능
   */
  async getWageReport(
    currentUser: AuthenticatedUser,
    query: { user_id?: string; start_date: string; end_date: string },
  ) {
    const targetUserId = query.user_id ?? currentUser.id;

    // 타인 조회는 관리자 이상만
    if (targetUserId !== currentUser.id && currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('관리자만 타인의 임금 정보를 조회할 수 있습니다.');
    }

    const [records, user] = await Promise.all([
      this.attendanceRepo.find({
        where: {
          companyId: currentUser.companyId,
          userId: targetUserId,
          workDate: Between(query.start_date, query.end_date) as any,
        },
        order: { workDate: 'ASC' },
        select: ['workDate', 'totalWorkMinutes', 'roundedWorkMinutes', 'wageAmount',
                 'isLate', 'lateMinutes', 'status'] as any,
      }),
      this.userRepo.findOne({
        where: { id: targetUserId },
        select: ['name', 'hourlyRate'] as any,
      }),
    ]);

    const totalWage       = records.reduce((s, r) => s + (Number((r as any).wageAmount) || 0), 0);
    const totalNetMinutes = records.reduce((s, r) => s + ((r as any).roundedWorkMinutes ?? 0), 0);
    const totalRawMinutes = records.reduce((s, r) => s + (r.totalWorkMinutes ?? 0), 0);

    // 주휴수당 계산 (주 15h 이상 → 1일 평균 근무시간 × 시급)
    const weeklyHours    = totalNetMinutes / 60;
    const avgDailyHours  = records.filter(r => r.clockInAt).length
      ? weeklyHours / records.filter(r => (r as any).roundedWorkMinutes > 0).length
      : 0;
    const weeklyHolidayPay = weeklyHours >= 15 && (user as any)?.hourlyRate
      ? Math.round(avgDailyHours * Number((user as any).hourlyRate))
      : 0;

    return {
      userId:            targetUserId,
      userName:          (user as any)?.name,
      hourlyRate:        (user as any)?.hourlyRate ? Number((user as any).hourlyRate) : null,
      period:            { start: query.start_date, end: query.end_date },
      totalRawMinutes,
      totalRawHours:     Math.round(totalRawMinutes / 60 * 10) / 10,
      totalNetMinutes,
      totalNetHours:     Math.round(totalNetMinutes / 60 * 10) / 10,
      totalWage:         Math.round(totalWage),
      weeklyHolidayPay,
      qualifiesForWeeklyHolidayPay: weeklyHours >= 15,
      records: records.map(r => ({
        workDate:           r.workDate,
        totalWorkMinutes:   r.totalWorkMinutes,
        roundedWorkMinutes: (r as any).roundedWorkMinutes,
        wageAmount:         (r as any).wageAmount ? Number((r as any).wageAmount) : null,
        isLate:             r.isLate,
        lateMinutes:        r.lateMinutes,
        status:             r.status,
      })),
    };
  }

  // ─────────────────────────────────────────
  // 분 단위 반올림 적용
  // ─────────────────────────────────────────
  /**
   * policy: floor(절사), round(반올림), ceil(올림)
   * unit: 1, 5, 10, 15, 30 (분)
   */
  private applyRounding(minutes: number, unit: number, policy: string): number {
    if (unit <= 1) return minutes;
    switch (policy) {
      case 'round': return Math.round(minutes / unit) * unit;
      case 'ceil':  return Math.ceil(minutes / unit) * unit;
      case 'floor':
      default:      return Math.floor(minutes / unit) * unit;
    }
  }

  // ─────────────────────────────────────────
  // 근무 확인 SMS 발송 (파트타임 특화)
  // ─────────────────────────────────────────
  private async sendWorkConfirmSms(
    action: 'clock-in' | 'clock-out',
    record: AttendanceRecord,
    company: Partial<Company>,
    userSchedule: Partial<{ phone: string | null }> | null,
  ): Promise<void> {
    if (!(company as any).workConfirmSmsEnabled) return;
    const phone = (userSchedule as any)?.phone as string | null;
    if (!phone) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul',
    });

    let msg: string;
    if (action === 'clock-in') {
      msg = `[관리왕] ${record.workDate} 출근 확인\n출근 시각: ${timeStr}\n본인이 아닌 경우 사업주에게 즉시 알려주세요.`;
    } else {
      const netMin  = record.roundedWorkMinutes ?? record.totalWorkMinutes ?? 0;
      const netH    = Math.floor(netMin / 60);
      const netM    = netMin % 60;
      const wageStr = record.wageAmount
        ? `\n오늘 임금: ${Math.round(Number(record.wageAmount)).toLocaleString()}원`
        : '';
      msg = `[관리왕] ${record.workDate} 퇴근 확인\n퇴근 시각: ${timeStr}\n실 근무: ${netH}h ${netM}m${wageStr}`;
    }

    // fire-and-forget (실패해도 출퇴근 처리에는 영향 없음)
    this.smsService.send(phone, msg).catch(() => {});
  }

  // ─────────────────────────────────────────
  // 야간 근무 시간 계산 (현장직 특화)
  // nightStartHour ~ nightEndHour 구간(기본 22~06시)에 해당하는 분수 계산
  // ─────────────────────────────────────────
  /**
   * clockIn ~ clockOut 사이에서 야간 구간(nightStart~nextDay nightEnd)에 겹치는 분수를 반환한다.
   * 예: 21:00 ~ 02:00 출근, nightStart=22, nightEnd=6 → 22:00~02:00 = 240분
   */
  calcNightWorkMinutes(
    clockIn: Date,
    clockOut: Date,
    nightStartHour: number,
    nightEndHour: number,
  ): number {
    const totalMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000);
    if (totalMinutes <= 0) return 0;

    // 1분 단위로 순회하는 방식 대신 구간 교차 계산 (효율적)
    // 하루(1440분) 단위로 나누어 처리
    let nightMinutes = 0;
    const MS_PER_MIN = 60000;

    // clockIn부터 clockOut까지 각 분의 KST 시간을 확인
    // 최대 48시간(연속 근무 최대치) 범위 내에서 계산
    const maxMinutes = Math.min(totalMinutes, 48 * 60);
    for (let i = 0; i < maxMinutes; i++) {
      const t = new Date(clockIn.getTime() + i * MS_PER_MIN);
      const kstHour = (t.getUTCHours() + 9) % 24;
      const isNight = nightStartHour > nightEndHour
        ? (kstHour >= nightStartHour || kstHour < nightEndHour)  // 22~06 (자정 넘어감)
        : (kstHour >= nightStartHour && kstHour < nightEndHour); // 예외: nightEnd가 더 큰 경우
      if (isNight) nightMinutes++;
    }

    return nightMinutes;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 사업주 현황판 (Owner Board)
  // ─────────────────────────────────────────────────────────────────────────

  private kstToday(): string {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  /**
   * 오늘 출근 현황 요약 + 현재 근무 중인 직원 목록
   * 기존 attendance_records + users 테이블만 사용 — 추가 스토리지 없음
   */
  async getOwnerBoard(user: AuthenticatedUser) {
    if (user.role === UserRole.EMPLOYEE) throw new ForbiddenException();

    const today = this.kstToday();

    // 상태별 집계 (GROUP BY 1 쿼리)
    const statusRows = await this.attendanceRepo
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .where('a.company_id = :cid', { cid: user.companyId })
      .andWhere('a.work_date = :d', { d: today })
      .groupBy('a.status')
      .getRawMany<{ status: string; cnt: string }>();

    const by: Record<string, number> = {};
    for (const r of statusRows) by[r.status] = Number(r.cnt);

    const present = ['normal', 'late', 'early_leave', 'half_day']
      .reduce((s, st) => s + (by[st] ?? 0), 0);

    // 총 재직자 수 (소프트 딜리트 제외)
    const totalEmployees = await this.userRepo
      .createQueryBuilder('u')
      .where('u.company_id = :cid', { cid: user.companyId })
      .andWhere('u.deleted_at IS NULL')
      .getCount();

    // 현재 근무 중 (출근O, 퇴근X) — 최소 필드만 select
    const working = await this.attendanceRepo
      .createQueryBuilder('a')
      .innerJoin('a.user', 'u')
      .select('a.clock_in_at',    'clockInAt')
      .addSelect('a.work_location', 'workLocation')
      .addSelect('u.id',           'userId')
      .addSelect('u.name',         'name')
      .addSelect('u.department',   'department')
      .addSelect('u.position',     'position')
      .where('a.company_id = :cid', { cid: user.companyId })
      .andWhere('a.work_date = :d', { d: today })
      .andWhere('a.clock_in_at IS NOT NULL')
      .andWhere('a.clock_out_at IS NULL')
      .orderBy('a.clock_in_at', 'ASC')
      .getRawMany<{
        clockInAt: Date; workLocation: string;
        userId: string; name: string; department: string | null; position: string | null;
      }>();

    return {
      date: today,
      totalEmployees,
      present,
      late:     by['late']    ?? 0,
      absent:   by['absent']  ?? 0,
      vacation: by['vacation']?? 0,
      pending:  by['pending'] ?? 0,
      currentlyWorking: working,
    };
  }

  /**
   * 특정 날짜·시각에 근무 중이었던 직원 조회
   * 기존 인덱스 (company_id, work_date) 활용 — O(log N) 접근
   */
  async whoWasThere(user: AuthenticatedUser, date: string, time: string) {
    if (user.role === UserRole.EMPLOYEE) throw new ForbiddenException();

    // KST 'HH:mm' → UTC Date
    const targetUtc = new Date(`${date}T${time.length === 5 ? time : time + ':00'}:00+09:00`);

    const rows = await this.attendanceRepo
      .createQueryBuilder('a')
      .innerJoin('a.user', 'u')
      .select('a.clock_in_at',    'clockInAt')
      .addSelect('a.clock_out_at', 'clockOutAt')
      .addSelect('a.work_location', 'workLocation')
      .addSelect('a.status',       'status')
      .addSelect('u.id',           'userId')
      .addSelect('u.name',         'name')
      .addSelect('u.department',   'department')
      .addSelect('u.position',     'position')
      .where('a.company_id = :cid', { cid: user.companyId })
      .andWhere('a.work_date = :date', { date })
      .andWhere('a.clock_in_at IS NOT NULL')
      .andWhere('a.clock_in_at <= :t', { t: targetUtc })
      .andWhere('(a.clock_out_at IS NULL OR a.clock_out_at >= :t)', { t: targetUtc })
      .orderBy('a.clock_in_at', 'ASC')
      .getRawMany<{
        clockInAt: Date; clockOutAt: Date | null; workLocation: string; status: string;
        userId: string; name: string; department: string | null; position: string | null;
      }>();

    return rows;
  }

  /**
   * 일별 출근 추이 (최근 N일)
   * GROUP BY work_date — 집계만, 행 단위 조회 없음
   */
  async getDailyTrend(user: AuthenticatedUser, days = 30) {
    if (user.role === UserRole.EMPLOYEE) throw new ForbiddenException();

    const endStr   = this.kstToday();
    const startStr = new Date(Date.now() - (days - 1) * 86_400_000 + 9 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    return this.attendanceRepo
      .createQueryBuilder('a')
      .select('a.work_date', 'date')
      .addSelect(
        `COUNT(CASE WHEN a.status IN ('normal','late','early_leave','half_day') THEN 1 END)`,
        'present',
      )
      .addSelect(`COUNT(CASE WHEN a.status = 'late'   THEN 1 END)`, 'late')
      .addSelect(`COUNT(CASE WHEN a.status = 'absent' THEN 1 END)`, 'absent')
      .where('a.company_id = :cid', { cid: user.companyId })
      .andWhere('a.work_date >= :s', { s: startStr })
      .andWhere('a.work_date <= :e', { e: endStr })
      .groupBy('a.work_date')
      .orderBy('a.work_date', 'ASC')
      .getRawMany<{ date: string; present: string; late: string; absent: string }>()
      .then(rows => rows.map(r => ({
        date:    r.date,
        present: Number(r.present),
        late:    Number(r.late),
        absent:  Number(r.absent),
      })));
  }
}
