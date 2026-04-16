import {
  Injectable, ForbiddenException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { BusinessLocation } from '../../database/entities/business-location.entity';
import { UserLocation } from '../../database/entities/user-location.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import { CreateLocationDto, UpdateLocationDto, AssignEmployeeDto } from './dto/locations.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(BusinessLocation)
    private locationRepo: Repository<BusinessLocation>,
    @InjectRepository(UserLocation)
    private userLocationRepo: Repository<UserLocation>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  // ──────────────────────────────────────────────
  // 지점 수 한도 계산 (기본 1개 + extra_location 애드온)
  // ──────────────────────────────────────────────
  private async getLocationQuota(companyId: string): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT quantity FROM addon_purchases
       WHERE company_id = $1 AND addon_code = 'extra_location' AND status = 'active'`,
      [companyId],
    );
    const extra = rows.reduce((sum: number, r: any) => sum + Number(r.quantity ?? 0), 0);
    return 1 + extra; // 기본 1개 + 추가 구매분
  }

  // ──────────────────────────────────────────────
  // 지점 목록 조회
  // ──────────────────────────────────────────────
  async getLocations(user: AuthenticatedUser) {
    const locations = await this.locationRepo.find({
      where: { companyId: user.companyId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });

    const quota = await this.getLocationQuota(user.companyId);
    const active = locations.filter((l) => l.isActive).length;

    return { locations, quota, activeCount: active };
  }

  // ──────────────────────────────────────────────
  // 지점 생성 (owner only)
  // ──────────────────────────────────────────────
  async createLocation(user: AuthenticatedUser, dto: CreateLocationDto) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('사업주만 지점을 추가할 수 있습니다.');
    }

    const activeCount = await this.locationRepo.count({
      where: { companyId: user.companyId, isActive: true, deletedAt: IsNull() },
    });
    const quota = await this.getLocationQuota(user.companyId);

    if (activeCount >= quota) {
      throw new BadRequestException(
        `현재 플랜에서 최대 ${quota}개의 지점을 사용할 수 있습니다. ` +
        '추가 지점 애드온을 구매하세요.',
      );
    }

    const location = this.locationRepo.create({
      companyId: user.companyId,
      name: dto.name,
      address: dto.address ?? null,
      phone: dto.phone ?? null,
      managerUserId: dto.managerUserId ?? null,
      note: dto.note ?? null,
    });
    return this.locationRepo.save(location);
  }

  // ──────────────────────────────────────────────
  // 지점 수정 (owner only)
  // ──────────────────────────────────────────────
  async updateLocation(user: AuthenticatedUser, id: string, dto: UpdateLocationDto) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('사업주만 지점 정보를 수정할 수 있습니다.');
    }
    const location = await this.locationRepo.findOne({
      where: { id, companyId: user.companyId, deletedAt: IsNull() },
    });
    if (!location) throw new NotFoundException('지점을 찾을 수 없습니다.');

    Object.assign(location, {
      name:          dto.name          ?? location.name,
      address:       dto.address       !== undefined ? dto.address       : location.address,
      phone:         dto.phone         !== undefined ? dto.phone         : location.phone,
      managerUserId: dto.managerUserId !== undefined ? dto.managerUserId : location.managerUserId,
      isActive:      dto.isActive      !== undefined ? dto.isActive      : location.isActive,
      note:          dto.note          !== undefined ? dto.note          : location.note,
    });
    return this.locationRepo.save(location);
  }

  // ──────────────────────────────────────────────
  // 지점 삭제 (soft delete, owner only)
  // ──────────────────────────────────────────────
  async deleteLocation(user: AuthenticatedUser, id: string) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('사업주만 지점을 삭제할 수 있습니다.');
    }
    const location = await this.locationRepo.findOne({
      where: { id, companyId: user.companyId, deletedAt: IsNull() },
    });
    if (!location) throw new NotFoundException('지점을 찾을 수 없습니다.');

    // 할당된 직원 수 확인
    const assignedCount = await this.userLocationRepo.count({ where: { locationId: id } });
    if (assignedCount > 0) {
      throw new BadRequestException(
        `이 지점에 ${assignedCount}명의 직원이 배정되어 있습니다. 먼저 배정을 해제하세요.`,
      );
    }

    await this.locationRepo.softDelete(id);
    return { deleted: true };
  }

  // ──────────────────────────────────────────────
  // 지점 소속 직원 조회
  // ──────────────────────────────────────────────
  async getLocationEmployees(user: AuthenticatedUser, locationId: string) {
    const location = await this.locationRepo.findOne({
      where: { id: locationId, companyId: user.companyId, deletedAt: IsNull() },
    });
    if (!location) throw new NotFoundException('지점을 찾을 수 없습니다.');

    const rows = await this.dataSource.query(
      `SELECT u.id, u.name, u.email, u.department, u.position, u.role,
              ul.is_primary AS "isPrimary", ul.assigned_at AS "assignedAt"
       FROM user_locations ul
       JOIN users u ON u.id = ul.user_id
       WHERE ul.location_id = $1 AND u.deleted_at IS NULL
       ORDER BY ul.is_primary DESC, u.name ASC`,
      [locationId],
    );
    return rows;
  }

  // ──────────────────────────────────────────────
  // 직원 지점 배정 (owner/manager)
  // ──────────────────────────────────────────────
  async assignEmployee(user: AuthenticatedUser, locationId: string, dto: AssignEmployeeDto) {
    if (user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('권한이 없습니다.');
    }
    const location = await this.locationRepo.findOne({
      where: { id: locationId, companyId: user.companyId, deletedAt: IsNull() },
    });
    if (!location) throw new NotFoundException('지점을 찾을 수 없습니다.');

    // 이미 배정된 경우 idempotent 처리
    const existing = await this.userLocationRepo.findOne({
      where: { userId: dto.userId, locationId },
    });

    if (dto.isPrimary) {
      // 기존 주 근무지 해제
      await this.userLocationRepo.update(
        { userId: dto.userId },
        { isPrimary: false },
      );
    }

    if (existing) {
      existing.isPrimary = dto.isPrimary ?? existing.isPrimary;
      return this.userLocationRepo.save(existing);
    }

    const ul = this.userLocationRepo.create({
      userId: dto.userId,
      locationId,
      isPrimary: dto.isPrimary ?? false,
    });
    return this.userLocationRepo.save(ul);
  }

  // ──────────────────────────────────────────────
  // 직원 지점 배정 해제
  // ──────────────────────────────────────────────
  async unassignEmployee(user: AuthenticatedUser, locationId: string, userId: string) {
    if (user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('권한이 없습니다.');
    }
    const location = await this.locationRepo.findOne({
      where: { id: locationId, companyId: user.companyId, deletedAt: IsNull() },
    });
    if (!location) throw new NotFoundException('지점을 찾을 수 없습니다.');

    await this.userLocationRepo.delete({ userId, locationId });
    return { removed: true };
  }

  // ──────────────────────────────────────────────
  // 내 배정 지점 조회 (직원 본인)
  // ──────────────────────────────────────────────
  async getMyLocations(user: AuthenticatedUser) {
    const rows = await this.dataSource.query(
      `SELECT bl.id, bl.name, bl.address, bl.phone, ul.is_primary AS "isPrimary"
       FROM user_locations ul
       JOIN business_locations bl ON bl.id = ul.location_id
       WHERE ul.user_id = $1 AND bl.deleted_at IS NULL AND bl.is_active = true
       ORDER BY ul.is_primary DESC, bl.name ASC`,
      [user.id],
    );
    return rows;
  }
}
