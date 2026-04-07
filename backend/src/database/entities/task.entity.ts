import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum TaskStatus {
  PENDING     = 'pending',
  IN_PROGRESS = 'in_progress',
  REVIEW      = 'review',
  DONE        = 'done',
  CANCELLED   = 'cancelled',
}

export enum TaskPriority {
  LOW    = 'low',
  NORMAL = 'normal',
  HIGH   = 'high',
  URGENT = 'urgent',
}

@Entity('tasks')
@Index(['companyId', 'status'])
@Index(['assigneeId', 'status'])
@Index(['companyId', 'dueDate'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId: string | null;

  @Column({ type: 'varchar', length: 10, default: TaskPriority.NORMAL })
  priority: TaskPriority;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 20, default: TaskStatus.PENDING })
  status: TaskStatus;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'attachment_urls', type: 'text', array: true, default: () => "'{}'" })
  attachmentUrls: string[];

  @Column({ name: 'parent_task_id', type: 'uuid', nullable: true })
  parentTaskId: string | null;

  // ── 업무지시 확장 필드 ─────────────────────────
  /** 업무 범위 (예: "영업팀 전체 / 3분기") */
  @Column({ type: 'text', nullable: true })
  scope: string | null;

  /** 기한 (날짜+시간, 1시간 단위). due_date와 병행 사용 */
  @Column({ name: 'due_datetime', type: 'timestamptz', nullable: true })
  dueDatetime: Date | null;

  /** 사용된 템플릿 ID */
  @Column({ name: 'template_id', type: 'varchar', length: 60, nullable: true })
  templateId: string | null;

  // ── 기한 조정 요청 워크플로우 ─────────────────
  /** pending | approved | rejected */
  @Column({ name: 'time_adjust_status', type: 'varchar', length: 20, nullable: true })
  timeAdjustStatus: 'pending' | 'approved' | 'rejected' | null;

  /** 담당자가 제안한 새 기한 */
  @Column({ name: 'time_adjust_proposed_datetime', type: 'timestamptz', nullable: true })
  timeAdjustProposedDatetime: Date | null;

  /** 기한 조정 요청 메시지 */
  @Column({ name: 'time_adjust_message', type: 'text', nullable: true })
  timeAdjustMessage: string | null;

  /** 기한 조정 요청 시각 */
  @Column({ name: 'time_adjust_requested_at', type: 'timestamptz', nullable: true })
  timeAdjustRequestedAt: Date | null;

  /** 기한 조정 응답 시각 */
  @Column({ name: 'time_adjust_responded_at', type: 'timestamptz', nullable: true })
  timeAdjustRespondedAt: Date | null;

  @ManyToOne(() => Company) @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => User) @JoinColumn({ name: 'creator_id' })
  creator: User;

  @ManyToOne(() => User, { nullable: true }) @JoinColumn({ name: 'assignee_id' })
  assignee: User;

  @ManyToOne(() => Task, t => t.subTasks, { nullable: true })
  @JoinColumn({ name: 'parent_task_id' })
  parentTask: Task;

  @OneToMany(() => Task, t => t.parentTask)
  subTasks: Task[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date;

  // ── 삭제 요청 워크플로우 ──────────────────────
  @Column({ name: 'deletion_requested_at', type: 'timestamptz', nullable: true })
  deletionRequestedAt: Date | null;

  @Column({ name: 'deletion_requested_by', type: 'uuid', nullable: true })
  deletionRequestedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'deletion_requested_by' })
  deletionRequestedBy: User | null;

  @Column({ name: 'deletion_requester_role', type: 'varchar', length: 20, nullable: true })
  deletionRequesterRole: string | null; // 'manager' | 'assignee'
}
