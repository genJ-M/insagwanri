import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { CalendarEvent } from './calendar-event.entity';
import { User } from './user.entity';

export enum ShareRequestStatus {
  PENDING  = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * 팀 이벤트를 다른 부서와 공유하려 할 때 팀장 승인이 필요한 경우 사용.
 * 팀원이 요청 → 팀장(해당 부서 manager)이 승인/거절 → 승인 시 CalendarEventShare 자동 생성.
 */
@Entity('calendar_share_requests')
@Index(['eventId', 'status'])
@Index(['companyId', 'decidedBy'])
export class CalendarShareRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id' })
  eventId: string;

  @ManyToOne(() => CalendarEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: CalendarEvent;

  @Column({ name: 'company_id' })
  companyId: string;

  /** 공유 요청한 팀원 */
  @Column({ name: 'requested_by' })
  requestedBy: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requested_by' })
  requester: User;

  /** 공유받을 대상 부서 */
  @Column({ name: 'target_department', type: 'varchar', length: 100 })
  targetDepartment: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ShareRequestStatus.PENDING,
  })
  status: ShareRequestStatus;

  /** 승인/거절한 팀장 */
  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'decided_by' })
  decider: User | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  /** 팀원이 남기는 공유 이유 */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
