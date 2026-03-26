import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLog } from '../../database/entities/admin-audit-log.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '../../database/entities/admin-user.entity';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class AuditQueryDto {
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() targetType?: string;
  @IsOptional() @IsString() adminUserId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

@Controller('admin/v1/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.READONLY)
export class AuditController {
  constructor(
    @InjectRepository(AdminAuditLog) private auditRepo: Repository<AdminAuditLog>,
  ) {}

  @Get()
  async findAll(@Query() query: AuditQueryDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 30;

    const qb = this.auditRepo
      .createQueryBuilder('log')
      .leftJoin('log.adminUser', 'au')
      .addSelect(['au.name', 'au.email'])
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.action) {
      qb.andWhere('log.action ILIKE :action', { action: `%${query.action}%` });
    }
    if (query.targetType) {
      qb.andWhere('log.targetType = :targetType', { targetType: query.targetType });
    }
    if (query.adminUserId) {
      qb.andWhere('log.adminUserId = :uid', { uid: query.adminUserId });
    }

    const [logs, total] = await qb.getManyAndCount();

    const data = logs.map(log => ({
      id: log.id,
      action: log.action,
      target_type: log.targetType,
      target_id: log.targetId,
      reason: log.reason,
      ip_address: log.ipAddress,
      created_at: log.createdAt,
      admin_user_name:  (log as any).au_name  ?? null,
      admin_user_email: (log as any).au_email ?? null,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
