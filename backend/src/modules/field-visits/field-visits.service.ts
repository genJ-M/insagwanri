import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FieldLocation } from '../../database/entities/field-location.entity';
import { FieldVisit } from '../../database/entities/field-visit.entity';
import { Task, TaskStatus, TaskPriority } from '../../database/entities/task.entity';
import { Company } from '../../database/entities/company.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateFieldLocationDto, UpdateFieldLocationDto, FieldLocationQueryDto,
  FieldCheckInDto, FieldCheckOutDto, AddVehicleEventDto, FieldVisitQueryDto,
  UpdateFieldVisitSettingsDto,
} from './dto/field-visits.dto';

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function kstDateString(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

@Injectable()
export class FieldVisitsService {
  constructor(
    @InjectRepository(FieldLocation)
    private readonly locRepo: Repository<FieldLocation>,
    @InjectRepository(FieldVisit)
    private readonly visitRepo: Repository<FieldVisit>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // FieldLocation CRUD (manager/owner 전용)
  // ─────────────────────────────────────────────────────────────

  async createLocation(user: AuthenticatedUser, dto: CreateFieldLocationDto) {
    const loc = this.locRepo.create({
      companyId:   user.companyId,
      name:        dto.name,
      address:     dto.address ?? null,
      lat:         dto.lat,
      lng:         dto.lng,
      radiusM:     dto.radiusM ?? 300,
      category:    dto.category,
      note:        dto.note ?? null,
      createdById: user.id,
    });
    return this.locRepo.save(loc);
  }

  async listLocations(user: AuthenticatedUser, query: FieldLocationQueryDto) {
    const qb = this.locRepo.createQueryBuilder('l')
      .where('l.company_id = :cid', { cid: user.companyId })
      .andWhere('l.deleted_at IS NULL');

    if (query.category) qb.andWhere('l.category = :cat', { cat: query.category });
    if (query.activeOnly !== false) qb.andWhere('l.is_active = TRUE');

    return qb.orderBy('l.name', 'ASC').getMany();
  }

  async getLocation(user: AuthenticatedUser, id: string) {
    const loc = await this.locRepo.findOne({
      where: { id, companyId: user.companyId },
    });
    if (!loc) throw new NotFoundException('방문지를 찾을 수 없습니다.');
    return loc;
  }

  async updateLocation(user: AuthenticatedUser, id: string, dto: UpdateFieldLocationDto) {
    const loc = await this.getLocation(user, id);
    Object.assign(loc, dto);
    return this.locRepo.save(loc);
  }

  async deleteLocation(user: AuthenticatedUser, id: string) {
    const loc = await this.getLocation(user, id);
    await this.locRepo.softDelete(id);
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────
  // 현장 체크인 / 체크아웃
  // ─────────────────────────────────────────────────────────────

  async checkIn(user: AuthenticatedUser, dto: FieldCheckInDto) {
    // 이미 오픈된 방문 있으면 거부 (하루 중 중복 체크인 방지 — 같은 날)
    const visitDate = dto.visitDate ?? kstDateString();
    const existing = await this.visitRepo.findOne({
      where: {
        userId:    user.id,
        visitDate,
        checkedOutAt: IsNull(),
      },
    });
    if (existing) {
      throw new BadRequestException('이미 진행 중인 방문이 있습니다. 먼저 체크아웃해주세요.');
    }

    let fieldLocation: FieldLocation | null = null;
    let distanceM: number | null = null;
    let isOutOfRange = false;

    if (dto.fieldLocationId) {
      fieldLocation = await this.locRepo.findOne({
        where: { id: dto.fieldLocationId, companyId: user.companyId, isActive: true },
      });
      if (!fieldLocation) throw new NotFoundException('방문지를 찾을 수 없습니다.');

      distanceM = Math.round(haversineM(dto.lat, dto.lng, Number(fieldLocation.lat), Number(fieldLocation.lng)));
      isOutOfRange = distanceM > fieldLocation.radiusM;
    } else {
      // 자동 매칭: 반경 내 활성 방문지 찾기
      const locations = await this.locRepo.find({
        where: { companyId: user.companyId, isActive: true },
      });
      let minDist = Infinity;
      for (const loc of locations) {
        const d = haversineM(dto.lat, dto.lng, Number(loc.lat), Number(loc.lng));
        if (d < minDist) { minDist = d; if (d <= loc.radiusM) fieldLocation = loc; }
      }
      if (fieldLocation) distanceM = Math.round(minDist);
    }

    const visit = this.visitRepo.create({
      companyId:       user.companyId,
      userId:          user.id,
      visitDate,
      fieldLocationId: fieldLocation?.id ?? null,
      checkedInAt:     new Date(),
      inLat:           dto.lat,
      inLng:           dto.lng,
      inDistanceM:     distanceM,
      isOutOfRange,
      purpose:         dto.purpose ?? null,
    });
    const saved = await this.visitRepo.save(visit);

    // 업무 보고서 자동 생성
    const company = await this.companyRepo.findOne({
      where: { id: user.companyId },
      select: ['id', 'fieldVisitAutoTask', 'fieldVisitTaskTitle'],
    });
    if (company?.fieldVisitAutoTask) {
      await this.createLinkedTask(saved, user, company, fieldLocation);
    }

    // 범위 밖 체크인 시 관리자 알림
    if (isOutOfRange) {
      await this.notificationsService.dispatch({
        companyId: user.companyId,
        userId:    user.id,
        type:      'field_checkin_out_of_range',
        title:     '범위 밖 현장 체크인',
        body:      `${fieldLocation?.name ?? '미등록 장소'}에서 ${distanceM}m 거리 체크인 (반경 ${fieldLocation?.radiusM}m 초과)`,
        refId:     saved.id,
        refType:   'field_visit',
      });
    }

    return this.visitRepo.findOne({ where: { id: saved.id }, relations: ['fieldLocation'] });
  }

  private async createLinkedTask(
    visit: FieldVisit,
    user: AuthenticatedUser,
    company: Company,
    location: FieldLocation | null,
  ) {
    const locationName = location?.name ?? '현장';
    const title =
      company.fieldVisitTaskTitle
        ? company.fieldVisitTaskTitle.replace('{{location}}', locationName)
        : `[외근 일지] ${visit.visitDate} ${locationName} 방문`;

    const task = this.taskRepo.create({
      companyId:   user.companyId,
      creatorId:   user.id,
      assigneeId:  user.id,
      title,
      description: `방문지: ${locationName}\n방문일: ${visit.visitDate}\n목적: ${visit.purpose ?? ''}`,
      scope:       '외근',
      priority:    TaskPriority.NORMAL,
      status:      TaskStatus.IN_PROGRESS,
      startDate:   visit.visitDate,
      dueDate:     visit.visitDate,
    });
    const savedTask = await this.taskRepo.save(task);
    await this.visitRepo.update(visit.id, { linkedTaskId: savedTask.id });
  }

  async checkOut(user: AuthenticatedUser, visitId: string, dto: FieldCheckOutDto) {
    const visit = await this.visitRepo.findOne({
      where: { id: visitId, userId: user.id },
    });
    if (!visit) throw new NotFoundException('방문 기록을 찾을 수 없습니다.');
    if (visit.checkedOutAt) throw new BadRequestException('이미 체크아웃된 방문입니다.');

    visit.checkedOutAt = new Date();
    visit.outLat = dto.lat;
    visit.outLng = dto.lng;
    return this.visitRepo.save(visit);
  }

  // ─────────────────────────────────────────────────────────────
  // 차량 이벤트 추가
  // ─────────────────────────────────────────────────────────────

  async addVehicleEvent(user: AuthenticatedUser, visitId: string, dto: AddVehicleEventDto) {
    const visit = await this.visitRepo.findOne({
      where: { id: visitId, userId: user.id },
    });
    if (!visit) throw new NotFoundException('방문 기록을 찾을 수 없습니다.');
    if (visit.checkedOutAt) throw new BadRequestException('이미 완료된 방문입니다.');

    const event = {
      type:     dto.type,
      ts:       new Date().toISOString(),
      lat:      dto.lat,
      lng:      dto.lng,
      obdSpeed: dto.obdSpeed,
    };
    visit.vehicleEvents = [...(visit.vehicleEvents ?? []), event];
    return this.visitRepo.save(visit);
  }

  // ─────────────────────────────────────────────────────────────
  // 일일 / 기간 조회
  // ─────────────────────────────────────────────────────────────

  async getMyVisits(user: AuthenticatedUser, query: FieldVisitQueryDto) {
    return this.getVisits(user, { ...query, userId: user.id });
  }

  async getVisits(user: AuthenticatedUser, query: FieldVisitQueryDto) {
    const qb = this.visitRepo.createQueryBuilder('v')
      .leftJoinAndSelect('v.fieldLocation', 'loc')
      .leftJoinAndSelect('v.user', 'u')
      .where('v.company_id = :cid', { cid: user.companyId });

    if (query.userId) qb.andWhere('v.user_id = :uid', { uid: query.userId });

    if (query.date) {
      qb.andWhere('v.visit_date = :date', { date: query.date });
    } else {
      if (query.startDate) qb.andWhere('v.visit_date >= :sd', { sd: query.startDate });
      if (query.endDate)   qb.andWhere('v.visit_date <= :ed', { ed: query.endDate });
    }

    return qb.orderBy('v.checked_in_at', 'DESC').getMany();
  }

  /** 일별 이동 경로 요약 */
  async getDailyRouteSummary(user: AuthenticatedUser, userId: string, date: string) {
    if (user.role === UserRole.EMPLOYEE && user.id !== userId) {
      throw new ForbiddenException('본인의 기록만 조회할 수 있습니다.');
    }

    const visits = await this.visitRepo.find({
      where: { companyId: user.companyId, userId, visitDate: date },
      relations: ['fieldLocation'],
      order: { checkedInAt: 'ASC' },
    });

    const totalVisits = visits.length;
    const locations = visits.map((v) => ({
      id:           v.id,
      locationName: v.fieldLocation?.name ?? '미등록 장소',
      category:     v.fieldLocation?.category ?? null,
      checkedInAt:  v.checkedInAt,
      checkedOutAt: v.checkedOutAt,
      durationMin:  v.checkedOutAt
        ? Math.round((v.checkedOutAt.getTime() - v.checkedInAt.getTime()) / 60000)
        : null,
      isOutOfRange: v.isOutOfRange,
      purpose:      v.purpose,
      linkedTaskId: v.linkedTaskId,
    }));

    const firstIn  = visits[0]?.checkedInAt ?? null;
    const lastOut  = visits.at(-1)?.checkedOutAt ?? null;
    const totalFieldMin = lastOut && firstIn
      ? Math.round((lastOut.getTime() - firstIn.getTime()) / 60000)
      : null;

    return { date, userId, totalVisits, totalFieldMin, locations };
  }

  // ─────────────────────────────────────────────────────────────
  // 워크스페이스 설정
  // ─────────────────────────────────────────────────────────────

  async updateSettings(user: AuthenticatedUser, dto: UpdateFieldVisitSettingsDto) {
    await this.companyRepo.update(user.companyId, {
      fieldVisitAutoTask:  dto.fieldVisitAutoTask,
      fieldVisitTaskTitle: dto.fieldVisitTaskTitle,
    });
    return { success: true };
  }
}
