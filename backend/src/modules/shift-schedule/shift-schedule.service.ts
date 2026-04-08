import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { addDays, format, startOfWeek, parseISO, isWithinInterval } from 'date-fns';
import {
  ShiftSchedule, ShiftScheduleStatus, ShiftAssignment, ShiftType,
} from '../../database/entities/shift-schedule.entity';
import { EmployeeAvailability } from '../../database/entities/employee-availability.entity';
import { User } from '../../database/entities/user.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateShiftScheduleDto, UpdateShiftScheduleDto, ShiftScheduleQueryDto,
  BulkUpsertAssignmentsDto, UpsertAvailabilityDto, AvailabilityQueryDto,
} from './dto/shift-schedule.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ShiftScheduleService {
  constructor(
    @InjectRepository(ShiftSchedule)       private schedRepo: Repository<ShiftSchedule>,
    @InjectRepository(ShiftAssignment)     private assignRepo: Repository<ShiftAssignment>,
    @InjectRepository(EmployeeAvailability) private availRepo:  Repository<EmployeeAvailability>,
    @InjectRepository(User)                private userRepo:   Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  private managerOrAbove(role: UserRole) {
    return role !== UserRole.EMPLOYEE;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 근무표 CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async findAll(user: AuthenticatedUser, query: ShiftScheduleQueryDto) {
    const qb = this.schedRepo.createQueryBuilder('s')
      .leftJoinAndSelect('s.creator', 'creator')
      .where('s.company_id = :cid', { cid: user.companyId })
      .orderBy('s.week_start', 'DESC');

    if (query.department) qb.andWhere('s.department = :dept', { dept: query.department });
    if (query.week_start) qb.andWhere('s.week_start = :ws', { ws: query.week_start });
    if (query.month) {
      const [y, m] = query.month.split('-').map(Number);
      const from = format(new Date(y, m - 1, 1), 'yyyy-MM-dd');
      const to   = format(new Date(y, m, 0), 'yyyy-MM-dd');
      qb.andWhere('s.week_start BETWEEN :from AND :to', { from, to });
    }

    // 일반 직원은 발행된 근무표만 조회
    if (user.role === UserRole.EMPLOYEE) {
      qb.andWhere('s.status = :pub', { pub: ShiftScheduleStatus.PUBLISHED });
    }

    const list = await qb.getMany();
    return { success: true, data: list };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const sched = await this.schedRepo.findOne({
      where: { id, companyId: user.companyId },
      relations: ['creator'],
    });
    if (!sched) throw new NotFoundException('근무표를 찾을 수 없습니다.');
    if (user.role === UserRole.EMPLOYEE && sched.status !== ShiftScheduleStatus.PUBLISHED) {
      throw new ForbiddenException('아직 발행되지 않은 근무표입니다.');
    }

    const assignments = await this.assignRepo.find({
      where: { shiftScheduleId: id },
      relations: ['user'],
      order: { date: 'ASC', startTime: 'ASC' },
    });

    return { success: true, data: { ...sched, assignments } };
  }

  async create(user: AuthenticatedUser, dto: CreateShiftScheduleDto) {
    if (!this.managerOrAbove(user.role)) {
      throw new ForbiddenException('관리자만 근무표를 생성할 수 있습니다.');
    }
    const sched = this.schedRepo.create({
      companyId:  user.companyId,
      creatorId:  user.id,
      title:      dto.title,
      department: dto.department ?? null,
      weekStart:  dto.week_start,
      status:     ShiftScheduleStatus.DRAFT,
      note:       dto.note ?? null,
    });
    return { success: true, data: await this.schedRepo.save(sched) };
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateShiftScheduleDto) {
    if (!this.managerOrAbove(user.role)) throw new ForbiddenException();
    const sched = await this.schedRepo.findOne({ where: { id, companyId: user.companyId } });
    if (!sched) throw new NotFoundException('근무표를 찾을 수 없습니다.');
    if (sched.status === ShiftScheduleStatus.PUBLISHED) {
      throw new BadRequestException('발행된 근무표는 수정할 수 없습니다. 먼저 초안으로 되돌려주세요.');
    }

    if (dto.title !== undefined)      sched.title      = dto.title;
    if (dto.department !== undefined) sched.department = dto.department ?? null;
    if (dto.note !== undefined)       sched.note       = dto.note ?? null;

    return { success: true, data: await this.schedRepo.save(sched) };
  }

  async remove(user: AuthenticatedUser, id: string) {
    if (!this.managerOrAbove(user.role)) throw new ForbiddenException();
    const sched = await this.schedRepo.findOne({ where: { id, companyId: user.companyId } });
    if (!sched) throw new NotFoundException();
    await this.schedRepo.softDelete(id);
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 발행 → 팀 전체 알림 + 개인 Schedule 자동 생성
  // ═══════════════════════════════════════════════════════════════════════════

  async publish(user: AuthenticatedUser, id: string) {
    if (!this.managerOrAbove(user.role)) throw new ForbiddenException();
    const sched = await this.schedRepo.findOne({ where: { id, companyId: user.companyId } });
    if (!sched) throw new NotFoundException();

    const assignments = await this.assignRepo.find({ where: { shiftScheduleId: id } });
    if (assignments.length === 0) {
      throw new BadRequestException('배정된 직원이 없습니다. 먼저 근무 배정을 완료해주세요.');
    }

    sched.status      = ShiftScheduleStatus.PUBLISHED;
    sched.publishedAt = new Date();
    await this.schedRepo.save(sched);

    // 배정된 직원 고유 목록
    const userIds = [...new Set(assignments.map((a) => a.userId))];

    // 알림 일괄 발송 (푸시 포함)
    await Promise.all(
      userIds.map((uid) =>
        this.notificationsService.dispatch({
          companyId: user.companyId,
          userId:    uid,
          type:      'schedule_published' as any,
          title:     '근무표가 공유되었습니다',
          body:      `${sched.title} (${sched.weekStart} 주) 근무표가 발행되었습니다.`,
          refId:     sched.id,
          refType:   'shift_schedule' as any,
        }).catch(() => {}),
      ),
    );

    return { success: true, data: { id, notifiedCount: userIds.length } };
  }

  async unpublish(user: AuthenticatedUser, id: string) {
    if (!this.managerOrAbove(user.role)) throw new ForbiddenException();
    const sched = await this.schedRepo.findOne({ where: { id, companyId: user.companyId } });
    if (!sched) throw new NotFoundException();
    sched.status      = ShiftScheduleStatus.DRAFT;
    sched.publishedAt = null;
    await this.schedRepo.save(sched);
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 근무 배정 (bulk upsert)
  // ═══════════════════════════════════════════════════════════════════════════

  async upsertAssignments(user: AuthenticatedUser, schedId: string, dto: BulkUpsertAssignmentsDto) {
    if (!this.managerOrAbove(user.role)) throw new ForbiddenException();
    const sched = await this.schedRepo.findOne({ where: { id: schedId, companyId: user.companyId } });
    if (!sched) throw new NotFoundException();

    for (const item of dto.assignments) {
      // 시간 유효성 (off 타입 제외)
      if (item.shift_type !== ShiftType.OFF && item.start_time && item.end_time) {
        if (item.end_time <= item.start_time) {
          throw new BadRequestException(`${item.date} 종료 시간은 시작 시간보다 이후여야 합니다.`);
        }
      }

      const existing = await this.assignRepo.findOne({
        where: { shiftScheduleId: schedId, userId: item.user_id, date: item.date },
      });

      if (existing) {
        existing.startTime = item.start_time ?? null;
        existing.endTime   = item.end_time ?? null;
        existing.shiftType = (item.shift_type as ShiftType) ?? ShiftType.OFFICE;
        existing.location  = item.location ?? null;
        existing.note      = item.note ?? null;
        await this.assignRepo.save(existing);
      } else {
        const a = this.assignRepo.create({
          shiftScheduleId: schedId,
          companyId:       user.companyId,
          userId:          item.user_id,
          date:            item.date,
          startTime:       item.start_time ?? null,
          endTime:         item.end_time ?? null,
          shiftType:       (item.shift_type as ShiftType) ?? ShiftType.OFFICE,
          location:        item.location ?? null,
          note:            item.note ?? null,
        });
        await this.assignRepo.save(a);
      }
    }

    const updated = await this.assignRepo.find({
      where: { shiftScheduleId: schedId },
      relations: ['user'],
      order: { date: 'ASC', startTime: 'ASC' },
    });
    return { success: true, data: updated };
  }

  async deleteAssignment(user: AuthenticatedUser, schedId: string, userId: string, date: string) {
    if (!this.managerOrAbove(user.role)) throw new ForbiddenException();
    await this.assignRepo.delete({ shiftScheduleId: schedId, userId, date });
    return { success: true };
  }

  /** 직원이 자신의 배정 확인 */
  async confirmAssignment(user: AuthenticatedUser, schedId: string, assignmentId: string) {
    const a = await this.assignRepo.findOne({
      where: { id: assignmentId, shiftScheduleId: schedId, userId: user.id },
    });
    if (!a) throw new NotFoundException();
    a.isConfirmed = true;
    a.confirmedAt = new Date();
    return { success: true, data: await this.assignRepo.save(a) };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 가용시간 관리
  // ═══════════════════════════════════════════════════════════════════════════

  async getAvailability(user: AuthenticatedUser, query: AvailabilityQueryDto) {
    const targetUserId = query.user_id ?? user.id;
    if (query.user_id && query.user_id !== user.id && user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('타인의 가용시간은 관리자만 조회할 수 있습니다.');
    }

    const list = await this.availRepo.find({
      where: { companyId: user.companyId, userId: targetUserId },
      order: { dayOfWeek: 'ASC', specificDate: 'ASC' },
    });
    return { success: true, data: list };
  }

  /** 팀원 전체 가용시간 조회 (관리자, 근무표 작성 시 사용) */
  async getTeamAvailability(user: AuthenticatedUser, weekStart: string, department?: string) {
    if (!this.managerOrAbove(user.role)) throw new ForbiddenException();

    // 해당 부서 직원 목록
    const userQb = this.userRepo.createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.department', 'u.position'])
      .where('u.company_id = :cid', { cid: user.companyId })
      .andWhere('u.deleted_at IS NULL');
    if (department) userQb.andWhere('u.department = :dept', { dept: department });
    const users = await userQb.getMany();

    const weekDates = Array.from({ length: 7 }, (_, i) =>
      format(addDays(parseISO(weekStart), i), 'yyyy-MM-dd'),
    );

    const userIds = users.map((u) => u.id);
    const avails  = userIds.length
      ? await this.availRepo.find({ where: { companyId: user.companyId, userId: In(userIds) } })
      : [];

    // 날짜별 가용시간 계산
    const result = users.map((u) => {
      const userAvails = avails.filter((a) => a.userId === u.id);
      const byDate: Record<string, { startTime: string; endTime: string; isAvailable: boolean; note: string | null }[]> = {};

      for (const dateStr of weekDates) {
        const date = parseISO(dateStr);
        const dow  = date.getDay(); // 0=일 1=월...

        // 특정 날짜 예외가 있으면 우선
        const specific = userAvails.filter((a) => a.specificDate === dateStr);
        // 요일 기반 반복
        const weekly   = userAvails.filter(
          (a) =>
            a.specificDate === null &&
            a.dayOfWeek === dow &&
            (!a.effectiveFrom || a.effectiveFrom <= dateStr) &&
            (!a.effectiveUntil || a.effectiveUntil >= dateStr),
        );

        const slots = specific.length ? specific : weekly;
        byDate[dateStr] = slots.map((s) => ({
          startTime:   s.startTime,
          endTime:     s.endTime,
          isAvailable: s.isAvailable,
          note:        s.note,
        }));
      }

      return { user: u, availability: byDate };
    });

    return { success: true, data: { weekDates, team: result } };
  }

  async upsertAvailability(user: AuthenticatedUser, dto: UpsertAvailabilityDto) {
    if (dto.day_of_week === undefined && !dto.specific_date) {
      throw new BadRequestException('day_of_week 또는 specific_date 중 하나는 필수입니다.');
    }
    if (dto.end_time <= dto.start_time) {
      throw new BadRequestException('종료 시간은 시작 시간보다 이후여야 합니다.');
    }

    // 동일 조건 존재 시 업데이트
    const where: any = { companyId: user.companyId, userId: user.id };
    if (dto.specific_date) {
      where.specificDate = dto.specific_date;
    } else {
      where.dayOfWeek = dto.day_of_week;
      where.specificDate = null;
    }
    const existing = await this.availRepo.findOne({ where });

    if (existing) {
      existing.startTime     = dto.start_time;
      existing.endTime       = dto.end_time;
      existing.isAvailable   = dto.is_available ?? true;
      existing.note          = dto.note ?? null;
      existing.effectiveFrom  = dto.effective_from ?? null;
      existing.effectiveUntil = dto.effective_until ?? null;
      return { success: true, data: await this.availRepo.save(existing) };
    }

    const a = this.availRepo.create({
      companyId:     user.companyId,
      userId:        user.id,
      dayOfWeek:     dto.day_of_week ?? null,
      specificDate:  dto.specific_date ?? null,
      startTime:     dto.start_time,
      endTime:       dto.end_time,
      isAvailable:   dto.is_available ?? true,
      note:          dto.note ?? null,
      effectiveFrom:  dto.effective_from ?? null,
      effectiveUntil: dto.effective_until ?? null,
    });
    return { success: true, data: await this.availRepo.save(a) };
  }

  async deleteAvailability(user: AuthenticatedUser, availId: string) {
    const a = await this.availRepo.findOne({
      where: { id: availId, companyId: user.companyId, userId: user.id },
    });
    if (!a) throw new NotFoundException();
    await this.availRepo.delete(availId);
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 근무표 추천 (가용시간 기반)
  // ═══════════════════════════════════════════════════════════════════════════

  async recommend(user: AuthenticatedUser, schedId: string) {
    if (!this.managerOrAbove(user.role)) throw new ForbiddenException();
    const sched = await this.schedRepo.findOne({ where: { id: schedId, companyId: user.companyId } });
    if (!sched) throw new NotFoundException();

    const teamData = await this.getTeamAvailability(user, sched.weekStart, sched.department ?? undefined);
    const team = (teamData as any).data.team as Array<{
      user: User;
      availability: Record<string, { startTime: string; endTime: string; isAvailable: boolean }[]>;
    }>;

    const recommendations: { user_id: string; date: string; start_time: string; end_time: string; shift_type: ShiftType }[] = [];
    for (const member of team) {
      const avail = member.availability;
      for (const [date, slots] of Object.entries(avail)) {
        const available = slots.filter((s) => s.isAvailable);
        if (available.length === 0) continue;
        // 가장 긴 슬롯 사용
        const best = available.sort(
          (a, b) => this.timeToMin(b.endTime) - this.timeToMin(b.startTime) -
                    (this.timeToMin(a.endTime) - this.timeToMin(a.startTime)),
        )[0];
        recommendations.push({
          user_id:    member.user.id,
          date,
          start_time: best.startTime,
          end_time:   best.endTime,
          shift_type: ShiftType.OFFICE,
        });
      }
    }

    return { success: true, data: recommendations };
  }

  private timeToMin(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }
}

