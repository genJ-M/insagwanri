import {
  IsString, IsOptional, IsUUID, IsIn, IsDateString,
  IsArray, IsUrl, MinLength, MaxLength, IsNumber, Min, Max,
  IsBoolean, IsISO8601,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @IsString() @MinLength(2) @MaxLength(200)
  title: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString() @MaxLength(500)
  scope?: string;

  @IsOptional() @IsUUID()
  assignee_id?: string;

  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: string = 'normal';

  @IsOptional() @IsString() @MaxLength(50)
  category?: string;

  @IsOptional() @IsDateString()
  start_date?: string;

  @IsOptional() @IsDateString()
  due_date?: string;

  /** ISO8601 datetime (날짜+시간, 1시간 단위) */
  @IsOptional() @IsISO8601()
  due_datetime?: string;

  @IsOptional() @IsString() @MaxLength(60)
  template_id?: string;

  @IsOptional() @IsArray() @IsUrl({}, { each: true })
  attachment_urls?: string[] = [];

  @IsOptional() @IsUUID()
  parent_task_id?: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString() @MaxLength(500)
  scope?: string;

  @IsOptional() @IsUUID()
  assignee_id?: string;

  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsIn(['pending', 'in_progress', 'review', 'done', 'cancelled'])
  status?: string;

  @IsOptional() @IsDateString()
  due_date?: string;

  @IsOptional() @IsISO8601()
  due_datetime?: string;

  @IsOptional() @IsArray() @IsUrl({}, { each: true })
  attachment_urls?: string[];
}

export class RequestTimeAdjustDto {
  /** 담당자가 제안하는 새 기한 (ISO8601) */
  @IsISO8601()
  proposed_datetime: string;

  @IsOptional() @IsString() @MaxLength(500)
  message?: string;
}

export class RespondTimeAdjustDto {
  @IsIn(['approved', 'rejected'])
  action: 'approved' | 'rejected';
}

export class CreateReportDto {
  @IsString() @MinLength(1)
  content: string;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  progress_percent?: number;

  @IsOptional() @IsArray() @IsUrl({}, { each: true })
  attachment_urls?: string[] = [];

  @IsOptional() @IsBoolean()
  is_ai_assisted?: boolean = false;
}

export class FeedbackDto {
  @IsString() @MinLength(1)
  feedback: string;
}

export class TaskQueryDto {
  @IsOptional()
  @IsIn(['pending', 'in_progress', 'review', 'done', 'cancelled'])
  status?: string;

  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: string;

  @IsOptional() @IsUUID()
  assignee_id?: string;

  @IsOptional() @IsDateString()
  due_date?: string;

  @IsOptional() @IsString()
  category?: string;

  /** 제목 검색 (자동완성 용도) */
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @Type(() => Number) @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @Min(1) @Max(100)
  limit?: number = 20;
}
