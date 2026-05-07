import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Schedule } from './schedule.entity';
import { User } from './user.entity';

export enum ScheduleShareRecipientType {
  USER       = 'user',
  DEPARTMENT = 'department',
}

@Entity('schedule_shares')
@Index(['scheduleId', 'revokedAt'])
@Index(['companyId', 'recipientUserId', 'revokedAt'])
@Index(['companyId', 'recipientDepartment', 'revokedAt'])
export class ScheduleShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'schedule_id' })
  scheduleId: string;

  @ManyToOne(() => Schedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'shared_by' })
  sharedBy: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shared_by' })
  sharedByUser: User;

  /** 'user' | 'department' */
  @Column({ name: 'recipient_type', type: 'varchar', length: 20 })
  recipientType: ScheduleShareRecipientType;

  /** user 공유 시 대상 userId */
  @Column({ name: 'recipient_user_id', type: 'uuid', nullable: true })
  recipientUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recipient_user_id' })
  recipientUser: User | null;

  /** department 공유 시 대상 부서명 */
  @Column({ name: 'recipient_department', type: 'varchar', length: 100, nullable: true })
  recipientDepartment: string | null;

  @CreateDateColumn({ name: 'shared_at', type: 'timestamptz' })
  sharedAt: Date;

  /** 공유 철회 시 set */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
