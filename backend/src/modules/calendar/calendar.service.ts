import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Or } from 'typeorm';
import {
  CalendarEvent,
  CalendarEventScope,
} from '../../database/entities/calendar-event.entity';
import { User } from '../../database/entities/user.entity';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateCalendarEventDto, UpdateCalendarEventDto, CalendarQueryDto,
} from './dto/calendar.dto';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEvent) private eventRepo: Repository<CalendarEvent>,
    @InjectRepository(User)          private userRepo: Repository<User>,
    @InjectRepository(AttendanceRecord) private attendanceRepo: Repository<AttendanceRecord>,
  ) {}

  // ─── 이벤트 목록 (해당 월 전체, 권한 필터) ──────────
  async getEvents(currentUser: AuthenticatedUser, query: CalendarQueryDto) {
    const { startDate, endDate } = this.monthRange(query.year, query.month);

    const qb = this.eventRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.creator', 'creator')
      .where('e.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('e.start_date <= :end', { end: endDate })
      .andWhere('e.end_date >= :start', { start: startDate });

    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);

    if (isAdmin) {
      // 관리자: 전사 + 팀(부서 필터) + 본인 개인
      if (query.department) {
        qb.andWhere(
          '(e.scope = :company OR (e.scope = :team AND e.target_department = :dept) OR (e.scope = :personal AND e.creator_id = :me))',
          {
            company: CalendarEventScope.COMPANY,
            team: CalendarEventScope.TEAM,
            dept: query.department,
            personal: CalendarEventScope.PERSONAL,
            me: currentUser.id,
          },
        );
      } else {
        // 전체 조회 (모든 팀 포함)
        qb.andWhere(
          '(e.scope IN (:...shared) OR e.creator_id = :me)',
          {
            shared: [CalendarEventScope.COMPANY, CalendarEventScope.TEAM],
            me: currentUser.id,
          },
        );
      }
    } else {
      // 직원: 전사 + 본인 팀 공지 + 본인 개인
      const myDept = currentUser.department ?? null;
      if (myDept) {
        qb.andWhere(
          '(e.scope = :company OR (e.scope = :team AND (e.target_department = :dept OR e.target_department IS NULL)) OR (e.scope = :personal AND e.creator_id = :me))',
          {
            company: CalendarEventScope.COMPANY,
            team: CalendarEventScope.TEAM,
            dept: myDept,
            personal: CalendarEventScope.PERSONAL,
            me: currentUser.id,
          },
        );
      } else {
        qb.andWhere(
          '(e.scope = :company OR (e.scope = :personal AND e.creator_id = :me))',
          {
            company: CalendarEventScope.COMPANY,
            personal: CalendarEventScope.PERSONAL,
            me: currentUser.id,
          },
        );
      }
    }

    qb.orderBy('e.start_date', 'ASC');
    const events = await qb.getMany();
    return events.map(e => this.toResponse(e, currentUser.id));
  }

  // ─── 근태 캘린더 데이터 (관리자) ───────────────────
  async getAttendanceCalendar(currentUser: AuthenticatedUser, query: CalendarQueryDto) {
    if (![UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role)) {
      throw new ForbiddenException();
    }
    const { startDate, endDate } = this.monthRange(query.year, query.month);

    // 직원 목록
    const userQb = this.userRepo.createQueryBuilder('u')
      .where('u.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('u.deleted_at IS NULL')
      .select(['u.id', 'u.name', 'u.department', 'u.position', 'u.employee_number']);

    if (query.department) {
      userQb.andWhere('u.department = :dept', { dept: query.department });
    }
    const users = await userQb.getMany();

    // 해당 월 근태 레코드
    const records = await this.attendanceRepo.createQueryBuilder('a')
      .where('a.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('a.work_date >= :start', { start: startDate })
      .andWhere('a.work_date <= :end', { end: endDate })
      .select(['a.id', 'a.user_id', 'a.work_date', 'a.status', 'a.clock_in_at', 'a.clock_out_at', 'a.total_work_minutes', 'a.is_late'])
      .getMany();

    // userId별 Map
    const recordMap = new Map<string, Record<string, typeof records[0]>>();
    for (const r of records) {
      if (!recordMap.has(r.userId)) recordMap.set(r.userId, {});
      recordMap.get(r.userId)![r.workDate] = r;
    }

    return {
      users: users.map(u => ({
        id: u.id, name: u.name,
        department: u.department, position: u.position,
        employeeNumber: u.employeeNumber,
      })),
      records: Object.fromEntries(
        users.map(u => {
          const byDate = recordMap.get(u.id) ?? {};
          return [u.id, Object.fromEntries(
            Object.entries(byDate).map(([date, rec]) => [date, {
              status: rec.status,
              isLate: rec.isLate,
              clockIn: rec.clockInAt ? new Date(rec.clockInAt).toTimeString().slice(0, 5) : null,
              clockOut: rec.clockOutAt ? new Date(rec.clockOutAt).toTimeString().slice(0, 5) : null,
              totalMin: rec.totalWorkMinutes,
            }]),
          )];
        }),
      ),
      year: query.year,
      month: query.month,
    };
  }

  // ─── 이벤트 생성 ────────────────────────────────────
  async createEvent(dto: CreateCalendarEventDto, currentUser: AuthenticatedUser) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);

    if (dto.scope === CalendarEventScope.COMPANY && !isAdmin) {
      throw new ForbiddenException('전사 공지는 관리자만 작성할 수 있습니다.');
    }
    if (dto.scope === CalendarEventScope.TEAM && !isAdmin) {
      throw new ForbiddenException('팀 공지는 관리자만 작성할 수 있습니다.');
    }
    if (dto.start_date > dto.end_date) {
      throw new BadRequestException('종료일은 시작일 이후여야 합니다.');
    }

    const event = this.eventRepo.create({
      companyId: currentUser.companyId,
      creatorId: currentUser.id,
      scope: dto.scope,
      targetDepartment: dto.target_department ?? null,
      title: dto.title,
      description: dto.description ?? null,
      startDate: dto.start_date,
      endDate: dto.end_date,
      allDay: dto.all_day ?? true,
      color: dto.color ?? null,
    });
    const saved = await this.eventRepo.save(event);
    const loaded = await this.eventRepo.findOne({ where: { id: saved.id }, relations: ['creator'] });
    return this.toResponse(loaded!, currentUser.id);
  }

  // ─── 이벤트 수정 ────────────────────────────────────
  async updateEvent(id: string, dto: UpdateCalendarEventDto, currentUser: AuthenticatedUser) {
    const event = await this.loadOrFail(id, currentUser.companyId);
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && event.creatorId !== currentUser.id) {
      throw new ForbiddenException('수정 권한이 없습니다.');
    }
    Object.assign(event, {
      ...(dto.title       !== undefined && { title:       dto.title }),
      ...(dto.description !== undefined && { description: dto.description ?? null }),
      ...(dto.start_date  !== undefined && { startDate:   dto.start_date }),
      ...(dto.end_date    !== undefined && { endDate:     dto.end_date }),
      ...(dto.color       !== undefined && { color:       dto.color ?? null }),
    });
    await this.eventRepo.save(event);
    const loaded = await this.eventRepo.findOne({ where: { id }, relations: ['creator'] });
    return this.toResponse(loaded!, currentUser.id);
  }

  // ─── 이벤트 삭제 ────────────────────────────────────
  async deleteEvent(id: string, currentUser: AuthenticatedUser) {
    const event = await this.loadOrFail(id, currentUser.companyId);
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && event.creatorId !== currentUser.id) {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }
    await this.eventRepo.softDelete(id);
    return { id };
  }

  // ─── 부서 목록 ──────────────────────────────────────
  async getDepartments(currentUser: AuthenticatedUser) {
    const rows = await this.userRepo
      .createQueryBuilder('u')
      .select('DISTINCT u.department', 'department')
      .where('u.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('u.department IS NOT NULL')
      .getRawMany();
    return rows.map(r => r.department as string).filter(Boolean);
  }

  // ─── 내부 헬퍼 ──────────────────────────────────────
  private monthRange(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0); // last day of month
    return {
      startDate: start.toISOString().split('T')[0],
      endDate:   end.toISOString().split('T')[0],
    };
  }

  private async loadOrFail(id: string, companyId: string): Promise<CalendarEvent> {
    const e = await this.eventRepo.findOne({ where: { id, companyId } });
    if (!e) throw new NotFoundException('일정을 찾을 수 없습니다.');
    return e;
  }

  private toResponse(e: CalendarEvent, myId: string) {
    return {
      id: e.id,
      scope: e.scope,
      targetDepartment: e.targetDepartment,
      title: e.title,
      description: e.description,
      startDate: e.startDate,
      endDate: e.endDate,
      allDay: e.allDay,
      color: e.color,
      createdAt: e.createdAt,
      isMine: e.creatorId === myId,
      creator: e.creator
        ? { id: e.creator.id, name: e.creator.name }
        : null,
    };
  }
}
