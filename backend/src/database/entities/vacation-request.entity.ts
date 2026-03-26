import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum VacationType {
  ANNUAL       = 'annual',        // 연차
  HALF_DAY_AM  = 'half_day_am',   // 오전 반차
  HALF_DAY_PM  = 'half_day_pm',   // 오후 반차
  SICK         = 'sick',          // 병가
  EVENT        = 'event',         // 경조사
  MATERNITY    = 'maternity',     // 출산휴가
  PATERNITY    = 'paternity',     // 육아휴직
  OTHER        = 'other',         // 기타
}

export enum VacationStatus {
  PENDING   = 'pending',    // 대기
  APPROVED  = 'approved',   // 승인
  REJECTED  = 'rejected',   // 반려
  CANCELLED = 'cancelled',  // 취소
}

@Entity('vacation_requests')
@Index(['companyId', 'userId'])
@Index(['companyId', 'status'])
@Index(['companyId', 'startDate', 'endDate'])
export class VacationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 30 })
  type: VacationType;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string; // 'YYYY-MM-DD'

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'numeric', precision: 5, scale: 1 })
  days: number; // 반차=0.5, 연차=1.0 이상

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 20, default: VacationStatus.PENDING })
  status: VacationStatus;

  // ─── 승인/반려 ─────────────────────────────────────
  @Column({ name: 'approver_id', nullable: true })
  approverId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approver_id' })
  approver: User | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;

  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
