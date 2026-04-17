import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TaxInvoiceStatus {
  PENDING = 'pending',
  ISSUED = 'issued',
  CANCELED = 'canceled',
  ERROR = 'error',
  RE_ISSUED = 're_issued',
}

@Entity('tax_invoices')
@Index(['companyId', 'createdAt'])
export class TaxInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ name: 'billing_profile_id', type: 'uuid', nullable: true })
  billingProfileId: string | null;

  @Index({ unique: true })
  @Column({ name: 'invoice_number', length: 60 })
  invoiceNumber: string; // TINV-2025-03-000123

  @Column({ type: 'varchar', length: 20, default: TaxInvoiceStatus.PENDING })
  status: TaxInvoiceStatus;

  // 공급자 (우리 회사)
  @Column({ name: 'supplier_name', type: 'varchar', length: 200, nullable: true })
  supplierName: string | null;

  @Column({ name: 'supplier_business_number', type: 'varchar', length: 20, nullable: true })
  supplierBusinessNumber: string | null;

  @Column({ name: 'supplier_representative', type: 'varchar', length: 100, nullable: true })
  supplierRepresentative: string | null;

  // 공급받는자 (고객사)
  @Column({ name: 'recipient_name', type: 'varchar', length: 200, nullable: true })
  recipientName: string | null;

  @Column({ name: 'recipient_business_number', type: 'varchar', length: 20, nullable: true })
  recipientBusinessNumber: string | null;

  @Column({ name: 'recipient_email', type: 'varchar', length: 255, nullable: true })
  recipientEmail: string | null;

  // 공급 내역
  @Column({ name: 'supply_date', type: 'date', nullable: true })
  supplyDate: string | null;

  @Column({ name: 'item_name', type: 'varchar', length: 200, nullable: true })
  itemName: string | null;

  @Column({ name: 'supply_amount_krw', type: 'decimal', precision: 12, scale: 2, default: 0 })
  supplyAmountKrw: number;

  @Column({ name: 'tax_amount_krw', type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmountKrw: number;

  @Column({ name: 'total_amount_krw', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmountKrw: number;

  // 국세청
  @Column({ name: 'e_invoice_provider', type: 'varchar', length: 30, nullable: true })
  eInvoiceProvider: string | null;

  @Column({ name: 'nts_confirmation_number', type: 'varchar', length: 50, nullable: true })
  ntsConfirmationNumber: string | null; // 24자리 승인번호

  @Column({ name: 'nts_submitted_at', type: 'timestamptz', nullable: true })
  ntsSubmittedAt: Date | null;

  @Column({ name: 'issued_at', type: 'timestamptz', nullable: true })
  issuedAt: Date | null;

  // 취소
  @Column({ name: 'original_invoice_id', type: 'uuid', nullable: true })
  originalInvoiceId: string | null;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt: Date | null;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ name: 'provider_raw_response', type: 'jsonb', nullable: true })
  providerRawResponse: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
