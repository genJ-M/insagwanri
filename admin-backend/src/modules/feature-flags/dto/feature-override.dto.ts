import { IsEnum, IsOptional, IsBoolean, IsInt, IsString, IsObject, IsDateString } from 'class-validator';
import { OverrideType } from '../../../database/entities/company-feature.entity';

export class SetFeatureOverrideDto {
  @IsEnum(OverrideType)
  overrideType: OverrideType;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsInt()
  limitValue?: number;

  @IsOptional()
  @IsObject()
  configValue?: Record<string, any>;

  @IsString()
  reason: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
