import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { CalendarEvent } from './calendar-event.entity';
import { User } from './user.entity';

export enum ShareRecipientType {
  USER       = 'user',
  DEPARTMENT = 'department',
}

@Entity('calendar_event_shares')
@Index(['eventId', 'revokedAt'])
@Index(['companyId', 'recipientUserId', 'revokedAt'])
@Index(['companyId', 'recipientDepartment', 'revokedAt'])
export class CalendarEventShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id' })
  eventId: string;

  @ManyToOne(() => CalendarEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: CalendarEvent;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'shared_by' })
  sharedBy: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shared_by' })
  sharedByUser: User;

  /** 'user' | 'department' */
  @Column({ name: 'recipient_type', type: 'varchar', length: 20 })
  recipientType: ShareRecipientType;

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
