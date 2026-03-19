import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('billing_profiles')
export class BillingProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'entity_type', length: 20 })
  entityType: string; // corporation|sole_proprietor|individual

  @Column({ name: 'legal_name', length: 200 })
  legalName: string;

  @Column({ name: 'representative_name', length: 100, nullable: true })
  representativeName: string | null;

  @Index({ unique: true })
  @Column({ name: 'business_registration_number', length: 20, nullable: true })
  businessRegistrationNumber: string | null; // XXX-XX-XXXXX

  @Column({ name: 'corporate_registration_number', length: 20, nullable: true })
  corporateRegistrationNumber: string | null;

  @Column({ name: 'business_type', length: 100, nullable: true })
  businessType: string | null;

  @Column({ name: 'business_item', length: 100, nullable: true })
  businessItem: string | null;

  @Column({ name: 'address_postal_code', length: 10, nullable: true })
  addressPostalCode: string | null;

  @Column({ name: 'address_line1', length: 200, nullable: true })
  addressLine1: string | null;

  @Column({ name: 'address_line2', length: 200, nullable: true })
  addressLine2: string | null;

  @Column({ name: 'tax_invoice_required', default: false })
  taxInvoiceRequired: boolean;

  @Column({ name: 'tax_invoice_email', length: 255, nullable: true })
  taxInvoiceEmail: string | null;

  @Column({ name: 'tax_invoice_issue_type', length: 20, default: 'on_payment' })
  taxInvoiceIssueType: string; // on_payment|monthly

  @Column({ name: 'billing_email', length: 255, nullable: true })
  billingEmail: string | null;

  @Column({ name: 'billing_phone', length: 30, nullable: true })
  billingPhone: string | null;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
