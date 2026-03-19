import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('service_usage')
@Index(['companyId', 'periodYear', 'periodMonth'], { unique: true })
export class ServiceUsage {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Index()
  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'subscription_id', type: 'uuid' })
  subscriptionId: string;

  @Column({ name: 'period_year', type: 'smallint' })
  periodYear: number;

  @Column({ name: 'period_month', type: 'smallint' })
  periodMonth: number;

  @Column({ name: 'active_employee_count', type: 'int', default: 0 })
  activeEmployeeCount: number;

  @Column({ name: 'ai_request_count', type: 'int', default: 0 })
  aiRequestCount: number;

  @Column({ name: 'ai_request_success', type: 'int', default: 0 })
  aiRequestSuccess: number;

  @Column({ name: 'ai_estimated_cost_usd', type: 'decimal', precision: 10, scale: 4, default: 0 })
  aiEstimatedCostUsd: number;

  @Column({ name: 'storage_used_mb', type: 'decimal', precision: 12, scale: 2, default: 0 })
  storageUsedMb: number;

  @Column({ name: 'plan_employee_limit', type: 'int', default: 0 })
  planEmployeeLimit: number;

  @Column({ name: 'snapshot_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  snapshotAt: Date;
}
