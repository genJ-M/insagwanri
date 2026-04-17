import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIAL_REFUNDED = 'partial_refunded',
  VOID = 'void',
  CANCELED = 'canceled',
}

@Entity('payments')
@Index(['companyId', 'createdAt'])
@Index(['status', 'createdAt'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'subscription_id', type: 'uuid' })
  subscriptionId: string;

  @Column({ name: 'payment_method_id', type: 'uuid', nullable: true })
  paymentMethodId: string | null;

  @Index({ unique: true })
  @Column({ name: 'invoice_number', length: 60 })
  invoiceNumber: string; // INV-2025-03-000123

  @Column({ type: 'varchar', length: 30, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  // 금액 (원화)
  @Column({ name: 'supply_amount_krw', type: 'decimal', precision: 12, scale: 2 })
  supplyAmountKrw: number;

  @Column({ name: 'tax_amount_krw', type: 'decimal', precision: 12, scale: 2 })
  taxAmountKrw: number;

  @Column({ name: 'total_amount_krw', type: 'decimal', precision: 12, scale: 2 })
  totalAmountKrw: number;

  @Column({ name: 'discount_amount_krw', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmountKrw: number;

  @Column({ name: 'coupon_id', type: 'uuid', nullable: true })
  couponId: string | null;

  @Column({ name: 'billing_period_start', type: 'date' })
  billingPeriodStart: string;

  @Column({ name: 'billing_period_end', type: 'date' })
  billingPeriodEnd: string;

  @Column({ name: 'billing_cycle', length: 10 })
  billingCycle: string;

  // PG 정보
  @Column({ name: 'pg_provider', length: 30, default: 'toss_payments' })
  pgProvider: string; // toss_payments|bank_transfer|admin_manual

  @Index({ unique: true })
  @Column({ name: 'pg_transaction_id', type: 'varchar', length: 200, nullable: true })
  pgTransactionId: string | null;

  @Column({ name: 'pg_order_id', type: 'varchar', length: 200, nullable: true })
  pgOrderId: string | null;

  @Column({ name: 'pg_raw_response', type: 'jsonb', nullable: true })
  pgRawResponse: Record<string, any> | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'failure_code', type: 'varchar', length: 100, nullable: true })
  failureCode: string | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ name: 'refundable_until', type: 'timestamptz', nullable: true })
  refundableUntil: Date | null;

  // 환불
  @Column({ name: 'refunded_amount_krw', type: 'decimal', precision: 12, scale: 2, default: 0 })
  refundedAmountKrw: number;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  @Column({ name: 'refund_reason', type: 'text', nullable: true })
  refundReason: string | null;

  @Column({ name: 'refund_type', type: 'varchar', length: 30, nullable: true })
  refundType: string | null; // full|partial|adjustment

  @Column({ name: 'refund_pg_transaction_id', type: 'varchar', length: 200, nullable: true })
  refundPgTransactionId: string | null;

  @Column({ name: 'tax_invoice_id', type: 'uuid', nullable: true })
  taxInvoiceId: string | null;

  @Column({ name: 'admin_memo', type: 'text', nullable: true })
  adminMemo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
