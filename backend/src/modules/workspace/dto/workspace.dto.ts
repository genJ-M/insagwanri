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

export class UpdatePublicSectorSettingsDto {
  /** 유연근무제 활성화 */
  @IsOptional()
  @IsBoolean()
  flexWorkEnabled?: boolean;

  /** 연가 소진 강제화 알림 활성화 */
  @IsOptional()
  @IsBoolean()
  annualLeaveForceEnabled?: boolean;

  /** 강제화 기준 잔여일수 (기본 5일) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  annualLeaveForceThreshold?: number;
}

export class UpdateItSettingsDto {
  /** 야근 다음날 지각 면책 활성화 */
  @IsOptional()
  @IsBoolean()
  lateNightExemptionEnabled?: boolean;

  /** 야근 기준 시간 (0~23, 기본 22) */
  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(23)
  lateNightThresholdHour?: number;

  /** 면책 유예 시간(분, 기본 60) */
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(180)
  lateNightGraceMinutes?: number;

  /** 연장근무 사전 결재 승인 필수 여부 */
  @IsOptional()
  @IsBoolean()
  overtimeApprovalRequired?: boolean;
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

export class UpdatePartTimeSettingsDto {
  /** 분 단위 반올림 단위 (1=1분, 5, 10, 15, 30) */
  @IsOptional()
  @IsInt()
  @IsIn([1, 5, 10, 15, 30])
  partTimeRoundingUnit?: number;

  /** 반올림 정책: floor(절사) | round(반올림) | ceil(올림) */
  @IsOptional()
  @IsIn(['floor', 'round', 'ceil'])
  partTimeRoundingPolicy?: string;

  /** 지각/조퇴 차감 단위 (1=1분, 5, 10, 15) */
  @IsOptional()
  @IsInt()
  @IsIn([1, 5, 10, 15])
  partTimeDeductionUnit?: number;

  /** 근무 확인 SMS 자동 발송 활성화 */
  @IsOptional()
  @IsBoolean()
  workConfirmSmsEnabled?: boolean;
}

export class UpdateShiftWorkerSettingsDto {
  /** 연속 근무 경고 기준 (시간, 기본 12) */
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(24)
  shiftLongWorkThresholdHours?: number;

  /** 야간 근무 시작 시간 (0~23, 기본 22) */
  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(23)
  nightWorkStartHour?: number;

  /** 야간 근무 종료 시간 (0~23, 기본 6) */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(12)
  nightWorkEndHour?: number;

  /** 야간수당 배율 (기본 1.5) */
  @IsOptional()
  @IsNumber()
  @Min(1.0)
  @Max(3.0)
  nightPayRate?: number;
}

export class UpdateFieldVisitWorkspaceSettingsDto {
  /** 외근 체크인 시 업무 일지 자동 생성 여부 */
  @IsOptional()
  @IsBoolean()
  fieldVisitAutoTask?: boolean;

  /** 자동 생성 업무 일지 제목 템플릿 ({{location}} 치환 가능) */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fieldVisitTaskTitle?: string | null;
}
