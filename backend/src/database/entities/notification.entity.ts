import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export type NotificationType =
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_completed'
  | 'task_urgent'
  | 'report_feedback'
  | 'message_mention'
  | 'message_dm'
  | 'channel_announcement'
  | 'schedule_reminder'
  | 'schedule_new'
  | 'attendance_late'
  | 'attendance_absent'
  | 'tax_deadline'
  | 'labor_event';

export type NotificationRefType =
  | 'task'
  | 'task_report'
  | 'message'
  | 'schedule'
  | 'payment';

@Entity('notifications')
@Index(['userId', 'isRead'])
@Index(['userId', 'createdAt'])
export class Notification {
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

  @Column({ length: 50 })
  type: NotificationType;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'ref_type', type: 'varchar', length: 20, nullable: true })
  refType: NotificationRefType | null;

  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId: string | null;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
