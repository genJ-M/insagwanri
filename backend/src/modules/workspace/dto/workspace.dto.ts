import {
  IsString, IsOptional, IsBoolean, IsNumber,
  IsArray, Min, Max, MaxLength, IsEnum, IsIn, ValidateNested, IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CompanyType } from '../../../database/entities/company.entity';
import { ATTENDANCE_METHODS, AttendanceMethod } from '../../attendance/dto/attendance.dto';

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(CompanyType)
  companyType?: CompanyType;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  businessNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  corporateNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  representativeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessItem?: string;

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

export class AttendanceMethodsWifiDto {
  @IsArray()
  @IsString({ each: true })
  ssids: string[];
}

export class AttendanceMethodsQrDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  windowMinutes?: number;
}

export class UpdateAttendanceMethodsDto {
  /** 활성화할 출퇴근 방식 목록 (순서 = 우선순위) */
  @IsArray()
  @IsIn(ATTENDANCE_METHODS, { each: true })
  enabled: AttendanceMethod[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AttendanceMethodsWifiDto)
  wifi?: AttendanceMethodsWifiDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttendanceMethodsQrDto)
  qr?: AttendanceMethodsQrDto;
}
