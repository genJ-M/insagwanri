import {
  IsString, IsEnum, IsOptional, IsDateString, IsUUID,
  IsNumber, IsInt, IsObject, Min, Max,
} from 'class-validator';
import { ContractType, JobCategory } from '../../../database/entities/contract.entity';

export class CreateContractDto {
  @IsUUID()
  user_id: string;

  @IsEnum(ContractType)
  type: ContractType;

  @IsString()
  title: string;

  @IsDateString()
  start_date: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  file_url?: string;

  @IsOptional()
  @IsString()
  file_name?: string;

  @IsOptional()
  @IsString()
  note?: string;

  // ─── 신규 필드 ────────────────────────────────
  @IsOptional()
  @IsEnum(JobCategory)
  job_category?: JobCategory;

  @IsOptional()
  @IsString()
  job_description?: string;

  @IsOptional()
  @IsString()
  work_location?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthly_salary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annual_salary?: number;

  @IsOptional()
  @IsObject()
  salary_detail?: Record<string, number>;

  @IsOptional()
  @IsInt()
  @Min(1) @Max(52)
  weekly_hours?: number;

  @IsOptional()
  @IsString()
  template_id?: string;
}

export class UpdateContractDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  file_url?: string;

  @IsOptional()
  @IsString()
  file_name?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsEnum(JobCategory)
  job_category?: JobCategory;

  @IsOptional()
  @IsString()
  job_description?: string;

  @IsOptional()
  @IsString()
  work_location?: string;

  @IsOptional()
  @IsNumber()
  monthly_salary?: number;

  @IsOptional()
  @IsNumber()
  annual_salary?: number;

  @IsOptional()
  @IsObject()
  salary_detail?: Record<string, number>;

  @IsOptional()
  @IsInt()
  weekly_hours?: number;
}

export class TerminateContractDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ContractQueryDto {
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  job_category?: string;
}

export class OcrImageDto {
  /** base64 인코딩된 이미지 */
  image_base64: string;

  /** MIME 타입 (image/jpeg, image/png, image/webp) */
  mime_type: string;

  /** 저장할 계약 ID (선택) */
  @IsOptional()
  @IsUUID()
  contract_id?: string;
}
