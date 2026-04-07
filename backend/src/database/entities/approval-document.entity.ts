import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum ApprovalDocType {
  GENERAL          = 'general',           // 일반
  VACATION         = 'vacation',          // 휴가신청
  EXPENSE          = 'expense',           // 지출결의
  OVERTIME         = 'overtime',          // 연장근무
  BUSINESS_TRIP    = 'business_trip',     // 출장
  HR               = 'hr',               // 인사발령
  PERMISSION_CHANGE   = 'permission_change',    // 접근권한 변경 기안 (승인 시 자동 적용)
  WORK_SCHEDULE_CHANGE = 'work_schedule_change', // 근무 스케줄 변경 기안 (승인 시 자동 적용)
}

export enum ApprovalDocStatus {
  DRAFT       = 'draft',        // 기안 중
  IN_PROGRESS = 'in_progress',  // 결재 진행
  APPROVED    = 'approved',     // 최종 승인
  REJECTED    = 'rejected',     // 반려
  CANCELLED   = 'cancelled',    // 취소
}

@Entity('approval_documents')
@Index(['companyId', 'authorId'])
@Index(['companyId', 'status'])
export class ApprovalDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'author_id' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ type: 'varchar', length: 30 })
  type: ApprovalDocType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 20, default: ApprovalDocStatus.DRAFT })
  status: ApprovalDocStatus;

  // 현재 결재 단계 (1부터 시작, 결재 완료 시 total steps)
  @Column({ name: 'current_step', type: 'int', default: 0 })
  currentStep: number;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  // 연관 업무 ID 목록 (태그)
  @Column({ name: 'related_task_ids', type: 'jsonb', nullable: true, default: () => "'[]'" })
  relatedTaskIds: string[];

  // 작성에 사용한 템플릿 ID (추적용, nullable)
  @Column({ name: 'template_id', type: 'varchar', length: 60, nullable: true })
  templateId: string | null;

  @OneToMany('ApprovalStep', 'document', { cascade: true })
  steps: any[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
