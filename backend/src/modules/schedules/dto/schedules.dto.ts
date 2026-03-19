import {
  IsString, IsOptional, IsUUID, IsDateString, IsBoolean,
  IsIn, IsNumber, Min, Max, Matches, MinLength, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateScheduleDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString() @MaxLength(200)
  location?: string;

  @IsOptional() @IsUUID()
  target_user_id?: string;

  @IsDateString()
  start_at: string;

  @IsDateString()
  end_at: string;

  @IsOptional() @IsBoolean()
  is_all_day?: boolean = false;

  @IsOptional()
  @IsIn(['general', 'meeting', 'vacation', 'business_trip', 'training', 'holiday'])
  type?: string = 'general';

  @IsOptional() @IsString()
  recurrence_rule?: string;         // iCal RRULE (FREQ=WEEKLY;BYDAY=MO)

  @IsOptional() @IsDateString()
  recurrence_end_at?: string;

  @IsOptional() @IsNumber() @Min(0)
  notify_before_min?: number;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color는 HEX 형식이어야 합니다. (예: #FF5733)' })
  color?: string;
}

export class UpdateScheduleDto {
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString() @MaxLength(200)
  location?: string;

  @IsOptional() @IsDateString()
  start_at?: string;

  @IsOptional() @IsDateString()
  end_at?: string;

  @IsOptional()
  @IsIn(['general', 'meeting', 'vacation', 'business_trip', 'training', 'holiday'])
  type?: string;

  @IsOptional() @IsString()
  recurrence_rule?: string;

  @IsOptional() @IsNumber() @Min(0)
  notify_before_min?: number;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;

  @IsOptional()
  @IsIn(['this_only', 'this_and_following', 'all'])
  update_recurrence?: string;
}

export class DeleteScheduleDto {
  @IsOptional()
  @IsIn(['this_only', 'this_and_following', 'all'])
  delete_recurrence?: string;
}

export class ScheduleQueryDto {
  @IsDateString()
  start_date: string;               // 필수

  @IsDateString()
  end_date: string;                 // 필수

  @IsOptional()
  @IsIn(['general', 'meeting', 'vacation', 'business_trip', 'training', 'holiday'])
  type?: string;

  @IsOptional() @IsUUID()
  user_id?: string;
}
