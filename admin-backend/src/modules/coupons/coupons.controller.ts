import {
  Controller, Get, Post, Patch, Delete,
  Query, Param, Body, UseGuards, ParseUUIDPipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from '../../database/entities/coupon.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminUser } from '../../common/decorators/admin-user.decorator';
import { AdminJwtPayload } from '../../common/types/admin-jwt-payload.type';
import { AdminRole } from '../../database/entities/admin-user.entity';
import {
  IsString, IsEnum, IsNumber, IsOptional, IsBoolean,
  IsInt, IsDateString, Min, MinLength, IsUUID, IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConflictException, NotFoundException } from '@nestjs/common';

class CreateCouponDto {
  @IsString() @MinLength(2) code: string;
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(['percentage', 'fixed_amount']) discount_type: string;
  @Type(() => Number) @IsNumber() @Min(0) discount_value: number;
  @IsOptional() @Type(() => Number) @IsNumber() max_discount_amount_krw?: number;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) applicable_plans?: string[];
  @IsOptional() @IsEnum(['all', 'monthly_only', 'yearly_only']) applicable_billing_cycles?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) max_total_uses?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) max_uses_per_company?: number;
  @IsDateString() valid_from: string;
  @IsOptional() @IsDateString() valid_until?: string;
  @IsOptional() @IsBoolean() is_public?: boolean;
}

class UpdateCouponDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsBoolean() is_public?: boolean;
  @IsOptional() @IsDateString() valid_until?: string;
  @IsOptional() @Type(() => Number) @IsInt() max_total_uses?: number;
}

class CouponQueryDto {
  @IsOptional() @IsString() isActive?: string;
  @IsOptional() @IsString() search?: string;
}

@Controller('admin/v1/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CouponsController {
  constructor(
    @InjectRepository(Coupon) private couponRepo: Repository<Coupon>,
  ) {}

  /** GET /admin/v1/coupons */
  @Get()
  @Roles(AdminRole.READONLY)
  async findAll(@Query() query: CouponQueryDto) {
    const qb = this.couponRepo.createQueryBuilder('c').orderBy('c.createdAt', 'DESC');

    if (query.isActive === 'true')  qb.andWhere('c.isActive = true');
    if (query.isActive === 'false') qb.andWhere('c.isActive = false');
    if (query.search) {
      qb.andWhere('(c.code ILIKE :s OR c.name ILIKE :s)', { s: `%${query.search}%` });
    }

    return qb.getMany();
  }

  /** POST /admin/v1/coupons */
  @Post()
  @Roles(AdminRole.OPERATIONS)
  async create(@Body() dto: CreateCouponDto, @AdminUser() actor: AdminJwtPayload) {
    const exists = await this.couponRepo.findOne({
      where: { code: dto.code.toUpperCase() },
    });
    if (exists) throw new ConflictException('이미 사용 중인 쿠폰 코드입니다.');

    const coupon = this.couponRepo.create({
      code: dto.code.toUpperCase(),
      name: dto.name,
      description: dto.description ?? null,
      discountType: dto.discount_type,
      discountValue: dto.discount_value,
      maxDiscountAmountKrw: dto.max_discount_amount_krw ?? null,
      applicablePlans: dto.applicable_plans ?? [],
      applicableBillingCycles: dto.applicable_billing_cycles ?? 'all',
      maxTotalUses: dto.max_total_uses ?? null,
      maxUsesPerCompany: dto.max_uses_per_company ?? 1,
      validFrom: new Date(dto.valid_from),
      validUntil: dto.valid_until ? new Date(dto.valid_until) : null,
      isPublic: dto.is_public ?? false,
      isActive: true,
      createdBy: actor.sub,
    });

    return this.couponRepo.save(coupon);
  }

  /** PATCH /admin/v1/coupons/:id */
  @Patch(':id')
  @Roles(AdminRole.OPERATIONS)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');

    await this.couponRepo.update(id, {
      ...(dto.name        !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.is_active   !== undefined && { isActive: dto.is_active }),
      ...(dto.is_public   !== undefined && { isPublic: dto.is_public }),
      ...(dto.valid_until !== undefined && { validUntil: dto.valid_until ? new Date(dto.valid_until) : null }),
      ...(dto.max_total_uses !== undefined && { maxTotalUses: dto.max_total_uses }),
    });

    return this.couponRepo.findOne({ where: { id } });
  }

  /** DELETE /admin/v1/coupons/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(AdminRole.OPERATIONS)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    if (coupon.currentTotalUses > 0) {
      // 사용된 쿠폰은 삭제 대신 비활성화
      await this.couponRepo.update(id, { isActive: false });
      return;
    }
    await this.couponRepo.delete(id);
  }
}
