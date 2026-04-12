import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Company } from './company.entity';
import { UserRole } from '../../common/types/jwt-payload.type';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

@Entity('users')
@Unique(['emailHash', 'companyId'])  // 암호화 이메일 해시 기반 유니크 (같은 회사 내 중복 불가)
@Index(['companyId'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  /** 평문 이메일 — BeforeInsert/Update 시 암호화 후 emailEncrypted에 저장, AfterLoad 시 복호화하여 복원 */
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  /** HMAC-SHA256 이메일 해시 — WHERE 조건 및 유니크 제약에 사용 */
  @Column({ name: 'email_hash', type: 'varchar', length: 64, nullable: true })
  emailHash: string | null;

  /** AES-256-GCM 암호화된 이메일 */
  @Column({ name: 'email_encrypted', type: 'text', nullable: true })
  emailEncrypted: string | null;

  /** AES-256-GCM 암호화된 이름 */
  @Column({ name: 'name_encrypted', type: 'text', nullable: true })
  nameEncrypted: string | null;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash: string | null;

  /** OAuth 제공자: 'google' | 'kakao' | null (이메일/비밀번호 가입은 null) */
  @Column({ type: 'varchar', length: 20, nullable: true })
  provider: string | null;

  /** OAuth 제공자의 고유 사용자 ID */
  @Column({ name: 'provider_account_id', type: 'varchar', length: 255, nullable: true })
  providerAccountId: string | null;

  @Column({ name: 'refresh_token_hash', type: 'text', nullable: true })
  refreshTokenHash: string | null;

  @Column({ length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'profile_image_url', type: 'text', nullable: true })
  profileImageUrl: string | null;

  @Column({ name: 'cover_image_url', type: 'text', nullable: true })
  coverImageUrl: string | null;

  @Column({ name: 'cover_image_mobile_url', type: 'text', nullable: true })
  coverImageMobileUrl: string | null;

  @Column({ name: 'cover_mobile_crop', type: 'jsonb', nullable: true })
  coverMobileCrop: { x: number; y: number; width: number; height: number } | null;

  @Column({ name: 'employee_number', type: 'varchar', length: 30, nullable: true })
  employeeNumber: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  department: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  position: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: UserRole.EMPLOYEE,
  })
  role: UserRole;

  @Column({ name: 'custom_work_start', type: 'time', nullable: true })
  customWorkStart: string | null;

  @Column({ name: 'custom_work_end', type: 'time', nullable: true })
  customWorkEnd: string | null;

  /**
   * 개인 법정 휴게시간(분). null이면 법정 최소 자동 계산
   * 4h이상: 30분 / 8h이상: 60분 (근로기준법 제54조)
   */
  @Column({ name: 'break_minutes', type: 'smallint', nullable: true })
  breakMinutes: number | null;

  /**
   * 개인 지각 판정 허용 시간(분). null이면 회사 설정(lateThresholdMin) 사용
   */
  @Column({ name: 'late_threshold_min_override', type: 'smallint', nullable: true })
  lateThresholdMinOverride: number | null;

  /**
   * 근무 스케줄 변경 메모 (최근 변경 사유)
   */
  @Column({ name: 'schedule_note', type: 'text', nullable: true })
  scheduleNote: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ name: 'joined_at', type: 'date', nullable: true })
  joinedAt: Date | null;

  /** 생년월일 (인사관리·생일 알림용, 연도 포함 전체 저장) */
  @Column({ type: 'date', nullable: true })
  birthday: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  /**
   * 담당 부서 범위 (manager 전용)
   * null = 전체 부서, 배열 = 해당 부서만 접근 가능
   */
  @Column({ name: 'managed_departments', type: 'jsonb', nullable: true })
  managedDepartments: string[] | null;

  /**
   * 세부 권한 플래그 (manager/employee 전용 — JSONB)
   * UserPermissions 타입과 동기화 필요 (jwt-payload.type.ts 참고)
   */
  @Column({ type: 'jsonb', nullable: true })
  permissions: import('../../common/types/jwt-payload.type').UserPermissions | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date;
}
