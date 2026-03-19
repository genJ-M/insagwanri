import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../../database/entities/plan.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '../../database/entities/admin-user.entity';
import { IsString, IsNumber, IsOptional, IsBoolean, IsInt } from 'class-validator';

class UpdatePlanDto {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsNumber() priceMonthlyKrw?: number;
  @IsOptional() @IsNumber() priceYearlyKrw?: number;
  @IsOptional() @IsNumber() yearlyDiscountRate?: number;
  @IsOptional() @IsInt() maxEmployees?: number;
  @IsOptional() @IsInt() aiRequestsPerDay?: number;
  @IsOptional() @IsNumber() storageLimitGb?: number;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

@Controller('admin/v1/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlansController {
  constructor(
    @InjectRepository(Plan)
    private planRepository: Repository<Plan>,
  ) {}

  // GET /admin/v1/plans
  @Get()
  @Roles(AdminRole.READONLY)
  findAll() {
    return this.planRepository.find({ order: { sortOrder: 'ASC' } });
  }

  // GET /admin/v1/plans/:id
  @Get(':id')
  @Roles(AdminRole.READONLY)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.planRepository.findOne({ where: { id } });
  }

  // PATCH /admin/v1/plans/:id
  @Patch(':id')
  @Roles(AdminRole.OPERATIONS)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    await this.planRepository.update(id, dto as any);
    return this.planRepository.findOne({ where: { id } });
  }
}
