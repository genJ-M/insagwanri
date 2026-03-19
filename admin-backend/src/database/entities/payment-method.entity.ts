import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('payment_methods')
@Index(['companyId', 'isActive'])
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'method_type', length: 20 })
  methodType: string; // card|bank_transfer

  // 카드 전용
  @Column({ name: 'card_type', length: 20, nullable: true })
  cardType: string | null; // corporate|business|personal

  @Column({ name: 'card_number_masked', length: 25, nullable: true })
  cardNumberMasked: string | null; // 앞6+뒤4자리

  @Column({ name: 'card_holder_name', length: 100, nullable: true })
  cardHolderName: string | null;

  @Column({ name: 'card_issuer', length: 50, nullable: true })
  cardIssuer: string | null;

  @Column({ name: 'card_brand', length: 20, nullable: true })
  cardBrand: string | null; // Visa|Mastercard|local

  @Column({ name: 'card_expiry_year', length: 4, nullable: true })
  cardExpiryYear: string | null;

  @Column({ name: 'card_expiry_month', length: 2, nullable: true })
  cardExpiryMonth: string | null;

  // AES-256 암호화 저장
  @Column({ name: 'pg_billing_key', length: 500, nullable: true })
  pgBillingKey: string | null;

  // 계좌이체 전용
  @Column({ name: 'account_type', length: 30, nullable: true })
  accountType: string | null; // corporate_account|business_account|personal_account

  @Column({ name: 'bank_code', length: 10, nullable: true })
  bankCode: string | null;

  @Column({ name: 'bank_name', length: 50, nullable: true })
  bankName: string | null;

  @Column({ name: 'account_number_masked', length: 25, nullable: true })
  accountNumberMasked: string | null;

  @Column({ name: 'account_holder_name', length: 100, nullable: true })
  accountHolderName: string | null;

  @Column({ name: 'account_business_number', length: 20, nullable: true })
  accountBusinessNumber: string | null;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'registered_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  registeredAt: Date;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt: Date | null;
}
