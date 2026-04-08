import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum RecurrenceType {
  MONTHLY   = 'monthly',
  WEEKLY    = 'weekly',
  YEARLY    = 'yearly',
  QUARTERLY = 'quarterly',
  CUSTOM    = 'custom',
}

export enum EventCategory {
  PAYROLL  = 'payroll',   // 급여
  TAX      = 'tax',       // 세금/신고
  REPORT   = 'report',    // 보고
  MEETING  = 'meeting',   // 정기회의
  DEADLINE = 'deadline',  // 마감
  CUSTOM   = 'custom',
}

@Entity('recurring_calendar_events')
@Index(['companyId', 'isActive'])
@Index(['companyId', 'department'])
export class RecurringCalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 30, default: EventCategory.CUSTOM })
  category: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string | null; // null = 전체

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null; // HEX

  // ─── 반복 규칙 ──────────────────────────────────────────────────────────
  @Column({ name: 'recurrence_type', type: 'varchar', length: 20, default: RecurrenceType.MONTHLY })
  recurrenceType: string;

  @Column({ name: 'day_of_month', type: 'smallint', nullable: true })
  dayOfMonth: number | null; // monthly/quarterly: 1-31

  @Column({ name: 'day_of_week', type: 'smallint', nullable: true })
  dayOfWeek: number | null; // weekly: 0=일,1=월...

  @Column({ name: 'month_of_year', type: 'jsonb', nullable: true })
  monthOfYear: number[] | null; // quarterly: [1,4,7,10], yearly: [3]

  // ─── 알림 설정 ──────────────────────────────────────────────────────────
  @Column({ name: 'notify_before_days', type: 'jsonb', default: '[]' })
  notifyBeforeDays: number[]; // [1, 3, 7]

  @Column({ name: 'notify_emails', type: 'jsonb', default: '[]' })
  notifyEmails: string[]; // 이메일 수신자 목록

  @Column({ name: 'notify_by_push', default: true })
  notifyByPush: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToOne(() => Company) @JoinColumn({ name: 'company_id' }) company: Company;
  @ManyToOne(() => User)    @JoinColumn({ name: 'created_by_id' }) createdBy: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
}
