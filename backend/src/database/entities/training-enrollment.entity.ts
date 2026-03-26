import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Training } from './training.entity';
import { User } from './user.entity';

export enum EnrollmentStatus {
  ENROLLED  = 'enrolled',
  COMPLETED = 'completed',
  DROPPED   = 'dropped',
}

@Entity('training_enrollments')
@Index(['companyId', 'trainingId'])
@Index(['companyId', 'userId'])
@Index(['companyId', 'trainingId', 'userId'], { unique: true })
export class TrainingEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'training_id' })
  trainingId: string;

  @ManyToOne(() => Training, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'training_id' })
  training: Training;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20, default: EnrollmentStatus.ENROLLED })
  status: EnrollmentStatus;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
