import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('user_careers')
@Index(['userId'])
export class UserCareer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'user_id' })
  userId: string;

  /** 이전 직장명 */
  @Column({ name: 'company_name', length: 200 })
  companyName: string;

  /** 직위/직책 */
  @Column({ length: 100, nullable: true })
  position: string | null;

  /** 부서 */
  @Column({ length: 100, nullable: true })
  department: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  /** 현재 재직 여부 */
  @Column({ name: 'is_current', type: 'boolean', default: false })
  isCurrent: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
