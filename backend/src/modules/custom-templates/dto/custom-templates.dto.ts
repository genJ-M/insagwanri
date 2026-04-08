import { IsString, IsEnum, IsOptional, IsBoolean, IsObject, MaxLength } from 'class-validator';
import { CustomTemplateType } from '../../../database/entities/custom-template.entity';

export class CreateCustomTemplateDto {
  @IsEnum(CustomTemplateType)
  type: CustomTemplateType;

  @IsString() @MaxLength(200)
  name: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString() @MaxLength(100)
  category?: string;

  @IsOptional() @IsObject()
  fields?: Record<string, unknown>;

  @IsOptional() @IsBoolean()
  is_company_wide?: boolean;
}

export class UpdateCustomTemplateDto {
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString() @MaxLength(100)
  category?: string;

  @IsOptional() @IsObject()
  fields?: Record<string, unknown>;

  @IsOptional() @IsBoolean()
  is_company_wide?: boolean;
}

export class CustomTemplateQueryDto {
  @IsOptional() @IsEnum(CustomTemplateType)
  type?: CustomTemplateType;

  @IsOptional() @IsString()
  category?: string;

  /** my | company | all (default: all accessible) */
  @IsOptional() @IsString()
  scope?: string;
}
