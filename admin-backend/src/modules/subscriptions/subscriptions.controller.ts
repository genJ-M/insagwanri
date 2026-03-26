import {
  Controller, Get, Post, Query, Param,
  Body, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Subscription, SubscriptionStatus } from '../../database/entities/subscription.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '../../database/entities/admin-user.entity';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { BadRequestException, NotFoundException } from '@nestjs/common';

class SubQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() plan?: string;
  @IsOptional() @IsString() billingCycle?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

class ExtendTrialDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(90) days: number;
}

class CancelDto {
  @IsOptional() cancelAtPeriodEnd?: boolean;
  @IsOptional() @IsString() reason?: string;
}

@Controller('admin/v1/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(
    @InjectRepository(Subscription) private subRepo: Repository<Subscription>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  /** GET /admin/v1/subscriptions */
  @Get()
  @Roles(AdminRole.READONLY)
  async findAll(@Query() query: SubQueryDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (query.status) {
      conditions.push(`s.status = $${i++}`);
      params.push(query.status);
    }
    if (query.plan) {
      conditions.push(`p.name = $${i++}`);
      params.push(query.plan);
    }
    if (query.billingCycle) {
      conditions.push(`s.billing_cycle = $${i++}`);
      params.push(query.billingCycle);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await this.dataSource.query(`
      SELECT
        s.id, s.status, s.billing_cycle, s.quantity,
        s.current_period_end, s.next_billing_at, s.trial_end_at,
        s.retry_count, s.past_due_since, s.cancel_at_period_end, s.created_at,
        c.name AS company_name,
        p.name AS plan_name, p.display_name AS plan_display_name
      FROM subscriptions s
      JOIN companies c ON c.id = s.company_id
      JOIN plans p ON p.id = s.plan_id
      ${where}
      ORDER BY s.created_at DESC
      LIMIT $${i} OFFSET $${i + 1}
    `, [...params, limit, offset]);

    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM subscriptions s JOIN companies c ON c.id = s.company_id JOIN plans p ON p.id = s.plan_id ${where}`,
      params,
    );

    return {
      data: rows,
      meta: { total: parseInt(total), page, limit, totalPages: Math.ceil(parseInt(total) / limit) },
    };
  }

  /** POST /admin/v1/subscriptions/:id/extend-trial */
  @Post(':id/extend-trial')
  @Roles(AdminRole.OPERATIONS)
  async extendTrial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendTrialDto,
  ) {
    const sub = await this.subRepo.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('구독을 찾을 수 없습니다.');
    if (sub.status !== SubscriptionStatus.TRIALING) {
      throw new BadRequestException('체험 중인 구독만 연장 가능합니다.');
    }

    const currentEnd = sub.trialEndAt ?? new Date();
    const newEnd = new Date(currentEnd);
    newEnd.setDate(newEnd.getDate() + dto.days);

    await this.subRepo.update(id, { trialEndAt: newEnd, currentPeriodEnd: newEnd });
    return { message: `체험 기간이 ${dto.days}일 연장되었습니다.` };
  }

  /** POST /admin/v1/subscriptions/:id/cancel */
  @Post(':id/cancel')
  @Roles(AdminRole.BILLING)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDto,
  ) {
    const sub = await this.subRepo.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('구독을 찾을 수 없습니다.');

    if (dto.cancelAtPeriodEnd) {
      await this.subRepo.update(id, {
        cancelAtPeriodEnd: true,
        cancelReason: dto.reason ?? null,
      });
      return { message: '기간 종료 시 해지 예약되었습니다.' };
    }

    await this.subRepo.update(id, {
      status: SubscriptionStatus.CANCELED,
      canceledAt: new Date(),
      cancelReason: dto.reason ?? null,
    });
    await this.dataSource.query(
      `UPDATE companies SET status = 'canceled', updated_at = NOW() WHERE id = $1`,
      [sub.companyId],
    );
    return { message: '즉시 해지되었습니다.' };
  }

  /** POST /admin/v1/subscriptions/:id/reactivate */
  @Post(':id/reactivate')
  @Roles(AdminRole.BILLING)
  async reactivate(@Param('id', ParseUUIDPipe) id: string) {
    const sub = await this.subRepo.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('구독을 찾을 수 없습니다.');

    if (sub.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('이미 활성 상태입니다.');
    }

    await this.subRepo.update(id, {
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
      canceledAt: null as any,
      pastDueSince: null as any,
      retryCount: 0,
      nextRetryAt: null as any,
    });
    await this.dataSource.query(
      `UPDATE companies SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [sub.companyId],
    );
    return { message: '구독이 재활성화되었습니다.' };
  }
}
