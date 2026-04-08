import {
  IsString, IsOptional, IsUUID, IsBoolean, IsIn,
  IsArray, MinLength, MaxLength, IsNumber, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleEventDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title: string;

  @IsString()
  start_at: string; // ISO datetime

  @IsString()
  end_at: string;

  @IsOptional() @IsBoolean()
  is_all_day?: boolean = false;

  @IsOptional() @IsString() @MaxLength(200)
  location?: string;
}

export class CreateChannelDto {
  @IsString() @MinLength(1) @MaxLength(100)
  name: string;

  @IsIn(['announcement', 'general', 'direct', 'group'])
  type: string;

  @IsOptional() @IsBoolean()
  is_private?: boolean = false;

  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  member_ids?: string[] = [];
}

export class SendMessageDto {
  @IsString() @MinLength(1)
  content: string;

  @IsOptional() @IsIn(['text', 'image', 'file'])
  content_type?: string = 'text';

  @IsOptional() @IsUUID()
  parent_message_id?: string;

  @IsOptional() @IsString()
  attachment_url?: string;

  @IsOptional() @IsString() @MaxLength(255)
  attachment_name?: string;

  @IsOptional() @IsNumber() @Min(0)
  attachment_size?: number;

  // ─── 공지 대상 설정 ────────────────────────────────────────────────────
  @IsOptional() @IsIn(['all', 'department', 'custom'])
  target_type?: string = 'all';

  @IsOptional() @IsString() @MaxLength(100)
  target_department?: string;

  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  target_user_ids?: string[];

  @IsOptional() @IsBoolean()
  is_private_recipients?: boolean = false;

  // ─── 캘린더 연동 ───────────────────────────────────────────────────────
  @IsOptional() @ValidateNested()
  @Type(() => ScheduleEventDto)
  schedule_event?: ScheduleEventDto;
}

export class EditMessageDto {
  @IsString() @MinLength(1)
  content: string;
}

export class ReadMessageDto {
  @IsUUID()
  last_read_message_id: string;
}

export class MessageQueryDto {
  @IsOptional() @IsUUID()
  before?: string;                  // cursor — 이 id 이전 메시지

  @IsOptional() @IsUUID()
  after?: string;                   // cursor — 이 id 이후 메시지

  @IsOptional() @Type(() => Number) @Min(1)
  limit?: number = 50;
}
