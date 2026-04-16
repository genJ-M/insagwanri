import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum CareSessionType {
  ELDERLY_CARE    = 'elderly_care',    // 노인 요양 돌봄
  DISABILITY_CARE = 'disability_care', // 장애인 활동 지원
  CHILDCARE       = 'childcare',       // 보육 (어린이집/가정)
  NURSING         = 'nursing',         // 간호 (병동·방문 간호)
  THERAPY         = 'therapy',         // 재활·치료
  HOME_CARE       = 'home_care',       // 방문 요양
  OTHER           = 'other',
}

/**
 * 돌봄/간호 세션 기록
 * - 수급자별 담당 시간 추적 → 돌봄 바우처 청구 근거
 * - 의료인 피로 누적 → company 임계값 초과 시 자동 경고
 */
@Entity('care_sessions')
@Index(['companyId', 'userId', 'sessionDate'])
@Index(['companyId', 'recipientId'])
export class CareSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  /** 담당 의료·돌봄 직원 */
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** 서비스 날짜 (KST YYYY-MM-DD) */
  @Column({ name: 'session_date', type: 'date' })
  sessionDate: string;

  /** 돌봄 유형 */
  @Column({ type: 'varchar', length: 30, default: CareSessionType.ELDERLY_CARE })
  type: CareSessionType;

  /** 수급자/환자 식별 ID (내부 관리용) */
  @Column({ name: 'recipient_id', type: 'varchar', length: 100, nullable: true })
  recipientId: string | null;

  /** 수급자/환자 이름 (표시용, 개인정보 최소화) */
  @Column({ name: 'recipient_name', type: 'varchar', length: 50 })
  recipientName: string;

  /** 바우처 코드 (돌봄 서비스 바우처 연동 시) */
  @Column({ name: 'voucher_code', type: 'varchar', length: 100, nullable: true })
  voucherCode: string | null;

  /** 세션 시작 시각 (UTC) */
  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  /** 세션 종료 시각 (UTC, null = 진행 중) */
  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  /** 세션 시간 (분, 종료 시 자동 계산) */
  @Column({ name: 'duration_min', type: 'smallint', nullable: true })
  durationMin: number | null;

  /** 야간 시간 포함 여부 (22:00~06:00) */
  @Column({ name: 'has_night_hours', default: false })
  hasNightHours: boolean;

  /** 휴일 세션 여부 (법정공휴일·일요일) */
  @Column({ name: 'is_holiday', default: false })
  isHoliday: boolean;

  /** 가산수당 적용 배율 (야간+휴일 중복 시 최대 배율 적용) */
  @Column({ name: 'pay_rate', type: 'decimal', precision: 4, scale: 2, default: 1.00 })
  payRate: number;

  /** 특이사항·인수인계 메모 */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** 연결된 출근 기록 ID */
  @Column({ name: 'attendance_record_id', type: 'uuid', nullable: true })
  attendanceRecordId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
