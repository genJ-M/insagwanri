import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum AiFeature {
  DRAFT              = 'draft',              // 업무 문장 작성
  SUMMARIZE          = 'summarize',          // 업무 보고 요약
  ANNOUNCEMENT       = 'announcement',       // 공지 메시지 생성
  SCHEDULE_SUMMARY   = 'schedule_summary',   // 일정 정리
  REFINE             = 'refine',             // 문장 다듬기 (범용)
  CLASSIFY_TASK          = 'classify_task',          // 업무 카테고리 분류
  TEAM_SCOPE_RECOMMEND   = 'team_scope_recommend',   // 팀 구성원 추천
}

export enum AiRequestStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED  = 'failed',
}

export enum AiRefType {
  TASK         = 'task',
  TASK_REPORT  = 'task_report',
  SCHEDULE     = 'schedule',
  MESSAGE      = 'message',
}

@Entity('ai_requests')
@Index(['companyId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['companyId', 'feature', 'createdAt'])
export class AiRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  feature: AiFeature;

  @Column({ name: 'input_text', type: 'text' })
  inputText: string;

  @Column({ name: 'output_text', type: 'text', nullable: true })
  outputText: string | null;

  @Column({ name: 'prompt_tokens', type: 'integer', nullable: true })
  promptTokens: number | null;

  @Column({ name: 'completion_tokens', type: 'integer', nullable: true })
  completionTokens: number | null;

  @Column({ name: 'total_tokens', type: 'integer', nullable: true })
  totalTokens: number | null;

  @Column({ name: 'ref_type', type: 'varchar', length: 20, nullable: true })
  refType: AiRefType | null;

  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId: string | null;

  @Column({ type: 'varchar', length: 20, default: AiRequestStatus.PENDING })
  status: AiRequestStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({
    name: 'estimated_cost_usd',
    type: 'decimal',
    precision: 10,
    scale: 6,
    nullable: true,
  })
  estimatedCostUsd: number | null;

  // 면책 문구 표시 여부 — 항상 true (정책 준수 기록)
  @Column({ name: 'disclaimer_shown', default: true })
  disclaimerShown: boolean;

  @Column({ name: 'model_name', type: 'varchar', length: 50, nullable: true })
  modelName: string | null;

  @ManyToOne(() => Company) @JoinColumn({ name: 'company_id' }) company: Company;
  @ManyToOne(() => User)    @JoinColumn({ name: 'user_id' })    user: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
