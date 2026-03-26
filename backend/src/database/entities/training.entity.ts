import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum TrainingStatus {
  PLANNED   = 'planned',
  ONGOING   = 'ongoing',
  COMPLETED = 'completed',
  CANCELED  = 'canceled',
}

@Entity('trainings')
@Index(['companyId', 'status'])
@Index(['companyId', 'startDate', 'endDate'])
export class Training {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ name: 'target_department', type: 'varchar', length: 100, nullable: true })
  targetDepartment: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null; // 'YYYY-MM-DD'

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ name: 'max_participants', type: 'int', nullable: true })
  maxParticipants: number | null;

  @Column({ type: 'varchar', length: 20, default: TrainingStatus.PLANNED })
  status: TrainingStatus;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
