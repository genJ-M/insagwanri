import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum ShiftScheduleStatus {
  DRAFT     = 'draft',
  PUBLISHED = 'published',
}

export enum ShiftType {
  OFFICE     = 'office',      // 사무실 근무
  FIELD_WORK = 'field_work',  // 외근
  REMOTE     = 'remote',      // 재택
  OVERTIME   = 'overtime',    // 초과근무
  OFF        = 'off',         // 휴무
}

@Entity('shift_schedules')
@Index(['companyId', 'weekStart'])
@Index(['companyId', 'department'])
export class ShiftSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @Column({ length: 200 })
  title: string;

  /** null = 전 부서 대상 */
  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string | null;

  /** 해당 주의 월요일 날짜 (YYYY-MM-DD) */
  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  @Column({ type: 'varchar', length: 20, default: ShiftScheduleStatus.DRAFT })
  status: ShiftScheduleStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @ManyToOne(() => Company) @JoinColumn({ name: 'company_id' }) company: Company;
  @ManyToOne(() => User)    @JoinColumn({ name: 'creator_id' }) creator: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
}

@Entity('shift_assignments')
@Index(['shiftScheduleId', 'userId'])
@Index(['companyId', 'date'])
export class ShiftAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shift_schedule_id' })
  shiftScheduleId: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'user_id' })
  userId: string;

  /** YYYY-MM-DD */
  @Column({ type: 'date' })
  date: string;

  /** HH:mm (off 타입이면 null) */
  @Column({ name: 'start_time', type: 'varchar', length: 5, nullable: true })
  startTime: string | null;

  @Column({ name: 'end_time', type: 'varchar', length: 5, nullable: true })
  endTime: string | null;

  @Column({ name: 'shift_type', type: 'varchar', length: 20, default: ShiftType.OFFICE })
  shiftType: ShiftType;

  /** 외근 장소 */
  @Column({ type: 'varchar', length: 300, nullable: true })
  location: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** 직원이 일정 확인 여부 */
  @Column({ name: 'is_confirmed', default: false })
  isConfirmed: boolean;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @ManyToOne(() => ShiftSchedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shift_schedule_id' })
  shiftSchedule: ShiftSchedule;

  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
