import {
  IsString, IsEnum, IsOptional, IsDateString,
  IsNumber, Min, IsInt, IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VacationType } from '../../../database/entities/vacation-request.entity';

export class CreateVacationDto {
  @IsEnum(VacationType)
  type: VacationType;

  @IsDateString()
  start_date: string; // 'YYYY-MM-DD'

  @IsDateString()
  end_date: string;

  @IsNumber()
  @Min(0.5)
  days: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectVacationDto {
  @IsOptional()
  @IsString()
  reject_reason?: string;
}

export class VacationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  month?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;
}

export class SetBalanceDto {
  @IsUUID()
  user_id: string;

  @IsInt()
  year: number;

  @IsNumber()
  @Min(0)
  total_days: number;

  @IsOptional()
  @IsNumber()
  adjust_days?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
