import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

export enum FeatureType {
  BOOLEAN = 'boolean',
  LIMIT = 'limit',
  CONFIG = 'config',
}

@Entity('features')
export class Feature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 100 })
  key: string; // snake_case 상수

  @Column({ length: 50 })
  category: string; // core|collaboration|ai|analytics|admin|integration

  @Column({
    name: 'feature_type',
    type: 'varchar',
    length: 20,
  })
  featureType: FeatureType;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'default_enabled', default: false })
  defaultEnabled: boolean;

  @Column({ name: 'default_config', type: 'jsonb', default: '{}' })
  defaultConfig: Record<string, any>;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
