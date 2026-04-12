import {
  Injectable, ConflictException, NotFoundException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, Not } from 'typeorm';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AttendanceRecord, AttendanceStatus } from '../../database/entities/attendance-record.entity';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import { TeamsService } from '../teams/teams.service';
import {
  ClockInDto, ClockOutDto, UpdateAttendanceDto,
  AttendanceQueryDto, AttendanceReportQueryDto,
  AttendanceMethod,
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
  ) {}

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

    // 회사 설정 조회 (근무 시간 + GPS + 출퇴근 방식)
    const company = await this.companyRepo.findOne({
      where: { id: currentUser.companyId },
      select: [
        'workStartTime', 'lateThresholdMin', 'timezone',
        'gpsEnabled', 'gpsLat', 'gpsLng', 'gpsRadiusM',
        'attendanceMethods',
      ] as any,
    });

    // 개인 근무 스케줄 조회 (customWorkStart/End/lateThresholdMinOverride)
    const userSchedule = await this.userRepo.findOne({
      where: { id: currentUser.id },
      select: ['customWorkStart', 'customWorkEnd', 'lateThresholdMinOverride', 'breakMinutes'] as any,
    });

    // 출퇴근 방식 검증
    const method = await this.resolveAndValidateMethod(dto, company ?? {}, 'clock-in');

    const now = new Date();
    // 개인 스케줄 우선, 없으면 회사 기본값
    const effectiveSchedule = this.mergeSchedule(userSchedule, company ?? {});
    const { isLate, lateMinutes } = this.calcLateStatus(now, effectiveSchedule);

    // GPS 검증 (gps 방식이거나 회사 GPS 활성화 시)
    const gpsResult = this.validateGps(dto.latitude ?? null, dto.longitude ?? null, dto.accuracyM ?? null, company ?? {});

    const clockInData = {
      clockInAt: now,
      clockInLat: dto.latitude ?? null,
      clockInLng: dto.longitude ?? null,
      clockInDistanceM: gpsResult.distanceM,
      clockInOutOfRange: gpsResult.outOfRange,
      gpsBypassed: gpsResult.bypassed,
      clockInMethod: method,
      isLate,
      lateMinutes: isLate ? lateMinutes : null,
      status: isLate ? AttendanceStatus.LATE : AttendanceStatus.NORMAL,
    };

    if (existing) {
      Object.assign(existing, clockInData);
      const saved = await this.attendanceRepo.save(existing);
      return { ...saved, gps: gpsResult };
    }

    const record = this.attendanceRepo.create({
      companyId: currentUser.companyId,
      userId: currentUser.id,
      workDate: today,
      ...clockInData,
    });

    const saved = await this.attendanceRepo.save(record);
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
      select: ['workEndTime', 'attendanceMethods'] as any,
    });

    const userSchedule = await this.userRepo.findOne({
      where: { id: currentUser.id },
      select: ['customWorkStart', 'customWorkEnd', 'lateThresholdMinOverride', 'breakMinutes'] as any,
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

    record.clockOutAt = now;
    record.clockOutLat = dto.latitude ?? null;
    record.clockOutLng = dto.longitude ?? null;
    record.clockOutMethod = method;
    record.totalWorkMinutes = totalWorkMinutes;
    record.breakMinutes = breakMinutes;

    if (isEarlyLeave && record.status === AttendanceStatus.NORMAL) {
      record.status = AttendanceStatus.EARLY_LEAVE;
    }

    return this.attendanceRepo.save(record);
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

  private calcAvgTime(times: Date[]): string | null {
    if (!times.length) return null;
    const avg = times.reduce((sum, t) => sum + t.getHours() * 60 + t.getMinutes(), 0) / times.length;
    const h = Math.floor(avg / 60);
    const m = Math.round(avg % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
