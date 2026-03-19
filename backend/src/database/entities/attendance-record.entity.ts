import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum AttendanceStatus {
  PENDING = 'pending',
  NORMAL = 'normal',
  LATE = 'late',
  EARLY_LEAVE = 'early_leave',
  ABSENT = 'absent',
  HALF_DAY = 'half_day',
  VACATION = 'vacation',
}

@Entity('attendance_records')
@Unique(['userId', 'workDate'])           // 하루 1행 보장
@Index(['companyId', 'workDate'])
@Index(['companyId', 'status', 'workDate'])
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Company) @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => User)    @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'work_date', type: 'date' })
  workDate: string;                        // 'YYYY-MM-DD'

  @Column({ name: 'clock_in_at', type: 'timestamptz', nullable: true })
  clockInAt: Date | null;

  @Column({ name: 'clock_out_at', type: 'timestamptz', nullable: true })
  clockOutAt: Date | null;

  @Column({ name: 'clock_in_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  clockInLat: number | null;

  @Column({ name: 'clock_in_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  clockInLng: number | null;

  @Column({ name: 'clock_out_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  clockOutLat: number | null;

  @Column({ name: 'clock_out_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  clockOutLng: number | null;

  @Column({ name: 'clock_in_distance_m', type: 'integer', nullable: true })
  clockInDistanceM: number | null;

  @Column({ name: 'clock_in_out_of_range', default: false })
  clockInOutOfRange: boolean;

  @Column({ name: 'gps_bypassed', default: false })
  gpsBypassed: boolean;

  @Column({ type: 'varchar', length: 20, default: AttendanceStatus.PENDING })
  status: AttendanceStatus;

  @Column({ name: 'is_late', default: false })
  isLate: boolean;

  @Column({ name: 'late_minutes', type: 'smallint', nullable: true })
  lateMinutes: number | null;

  @Column({ name: 'total_work_minutes', type: 'smallint', nullable: true })
  totalWorkMinutes: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @ManyToOne(() => User, { nullable: true }) @JoinColumn({ name: 'approved_by' })
  approver: User;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
