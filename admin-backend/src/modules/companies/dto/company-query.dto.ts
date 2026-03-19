import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum CompanyStatusFilter {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELED = 'canceled',
}

export class CompanyQueryDto {
  @IsOptional()
  @IsString()
  search?: string; // 회사명, 이메일, 사업자번호

  @IsOptional()
  @IsEnum(CompanyStatusFilter)
  status?: CompanyStatusFilter;

  @IsOptional()
  @IsString()
  plan?: string; // free|basic|pro|enterprise

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SuspendCompanyDto {
  @IsString()
  reason: string;
}

export class ChangePlanDto {
  @IsString()
  planId: string;

  @IsString()
  reason: string;
}
