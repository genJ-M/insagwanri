import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  VacationRequest,
  VacationStatus,
  VacationType,
} from '../../database/entities/vacation-request.entity';
import { VacationBalance } from '../../database/entities/vacation-balance.entity';
import { User } from '../../database/entities/user.entity';
import { AttendanceRecord, AttendanceStatus } from '../../database/entities/attendance-record.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateVacationDto, RejectVacationDto, VacationQueryDto, SetBalanceDto,
} from './dto/vacation.dto';
import { TeamsService } from '../teams/teams.service';

// 연차 차감이 필요한 타입
const DEDUCTIBLE_TYPES: VacationType[] = [
  VacationType.ANNUAL,
  VacationType.HALF_DAY_AM,
  VacationType.HALF_DAY_PM,
];

// 자동 복무처리가 필요한 타입 (출장/외부교육)
const AUTO_DUTY_TYPES: VacationType[] = [
  VacationType.BUSINESS_TRIP,
  VacationType.EXTERNAL_TRAINING,
];

@Injectable()
export class VacationsService {
  constructor(
    @InjectRepository(VacationRequest) private reqRepo: Repository<VacationRequest>,
    @InjectRepository(VacationBalance) private balanceRepo: Repository<VacationBalance>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(AttendanceRecord) private attendanceRepo: Repository<AttendanceRecord>,
    private teamsService: TeamsService,
  ) {}

  // ─── 목록 조회 ───────────────────────────────────────
  async findAll(currentUser: AuthenticatedUser, query: VacationQueryDto) {
    const qb = this.reqRepo.createQueryBuilder('v')
      .leftJoinAndSelect('v.user', 'user')
      .leftJoinAndSelect('v.approver', 'approver')
      .where('v.company_id = :cid', { cid: currentUser.companyId })
      .orderBy('v.created_at', 'DESC');

    if (currentUser.role === UserRole.EMPLOYEE) {
      const leaderMemberIds = await this.teamsService.getLeaderTeamMemberIds(
        currentUser.id, currentUser.companyId,
      );
      if (leaderMemberIds) {
        // 팀장: 본인 + 팀원 휴가 조회
        const visibleIds = [currentUser.id, ...leaderMemberIds];
        qb.andWhere('v.user_id IN (:...visibleIds)', { visibleIds });
      } else {
        // 일반 직원: 본인만
        qb.andWhere('v.user_id = :uid', { uid: currentUser.id });
      }
    } else if (query.user_id) {
      qb.andWhere('v.user_id = :uid', { uid: query.user_id });
    }

    if (query.status) {
      qb.andWhere('v.status = :status', { status: query.status });
    }
    if (query.year) {
      qb.andWhere("EXTRACT(YEAR FROM v.start_date::date) = :year", { year: query.year });
    }
    if (query.month) {
      qb.andWhere("EXTRACT(MONTH FROM v.start_date::date) = :month", { month: query.month });
    }

    const rows = await qb.getMany();
    return rows.map(r => this.toResponse(r));
  }

  // ─── 단건 조회 ───────────────────────────────────────
  async findOne(id: string, currentUser: AuthenticatedUser) {
    const req = await this.reqRepo.findOne({
      where: { id, companyId: currentUser.companyId },
      relations: ['user', 'approver'],
    });
    if (!req) throw new NotFoundException('휴가 신청을 찾을 수 없습니다.');
    if (currentUser.role === UserRole.EMPLOYEE && req.userId !== currentUser.id) {
      const isLeader = await this.teamsService.isLeaderOf(
        currentUser.id, req.userId, currentUser.companyId,
      );
      if (!isLeader) throw new ForbiddenException('접근 권한이 없습니다.');
    }
    return this.toResponse(req);
  }

  // ─── 본인 잔여 휴가 ──────────────────────────────────
  async getMyBalance(currentUser: AuthenticatedUser, year?: number) {
    const y = year ?? new Date().getFullYear();
    return this.getBalanceForUser(currentUser.companyId, currentUser.id, y);
  }

  // ─── 팀 전체 잔여 휴가 (관리자) ──────────────────────
  async getTeamBalances(currentUser: AuthenticatedUser, year?: number) {
    const y = year ?? new Date().getFullYear();
    const users = await this.userRepo.find({
      where: { companyId: currentUser.companyId },
      select: ['id', 'name', 'department', 'position'],
    });

    return Promise.all(
      users.map(async u => {
        const bal = await this.getBalanceForUser(currentUser.companyId, u.id, y);
        return { user: { id: u.id, name: u.name, department: u.department, position: u.position }, ...bal };
      }),
    );
  }

  // ─── 휴가 신청 ───────────────────────────────────────
  async create(dto: CreateVacationDto, currentUser: AuthenticatedUser) {
    // 날짜 검증
    if (dto.start_date > dto.end_date) {
      throw new BadRequestException('종료일은 시작일 이후여야 합니다.');
    }

    // 잔여일 확인 (연차/반차만)
    if (DEDUCTIBLE_TYPES.includes(dto.type)) {
      const bal = await this.getBalanceForUser(
        currentUser.companyId,
        currentUser.id,
        new Date(dto.start_date).getFullYear(),
      );
      if (bal.remaining < dto.days) {
        throw new BadRequestException(
          `잔여 휴가일이 부족합니다. (잔여: ${bal.remaining}일, 신청: ${dto.days}일)`,
        );
      }
    }

    const req = this.reqRepo.create({
      companyId: currentUser.companyId,
      userId: currentUser.id,
      type: dto.type,
      startDate: dto.start_date,
      endDate: dto.end_date,
      days: dto.days,
      reason: dto.reason ?? null,
      status: VacationStatus.PENDING,
    });
    const saved = await this.reqRepo.save(req);
    return this.toResponse(
      await this.reqRepo.findOne({ where: { id: saved.id }, relations: ['user', 'approver'] }) as VacationRequest,
    );
  }

  // ─── 승인 ────────────────────────────────────────────
  async approve(id: string, currentUser: AuthenticatedUser) {
    const req = await this.getReqOrFail(id, currentUser.companyId);

    if (currentUser.role === UserRole.EMPLOYEE) {
      const isLeader = await this.teamsService.isLeaderOf(
        currentUser.id, req.userId, currentUser.companyId,
      );
      if (!isLeader) throw new ForbiddenException('휴가 승인 권한이 없습니다.');
    }

    if (req.status !== VacationStatus.PENDING) {
      throw new BadRequestException('대기 중인 신청만 승인할 수 있습니다.');
    }

    req.status = VacationStatus.APPROVED;
    req.approverId = currentUser.id;
    req.approvedAt = new Date();
    await this.reqRepo.save(req);

    // 연차 차감
    if (DEDUCTIBLE_TYPES.includes(req.type as VacationType)) {
      await this.incrementUsed(
        req.companyId,
        req.userId,
        new Date(req.startDate).getFullYear(),
        Number(req.days),
      );
    }

    // 출장/외부교육: 해당 날짜 범위 근태 자동 normal 처리
    if (AUTO_DUTY_TYPES.includes(req.type as VacationType)) {
      await this.autoCreateDutyAttendance(req, currentUser.id);
    }

    return this.toResponse(
      await this.reqRepo.findOne({ where: { id }, relations: ['user', 'approver'] }) as VacationRequest,
    );
  }

  // ─── 반려 ────────────────────────────────────────────
  async reject(id: string, dto: RejectVacationDto, currentUser: AuthenticatedUser) {
    const req = await this.getReqOrFail(id, currentUser.companyId);

    if (currentUser.role === UserRole.EMPLOYEE) {
      const isLeader = await this.teamsService.isLeaderOf(
        currentUser.id, req.userId, currentUser.companyId,
      );
      if (!isLeader) throw new ForbiddenException('휴가 반려 권한이 없습니다.');
    }

    if (req.status !== VacationStatus.PENDING) {
      throw new BadRequestException('대기 중인 신청만 반려할 수 있습니다.');
    }

    req.status = VacationStatus.REJECTED;
    req.approverId = currentUser.id;
    req.rejectedAt = new Date();
    req.rejectReason = dto.reject_reason ?? null;
    await this.reqRepo.save(req);

    return this.toResponse(
      await this.reqRepo.findOne({ where: { id }, relations: ['user', 'approver'] }) as VacationRequest,
    );
  }

  // ─── 취소 (본인) ─────────────────────────────────────
  async cancel(id: string, currentUser: AuthenticatedUser) {
    const req = await this.getReqOrFail(id, currentUser.companyId);

    if (req.userId !== currentUser.id) {
      throw new ForbiddenException('본인 신청만 취소할 수 있습니다.');
    }
    if (req.status === VacationStatus.CANCELLED) {
      throw new BadRequestException('이미 취소된 신청입니다.');
    }

    const wasApproved = req.status === VacationStatus.APPROVED;
    req.status = VacationStatus.CANCELLED;
    await this.reqRepo.save(req);

    // 승인 취소 → 연차 복구
    if (wasApproved && DEDUCTIBLE_TYPES.includes(req.type as VacationType)) {
      await this.incrementUsed(
        req.companyId,
        req.userId,
        new Date(req.startDate).getFullYear(),
        -Number(req.days),
      );
    }

    return this.toResponse(
      await this.reqRepo.findOne({ where: { id }, relations: ['user', 'approver'] }) as VacationRequest,
    );
  }

  // ─── 삭제 ────────────────────────────────────────────
  async remove(id: string, currentUser: AuthenticatedUser) {
    const req = await this.getReqOrFail(id, currentUser.companyId);

    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && req.userId !== currentUser.id) {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }
    if (req.status === VacationStatus.APPROVED) {
      throw new BadRequestException('승인된 신청은 삭제할 수 없습니다. 먼저 취소 처리 해주세요.');
    }

    await this.reqRepo.softDelete(id);
    return { id };
  }

  // ─── 잔여 휴가 설정 (관리자) ─────────────────────────
  async setBalance(dto: SetBalanceDto, currentUser: AuthenticatedUser) {
    const user = await this.userRepo.findOne({
      where: { id: dto.user_id, companyId: currentUser.companyId },
    });
    if (!user) throw new NotFoundException('직원을 찾을 수 없습니다.');

    let bal = await this.balanceRepo.findOne({
      where: { companyId: currentUser.companyId, userId: dto.user_id, year: dto.year },
    });

    if (bal) {
      bal.totalDays = dto.total_days;
      if (dto.adjust_days !== undefined) bal.adjustDays = dto.adjust_days;
      if (dto.note !== undefined) bal.note = dto.note ?? null;
    } else {
      bal = this.balanceRepo.create({
        companyId: currentUser.companyId,
        userId: dto.user_id,
        year: dto.year,
        totalDays: dto.total_days,
        usedDays: 0,
        adjustDays: dto.adjust_days ?? 0,
        note: dto.note ?? null,
      });
    }

    const saved = await this.balanceRepo.save(bal);
    return this.balanceToResponse(saved);
  }

  // ─── 내부 헬퍼 ──────────────────────────────────────
  private async getReqOrFail(id: string, companyId: string): Promise<VacationRequest> {
    const req = await this.reqRepo.findOne({ where: { id, companyId } });
    if (!req) throw new NotFoundException('휴가 신청을 찾을 수 없습니다.');
    return req;
  }

  private async getBalanceForUser(companyId: string, userId: string, year: number) {
    let bal = await this.balanceRepo.findOne({ where: { companyId, userId, year } });
    if (!bal) {
      // 잔액 레코드 없으면 기본값 반환 (저장하지 않음)
      return { year, totalDays: 0, usedDays: 0, adjustDays: 0, remaining: 0, note: null };
    }
    const remaining = Number(bal.totalDays) + Number(bal.adjustDays) - Number(bal.usedDays);
    return {
      year,
      totalDays: Number(bal.totalDays),
      usedDays: Number(bal.usedDays),
      adjustDays: Number(bal.adjustDays),
      remaining: Math.max(remaining, 0),
      note: bal.note,
    };
  }

  private async incrementUsed(
    companyId: string,
    userId: string,
    year: number,
    delta: number,
  ) {
    let bal = await this.balanceRepo.findOne({ where: { companyId, userId, year } });
    if (!bal) {
      bal = this.balanceRepo.create({ companyId, userId, year, totalDays: 0, usedDays: 0, adjustDays: 0 });
    }
    bal.usedDays = Math.max(0, Number(bal.usedDays) + delta);
    await this.balanceRepo.save(bal);
  }

  /**
   * 출장/외부교육 승인 시 해당 날짜 범위의 attendance_records 자동 생성
   * 이미 출근 기록이 있는 날은 건너뜀 (멱등)
   */
  private async autoCreateDutyAttendance(req: VacationRequest, approverId: string): Promise<void> {
    const start = new Date(req.startDate);
    const end   = new Date(req.endDate);

    const workLocation = req.type === VacationType.BUSINESS_TRIP ? 'field' : 'office';
    const note = req.type === VacationType.BUSINESS_TRIP ? '출장 (자동 복무처리)' : '외부교육 (자동 복무처리)';

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const workDate = d.toISOString().split('T')[0];
      const existing = await this.attendanceRepo.findOne({
        where: { userId: req.userId, workDate },
      });
      if (existing?.clockInAt) continue; // 이미 출근 기록 있으면 건너뜀

      const startOfDay = new Date(`${workDate}T00:00:00.000Z`);
      const endOfDay   = new Date(`${workDate}T09:00:00.000Z`); // 09:00 출근 가정

      if (existing) {
        existing.clockInAt      = endOfDay;
        existing.clockOutAt     = new Date(`${workDate}T18:00:00.000Z`);
        existing.totalWorkMinutes = 480; // 8시간
        existing.status         = AttendanceStatus.NORMAL;
        existing.workLocation   = workLocation;
        existing.note           = note;
        existing.approvedBy     = approverId;
        existing.approvedAt     = new Date();
        await this.attendanceRepo.save(existing);
      } else {
        const record = this.attendanceRepo.create({
          companyId:        req.companyId,
          userId:           req.userId,
          workDate,
          clockInAt:        endOfDay,
          clockOutAt:       new Date(`${workDate}T18:00:00.000Z`),
          totalWorkMinutes: 480,
          breakMinutes:     60,
          status:           AttendanceStatus.NORMAL,
          workLocation,
          note,
          approvedBy:       approverId,
          approvedAt:       new Date(),
        });
        await this.attendanceRepo.save(record);
      }
    }
  }

  private toResponse(req: VacationRequest) {
    return {
      id: req.id,
      type: req.type,
      startDate: req.startDate,
      endDate: req.endDate,
      days: Number(req.days),
      reason: req.reason,
      status: req.status,
      rejectReason: req.rejectReason,
      approvedAt: req.approvedAt,
      rejectedAt: req.rejectedAt,
      createdAt: req.createdAt,
      user: req.user
        ? { id: req.user.id, name: req.user.name, department: req.user.department, position: req.user.position }
        : null,
      approver: req.approver
        ? { id: req.approver.id, name: req.approver.name }
        : null,
    };
  }

  private balanceToResponse(bal: VacationBalance) {
    const remaining = Number(bal.totalDays) + Number(bal.adjustDays) - Number(bal.usedDays);
    return {
      id: bal.id,
      year: bal.year,
      totalDays: Number(bal.totalDays),
      usedDays: Number(bal.usedDays),
      adjustDays: Number(bal.adjustDays),
      remaining: Math.max(remaining, 0),
      note: bal.note,
    };
  }
}
