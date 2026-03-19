import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index, Check,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum ScheduleType {
  GENERAL       = 'general',
  MEETING       = 'meeting',
  VACATION      = 'vacation',
  BUSINESS_TRIP = 'business_trip',
  TRAINING      = 'training',
  HOLIDAY       = 'holiday',
}

@Entity('schedules')
@Check('"end_at" > "start_at"')
@Index(['companyId', 'startAt', 'endAt'])
@Index(['targetUserId', 'startAt'])
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @Column({ name: 'target_user_id', type: 'uuid', nullable: true })
  targetUserId: string | null;             // NULL = 전사 공개

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;

  @Column({ name: 'is_all_day', default: false })
  isAllDay: boolean;

  @Column({ type: 'varchar', length: 20, default: ScheduleType.GENERAL })
  type: ScheduleType;

  @Column({ name: 'recurrence_rule', type: 'text', nullable: true })
  recurrenceRule: string | null;           // iCal RRULE

  @Column({ name: 'recurrence_end_at', type: 'date', nullable: true })
  recurrenceEndAt: string | null;

  @Column({ name: 'notify_before_min', type: 'smallint', nullable: true })
  notifyBeforeMin: number | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;                    // HEX

  @ManyToOne(() => Company) @JoinColumn({ name: 'company_id' }) company: Company;
  @ManyToOne(() => User)    @JoinColumn({ name: 'creator_id' }) creator: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'target_user_id' })
  targetUser: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date;
}
