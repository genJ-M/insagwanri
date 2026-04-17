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
  @Column({ name: 'card_type', type: 'varchar', length: 20, nullable: true })
  cardType: string | null; // corporate|business|personal

  @Column({ name: 'card_number_masked', type: 'varchar', length: 25, nullable: true })
  cardNumberMasked: string | null; // 앞6+뒤4자리

  @Column({ name: 'card_holder_name', type: 'varchar', length: 100, nullable: true })
  cardHolderName: string | null;

  @Column({ name: 'card_issuer', type: 'varchar', length: 50, nullable: true })
  cardIssuer: string | null;

  @Column({ name: 'card_brand', type: 'varchar', length: 20, nullable: true })
  cardBrand: string | null; // Visa|Mastercard|local

  @Column({ name: 'card_expiry_year', type: 'varchar', length: 4, nullable: true })
  cardExpiryYear: string | null;

  @Column({ name: 'card_expiry_month', type: 'varchar', length: 2, nullable: true })
  cardExpiryMonth: string | null;

  // AES-256 암호화 저장
  @Column({ name: 'pg_billing_key', type: 'varchar', length: 500, nullable: true })
  pgBillingKey: string | null;

  // 계좌이체 전용
  @Column({ name: 'account_type', type: 'varchar', length: 30, nullable: true })
  accountType: string | null; // corporate_account|business_account|personal_account

  @Column({ name: 'bank_code', type: 'varchar', length: 10, nullable: true })
  bankCode: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 50, nullable: true })
  bankName: string | null;

  @Column({ name: 'account_number_masked', type: 'varchar', length: 25, nullable: true })
  accountNumberMasked: string | null;

  @Column({ name: 'account_holder_name', type: 'varchar', length: 100, nullable: true })
  accountHolderName: string | null;

  @Column({ name: 'account_business_number', type: 'varchar', length: 20, nullable: true })
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
