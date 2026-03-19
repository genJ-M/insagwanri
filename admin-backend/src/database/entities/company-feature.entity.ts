import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum OverrideType {
  FORCE_ENABLE = 'force_enable',
  FORCE_DISABLE = 'force_disable',
  LIMIT_ADJUST = 'limit_adjust',
  CONFIG_OVERRIDE = 'config_override',
}

@Entity('company_features')
@Index(['companyId', 'featureId'], { unique: true })
export class CompanyFeature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'feature_id', type: 'uuid' })
  featureId: string;

  @Column({
    name: 'override_type',
    type: 'varchar',
    length: 30,
  })
  overrideType: OverrideType;

  @Column({ name: 'is_enabled', type: 'boolean', nullable: true })
  isEnabled: boolean | null;

  @Column({ name: 'limit_value', type: 'int', nullable: true })
  limitValue: number | null;

  @Column({ name: 'config_value', type: 'jsonb', nullable: true })
  configValue: Record<string, any> | null;

  @Column({ type: 'text' })
  reason: string; // 감사 추적 필수

  @Column({ name: 'applied_by', type: 'uuid' })
  appliedBy: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null; // NULL = 영구

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
