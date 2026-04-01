import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract, ContractStatus } from '../../database/entities/contract.entity';
import { User } from '../../database/entities/user.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateContractDto, UpdateContractDto, TerminateContractDto, ContractQueryDto,
} from './dto/contract.dto';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract) private contractRepo: Repository<Contract>,
    @InjectRepository(User)     private userRepo: Repository<User>,
  ) {}

  // ─── 목록 ─────────────────────────────────────────
  async findAll(currentUser: AuthenticatedUser, query: ContractQueryDto) {
    const qb = this.contractRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .where('c.company_id = :cid', { cid: currentUser.companyId })
      .orderBy('c.start_date', 'DESC');

    // 직원: 본인 계약만
    if (currentUser.role === UserRole.EMPLOYEE) {
      qb.andWhere('c.user_id = :uid', { uid: currentUser.id });
    } else {
      if (query.user_id) qb.andWhere('c.user_id = :uid', { uid: query.user_id });
    }

    if (query.status) qb.andWhere('c.status = :status', { status: query.status });
    if (query.type)   qb.andWhere('c.type = :type',     { type: query.type });

    // 만료 자동 업데이트
    const today = new Date().toISOString().split('T')[0];
    await this.contractRepo.createQueryBuilder()
      .update(Contract)
      .set({ status: ContractStatus.EXPIRED })
      .where('company_id = :cid AND status = :active AND end_date < :today AND end_date IS NOT NULL', {
        cid: currentUser.companyId,
        active: ContractStatus.ACTIVE,
        today,
      })
      .execute();

    const contracts = await qb.getMany();
    return contracts.map(c => this.toResponse(c));
  }

  // ─── 단건 ─────────────────────────────────────────
  async findOne(id: string, currentUser: AuthenticatedUser) {
    const c = await this.loadOrFail(id, currentUser.companyId);
    if (currentUser.role === UserRole.EMPLOYEE && c.userId !== currentUser.id) {
      throw new ForbiddenException();
    }
    return this.toResponse(c);
  }

  // ─── 등록 (관리자) ───────────────────────────────
  async create(dto: CreateContractDto, currentUser: AuthenticatedUser) {
    const user = await this.userRepo.findOne({ where: { id: dto.user_id, companyId: currentUser.companyId } });
    if (!user) throw new NotFoundException('직원을 찾을 수 없습니다.');

    const c = this.contractRepo.create({
      companyId: currentUser.companyId,
      userId: dto.user_id,
      type: dto.type,
      title: dto.title,
      startDate: dto.start_date,
      endDate: dto.end_date ?? null,
      status: ContractStatus.ACTIVE,
      fileUrl: dto.file_url ?? null,
      fileName: dto.file_name ?? null,
      note: dto.note ?? null,
      createdBy: currentUser.id,
    });
    const saved = await this.contractRepo.save(c);
    return this.toResponse(await this.loadOrFail(saved.id, currentUser.companyId));
  }

  // ─── 수정 (관리자) ───────────────────────────────
  async update(id: string, dto: UpdateContractDto, currentUser: AuthenticatedUser) {
    const c = await this.loadOrFail(id, currentUser.companyId);
    if (c.status === ContractStatus.TERMINATED) throw new BadRequestException('해지된 계약은 수정할 수 없습니다.');

    Object.assign(c, {
      ...(dto.title      && { title:    dto.title }),
      ...(dto.start_date && { startDate: dto.start_date }),
      ...(dto.end_date !== undefined && { endDate: dto.end_date ?? null }),
      ...(dto.file_url  !== undefined && { fileUrl:  dto.file_url ?? null }),
      ...(dto.file_name !== undefined && { fileName: dto.file_name ?? null }),
      ...(dto.note      !== undefined && { note:     dto.note ?? null }),
    });
    await this.contractRepo.save(c);
    return this.toResponse(await this.loadOrFail(id, currentUser.companyId));
  }

  // ─── 해지 (관리자) ───────────────────────────────
  async terminate(id: string, dto: TerminateContractDto, currentUser: AuthenticatedUser) {
    const c = await this.loadOrFail(id, currentUser.companyId);
    if (c.status === ContractStatus.TERMINATED) throw new BadRequestException('이미 해지된 계약입니다.');

    c.status = ContractStatus.TERMINATED;
    c.terminatedAt = new Date();
    c.terminateReason = dto.reason ?? null;
    await this.contractRepo.save(c);
    return this.toResponse(c);
  }

  // ─── 삭제 (관리자) ───────────────────────────────
  async remove(id: string, currentUser: AuthenticatedUser) {
    await this.loadOrFail(id, currentUser.companyId);
    await this.contractRepo.softDelete(id);
    return { id };
  }

  // ─── 내부 헬퍼 ──────────────────────────────────
  private async loadOrFail(id: string, companyId: string): Promise<Contract> {
    const c = await this.contractRepo.findOne({
      where: { id, companyId },
      relations: ['user'],
    });
    if (!c) throw new NotFoundException('계약을 찾을 수 없습니다.');
    return c;
  }

  private toResponse(c: Contract) {
    const today = new Date().toISOString().split('T')[0];
    const daysLeft = c.endDate
      ? Math.ceil((new Date(c.endDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: c.id,
      type: c.type,
      title: c.title,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      fileUrl: c.fileUrl,
      fileName: c.fileName,
      note: c.note,
      terminatedAt: c.terminatedAt,
      terminateReason: c.terminateReason,
      createdAt: c.createdAt,
      daysLeft,
      isExpiringSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= 30,
      user: c.user
        ? { id: c.user.id, name: c.user.name, department: c.user.department, position: c.user.position }
        : null,
    };
  }
}
