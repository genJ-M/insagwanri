import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum LicenseType {
  NURSE               = 'nurse',               // 간호사 면허
  NURSE_AID           = 'nurse_aid',           // 간호조무사
  CARE_WORKER         = 'care_worker',         // 요양보호사 자격증
  SOCIAL_WORKER       = 'social_worker',       // 사회복지사
  CHILDCARE_TEACHER   = 'childcare_teacher',   // 보육교사
  PHYSICAL_THERAPIST  = 'physical_therapist',  // 물리치료사
  OCCUPATIONAL_THERAPIST = 'occupational_therapist', // 작업치료사
  RADIOGRAPHER        = 'radiographer',        // 방사선사
  MEDICAL_TECHNOLOGIST = 'medical_technologist', // 임상병리사
  PARAMEDIC           = 'paramedic',           // 응급구조사
  DENTAL_HYGIENIST    = 'dental_hygienist',    // 치위생사
  OTHER               = 'other',
}

/**
 * 직원 자격증/면허 관리
 * - 만료일 임박 시 Cron으로 자동 알림
 * - 의료법 제8조, 노인복지법 제39조의2 대응
 */
@Entity('care_licenses')
@Index(['companyId', 'userId'])
@Index(['companyId', 'expiresAt'])
export class CareLicense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** 자격증 종류 */
  @Column({ type: 'varchar', length: 40 })
  type: LicenseType;

  /** 자격증/면허번호 (선택) */
  @Column({ name: 'license_number', type: 'varchar', length: 100, nullable: true })
  licenseNumber: string | null;

  /** 자격증명 (type=other일 때 직접 입력) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  /** 발급일 */
  @Column({ name: 'issued_at', type: 'date', nullable: true })
  issuedAt: string | null;

  /** 만료일 (무기한 자격증이면 null) */
  @Column({ name: 'expires_at', type: 'date', nullable: true })
  expiresAt: string | null;

  /** 발급 기관 */
  @Column({ name: 'issuer', type: 'varchar', length: 100, nullable: true })
  issuer: string | null;

  /** 첨부 파일 URL (자격증 사진) */
  @Column({ name: 'file_url', type: 'text', nullable: true })
  fileUrl: string | null;

  /** 만료 경고 알림 발송 여부 추적 (중복 발송 방지) */
  @Column({ name: 'expiry_warned_at', type: 'timestamptz', nullable: true })
  expiryWarnedAt: Date | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date;
}
