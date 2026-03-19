import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('export_logs')
@Index(['requestedBy', 'requestedAt'])
export class ExportLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null; // NULL = 전체

  @Column({ name: 'export_type', length: 50 })
  exportType: string;
  // payment_history|tax_invoice_list|tax_summary|subscription_report|refund_history

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart: string | null;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  filters: Record<string, any>;

  @Column({ length: 20, default: 'pending' })
  status: string; // pending|processing|completed|failed

  @Column({ name: 'file_format', length: 10, default: 'xlsx' })
  fileFormat: string; // xlsx|csv|json

  @Column({ name: 'file_url', type: 'text', nullable: true })
  fileUrl: string | null;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes: string | null;

  @Column({ name: 'row_count', type: 'int', nullable: true })
  rowCount: number | null;

  @CreateDateColumn({ name: 'requested_at', type: 'timestamptz' })
  requestedAt: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;
}
