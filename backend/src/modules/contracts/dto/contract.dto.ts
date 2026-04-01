import {
  IsString, IsEnum, IsOptional, IsDateString, IsUUID,
} from 'class-validator';
import { ContractType } from '../../../database/entities/contract.entity';

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
}
