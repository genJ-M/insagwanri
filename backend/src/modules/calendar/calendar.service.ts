import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Schedule, ScheduleScope, ScheduleType,
} from '../../database/entities/schedule.entity';
import {
  ScheduleShare, ScheduleShareRecipientType,
} from '../../database/entities/schedule-share.entity';
import {
  ScheduleShareRequest, ScheduleShareRequestStatus,
} from '../../database/entities/schedule-share-request.entity';
import { User } from '../../database/entities/user.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateCalendarEventDto, UpdateCalendarEventDto, CalendarQueryDto,
} from './dto/calendar.dto';

/**
 * /calendar API의 내부 저장소를 schedules 도메인으로 통합한 버전 (Phase B).
 * - 외부 응답 형태는 기존 calendar API와 호환 (startDate/endDate 'YYYY-MM-DD' 문자열).
 * - 시간 단위 일정(is_all_day=false)도 같은 캘린더 뷰에 노출되며, 캘린더에서는 dates 변경을 거부.
 */
@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(Schedule)             private scheduleRepo: Repository<Schedule>,
    @InjectRepository(ScheduleShare)        private shareRepo: Repository<ScheduleShare>,
    @InjectRepository(ScheduleShareRequest) private shareRequestRepo: Repository<ScheduleShareRequest>,
    @InjectRepository(User)                 private userRepo: Repository<User>,
  ) {}

  // ─── 이벤트 목록 (프라이버시 강화: 팀 격리) ──────────
  async getEvents(currentUser: AuthenticatedUser, query: CalendarQueryDto) {
    const { startDate, endDate } = this.monthRange(query.year, query.month);
    const myDept = currentUser.department ?? null;

    const sharedEventIds = await this.getSharedEventIds(currentUser);

    const qb = this.scheduleRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.creator', 'creator')
      .where('e.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('e.start_at::date <= :end', { end: endDate })
      .andWhere('e.end_at::date   >= :start', { start: startDate })
      .andWhere('e.deleted_at IS NULL');

    const myDepts: string[] = [];
    if (myDept) myDepts.push(myDept);
    if (currentUser.managedDepartments?.length) {
      myDepts.push(...currentUser.managedDepartments);
    }

    if (sharedEventIds.length > 0) {
      qb.andWhere(
        `(
          e.scope = :company
          OR (e.scope = :team AND (e.target_department IN (:...myDepts) OR (e.target_department IS NULL AND :hasDepts = false)))
          OR (e.scope = :personal AND e.creator_id = :me)
          OR e.id IN (:...sharedIds)
        )`,
        {
          company: ScheduleScope.COMPANY,
          team: ScheduleScope.TEAM,
          myDepts: myDepts.length > 0 ? myDepts : ['__none__'],
          hasDepts: myDepts.length > 0,
          personal: ScheduleScope.PERSONAL,
          me: currentUser.id,
          sharedIds: sharedEventIds,
        },
      );
    } else if (myDepts.length > 0) {
      qb.andWhere(
        `(
          e.scope = :company
          OR (e.scope = :team AND e.target_department IN (:...myDepts))
          OR (e.scope = :personal AND e.creator_id = :me)
        )`,
        {
          company: ScheduleScope.COMPANY,
          team: ScheduleScope.TEAM,
          myDepts,
          personal: ScheduleScope.PERSONAL,
          me: currentUser.id,
        },
      );
    } else {
      qb.andWhere(
        `(e.scope = :company OR (e.scope = :personal AND e.creator_id = :me))`,
        {
          company: ScheduleScope.COMPANY,
          personal: ScheduleScope.PERSONAL,
          me: currentUser.id,
        },
      );
    }

    if (query.department && [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role)) {
      this.canManageDepartment(currentUser, query.department);
    }

    qb.orderBy('e.start_at', 'ASC');
    const events = await qb.getMany();

    const sharesByEventId = await this.getSharesByEventIds(
      events.map(e => e.id),
      currentUser.companyId,
    );

    return events.map(e => this.toResponse(e, currentUser.id, sharedEventIds, sharesByEventId[e.id] ?? []));
  }

  // ─── 이벤트 생성 ────────────────────────────────────
  async createEvent(dto: CreateCalendarEventDto, currentUser: AuthenticatedUser) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);

    if (dto.scope === ScheduleScope.COMPANY && !isAdmin) {
      throw new ForbiddenException('전사 공지는 관리자만 작성할 수 있습니다.');
    }
    if (dto.scope === ScheduleScope.TEAM && !isAdmin) {
      throw new ForbiddenException('팀 공지는 관리자만 작성할 수 있습니다.');
    }

    const allDay = dto.all_day ?? true;
    let startAt: Date;
    let endAt: Date;

    if (!allDay) {
      if (!dto.start_at || !dto.end_at) {
        throw new BadRequestException('시간 단위 일정은 start_at / end_at 이 필요합니다.');
      }
      startAt = new Date(dto.start_at);
      endAt   = new Date(dto.end_at);
    } else {
      // start_at 가 들어오면 그것의 날짜 부분을, 아니면 start_date 사용
      const startBase = dto.start_at ?? dto.start_date;
      const endBase   = dto.end_at   ?? dto.end_date;
      if (!startBase || !endBase) {
        throw new BadRequestException('일정 기간을 입력해 주세요.');
      }
      startAt = this.dateToStartTs(startBase.slice(0, 10));
      endAt   = this.dateToEndTs(endBase.slice(0, 10));
    }

    if (endAt <= startAt) {
      throw new BadRequestException('종료는 시작 이후여야 합니다.');
    }

    const schedule = this.scheduleRepo.create({
      companyId:        currentUser.companyId,
      creatorId:        currentUser.id,
      scope:            dto.scope,
      targetDepartment: dto.target_department ?? null,
      title:            dto.title,
      description:      dto.description ?? null,
      location:         null,
      targetUserId:     dto.scope === ScheduleScope.PERSONAL ? currentUser.id : null,
      startAt,
      endAt,
      isAllDay:         allDay,
      type:             ScheduleType.GENERAL,
      color:            dto.color ?? null,
      recurrenceRule:   dto.recurrence_rule ?? null,
      recurrenceEndAt:  dto.recurrence_end_at ?? null,
      notifyBeforeMin:  dto.notify_before_min ?? null,
    });
    const saved = await this.scheduleRepo.save(schedule);
    const loaded = await this.scheduleRepo.findOne({ where: { id: saved.id }, relations: ['creator'] });
    return this.toResponse(loaded!, currentUser.id, [], []);
  }

  // ─── 이벤트 수정 ────────────────────────────────────
  async updateEvent(id: string, dto: UpdateCalendarEventDto, currentUser: AuthenticatedUser) {
    const event = await this.loadOrFail(id, currentUser.companyId);
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && event.creatorId !== currentUser.id) {
      throw new ForbiddenException('수정 권한이 없습니다.');
    }

    if (dto.title             !== undefined) event.title           = dto.title;
    if (dto.description       !== undefined) event.description     = dto.description ?? null;
    if (dto.color             !== undefined) event.color           = dto.color ?? null;
    if (dto.recurrence_rule   !== undefined) event.recurrenceRule  = dto.recurrence_rule ?? null;
    if (dto.recurrence_end_at !== undefined) event.recurrenceEndAt = dto.recurrence_end_at ?? null;
    if (dto.notify_before_min !== undefined) event.notifyBeforeMin = dto.notify_before_min ?? null;

    // all_day 또는 시간 변경
    if (dto.all_day !== undefined) event.isAllDay = dto.all_day;

    if (dto.start_at) {
      event.startAt = new Date(dto.start_at);
    } else if (dto.start_date) {
      event.startAt = this.dateToStartTs(dto.start_date);
    }
    if (dto.end_at) {
      event.endAt = new Date(dto.end_at);
    } else if (dto.end_date) {
      event.endAt = this.dateToEndTs(dto.end_date);
    }

    if (event.endAt <= event.startAt) {
      throw new BadRequestException('종료는 시작 이후여야 합니다.');
    }

    await this.scheduleRepo.save(event);
    const loaded = await this.scheduleRepo.findOne({ where: { id }, relations: ['creator'] });
    return this.toResponse(loaded!, currentUser.id, [], []);
  }

  // ─── 이벤트 삭제 ────────────────────────────────────
  async deleteEvent(id: string, currentUser: AuthenticatedUser) {
    const event = await this.loadOrFail(id, currentUser.companyId);
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && event.creatorId !== currentUser.id) {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }
    await this.scheduleRepo.softDelete(id);
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
    recipientType: ScheduleShareRecipientType,
    recipientUserId?: string,
    recipientDepartment?: string,
    note?: string,
  ) {
    const event = await this.loadOrFail(eventId, currentUser.companyId);

    if (event.scope === ScheduleScope.COMPANY) {
      throw new BadRequestException('전사 공지는 공유 설정이 필요 없습니다.');
    }

    // PERSONAL 이벤트: 본인만 공유 가능, user 타입만 가능
    if (event.scope === ScheduleScope.PERSONAL) {
      if (event.creatorId !== currentUser.id) {
        throw new ForbiddenException('본인 이벤트만 공유할 수 있습니다.');
      }
      if (recipientType !== ScheduleShareRecipientType.USER || !recipientUserId) {
        throw new BadRequestException('개인 일정은 특정 사용자에게만 공유할 수 있습니다.');
      }
      const existing = await this.shareRepo.findOne({
        where: { scheduleId: eventId, recipientUserId, revokedAt: undefined as any },
      });
      if (existing && !existing.revokedAt) {
        throw new BadRequestException('이미 공유 중인 사용자입니다.');
      }
      const share = this.shareRepo.create({
        scheduleId:          eventId,
        companyId:           currentUser.companyId,
        sharedBy:            currentUser.id,
        recipientType:       ScheduleShareRecipientType.USER,
        recipientUserId,
        recipientDepartment: null,
        revokedAt:           null,
      });
      return this.shareRepo.save(share);
    }

    // TEAM 이벤트: 팀장(이 팀의 manager)만 직접 공유, 팀원은 요청
    if (event.scope === ScheduleScope.TEAM) {
      if (recipientType !== ScheduleShareRecipientType.DEPARTMENT || !recipientDepartment) {
        throw new BadRequestException('팀 일정은 다른 부서와 공유할 수 있습니다.');
      }
      const isTeamLeader = this.canManageDepartment(currentUser, event.targetDepartment ?? '');
      if (isTeamLeader) {
        const existing = await this.shareRepo.findOne({
          where: { scheduleId: eventId, recipientDepartment },
        });
        if (existing && !existing.revokedAt) {
          throw new BadRequestException('이미 해당 부서에 공유 중입니다.');
        }
        const share = this.shareRepo.create({
          scheduleId:          eventId,
          companyId:           currentUser.companyId,
          sharedBy:            currentUser.id,
          recipientType:       ScheduleShareRecipientType.DEPARTMENT,
          recipientUserId:     null,
          recipientDepartment,
          revokedAt:           null,
        });
        return this.shareRepo.save(share);
      } else {
        const existingReq = await this.shareRequestRepo.findOne({
          where: {
            scheduleId: eventId, targetDepartment: recipientDepartment,
            status: ScheduleShareRequestStatus.PENDING,
          },
        });
        if (existingReq) {
          throw new BadRequestException('이미 해당 부서에 대한 공유 요청이 진행 중입니다.');
        }
        const req = this.shareRequestRepo.create({
          scheduleId:       eventId,
          companyId:        currentUser.companyId,
          requestedBy:      currentUser.id,
          targetDepartment: recipientDepartment,
          status:           ScheduleShareRequestStatus.PENDING,
          note:             note ?? null,
        });
        return { type: 'request', data: await this.shareRequestRepo.save(req) };
      }
    }
  }

  // ─── 공유 철회 ──────────────────────────────────────
  async revokeShare(shareId: string, currentUser: AuthenticatedUser) {
    const share = await this.shareRepo.findOne({
      where: { id: shareId, companyId: currentUser.companyId },
      relations: ['schedule'],
    });
    if (!share) throw new NotFoundException('공유 정보를 찾을 수 없습니다.');
    if (share.revokedAt) throw new BadRequestException('이미 철회된 공유입니다.');

    if (share.sharedBy !== currentUser.id && share.schedule.creatorId !== currentUser.id) {
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
      where: { scheduleId: eventId, companyId: currentUser.companyId },
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
      relations: ['schedule'],
    });
    if (!req) throw new NotFoundException('공유 요청을 찾을 수 없습니다.');
    if (req.status !== ScheduleShareRequestStatus.PENDING) {
      throw new BadRequestException('이미 처리된 요청입니다.');
    }

    const isTeamLeader = this.canManageDepartment(currentUser, req.schedule.targetDepartment ?? '');
    if (!isTeamLeader) throw new ForbiddenException('팀장만 공유 요청을 처리할 수 있습니다.');

    req.status = approve ? ScheduleShareRequestStatus.APPROVED : ScheduleShareRequestStatus.REJECTED;
    req.decidedBy = currentUser.id;
    req.decidedAt = new Date();
    await this.shareRequestRepo.save(req);

    if (approve) {
      const share = this.shareRepo.create({
        scheduleId:          req.scheduleId,
        companyId:           currentUser.companyId,
        sharedBy:            currentUser.id,
        recipientType:       ScheduleShareRecipientType.DEPARTMENT,
        recipientUserId:     null,
        recipientDepartment: req.targetDepartment,
        revokedAt:           null,
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

    return this.shareRequestRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.schedule', 'schedule')
      .leftJoinAndSelect('r.requester', 'requester')
      .where('r.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('r.status = :status', { status: ScheduleShareRequestStatus.PENDING })
      .andWhere('schedule.target_department IN (:...depts)', { depts: managedDepts })
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

  /** 'YYYY-MM-DD' → 'YYYY-MM-DD 00:00:00' (현지) */
  private dateToStartTs(d: string): Date {
    return new Date(`${d}T00:00:00`);
  }

  /** 'YYYY-MM-DD' → 'YYYY-MM-DD 23:59:59' (현지) */
  private dateToEndTs(d: string): Date {
    return new Date(`${d}T23:59:59`);
  }

  private async loadOrFail(id: string, companyId: string): Promise<Schedule> {
    const e = await this.scheduleRepo.findOne({ where: { id, companyId } });
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
      .select('s.schedule_id', 'scheduleId')
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
    return rows.map(r => r.scheduleId as string);
  }

  /** 이벤트 ID 목록에 대한 공유 정보 Map */
  private async getSharesByEventIds(
    eventIds: string[],
    companyId: string,
  ): Promise<Record<string, ScheduleShare[]>> {
    if (eventIds.length === 0) return {};
    const shares = await this.shareRepo.find({
      where: { companyId },
      relations: ['recipientUser'],
    });
    const filtered = shares.filter(s => eventIds.includes(s.scheduleId) && !s.revokedAt);
    const map: Record<string, ScheduleShare[]> = {};
    for (const s of filtered) {
      if (!map[s.scheduleId]) map[s.scheduleId] = [];
      map[s.scheduleId].push(s);
    }
    return map;
  }

  private toResponse(
    e: Schedule,
    myId: string,
    sharedEventIds: string[],
    eventShares: ScheduleShare[],
  ) {
    return {
      id: e.id,
      scope: e.scope,
      targetDepartment: e.targetDepartment,
      title: e.title,
      description: e.description,
      startDate: this.dateOnly(e.startAt),
      endDate:   this.dateOnly(e.endAt),
      // 시간 단위 이벤트(allDay=false) 렌더링용 — ISO 문자열
      startAt:   e.startAt instanceof Date ? e.startAt.toISOString() : new Date(e.startAt).toISOString(),
      endAt:     e.endAt   instanceof Date ? e.endAt.toISOString()   : new Date(e.endAt).toISOString(),
      allDay: e.isAllDay,
      color: e.color,
      recurrenceRule:  e.recurrenceRule,
      recurrenceEndAt: e.recurrenceEndAt,
      notifyBeforeMin: e.notifyBeforeMin,
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

  /** Date | string → 'YYYY-MM-DD' */
  private dateOnly(d: Date | string): string {
    if (typeof d === 'string') return d.slice(0, 10);
    return new Date(d).toISOString().slice(0, 10);
  }
}
