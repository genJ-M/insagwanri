import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ContractType {
  STANDARD = 'standard',
  CUSTOM = 'custom',
  PILOT = 'pilot',
}

export enum ContractStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
}

@Entity('contracts')
@Index(['companyId', 'status'])
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Index({ unique: true })
  @Column({ name: 'contract_number', length: 60 })
  contractNumber: string; // CNT-2025-000001

  @Column({ type: 'varchar', length: 30, default: ContractType.STANDARD })
  type: ContractType;

  @Column({ type: 'varchar', length: 20, default: ContractStatus.DRAFT })
  status: ContractStatus;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @Column({ name: 'custom_price_monthly_krw', type: 'decimal', precision: 12, scale: 2, nullable: true })
  customPriceMonthlyKrw: number | null;

  @Column({ name: 'custom_max_employees', type: 'int', nullable: true })
  customMaxEmployees: number | null;

  @Column({ name: 'contract_value_krw', type: 'decimal', precision: 15, scale: 2, nullable: true })
  contractValueKrw: number | null;

  @Column({ name: 'payment_terms', length: 50, default: 'monthly' })
  paymentTerms: string; // monthly|quarterly|annual_prepaid

  @Column({ name: 'sla_uptime_percent', type: 'decimal', precision: 5, scale: 2, default: 99.9 })
  slaUptimePercent: number;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt: Date | null;

  @Column({ name: 'file_url', type: 'text', nullable: true })
  fileUrl: string | null;

  @Column({ name: 'admin_user_id', type: 'uuid', nullable: true })
  adminUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
