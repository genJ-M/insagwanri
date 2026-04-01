import {
  IsString, IsOptional, IsDateString,
  IsInt, IsUUID, IsArray, Min, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTrainingDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetDepartment?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string; // 'YYYY-MM-DD'

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxParticipants?: number;
}

export class UpdateTrainingDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetDepartment?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class EnrollDto {
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];
}

export class CompleteEnrollmentDto {
  @IsOptional()
  @IsString()
  note?: string;
}
