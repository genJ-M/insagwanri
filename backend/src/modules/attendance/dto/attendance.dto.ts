import {
  IsOptional, IsNumber, IsString, IsDateString,
  IsIn, Min, Max, IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 지원하는 출퇴근 연동 방식 */
export type AttendanceMethod = 'manual' | 'gps' | 'wifi' | 'qr' | 'face';
export const ATTENDANCE_METHODS: AttendanceMethod[] = ['manual', 'gps', 'wifi', 'qr', 'face'];

export class ClockInDto {
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsNumber() accuracyM?: number;

  /** 사용한 출퇴근 방식 (미입력 시 'manual') */
  @IsOptional()
  @IsIn(ATTENDANCE_METHODS)
  method?: AttendanceMethod;

  /** QR 방식: 스캔한 QR 토큰 문자열 */
  @IsOptional() @IsString()
  qrToken?: string;

  /** WiFi 방식: 현재 연결된 WiFi SSID */
  @IsOptional() @IsString()
  wifiSsid?: string;
}

export class ClockOutDto {
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsNumber() accuracyM?: number;

  @IsOptional()
  @IsIn(ATTENDANCE_METHODS)
  method?: AttendanceMethod;

  @IsOptional() @IsString()
  qrToken?: string;

  @IsOptional() @IsString()
  wifiSsid?: string;
}

export class UpdateAttendanceDto {
  @IsOptional() @IsDateString()
  clock_in_at?: string;

  @IsOptional() @IsDateString()
  clock_out_at?: string;

  @IsOptional()
  @IsIn(['normal', 'late', 'early_leave', 'absent', 'half_day', 'vacation'])
  status?: string;

  @IsOptional() @IsString()
  note?: string;
}

export class AttendanceQueryDto {
  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsDateString()
  start_date?: string;

  @IsOptional() @IsDateString()
  end_date?: string;

  @IsOptional() @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsIn(['pending', 'normal', 'late', 'early_leave', 'absent', 'half_day', 'vacation'])
  status?: string;

  @IsOptional() @Type(() => Number) @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @Min(1) @Max(100)
  limit?: number = 20;
}

export class AttendanceReportQueryDto {
  @IsOptional() @Type(() => Number) @Min(2020) @Max(2100)
  year?: number;

  @IsOptional() @Type(() => Number) @Min(1) @Max(12)
  month?: number;

  @IsOptional() @IsUUID()
  user_id?: string;
}
