import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  ManyToOne, JoinColumn, Index, Unique,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum SalaryStatus {
  DRAFT     = 'draft',
  CONFIRMED = 'confirmed',
  PAID      = 'paid',
}

@Entity('salaries')
@Unique(['companyId', 'userId', 'year', 'month'])
@Index(['companyId', 'year', 'month'])
export class Salary {
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

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number; // 1–12

  // ─── 지급 항목 ────────────────────────────────────
  @Column({ name: 'base_salary', type: 'int', default: 0 })
  baseSalary: number; // 기본급

  @Column({ name: 'overtime_pay', type: 'int', default: 0 })
  overtimePay: number; // 연장근무수당

  @Column({ name: 'holiday_pay', type: 'int', default: 0 })
  holidayPay: number; // 휴일수당

  @Column({ name: 'bonus', type: 'int', default: 0 })
  bonus: number; // 상여금

  @Column({ name: 'meal_allowance', type: 'int', default: 0 })
  mealAllowance: number; // 식비 (비과세 200,000원 이하)

  @Column({ name: 'transport_allowance', type: 'int', default: 0 })
  transportAllowance: number; // 교통비 (비과세 200,000원 이하)

  @Column({ name: 'other_allowance', type: 'int', default: 0 })
  otherAllowance: number; // 기타수당

  // ─── 공제 항목 ────────────────────────────────────
  @Column({ name: 'income_tax', type: 'int', default: 0 })
  incomeTax: number; // 소득세

  @Column({ name: 'local_tax', type: 'int', default: 0 })
  localTax: number; // 지방소득세 (소득세 × 10%)

  @Column({ name: 'national_pension', type: 'int', default: 0 })
  nationalPension: number; // 국민연금 (4.5%)

  @Column({ name: 'health_insurance', type: 'int', default: 0 })
  healthInsurance: number; // 건강보험 (3.545%)

  @Column({ name: 'care_insurance', type: 'int', default: 0 })
  careInsurance: number; // 장기요양보험 (건강보험 × 12.95%)

  @Column({ name: 'employment_insurance', type: 'int', default: 0 })
  employmentInsurance: number; // 고용보험 (0.9%)

  @Column({ name: 'other_deduction', type: 'int', default: 0 })
  otherDeduction: number; // 기타공제

  // ─── 상태 ─────────────────────────────────────────
  @Column({
    type: 'varchar', length: 20,
    default: SalaryStatus.DRAFT,
  })
  status: SalaryStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  // ─── 근무 통계 (참고용) ─────────────────────────────
  @Column({ name: 'work_days', type: 'int', nullable: true })
  workDays: number | null;

  @Column({ name: 'work_minutes', type: 'int', nullable: true })
  workMinutes: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_by', type: 'varchar', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
