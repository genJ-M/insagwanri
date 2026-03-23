import {
  IsInt, IsOptional, IsString, IsIn, IsUUID,
  Min, Max, IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalaryDto {
  @IsUUID()
  user_id: string;

  @IsInt() @Min(2020) @Max(2099)
  year: number;

  @IsInt() @Min(1) @Max(12)
  month: number;

  @IsInt() @Min(0)
  base_salary: number;

  @IsOptional() @IsInt() @Min(0)
  overtime_pay?: number;

  @IsOptional() @IsInt() @Min(0)
  holiday_pay?: number;

  @IsOptional() @IsInt() @Min(0)
  bonus?: number;

  @IsOptional() @IsInt() @Min(0)
  meal_allowance?: number;

  @IsOptional() @IsInt() @Min(0)
  transport_allowance?: number;

  @IsOptional() @IsInt() @Min(0)
  other_allowance?: number;

  @IsOptional() @IsInt() @Min(0)
  income_tax?: number;

  @IsOptional() @IsInt() @Min(0)
  local_tax?: number;

  @IsOptional() @IsInt() @Min(0)
  national_pension?: number;

  @IsOptional() @IsInt() @Min(0)
  health_insurance?: number;

  @IsOptional() @IsInt() @Min(0)
  care_insurance?: number;

  @IsOptional() @IsInt() @Min(0)
  employment_insurance?: number;

  @IsOptional() @IsInt() @Min(0)
  other_deduction?: number;

  @IsOptional() @IsString()
  note?: string;
}

export class UpdateSalaryDto {
  @IsOptional() @IsInt() @Min(0)
  base_salary?: number;

  @IsOptional() @IsInt() @Min(0)
  overtime_pay?: number;

  @IsOptional() @IsInt() @Min(0)
  holiday_pay?: number;

  @IsOptional() @IsInt() @Min(0)
  bonus?: number;

  @IsOptional() @IsInt() @Min(0)
  meal_allowance?: number;

  @IsOptional() @IsInt() @Min(0)
  transport_allowance?: number;

  @IsOptional() @IsInt() @Min(0)
  other_allowance?: number;

  @IsOptional() @IsInt() @Min(0)
  income_tax?: number;

  @IsOptional() @IsInt() @Min(0)
  local_tax?: number;

  @IsOptional() @IsInt() @Min(0)
  national_pension?: number;

  @IsOptional() @IsInt() @Min(0)
  health_insurance?: number;

  @IsOptional() @IsInt() @Min(0)
  care_insurance?: number;

  @IsOptional() @IsInt() @Min(0)
  employment_insurance?: number;

  @IsOptional() @IsInt() @Min(0)
  other_deduction?: number;

  @IsOptional() @IsString()
  note?: string;
}

export class SalaryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(2020) @Max(2099)
  year?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12)
  month?: number;

  @IsOptional() @IsUUID()
  user_id?: string;

  @IsOptional() @IsIn(['draft', 'confirmed', 'paid'])
  status?: string;
}

export class AutoCalculateDto {
  @IsInt() @Min(2020) @Max(2099)
  year: number;

  @IsInt() @Min(1) @Max(12)
  month: number;

  @IsInt() @Min(0)
  base_salary: number;

  @IsOptional() @IsInt() @Min(0)
  meal_allowance?: number;

  @IsOptional() @IsInt() @Min(0)
  transport_allowance?: number;
}
