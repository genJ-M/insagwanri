import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Company } from '../../../database/entities/company.entity';

export type ModuleSource = 'plan' | 'addon' | 'manual';

@Entity('company_modules')
@Unique(['companyId', 'moduleId'])
@Index(['companyId'])
export class CompanyModule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  /** MODULE_IDS 중 하나 (e.g. 'attendance', 'ai') */
  @Column({ name: 'module_id', length: 50 })
  moduleId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /**
   * 활성화 출처
   * - plan: 플랜 변경 시 자동 활성화
   * - addon: addon_purchases를 통해 개별 구매
   * - manual: 어드민이 수동 조작
   */
  @Column({ type: 'varchar', length: 20, default: 'plan' })
  source: ModuleSource;

  /** 애드온 구매로 활성화된 경우 — 해당 addon_purchases.id */
  @Column({ name: 'addon_purchase_id', type: 'uuid', nullable: true })
  addonPurchaseId: string | null;

  @CreateDateColumn({ name: 'activated_at', type: 'timestamptz' })
  activatedAt: Date;
}
