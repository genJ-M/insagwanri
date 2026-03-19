import {
  IsString, IsOptional, IsUUID, IsBoolean, IsIn,
  IsArray, MinLength, MaxLength, IsNumber, Min, IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

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
