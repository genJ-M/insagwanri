import {
  IsString, IsEnum, IsOptional, IsDateString,
  IsBoolean, IsInt, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScheduleScope } from '../../../database/entities/schedule.entity';

export class CreateCalendarEventDto {
  @IsEnum(ScheduleScope)
  scope: ScheduleScope;

  @IsOptional()
  @IsString()
  target_department?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  // all_day=true 시 사용 — 'YYYY-MM-DD'
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  // all_day=false 시 사용 — ISO datetime, start_date/end_date 보다 우선
  @IsOptional()
  @IsDateString()
  start_at?: string;

  @IsOptional()
  @IsDateString()
  end_at?: string;

  @IsOptional()
  @IsBoolean()
  all_day?: boolean;

  @IsOptional()
  @IsString()
  color?: string;

  // 반복 — iCal RRULE (예: FREQ=WEEKLY;BYDAY=MO)
  @IsOptional()
  @IsString()
  recurrence_rule?: string;

  @IsOptional()
  @IsDateString()
  recurrence_end_at?: string;

  // 시작 N분 전 알림 (0 = 알림 없음)
  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(0) @Max(10080)
  notify_before_min?: number;
}

export class UpdateCalendarEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsDateString()
  start_at?: string;

  @IsOptional()
  @IsDateString()
  end_at?: string;

  @IsOptional()
  @IsBoolean()
  all_day?: boolean;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  recurrence_rule?: string;

  @IsOptional()
  @IsDateString()
  recurrence_end_at?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(0) @Max(10080)
  notify_before_min?: number;
}

export class CalendarQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsOptional()
  @IsString()
  department?: string;
}
