import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Unique, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

@Entity('vacation_balances')
@Unique(['companyId', 'userId', 'year'])
@Index(['companyId', 'year'])
export class VacationBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int' })
  year: number;

  @Column({ name: 'total_days', type: 'numeric', precision: 5, scale: 1, default: 0 })
  totalDays: number; // 총 부여일수

  @Column({ name: 'used_days', type: 'numeric', precision: 5, scale: 1, default: 0 })
  usedDays: number; // 사용일수 (승인된 것 자동 집계)

  @Column({ name: 'adjust_days', type: 'numeric', precision: 5, scale: 1, default: 0 })
  adjustDays: number; // 수동 조정 (추가 +, 차감 -)

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
