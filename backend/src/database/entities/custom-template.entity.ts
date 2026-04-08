import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum CustomTemplateType {
  TASK     = 'task',
  SCHEDULE = 'schedule',
  SHIFT    = 'shift',
}

@Entity('custom_templates')
@Index(['companyId', 'type'])
@Index(['companyId', 'creatorId'])
export class CustomTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @Column({ type: 'varchar', length: 20 })
  type: CustomTemplateType;

  /** 템플릿 이름 */
  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** 분류 태그 (예: "영업", "운영", "외근") */
  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  /**
   * 타입별 구조:
   * task:     { title, description, category, priority, scope, checklist[] }
   * schedule: { title, type, duration_min, location, description, color, is_all_day }
   * shift:    { start_time, end_time, shift_type, location, note }
   */
  @Column({ type: 'jsonb', default: '{}' })
  fields: Record<string, unknown>;

  /** true = 회사 전체 공유 (manager+만 설정 가능) */
  @Column({ name: 'is_company_wide', default: false })
  isCompanyWide: boolean;

  /** 사용 횟수 */
  @Column({ name: 'use_count', type: 'int', default: 0 })
  useCount: number;

  @ManyToOne(() => Company) @JoinColumn({ name: 'company_id' }) company: Company;
  @ManyToOne(() => User)    @JoinColumn({ name: 'creator_id' }) creator: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
}
