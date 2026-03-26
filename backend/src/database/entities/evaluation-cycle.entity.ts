import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum EvalCycleStatus {
  DRAFT  = 'draft',   // 준비중
  ACTIVE = 'active',  // 진행중
  CLOSED = 'closed',  // 마감
}

/** 결과 열람 권한 */
export enum ResultVisibility {
  EVALUATEE_ONLY  = 'evaluatee_only', // 피평가자 + owner
  DEPT_MANAGER    = 'dept_manager',   // 피평가자 + 소속관리자 + owner
  ALL_MANAGERS    = 'all_managers',   // 모든 관리자 + owner
}

/** 원본 답변 열람 권한 */
export enum AnswerVisibility {
  NONE        = 'none',           // 집계 점수만 (피평가자도 raw 못 봄)
  EVALUATEE   = 'evaluatee',      // 피평가자도 raw 열람 가능
  MANAGERS_ONLY = 'managers_only',// 관리자만 raw 열람 (기본)
}

@Entity('evaluation_cycles')
@Index(['companyId', 'status'])
export class EvaluationCycle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column({ type: 'varchar', length: 100 })
  name: string; // 예: "2026년 상반기 정기평가"

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: EvalCycleStatus.DRAFT })
  status: EvalCycleStatus;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  // ─── 프라이버시 설정 ─────────────────────────────
  /** 결과를 피평가자에게 공개했는지 */
  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  /** 평가자 신원 익명 처리 여부 (owner만 식별 가능) */
  @Column({ name: 'is_anonymous', default: false })
  isAnonymous: boolean;

  /** 결과 열람 권한 */
  @Column({
    name: 'result_visibility',
    type: 'varchar',
    length: 30,
    default: ResultVisibility.DEPT_MANAGER,
  })
  resultVisibility: ResultVisibility;

  /** 원본 답변 열람 권한 */
  @Column({
    name: 'answer_visibility',
    type: 'varchar',
    length: 30,
    default: AnswerVisibility.MANAGERS_ONLY,
  })
  answerVisibility: AnswerVisibility;

  /** 자기평가 포함 여부 */
  @Column({ name: 'include_self', default: true })
  includeSelf: boolean;

  /** 동료평가 포함 여부 */
  @Column({ name: 'include_peer', default: false })
  includePeer: boolean;

  /** 상급자 평가 포함 여부 */
  @Column({ name: 'include_manager', default: true })
  includeManager: boolean;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
