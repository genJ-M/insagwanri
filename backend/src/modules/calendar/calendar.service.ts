import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CalendarEvent,
  CalendarEventScope,
} from '../../database/entities/calendar-event.entity';
import {
  CalendarEventShare,
  ShareRecipientType,
} from '../../database/entities/calendar-event-share.entity';
import {
  CalendarShareRequest,
  ShareRequestStatus,
} from '../../database/entities/calendar-share-request.entity';
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
    @InjectRepository(CalendarEventShare) private shareRepo: Repository<CalendarEventShare>,
    @InjectRepository(CalendarShareRequest) private shareRequestRepo: Repository<CalendarShareRequest>,
    @InjectRepository(User)          private userRepo: Repository<User>,
    @InjectRepository(AttendanceRecord) private attendanceRepo: Repository<AttendanceRecord>,
  ) {}

  // ─── 이벤트 목록 (프라이버시 강화: 팀 격리) ──────────
  async getEvents(currentUser: AuthenticatedUser, query: CalendarQueryDto) {
    const { startDate, endDate } = this.monthRange(query.year, query.month);
    const myDept = currentUser.department ?? null;

    /*
     * 접근 가능 이벤트:
     * 1. COMPANY scope — 전사 공개
     * 2. TEAM scope    — 내 소속 부서(or 내가 관리하는 부서)의 이벤트만
     * 3. PERSONAL scope — 내가 만든 이벤트만
     * 4. 공유받은 이벤트 (calendar_event_shares 테이블, revoked_at IS NULL)
     */

    // 공유받은 이벤트 ID 수집
    const sharedEventIds = await this.getSharedEventIds(currentUser);

    const qb = this.eventRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.creator', 'creator')
      .where('e.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('e.start_date <= :end', { end: endDate })
      .andWhere('e.end_date >= :start', { start: startDate })
      .andWhere('e.deleted_at IS NULL');

    // 내가 속한 부서 + 내가 관리하는 부서 목록
    const myDepts: string[] = [];
    if (myDept) myDepts.push(myDept);
    if (currentUser.managedDepartments?.length) {
      myDepts.push(...currentUser.managedDepartments);
    }

    if (sharedEventIds.length > 0) {
      // 공유 이벤트 포함 조건
      qb.andWhere(
        `(
          e.scope = :company
          OR (e.scope = :team AND (e.target_department IN (:...myDepts) OR e.target_department IS NULL AND :hasDepts = false))
          OR (e.scope = :personal AND e.creator_id = :me)
          OR e.id IN (:...sharedIds)
        )`,
        {
          company: CalendarEventScope.COMPANY,
          team: CalendarEventScope.TEAM,
          myDepts: myDepts.length > 0 ? myDepts : ['__none__'],
          hasDepts: myDepts.length > 0,
          personal: CalendarEventScope.PERSONAL,
          me: currentUser.id,
          sharedIds: sharedEventIds,
        },
      );
    } else {
      if (myDepts.length > 0) {
        qb.andWhere(
          `(
            e.scope = :company
            OR (e.scope = :team AND e.target_department IN (:...myDepts))
            OR (e.scope = :personal AND e.creator_id = :me)
          )`,
          {
            company: CalendarEventScope.COMPANY,
            team: CalendarEventScope.TEAM,
            myDepts,
            personal: CalendarEventScope.PERSONAL,
            me: currentUser.id,
          },
        );
      } else {
        qb.andWhere(
          `(e.scope = :company OR (e.scope = :personal AND e.creator_id = :me))`,
          { company: CalendarEventScope.COMPANY, personal: CalendarEventScope.PERSONAL, me: currentUser.id },
        );
      }
    }

    if (query.department && [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role)) {
      // 관리자가 특정 팀 필터 적용 — 단 해당 팀 관리 권한 확인
      const canSee = this.canManageDepartment(currentUser, query.department);
      if (canSee) {
        // 이미 위 where에서 myDepts에 포함돼 있으면 ok
      }
    }

    qb.orderBy('e.start_date', 'ASC');
    const events = await qb.getMany();

    // 공유 여부 표시
    const sharesByEventId = await this.getSharesByEventIds(
      events.map(e => e.id),
      currentUser.companyId,
    );

    return events.map(e => this.toResponse(e, currentUser.id, sharedEventIds, sharesByEventId[e.id] ?? []));
  }

  // ─── 근태 캘린더 데이터 (관리자) ───────────────────
  async getAttendanceCalendar(currentUser: AuthenticatedUser, query: CalendarQueryDto) {
    if (![UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role)) {
      throw new ForbiddenException();
    }
    const { startDate, endDate } = this.monthRange(query.year, query.month);

    const userQb = this.userRepo.createQueryBuilder('u')
      .where('u.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('u.deleted_at IS NULL')
      .select(['u.id', 'u.name', 'u.department', 'u.position', 'u.employee_number']);

    if (query.department) {
      userQb.andWhere('u.department = :dept', { dept: query.department });
    }
    const users = await userQb.getMany();

    const records = await this.attendanceRepo.createQueryBuilder('a')
      .where('a.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('a.work_date >= :start', { start: startDate })
      .andWhere('a.work_date <= :end', { end: endDate })
      .select(['a.id', 'a.user_id', 'a.work_date', 'a.status', 'a.clock_in_at', 'a.clock_out_at', 'a.total_work_minutes', 'a.is_late'])
      .getMany();

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
    return this.toResponse(loaded!, currentUser.id, [], {});
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
    return this.toResponse(loaded!, currentUser.id, [], {});
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

  // ─── 이벤트 공유 (개인→유저, 팀→팀) ────────────────
  async shareEvent(
    eventId: string,
    currentUser: AuthenticatedUser,
    recipientType: ShareRecipientType,
    recipientUserId?: string,
    recipientDepartment?: string,
    note?: string,
  ) {
    const event = await this.loadOrFail(eventId, currentUser.companyId);

    if (event.scope === CalendarEventScope.COMPANY) {
      throw new BadRequestException('전사 공지는 공유 설정이 필요 없습니다.');
    }

    // PERSONAL 이벤트: 본인만 공유 가능, user 타입만 가능
    if (event.scope === CalendarEventScope.PERSONAL) {
      if (event.creatorId !== currentUser.id) {
        throw new ForbiddenException('본인 이벤트만 공유할 수 있습니다.');
      }
      if (recipientType !== ShareRecipientType.USER || !recipientUserId) {
        throw new BadRequestException('개인 일정은 특정 사용자에게만 공유할 수 있습니다.');
      }
      // 중복 공유 방지
      const existing = await this.shareRepo.findOne({
        where: { eventId, recipientUserId, revokedAt: undefined as any },
      });
      if (existing && !existing.revokedAt) {
        throw new BadRequestException('이미 공유 중인 사용자입니다.');
      }
      const share = this.shareRepo.create({
        eventId, companyId: currentUser.companyId,
        sharedBy: currentUser.id,
        recipientType: ShareRecipientType.USER,
        recipientUserId,
        recipientDepartment: null,
        revokedAt: null,
      });
      return this.shareRepo.save(share);
    }

    // TEAM 이벤트: 팀장(이 팀의 manager)만 직접 공유, 팀원은 요청
    if (event.scope === CalendarEventScope.TEAM) {
      if (recipientType !== ShareRecipientType.DEPARTMENT || !recipientDepartment) {
        throw new BadRequestException('팀 일정은 다른 부서와 공유할 수 있습니다.');
      }
      const isTeamLeader = this.canManageDepartment(currentUser, event.targetDepartment ?? '');
      if (isTeamLeader) {
        // 팀장: 직접 공유
        const existing = await this.shareRepo.findOne({
          where: { eventId, recipientDepartment },
        });
        if (existing && !existing.revokedAt) {
          throw new BadRequestException('이미 해당 부서에 공유 중입니다.');
        }
        const share = this.shareRepo.create({
          eventId, companyId: currentUser.companyId,
          sharedBy: currentUser.id,
          recipientType: ShareRecipientType.DEPARTMENT,
          recipientUserId: null,
          recipientDepartment,
          revokedAt: null,
        });
        return this.shareRepo.save(share);
      } else {
        // 팀원: 팀장 승인 요청 생성
        const existingReq = await this.shareRequestRepo.findOne({
          where: { eventId, targetDepartment: recipientDepartment, status: ShareRequestStatus.PENDING },
        });
        if (existingReq) {
          throw new BadRequestException('이미 해당 부서에 대한 공유 요청이 진행 중입니다.');
        }
        const req = this.shareRequestRepo.create({
          eventId, companyId: currentUser.companyId,
          requestedBy: currentUser.id,
          targetDepartment: recipientDepartment,
          status: ShareRequestStatus.PENDING,
          note: note ?? null,
        });
        return { type: 'request', data: await this.shareRequestRepo.save(req) };
      }
    }
  }

  // ─── 공유 철회 ──────────────────────────────────────
  async revokeShare(shareId: string, currentUser: AuthenticatedUser) {
    const share = await this.shareRepo.findOne({
      where: { id: shareId, companyId: currentUser.companyId },
      relations: ['event'],
    });
    if (!share) throw new NotFoundException('공유 정보를 찾을 수 없습니다.');
    if (share.revokedAt) throw new BadRequestException('이미 철회된 공유입니다.');

    // 공유자 또는 이벤트 생성자만 철회 가능
    if (share.sharedBy !== currentUser.id && share.event.creatorId !== currentUser.id) {
      const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
      if (!isAdmin) throw new ForbiddenException('공유 철회 권한이 없습니다.');
    }
    share.revokedAt = new Date();
    return this.shareRepo.save(share);
  }

  // ─── 이벤트 공유 목록 조회 ──────────────────────────
  async getEventShares(eventId: string, currentUser: AuthenticatedUser) {
    const event = await this.loadOrFail(eventId, currentUser.companyId);
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && event.creatorId !== currentUser.id) {
      throw new ForbiddenException('공유 목록 조회 권한이 없습니다.');
    }
    return this.shareRepo.find({
      where: { eventId, companyId: currentUser.companyId },
      relations: ['sharedByUser', 'recipientUser'],
      order: { sharedAt: 'DESC' },
    });
  }

  // ─── 팀장: 공유 요청 승인/거절 ─────────────────────
  async decideShareRequest(
    requestId: string,
    currentUser: AuthenticatedUser,
    approve: boolean,
  ) {
    const req = await this.shareRequestRepo.findOne({
      where: { id: requestId, companyId: currentUser.companyId },
      relations: ['event'],
    });
    if (!req) throw new NotFoundException('공유 요청을 찾을 수 없습니다.');
    if (req.status !== ShareRequestStatus.PENDING) {
      throw new BadRequestException('이미 처리된 요청입니다.');
    }

    // 팀장 확인: 이벤트 소속 팀의 manager
    const isTeamLeader = this.canManageDepartment(currentUser, req.event.targetDepartment ?? '');
    if (!isTeamLeader) throw new ForbiddenException('팀장만 공유 요청을 처리할 수 있습니다.');

    req.status = approve ? ShareRequestStatus.APPROVED : ShareRequestStatus.REJECTED;
    req.decidedBy = currentUser.id;
    req.decidedAt = new Date();
    await this.shareRequestRepo.save(req);

    if (approve) {
      // 공유 레코드 생성
      const share = this.shareRepo.create({
        eventId: req.eventId,
        companyId: currentUser.companyId,
        sharedBy: currentUser.id,
        recipientType: ShareRecipientType.DEPARTMENT,
        recipientUserId: null,
        recipientDepartment: req.targetDepartment,
        revokedAt: null,
      });
      await this.shareRepo.save(share);
    }

    return req;
  }

  // ─── 내 팀 공유 요청 목록 (팀장용) ─────────────────
  async getPendingShareRequests(currentUser: AuthenticatedUser) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin) throw new ForbiddenException();

    const managedDepts = currentUser.managedDepartments ?? [];
    if (managedDepts.length === 0) return [];

    // 내가 관리하는 부서의 팀 이벤트에 대한 대기 중 요청
    return this.shareRequestRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.event', 'event')
      .leftJoinAndSelect('r.requester', 'requester')
      .where('r.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('r.status = :status', { status: ShareRequestStatus.PENDING })
      .andWhere('event.target_department IN (:...depts)', { depts: managedDepts })
      .orderBy('r.created_at', 'DESC')
      .getMany();
  }

  // ─── 내부 헬퍼 ──────────────────────────────────────
  private monthRange(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0);
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

  /** 현재 유저가 해당 부서를 관리하는지 확인 */
  private canManageDepartment(user: AuthenticatedUser, dept: string): boolean {
    if (user.role === UserRole.OWNER) return true;
    if (user.role === UserRole.MANAGER) {
      if (!dept) return true;
      return (user.managedDepartments ?? []).includes(dept);
    }
    return false;
  }

  /** 내가 공유받은 이벤트 ID 목록 */
  private async getSharedEventIds(user: AuthenticatedUser): Promise<string[]> {
    const myDept = user.department;
    const qb = this.shareRepo
      .createQueryBuilder('s')
      .select('s.event_id', 'eventId')
      .where('s.company_id = :cid', { cid: user.companyId })
      .andWhere('s.revoked_at IS NULL');

    if (myDept) {
      qb.andWhere(
        '(s.recipient_user_id = :uid OR s.recipient_department = :dept)',
        { uid: user.id, dept: myDept },
      );
    } else {
      qb.andWhere('s.recipient_user_id = :uid', { uid: user.id });
    }

    const rows = await qb.getRawMany();
    return rows.map(r => r.eventId as string);
  }

  /** 이벤트 ID 목록에 대한 공유 정보 Map */
  private async getSharesByEventIds(
    eventIds: string[],
    companyId: string,
  ): Promise<Record<string, CalendarEventShare[]>> {
    if (eventIds.length === 0) return {};
    const shares = await this.shareRepo.find({
      where: { companyId },
      relations: ['recipientUser'],
    });
    const filtered = shares.filter(s => eventIds.includes(s.eventId) && !s.revokedAt);
    const map: Record<string, CalendarEventShare[]> = {};
    for (const s of filtered) {
      if (!map[s.eventId]) map[s.eventId] = [];
      map[s.eventId].push(s);
    }
    return map;
  }

  private toResponse(
    e: CalendarEvent,
    myId: string,
    sharedEventIds: string[],
    shares: Record<string, CalendarEventShare[]> | CalendarEventShare[],
  ) {
    const eventShares = Array.isArray(shares) ? shares : (shares[e.id] ?? []);
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
      isSharedToMe: sharedEventIds.includes(e.id),
      shares: eventShares.map(s => ({
        id: s.id,
        recipientType: s.recipientType,
        recipientUserId: s.recipientUserId,
        recipientUserName: s.recipientUser?.name ?? null,
        recipientDepartment: s.recipientDepartment,
        sharedAt: s.sharedAt,
        revokedAt: s.revokedAt,
      })),
      creator: e.creator
        ? { id: e.creator.id, name: e.creator.name }
        : null,
    };
  }
}
