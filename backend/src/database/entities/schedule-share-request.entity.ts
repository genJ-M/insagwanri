import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Schedule } from './schedule.entity';
import { User } from './user.entity';

export enum ScheduleShareRequestStatus {
  PENDING  = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * 팀 일정을 다른 부서와 공유하려 할 때 팀장 승인이 필요한 경우 사용.
 * 팀원이 요청 → 팀장(해당 부서 manager)이 승인/거절 → 승인 시 ScheduleShare 자동 생성.
 */
@Entity('schedule_share_requests')
@Index(['scheduleId', 'status'])
@Index(['companyId', 'decidedBy'])
export class ScheduleShareRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'schedule_id' })
  scheduleId: string;

  @ManyToOne(() => Schedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

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
    default: ScheduleShareRequestStatus.PENDING,
  })
  status: ScheduleShareRequestStatus;

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
