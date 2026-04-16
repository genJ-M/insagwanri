import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';

export enum CompanyPlan {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum CompanyType {
  INDIVIDUAL = 'individual', // 개인사업자
  CORPORATION = 'corporation', // 법인
  NONE = 'none', // 미등록 / 개인
}

export enum CompanyStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'business_number', type: 'varchar', length: 20, unique: true, nullable: true })
  businessNumber: string | null;

  /** 회사 유형: individual(개인사업자) | corporation(법인) | none(미등록) */
  @Column({ name: 'company_type', type: 'varchar', length: 20, default: CompanyType.NONE })
  companyType: CompanyType;

  /** 법인등록번호 (법인만) */
  @Column({ name: 'corporate_number', type: 'varchar', length: 20, nullable: true })
  corporateNumber: string | null;

  /** 대표자명 */
  @Column({ name: 'representative_name', type: 'varchar', length: 50, nullable: true })
  representativeName: string | null;

  /** 업태 (예: 제조업, 서비스업) */
  @Column({ name: 'business_type', type: 'varchar', length: 100, nullable: true })
  businessType: string | null;

  /** 업종/종목 (예: 소프트웨어 개발) */
  @Column({ name: 'business_item', type: 'varchar', length: 100, nullable: true })
  businessItem: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  industry: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ name: 'cover_image_url', type: 'text', nullable: true })
  coverImageUrl: string | null;

  @Column({ name: 'cover_image_mobile_url', type: 'text', nullable: true })
  coverImageMobileUrl: string | null;

  @Column({ name: 'cover_mobile_crop', type: 'jsonb', nullable: true })
  coverMobileCrop: { x: number; y: number; width: number; height: number } | null;

  @Column({ name: 'branding_text_color', type: 'varchar', length: 7, default: '#FFFFFF' })
  brandingTextColor: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: CompanyPlan.FREE,
  })
  plan: CompanyPlan;

  @Column({ name: 'plan_started_at', type: 'timestamptz', nullable: true })
  planStartedAt: Date | null;

  @Column({ name: 'plan_expires_at', type: 'timestamptz', nullable: true })
  planExpiresAt: Date | null;

  @Column({ name: 'max_members', type: 'smallint', default: 5 })
  maxMembers: number;

  @Column({ name: 'work_start_time', type: 'time', default: '09:00' })
  workStartTime: string;

  @Column({ name: 'work_end_time', type: 'time', default: '18:00' })
  workEndTime: string;

  @Column({ name: 'late_threshold_min', type: 'smallint', default: 10 })
  lateThresholdMin: number;

  @Column({ length: 50, default: 'Asia/Seoul' })
  timezone: string;

  @Column({
    name: 'work_days',
    type: 'smallint',
    array: true,
    default: () => "'{1,2,3,4,5}'",
  })
  workDays: number[];

  @Column({
    type: 'varchar',
    length: 20,
    default: CompanyStatus.ACTIVE,
  })
  status: CompanyStatus;

  @Column({ name: 'gps_enabled', default: false })
  gpsEnabled: boolean;

  @Column({ name: 'gps_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  gpsLat: number | null;

  @Column({ name: 'gps_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  gpsLng: number | null;

  @Column({ name: 'gps_radius_m', type: 'smallint', default: 100 })
  gpsRadiusM: number;

  @Column({ name: 'gps_strict_mode', default: false })
  gpsStrictMode: boolean;

  /**
   * 출퇴근 연동 방식 설정 (JSONB)
   * enabled: 활성화된 방식 목록 (먼저 기록된 방식이 우선)
   * wifi.ssids: 허용된 사내 WiFi SSID 목록
   * qr.windowMinutes: QR 토큰 회전 주기 (기본 5분)
   */
  @Column({ name: 'attendance_methods', type: 'jsonb', nullable: true })
  attendanceMethods: {
    enabled: ('manual' | 'gps' | 'wifi' | 'qr' | 'face')[];
    wifi?: { ssids: string[] };
    qr?: { windowMinutes: number };
  } | null;

  // ── IT/스타트업 특화 설정 ─────────────────────────────────────────────────
  /** 야근 다음날 지각 면책 활성화 여부 */
  @Column({ name: 'late_night_exemption_enabled', default: false })
  lateNightExemptionEnabled: boolean;

  /** 야근 기준 시간 (기본 22시 — 이 시간 이후 퇴근 시 다음날 면책 적용) */
  @Column({ name: 'late_night_threshold_hour', type: 'smallint', default: 22 })
  lateNightThresholdHour: number;

  /** 면책 유예 시간(분) — 기본 60분 (다음날 출근 시간에서 이 만큼 유예) */
  @Column({ name: 'late_night_grace_minutes', type: 'smallint', default: 60 })
  lateNightGraceMinutes: number;

  /** 연장근무 사전 결재 승인 필수 여부 */
  @Column({ name: 'overtime_approval_required', default: true })
  overtimeApprovalRequired: boolean;

  // ── 공공기관/준공무원 특화 설정 ──────────────────────────────────────────
  /** 유연근무제 활성화 여부 */
  @Column({ name: 'flex_work_enabled', default: false })
  flexWorkEnabled: boolean;

  /** 연가 사용 강제화 알림 활성화 */
  @Column({ name: 'annual_leave_force_enabled', default: false })
  annualLeaveForceEnabled: boolean;

  /** 연가 강제화 알림 기준 잔여일수 (기본 5일 이상 남으면 알림) */
  @Column({ name: 'annual_leave_force_threshold', type: 'smallint', default: 5 })
  annualLeaveForceThreshold: number;

  // ── 현장직/교대근무직 특화 설정 ──────────────────────────────────────────
  /** 연속 근무 경고 기준 (시간, 기본 12시간) */
  @Column({ name: 'shift_long_work_threshold_hours', type: 'smallint', default: 12 })
  shiftLongWorkThresholdHours: number;

  /** 야간 근무 시작 시간 (0~23, 기본 22시) */
  @Column({ name: 'night_work_start_hour', type: 'smallint', default: 22 })
  nightWorkStartHour: number;

  /** 야간 근무 종료 시간 (0~23, 기본 6시) */
  @Column({ name: 'night_work_end_hour', type: 'smallint', default: 6 })
  nightWorkEndHour: number;

  /** 야간수당 배율 (기본 1.5배) */
  @Column({ name: 'night_pay_rate', type: 'decimal', precision: 4, scale: 2, default: 1.50 })
  nightPayRate: number;

  // ── 파트타임/아르바이트직 특화 설정 ──────────────────────────────────────
  /**
   * 분 단위 반올림 단위 (분)
   * 1=1분 단위(기본), 5=5분, 10=10분, 15=15분, 30=30분
   */
  @Column({ name: 'part_time_rounding_unit', type: 'smallint', default: 1 })
  partTimeRoundingUnit: number;

  /**
   * 반올림 정책: floor(절사) | round(반올림) | ceil(올림)
   * 예: 67분, 10분 단위 → floor=60, round=70, ceil=70
   */
  @Column({ name: 'part_time_rounding_policy', type: 'varchar', length: 10, default: 'floor' })
  partTimeRoundingPolicy: string;

  /**
   * 지각/조퇴 차감 단위 (분)
   * 예: 10분 단위 → 7분 지각이면 10분 차감 (올림 절사)
   */
  @Column({ name: 'part_time_deduction_unit', type: 'smallint', default: 1 })
  partTimeDeductionUnit: number;

  /** 근무 확인 문자 자동 발송 여부 (출퇴근 시 알바생에게 SMS 발송) */
  @Column({ name: 'work_confirm_sms_enabled', default: false })
  workConfirmSmsEnabled: boolean;

  // ─── 현장 외근직 설정 ───────────────────────────────────────────────────

  /** 외근 체크인 시 업무 보고서(Task) 자동 생성 여부 */
  @Column({ name: 'field_visit_auto_task', default: true })
  fieldVisitAutoTask: boolean;

  /** 자동 생성 업무 보고서 제목 템플릿 (null → 기본값 사용) */
  @Column({ name: 'field_visit_task_title', type: 'varchar', length: 200, nullable: true })
  fieldVisitTaskTitle: string | null;

  // ─── 의료·돌봄직 설정 ───────────────────────────────────────────────────

  /** 휴일 가산수당 배율 (기본 1.5배, 근로기준법 제56조) */
  @Column({ name: 'care_holiday_pay_rate', type: 'decimal', precision: 4, scale: 2, default: 1.50 })
  careHolidayPayRate: number;

  /** 누적 피로도 경고 기준 (주간 근무시간, 기본 52시간) */
  @Column({ name: 'care_fatigue_threshold_hours', type: 'smallint', default: 52 })
  careFatigueThresholdHours: number;

  /** 자격증 만료 사전 경고 일수 (기본 30일) */
  @Column({ name: 'care_license_warn_days', type: 'smallint', default: 30 })
  careLicenseWarnDays: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date;
}
