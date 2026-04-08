import {
  IsString, IsEnum, IsOptional, IsBoolean, IsArray, IsDateString,
  ValidateNested, MaxLength, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ShiftType } from '../../../database/entities/shift-schedule.entity';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ── 근무표 ──────────────────────────────────────────────────────────────────
export class CreateShiftScheduleDto {
  @IsString() @MaxLength(200)
  title: string;

  @IsOptional() @IsString() @MaxLength(100)
  department?: string;

  /** YYYY-MM-DD (해당 주 월요일) */
  @IsDateString()
  week_start: string;

  @IsOptional() @IsString()
  note?: string;
}

export class UpdateShiftScheduleDto {
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(100)
  department?: string;

  @IsOptional() @IsString()
  note?: string;
}

export class ShiftScheduleQueryDto {
  @IsOptional() @IsString()
  department?: string;

  /** YYYY-MM-DD (주의 월요일) */
  @IsOptional() @IsDateString()
  week_start?: string;

  /** YYYY-MM (월 단위 범위 조회) */
  @IsOptional() @IsString()
  month?: string;
}

// ── 근무 배정 ─────────────────────────────────────────────────────────────
export class ShiftAssignmentItemDto {
  @IsString()
  user_id: string;

  @IsDateString()
  date: string;

  @IsOptional() @Matches(TIME_RE)
  start_time?: string;

  @IsOptional() @Matches(TIME_RE)
  end_time?: string;

  @IsOptional() @IsEnum(ShiftType)
  shift_type?: ShiftType;

  @IsOptional() @IsString() @MaxLength(300)
  location?: string;

  @IsOptional() @IsString()
  note?: string;
}

export class BulkUpsertAssignmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShiftAssignmentItemDto)
  assignments: ShiftAssignmentItemDto[];
}

export class DeleteAssignmentDto {
  @IsString()
  user_id: string;

  @IsDateString()
  date: string;
}

// ── 가용시간 ──────────────────────────────────────────────────────────────
export class UpsertAvailabilityDto {
  /** 0=일, 1=월, ..., 6=토 — specificDate 없으면 필수 */
  @IsOptional()
  day_of_week?: number;

  @IsOptional() @IsDateString()
  specific_date?: string;

  @Matches(TIME_RE)
  start_time: string;

  @Matches(TIME_RE)
  end_time: string;

  @IsOptional() @IsBoolean()
  is_available?: boolean;

  @IsOptional() @IsString()
  note?: string;

  @IsOptional() @IsDateString()
  effective_from?: string;

  @IsOptional() @IsDateString()
  effective_until?: string;
}

export class AvailabilityQueryDto {
  /** 특정 사용자 (관리자만 타인 조회 가능) */
  @IsOptional() @IsString()
  user_id?: string;

  /** YYYY-MM-DD ~ YYYY-MM-DD 범위의 가용시간을 날짜별로 평탄화 */
  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;
}
