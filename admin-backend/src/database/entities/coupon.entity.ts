import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 50 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'discount_type', length: 20 })
  discountType: string; // percentage|fixed_amount

  @Column({ name: 'discount_value', type: 'decimal', precision: 10, scale: 2 })
  discountValue: number;

  @Column({ name: 'max_discount_amount_krw', type: 'decimal', precision: 12, scale: 2, nullable: true })
  maxDiscountAmountKrw: number | null;

  @Column({ name: 'applicable_plans', type: 'uuid', array: true, default: '{}' })
  applicablePlans: string[];

  @Column({ name: 'applicable_billing_cycles', length: 20, default: 'all' })
  applicableBillingCycles: string; // all|monthly_only|yearly_only

  @Column({ name: 'min_amount_krw', type: 'decimal', precision: 12, scale: 2, default: 0 })
  minAmountKrw: number;

  @Column({ name: 'max_total_uses', type: 'int', nullable: true })
  maxTotalUses: number | null;

  @Column({ name: 'max_uses_per_company', type: 'int', default: 1 })
  maxUsesPerCompany: number;

  @Column({ name: 'current_total_uses', type: 'int', default: 0 })
  currentTotalUses: number;

  @Column({ name: 'valid_from', type: 'timestamptz' })
  validFrom: Date;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
