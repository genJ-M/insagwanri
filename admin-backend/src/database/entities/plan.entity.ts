import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PlanName {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 50 })
  name: string; // free|basic|pro|enterprise

  @Column({ name: 'display_name', length: 100 })
  displayName: string;

  @Column({ name: 'price_monthly_krw', type: 'decimal', precision: 12, scale: 2, default: 0 })
  priceMonthlyKrw: number;

  @Column({ name: 'price_yearly_krw', type: 'decimal', precision: 12, scale: 2, default: 0 })
  priceYearlyKrw: number;

  @Column({ name: 'yearly_discount_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  yearlyDiscountRate: number;

  @Column({ name: 'max_employees', type: 'int', default: 5 })
  maxEmployees: number;

  @Column({ name: 'ai_requests_per_day', type: 'int', default: 10 })
  aiRequestsPerDay: number;

  @Column({ name: 'storage_limit_gb', type: 'decimal', precision: 10, scale: 2, default: 1 })
  storageLimitGb: number;

  @Column({ type: 'jsonb', default: '{}' })
  features: Record<string, any>;

  @Column({ name: 'trial_days', type: 'int', default: 0 })
  trialDays: number;

  @Column({ name: 'is_public', default: true })
  isPublic: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
