import {
  IsString, IsEnum, IsOptional, IsArray,
  IsUUID, IsInt, Min, ArrayMinSize, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalDocType } from '../../../database/entities/approval-document.entity';

export class ApproverStepDto {
  @IsUUID()
  approver_id: string;

  @IsInt()
  @Min(1)
  step: number;
}

export class CreateApprovalDto {
  @IsEnum(ApprovalDocType)
  type: ApprovalDocType;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApproverStepDto)
  approvers: ApproverStepDto[];

  @IsOptional()
  @IsArray()
  related_task_ids?: string[];

  @IsOptional()
  @IsString()
  template_id?: string;
}

export class UpdateApprovalDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApproverStepDto)
  approvers?: ApproverStepDto[];

  @IsOptional()
  @IsArray()
  related_task_ids?: string[];
}

export class ActApprovalDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

export class ApprovalQueryDto {
  @IsOptional()
  @IsString()
  box?: 'sent' | 'received' | 'all'; // 기안함 / 수신함 / 전체

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;
}
