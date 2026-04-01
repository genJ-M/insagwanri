import {
  IsString, IsEnum, IsOptional, IsDateString,
  IsBoolean, IsArray, IsUUID, IsInt, Min, Max,
  ValidateNested, IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EvalCycleStatus, ResultVisibility, AnswerVisibility,
} from '../../../database/entities/evaluation-cycle.entity';
import { EvalCategory } from '../../../database/entities/evaluation-answer.entity';

export class CreateCycleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;

  @IsOptional()
  @IsEnum(ResultVisibility)
  result_visibility?: ResultVisibility;

  @IsOptional()
  @IsEnum(AnswerVisibility)
  answer_visibility?: AnswerVisibility;

  @IsOptional()
  @IsBoolean()
  include_self?: boolean;

  @IsOptional()
  @IsBoolean()
  include_peer?: boolean;

  @IsOptional()
  @IsBoolean()
  include_manager?: boolean;

  /** 평가 대상자 목록 */
  @IsArray()
  @IsUUID('all', { each: true })
  participant_ids: string[];
}

export class UpdateCycleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsEnum(ResultVisibility)
  result_visibility?: ResultVisibility;

  @IsOptional()
  @IsEnum(AnswerVisibility)
  answer_visibility?: AnswerVisibility;
}

export class AddParticipantsDto {
  @IsArray()
  @IsUUID('all', { each: true })
  user_ids: string[];
}

export class AnswerItemDto {
  @IsEnum(EvalCategory)
  category: EvalCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  score?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SaveAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers: AnswerItemDto[];
}

export class EvaluationQueryDto {
  @IsOptional()
  @IsString()
  box?: 'mine' | 'received'; // mine=내가 평가, received=내 평가 받기

  @IsOptional()
  @IsUUID()
  cycle_id?: string;
}
