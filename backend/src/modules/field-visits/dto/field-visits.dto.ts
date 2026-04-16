import {
  IsString, IsOptional, IsNumber, IsBoolean,
  IsEnum, IsDateString, IsUUID, Min, Max,
  MaxLength, IsArray, ValidateNested, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FieldLocCategory } from '../../../database/entities/field-location.entity';
import { VehicleEventType } from '../../../database/entities/field-visit.entity';

/* ── 방문지 (FieldLocation) ─────────────────────────────────── */

export class CreateFieldLocationDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsNumber()
  @Min(-90) @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180) @Max(180)
  lng: number;

  /** 체크인 인정 반경 (m, 기본 300m) */
  @IsOptional()
  @IsNumber()
  @Min(50) @Max(5000)
  radiusM?: number;

  @IsOptional()
  @IsEnum(FieldLocCategory)
  category?: FieldLocCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateFieldLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90) @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180) @Max(180)
  lng?: number;

  @IsOptional()
  @IsNumber()
  @Min(50) @Max(5000)
  radiusM?: number;

  @IsOptional()
  @IsEnum(FieldLocCategory)
  category?: FieldLocCategory;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class FieldLocationQueryDto {
  @IsOptional()
  @IsEnum(FieldLocCategory)
  category?: FieldLocCategory;

  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;
}

/* ── 현장 방문 체크인/아웃 ────────────────────────────────────── */

export class FieldCheckInDto {
  /** 체크인 GPS 위도 */
  @IsNumber()
  @Min(-90) @Max(90)
  lat: number;

  /** 체크인 GPS 경도 */
  @IsNumber()
  @Min(-180) @Max(180)
  lng: number;

  /** 매칭할 방문지 ID (없으면 미등록 spot 체크인) */
  @IsOptional()
  @IsUUID()
  fieldLocationId?: string;

  /** 방문 목적 */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  purpose?: string;

  /** 방문일 (KST YYYY-MM-DD, 생략 시 서버가 현재 KST 날짜 사용) */
  @IsOptional()
  @IsDateString()
  visitDate?: string;
}

export class FieldCheckOutDto {
  @IsNumber()
  @Min(-90) @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180) @Max(180)
  lng: number;
}

/* ── 차량 이벤트 ───────────────────────────────────────────────── */

export class AddVehicleEventDto {
  @IsEnum(VehicleEventType)
  type: VehicleEventType;

  @IsOptional()
  @IsNumber()
  @Min(-90) @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180) @Max(180)
  lng?: number;

  /** OBD 연동 시 속도 (km/h) */
  @IsOptional()
  @IsNumber()
  @Min(0) @Max(300)
  obdSpeed?: number;
}

/* ── 조회 ─────────────────────────────────────────────────────── */

export class FieldVisitQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;        // 특정 날짜 필터

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/* ── 워크스페이스 설정 ──────────────────────────────────────────── */

export class UpdateFieldVisitSettingsDto {
  @IsOptional()
  @IsBoolean()
  fieldVisitAutoTask?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fieldVisitTaskTitle?: string | null;
}
