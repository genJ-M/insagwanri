import {
  Injectable, ConflictException, NotFoundException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, Not } from 'typeorm';
import { AttendanceRecord, AttendanceStatus } from '../../database/entities/attendance-record.entity';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  ClockInDto, ClockOutDto, UpdateAttendanceDto,
  AttendanceQueryDto, AttendanceReportQueryDto,
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
  ) {}

  // ─────────────────────────────────────────
  // 출근
  // ─────────────────────────────────────────
  async clockIn(currentUser: AuthenticatedUser, dto: ClockInDto) {
    const today = this.getTodayDate();

    // 당일 중복 출근 방지
    const existing = await this.attendanceRepo.findOne({
      where: { userId: currentUser.id, workDate: today },
    });

    if (existing?.clockInAt) {
      throw new ConflictException('이미 출근 처리되었습니다.');
    }

    // 회사 설정 조회 (근무 시간 + GPS)
    const company = await this.companyRepo.findOne({
      where: { id: currentUser.companyId },
      select: [
        'workStartTime', 'lateThresholdMin', 'timezone',
        'gpsEnabled', 'gpsLat', 'gpsLng', 'gpsRadiusM',
      ] as any,
    });

    const now = new Date();
    const { isLate, lateMinutes } = this.calcLateStatus(now, company ?? {});

    // GPS 검증
    const gpsResult = this.validateGps(dto.latitude ?? null, dto.longitude ?? null, dto.accuracyM ?? null, company ?? {});

    const clockInData = {
      clockInAt: now,
      clockInLat: dto.latitude ?? null,
      clockInLng: dto.longitude ?? null,
      clockInDistanceM: gpsResult.distanceM,
      clockInOutOfRange: gpsResult.outOfRange,
      gpsBypassed: gpsResult.bypassed,
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

    if (record.clockOutAt) {
      throw new ConflictException('이미 퇴근 처리되었습니다.');
    }

    const now = new Date();
    const company = await this.companyRepo.findOne({
      where: { id: currentUser.companyId },
      select: ['workEndTime'],
    });

    const totalWorkMinutes = Math.floor(
      (now.getTime() - record.clockInAt.getTime()) / 60000,
    );

    const isEarlyLeave = this.isEarlyLeave(now, company ?? {});

    record.clockOutAt = now;
    record.clockOutLat = dto.latitude ?? null;
    record.clockOutLng = dto.longitude ?? null;
    record.totalWorkMinutes = totalWorkMinutes;

    if (isEarlyLeave && record.status === AttendanceStatus.NORMAL) {
      record.status = AttendanceStatus.EARLY_LEAVE;
    }

    return this.attendanceRepo.save(record);
  }

  // ─────────────────────────────────────────
  // 근태 목록 (관리자)
  // ─────────────────────────────────────────
  async getAttendanceList(currentUser: AuthenticatedUser, query: AttendanceQueryDto) {
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

    // 수정 시 근무시간 재계산
    if (record.clockInAt && record.clockOutAt) {
      record.totalWorkMinutes = Math.floor(
        (record.clockOutAt.getTime() - record.clockInAt.getTime()) / 60000,
      );
    }

    record.approvedBy = currentUser.id;
    record.approvedAt = new Date();

    return this.attendanceRepo.save(record);
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

  private calcLateStatus(now: Date, company: Partial<Company>) {
    if (!company?.workStartTime) return { isLate: false, lateMinutes: 0 };

    const [h, m] = company.workStartTime.split(':').map(Number);
    const threshold = company.lateThresholdMin ?? 10;

    const workStart = new Date(now);
    workStart.setHours(h, m + threshold, 0, 0);

    const lateMinutes = Math.floor((now.getTime() - workStart.getTime()) / 60000);
    return { isLate: lateMinutes > 0, lateMinutes: Math.max(lateMinutes, 0) };
  }

  private isEarlyLeave(now: Date, company: Partial<Company>): boolean {
    if (!company?.workEndTime) return false;
    const [h, m] = company.workEndTime.split(':').map(Number);
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
