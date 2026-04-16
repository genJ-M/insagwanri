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

  /** 적용된 휴게시간(분) — 법정 최소 또는 개인 설정 */
  @Column({ name: 'break_minutes', type: 'smallint', nullable: true })
  breakMinutes: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** 출근에 사용된 연동 방식 (manual | gps | wifi | qr | face) */
  @Column({ name: 'clock_in_method', type: 'varchar', length: 20, nullable: true })
  clockInMethod: string | null;

  /** 퇴근에 사용된 연동 방식 */
  @Column({ name: 'clock_out_method', type: 'varchar', length: 20, nullable: true })
  clockOutMethod: string | null;

  /**
   * 근무 위치 (office | remote | field)
   * WiFi SSID가 사내 SSID 목록에 포함되면 'office', 미포함이면 'remote'
   */
  @Column({ name: 'work_location', type: 'varchar', length: 20, default: 'office' })
  workLocation: string;

  /**
   * 유연근무 유형 (공공기관 특화)
   * regular: 일반 / staggered: 시차출퇴근 / discretionary: 재량근무 / intensive: 집중근무
   */
  @Column({ name: 'flex_type', type: 'varchar', length: 30, default: 'regular' })
  flexType: string;

  /**
   * 야근 면책 적용 여부
   * 전날 퇴근 시간이 회사 설정 threshold(기본 22시) 이후면 다음날 지각 면책
   */
  @Column({ name: 'late_exempted', default: false })
  lateExempted: boolean;

  /**
   * 연속 근무 12h 초과 플래그 (현장직 특화)
   * 퇴근 시 totalWorkMinutes >= threshold 이면 true
   */
  @Column({ name: 'is_long_work', default: false })
  isLongWork: boolean;

  /**
   * 야간 근무 시간(분) — 22시~06시 구간 (회사 설정으로 조정 가능)
   * 야간수당 계산의 기준이 됨
   */
  @Column({ name: 'night_work_minutes', type: 'smallint', default: 0 })
  nightWorkMinutes: number;

  /**
   * 반올림 정책 적용 후 실 임금 계산 기준 근무 분수 (파트타임 특화)
   * totalWorkMinutes에서 지각/조퇴 차감 후 반올림 정책 적용 결과
   */
  @Column({ name: 'rounded_work_minutes', type: 'smallint', nullable: true })
  roundedWorkMinutes: number | null;

  /**
   * 당일 임금 (파트타임 특화, 원 단위)
   * roundedWorkMinutes / 60 × hourlyRate
   */
  @Column({ name: 'wage_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  wageAmount: number | null;

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
