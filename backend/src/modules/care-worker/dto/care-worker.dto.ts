import {
  IsString, IsOptional, IsEnum, IsDateString, IsUUID,
  IsNumber, IsBoolean, IsInt, Min, Max, MaxLength, IsIn,
} from 'class-validator';
import { LicenseType } from '../../../database/entities/care-license.entity';
import { CareSessionType } from '../../../database/entities/care-session.entity';

/* ── 자격증/면허 ──────────────────────────────────────────────── */

export class CreateCareLicenseDto {
  @IsEnum(LicenseType)
  type: LicenseType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string;

  /** type=other일 때 직접 입력하는 자격증명 */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  /** null = 무기한 (갱신 없는 자격증) */
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  issuer?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;
}

export class UpdateCareLicenseDto {
  @IsOptional()
  @IsEnum(LicenseType)
  type?: LicenseType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  issuer?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class LicenseQueryDto {
  /** 특정 직원 ID (미입력 시 내 자격증) */
  @IsOptional()
  @IsUUID()
  userId?: string;

  /** 만료 임박 필터 (N일 이내) */
  @IsOptional()
  @IsInt()
  @Min(1)
  expiringWithinDays?: number;
}

/* ── 돌봄 세션 ───────────────────────────────────────────────── */

export class StartCareSessionDto {
  @IsEnum(CareSessionType)
  type: CareSessionType;

  @IsString()
  @MaxLength(50)
  recipientName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  recipientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  voucherCode?: string;

  @IsOptional()
  @IsDateString()
  sessionDate?: string;

  @IsOptional()
  @IsUUID()
  attendanceRecordId?: string;
}

export class EndCareSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CareSessionQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  recipientId?: string;
}

/* ── 가산수당 조회 ───────────────────────────────────────────── */

export class HolidayPayQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

/* ── 워크스페이스 설정 ─────────────────────────────────────────── */

export class UpdateCareWorkerSettingsDto {
  /** 휴일 가산수당 배율 (기본 1.5) */
  @IsOptional()
  @IsNumber()
  @Min(1.0)
  @Max(3.0)
  careHolidayPayRate?: number;

  /** 피로도 경고 기준 주간 근무시간 (기본 52) */
  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(80)
  careFatigueThresholdHours?: number;

  /** 자격증 만료 사전 경고 일수 (기본 30) */
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(90)
  careLicenseWarnDays?: number;
}
