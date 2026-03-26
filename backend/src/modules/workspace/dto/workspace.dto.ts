import {
  IsString, IsOptional, IsBoolean, IsNumber,
  IsArray, Min, Max, MaxLength,
} from 'class-validator';

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class UpdateWorkSettingsDto {
  @IsOptional()
  @IsString()
  workStartTime?: string; // "09:00"

  @IsOptional()
  @IsString()
  workEndTime?: string; // "18:00"

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(120)
  lateThresholdMin?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  workDays?: number[]; // [1,2,3,4,5]
}

export class CoverMobileCropDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;
}

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;

  @IsOptional()
  @IsString()
  coverImageMobileUrl?: string | null;

  @IsOptional()
  coverMobileCrop?: CoverMobileCropDto | null;

  @IsOptional()
  @IsString()
  brandingTextColor?: string;
}

export class UpdateGpsSettingsDto {
  @IsBoolean()
  gpsEnabled: boolean;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  gpsLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  gpsLng?: number;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(1000)
  gpsRadiusM?: number;

  @IsOptional()
  @IsBoolean()
  gpsStrictMode?: boolean;
}
