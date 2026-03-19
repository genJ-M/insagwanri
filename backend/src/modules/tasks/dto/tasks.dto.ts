import {
  IsString, IsOptional, IsUUID, IsIn, IsDateString,
  IsArray, IsUrl, MinLength, MaxLength, IsNumber, Min, Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @IsString() @MinLength(2) @MaxLength(200)
  title: string;

  @IsOptional() @IsString()
  description?: string;

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

  @IsOptional() @IsArray() @IsUrl({}, { each: true })
  attachment_urls?: string[];
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

  @IsOptional() @Type(() => Number) @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @Min(1) @Max(100)
  limit?: number = 20;
}
