import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, Or, IsNull } from 'typeorm';
import { Schedule, ScheduleType } from '../../database/entities/schedule.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateScheduleDto, UpdateScheduleDto, DeleteScheduleDto, ScheduleQueryDto,
} from './dto/schedules.dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private scheduleRepo: Repository<Schedule>,
  ) {}

  // ─────────────────────────────────────────
  // 스케줄 생성
  // ─────────────────────────────────────────
  async createSchedule(currentUser: AuthenticatedUser, dto: CreateScheduleDto) {
    if (new Date(dto.end_at) <= new Date(dto.start_at)) {
      throw new BadRequestException('종료 시간은 시작 시간보다 이후여야 합니다.');
    }

    // employee는 본인 개인 일정만 생성 가능
    if (currentUser.role === UserRole.EMPLOYEE) {
      if (dto.target_user_id && dto.target_user_id !== currentUser.id) {
        throw new ForbiddenException('본인 일정만 생성할 수 있습니다.');
      }
      // 전사 공개 일정 생성 불가
      if (!dto.target_user_id) {
        throw new ForbiddenException('전사 공개 스케줄은 관리자만 생성할 수 있습니다.');
      }
    }

    const schedule = this.scheduleRepo.create({
      companyId:       currentUser.companyId,
      creatorId:       currentUser.id,
      title:           dto.title,
      description:     dto.description ?? null,
      location:        dto.location ?? null,
      targetUserId:    dto.target_user_id ?? null,
      startAt:         new Date(dto.start_at),
      endAt:           new Date(dto.end_at),
      isAllDay:        dto.is_all_day ?? false,
      type:            (dto.type as ScheduleType) ?? ScheduleType.GENERAL,
      recurrenceRule:  dto.recurrence_rule ?? null,
      recurrenceEndAt: dto.recurrence_end_at ?? null,
      notifyBeforeMin: dto.notify_before_min ?? null,
      color:           dto.color ?? null,
    });

    return this.scheduleRepo.save(schedule);
  }

  // ─────────────────────────────────────────
  // 스케줄 목록 조회
  // ─────────────────────────────────────────
  async getSchedules(currentUser: AuthenticatedUser, query: ScheduleQueryDto) {
    const { start_date, end_date, type, user_id } = query;

    const qb = this.scheduleRepo
      .createQueryBuilder('s')
      .leftJoin('s.creator', 'creator')
      .leftJoin('s.targetUser', 'targetUser')
      .addSelect(['creator.id', 'creator.name', 'targetUser.id', 'targetUser.name'])
      .where('s.company_id = :companyId', { companyId: currentUser.companyId })
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.start_at <= :endDate', { endDate: end_date + 'T23:59:59Z' })
      .andWhere('s.end_at >= :startDate', { startDate: start_date + 'T00:00:00Z' });

    // employee: 전사 공개 + 본인 개인 일정만
    if (currentUser.role === UserRole.EMPLOYEE) {
      qb.andWhere(
        '(s.target_user_id IS NULL OR s.target_user_id = :userId)',
        { userId: currentUser.id },
      );
    } else if (user_id) {
      // manager/owner: 특정 직원 필터
      qb.andWhere(
        '(s.target_user_id IS NULL OR s.target_user_id = :userId)',
        { userId: user_id },
      );
    }

    if (type) qb.andWhere('s.type = :type', { type });

    qb.orderBy('s.start_at', 'ASC');

    return qb.getMany();
  }

  // ─────────────────────────────────────────
  // 스케줄 상세
  // ─────────────────────────────────────────
  async findScheduleById(id: string, currentUser: AuthenticatedUser) {
    const schedule = await this.scheduleRepo.findOne({
      where: { id, companyId: currentUser.companyId },
      relations: ['creator', 'targetUser'],
    });

    if (!schedule || schedule.deletedAt) {
      throw new NotFoundException('스케줄을 찾을 수 없습니다.');
    }

    this.checkScheduleAccess(schedule, currentUser);
    return schedule;
  }

  // ─────────────────────────────────────────
  // 스케줄 수정
  // ─────────────────────────────────────────
  async updateSchedule(id: string, currentUser: AuthenticatedUser, dto: UpdateScheduleDto) {
    const schedule = await this.scheduleRepo.findOne({
      where: { id, companyId: currentUser.companyId },
    });

    if (!schedule || schedule.deletedAt) {
      throw new NotFoundException('스케줄을 찾을 수 없습니다.');
    }

    this.checkScheduleModifyPermission(schedule, currentUser);

    if (dto.start_at && dto.end_at) {
      if (new Date(dto.end_at) <= new Date(dto.start_at)) {
        throw new BadRequestException('종료 시간은 시작 시간보다 이후여야 합니다.');
      }
    }

    if (dto.title !== undefined)            schedule.title           = dto.title;
    if (dto.description !== undefined)      schedule.description     = dto.description;
    if (dto.location !== undefined)         schedule.location        = dto.location;
    if (dto.start_at)                       schedule.startAt         = new Date(dto.start_at);
    if (dto.end_at)                         schedule.endAt           = new Date(dto.end_at);
    if (dto.type)                           schedule.type            = dto.type as ScheduleType;
    if (dto.recurrence_rule !== undefined)  schedule.recurrenceRule  = dto.recurrence_rule;
    if (dto.notify_before_min !== undefined) schedule.notifyBeforeMin = dto.notify_before_min;
    if (dto.color !== undefined)            schedule.color           = dto.color;

    return this.scheduleRepo.save(schedule);
  }

  // ─────────────────────────────────────────
  // 스케줄 삭제 (Soft Delete)
  // ─────────────────────────────────────────
  async deleteSchedule(id: string, currentUser: AuthenticatedUser, dto: DeleteScheduleDto) {
    const schedule = await this.scheduleRepo.findOne({
      where: { id, companyId: currentUser.companyId },
    });

    if (!schedule || schedule.deletedAt) {
      throw new NotFoundException('스케줄을 찾을 수 없습니다.');
    }

    this.checkScheduleModifyPermission(schedule, currentUser);
    await this.scheduleRepo.softDelete(id);

    return { id, deleted_at: new Date() };
  }

  // ─────────────────────────────────────────
  // 접근 권한 체크 유틸
  // ─────────────────────────────────────────
  private checkScheduleAccess(schedule: Schedule, user: AuthenticatedUser) {
    if (user.role !== UserRole.EMPLOYEE) return;
    if (schedule.targetUserId === null) return;         // 전사 공개
    if (schedule.targetUserId === user.id) return;      // 본인 일정
    throw new ForbiddenException('접근 권한이 없습니다.');
  }

  private checkScheduleModifyPermission(schedule: Schedule, user: AuthenticatedUser) {
    if (user.role === UserRole.OWNER || user.role === UserRole.MANAGER) return;
    // employee: 본인이 만든 개인 일정만 수정 가능
    if (
      schedule.creatorId === user.id &&
      schedule.targetUserId === user.id
    ) return;
    throw new ForbiddenException('수정 권한이 없습니다.');
  }
}
