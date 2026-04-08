import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, UpdateDateColumn, Index, Unique,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

@Entity('department_page_visibility')
@Unique(['companyId', 'department', 'pageKey'])
@Index(['companyId', 'department'])
export class DepartmentPageVisibility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ type: 'varchar', length: 100 })
  department: string; // 부서명, '__default__' = 회사 기본값

  @Column({ name: 'page_key', type: 'varchar', length: 100 })
  pageKey: string; // e.g. '/salary', '/tax-documents'

  @Column({ name: 'is_visible', default: true })
  isVisible: boolean;

  @Column({ name: 'updated_by_id', nullable: true })
  updatedById: string | null;

  @ManyToOne(() => Company) @JoinColumn({ name: 'company_id' }) company: Company;
  @ManyToOne(() => User, { nullable: true }) @JoinColumn({ name: 'updated_by_id' }) updatedBy: User | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
