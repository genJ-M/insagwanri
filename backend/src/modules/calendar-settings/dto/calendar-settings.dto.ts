import {
  IsString, IsOptional, IsBoolean, IsIn, IsArray,
  IsNumber, IsEmail, Min, Max, MinLength, MaxLength,
  ValidateNested, IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRecurringEventDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsIn(['payroll', 'tax', 'report', 'meeting', 'deadline', 'custom'])
  category?: string = 'custom';

  @IsOptional() @IsString() @MaxLength(100)
  department?: string; // null = 전체

  @IsOptional() @IsString()
  color?: string;

  @IsIn(['monthly', 'weekly', 'yearly', 'quarterly'])
  recurrence_type: string;

  @IsOptional() @IsNumber() @Min(1) @Max(31)
  day_of_month?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(6)
  day_of_week?: number;

  @IsOptional() @IsArray() @IsNumber({}, { each: true })
  month_of_year?: number[]; // [1,4,7,10] for quarterly

  @IsOptional() @IsArray() @IsNumber({}, { each: true })
  notify_before_days?: number[] = [];

  @IsOptional() @IsArray() @IsEmail({}, { each: true })
  notify_emails?: string[] = [];

  @IsOptional() @IsBoolean()
  notify_by_push?: boolean = true;

  @IsOptional() @IsBoolean()
  is_active?: boolean = true;
}

export class UpdateRecurringEventDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsIn(['monthly', 'weekly', 'yearly', 'quarterly']) recurrence_type?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(31) day_of_month?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(6) day_of_week?: number;
  @IsOptional() @IsArray() @IsNumber({}, { each: true }) month_of_year?: number[];
  @IsOptional() @IsArray() @IsNumber({}, { each: true }) notify_before_days?: number[];
  @IsOptional() @IsArray() @IsEmail({}, { each: true }) notify_emails?: string[];
  @IsOptional() @IsBoolean() notify_by_push?: boolean;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class PageVisibilityItemDto {
  @IsString() @MaxLength(100) page_key: string;
  @IsBoolean() is_visible: boolean;
}

export class SetDepartmentVisibilityDto {
  @IsString() @MaxLength(100)
  department: string; // '__default__' for company-wide

  @IsArray() @ValidateNested({ each: true })
  @Type(() => PageVisibilityItemDto)
  pages: PageVisibilityItemDto[];
}

export class ApplyTemplateDto {
  @IsString() @MaxLength(100)
  department: string;

  @IsIn(['finance', 'hr', 'operations', 'sales', 'it', 'management', 'general'])
  template: string;

  @IsOptional() @IsBoolean()
  create_recurring_events?: boolean = true;
}
