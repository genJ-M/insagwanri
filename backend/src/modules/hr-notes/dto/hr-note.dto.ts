import { IsString, IsOptional, IsIn, IsBoolean, IsUUID, MaxLength } from 'class-validator';

const CATEGORIES = ['consult', 'warning', 'praise', 'assignment', 'other'];

export class CreateHrNoteDto {
  @IsUUID()
  target_user_id: string;

  @IsIn(CATEGORIES)
  category: string;

  @IsString() @MaxLength(255)
  title: string;

  @IsString() @MaxLength(5000)
  content: string;

  @IsOptional() @IsBoolean()
  is_private?: boolean;
}

export class UpdateHrNoteDto {
  @IsOptional() @IsIn(CATEGORIES)
  category?: string;

  @IsOptional() @IsString() @MaxLength(255)
  title?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  content?: string;

  @IsOptional() @IsBoolean()
  is_private?: boolean;
}

export class HrNoteQueryDto {
  @IsOptional() @IsUUID()
  target_user_id?: string;

  @IsOptional() @IsIn(CATEGORIES)
  category?: string;

  @IsOptional() @IsString()
  q?: string;
}
