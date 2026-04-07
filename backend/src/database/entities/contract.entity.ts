import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum ContractType {
  EMPLOYMENT  = 'employment',   // 근로계약
  PART_TIME   = 'part_time',    // 단시간근로계약
  CONTRACT    = 'contract',     // 용역계약
  NDA         = 'nda',          // 비밀유지계약
  OTHER       = 'other',        // 기타
}

/**
 * 직무 카테고리 (근로계약서 업무 분류)
 */
export enum JobCategory {
  MANAGEMENT  = 'management',   // 경영·관리
  SALES       = 'sales',        // 영업·마케팅
  DEVELOPMENT = 'development',  // IT·개발
  DESIGN      = 'design',       // 디자인
  FINANCE     = 'finance',      // 재무·회계
  HR          = 'hr',           // 인사·총무
  PRODUCTION  = 'production',   // 생산·제조
  LOGISTICS   = 'logistics',    // 물류·운송
  CUSTOMER    = 'customer',     // 고객지원
  RESEARCH    = 'research',     // 연구·개발(R&D)
  LEGAL       = 'legal',        // 법무·컴플라이언스
  OTHER       = 'other',        // 기타
}

export enum ContractStatus {
  ACTIVE      = 'active',       // 유효
  EXPIRED     = 'expired',      // 만료
  TERMINATED  = 'terminated',   // 해지
}

@Entity('contracts')
@Index(['companyId', 'userId'])
@Index(['companyId', 'status'])
@Index(['companyId', 'endDate'])
export class Contract {
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

  @Column({ type: 'varchar', length: 30 })
  type: ContractType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null; // null = 무기한

  @Column({ type: 'varchar', length: 20, default: ContractStatus.ACTIVE })
  status: ContractStatus;

  @Column({ name: 'file_url', type: 'text', nullable: true })
  fileUrl: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'terminated_at', type: 'timestamptz', nullable: true })
  terminatedAt: Date | null;

  @Column({ name: 'terminate_reason', type: 'text', nullable: true })
  terminateReason: string | null;

  @Column({ name: 'created_by', type: 'varchar', nullable: true })
  createdBy: string | null;

  // ─── 근로계약 주요 조건 ──────────────────────────────

  /** 직무 카테고리 */
  @Column({ name: 'job_category', type: 'varchar', length: 30, nullable: true })
  jobCategory: JobCategory | null;

  /** 업무 내용 */
  @Column({ name: 'job_description', type: 'text', nullable: true })
  jobDescription: string | null;

  /** 근무 장소 */
  @Column({ name: 'work_location', type: 'varchar', length: 200, nullable: true })
  workLocation: string | null;

  /** 월 기본급 (원) */
  @Column({ name: 'monthly_salary', type: 'bigint', nullable: true })
  monthlySalary: number | null;

  /** 연봉 (원, null이면 월급×12로 계산) */
  @Column({ name: 'annual_salary', type: 'bigint', nullable: true })
  annualSalary: number | null;

  /** 급여 상세 JSON (수당, 상여금 등) */
  @Column({ name: 'salary_detail', type: 'jsonb', nullable: true })
  salaryDetail: Record<string, number> | null;

  /** 소정 근로 시간 (주간) */
  @Column({ name: 'weekly_hours', type: 'smallint', nullable: true })
  weeklyHours: number | null;

  /** 사용한 계약서 템플릿 ID */
  @Column({ name: 'template_id', type: 'varchar', length: 50, nullable: true })
  templateId: string | null;

  /** 이미지 OCR로 추출한 전체 텍스트 */
  @Column({ name: 'ocr_text', type: 'text', nullable: true })
  ocrText: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
