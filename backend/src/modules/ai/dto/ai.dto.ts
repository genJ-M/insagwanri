import {
  IsString, IsOptional, IsIn, IsUUID,
  MinLength, MaxLength, IsDateString, IsArray, IsInt, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────
// 1. 업무 문장 작성 (draft)
// ─────────────────────────────────────────
export class DraftDto {
  @IsString()
  @MinLength(5, { message: '업무 내용을 더 구체적으로 입력해주세요.' })
  @MaxLength(1000, { message: '입력 내용이 너무 깁니다. (최대 1000자)' })
  input_text: string;

  @IsOptional()
  @IsIn(['formal', 'friendly', 'concise'], {
    message: '문체는 formal | friendly | concise 중 하나여야 합니다.',
  })
  tone?: string = 'formal';

  @IsOptional()
  @IsIn(['task_instruction', 'task_report', 'memo', 'email'], {
    message: '문서 유형이 올바르지 않습니다.',
  })
  document_type?: string = 'task_instruction';

  @IsOptional() @IsUUID()
  ref_id?: string;

  @IsOptional()
  @IsIn(['task', 'task_report', 'schedule', 'message'])
  ref_type?: string;
}

// ─────────────────────────────────────────
// 2. 업무 보고 요약 (summarize)
// ─────────────────────────────────────────
export class SummarizeDto {
  @IsString()
  @MinLength(10, { message: '요약할 내용을 더 입력해주세요.' })
  @MaxLength(3000, { message: '입력 내용이 너무 깁니다. (최대 3000자)' })
  input_text: string;

  @IsOptional()
  @IsIn(['bullet', 'paragraph'], {
    message: '요약 형식은 bullet | paragraph 중 하나여야 합니다.',
  })
  format?: string = 'bullet';

  @IsOptional() @IsUUID()
  task_id?: string;

  @IsOptional() @IsUUID()
  report_id?: string;
}

// ─────────────────────────────────────────
// 3. 공지 메시지 생성 (announcement)
// ─────────────────────────────────────────
export class AnnouncementDto {
  @IsString()
  @MinLength(5, { message: '공지 내용을 더 구체적으로 입력해주세요.' })
  @MaxLength(500, { message: '입력 내용이 너무 깁니다. (최대 500자)' })
  input_text: string;

  @IsOptional()
  @IsIn(['formal', 'friendly'], {
    message: '문체는 formal | friendly 중 하나여야 합니다.',
  })
  tone?: string = 'formal';

  @IsOptional()
  @IsIn(['meeting', 'schedule_change', 'general', 'urgent'], {
    message: '공지 유형이 올바르지 않습니다.',
  })
  announcement_type?: string = 'general';

  @IsOptional() @IsUUID()
  channel_id?: string;
}

// ─────────────────────────────────────────
// 4. 일정 정리 (schedule_summary)
// ─────────────────────────────────────────
export class ScheduleSummaryDto {
  @IsArray()
  @IsString({ each: true })
  schedules: string[];               // 일정 목록 (문자열 배열로 전달)

  @IsOptional() @IsDateString()
  target_date?: string;              // 기준 날짜 (기본: 오늘)

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  period?: string = 'daily';
}

// ─────────────────────────────────────────
// 문장 다듬기 (refine) — 범용
// ─────────────────────────────────────────
export class RefineDto {
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  input_text: string;

  @IsOptional()
  @IsIn(['formal', 'friendly', 'concise'])
  tone?: string = 'formal';
}

// ─────────────────────────────────────────
// AI 사용량 조회
// ─────────────────────────────────────────
export class AiUsageQueryDto {
  @IsOptional() @IsDateString()
  start_date?: string;

  @IsOptional() @IsDateString()
  end_date?: string;

  @IsOptional() @IsUUID()
  user_id?: string;
}

// ─────────────────────────────────────────
// AI 히스토리 조회
// ─────────────────────────────────────────
export class AiHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
