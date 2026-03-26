import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index, Unique,
} from 'typeorm';
import { User } from './user.entity';
import { EvaluationCycle } from './evaluation-cycle.entity';

export enum EvalType {
  SELF    = 'self',    // 자기평가
  PEER    = 'peer',    // 동료평가
  MANAGER = 'manager', // 상급자 평가
}

export enum EvalStatus {
  PENDING    = 'pending',    // 미완료
  IN_PROGRESS = 'in_progress',
  SUBMITTED  = 'submitted',  // 제출 완료
}

@Entity('evaluations')
@Unique(['cycleId', 'evaluateeId', 'evaluatorId'])
@Index(['cycleId', 'evaluateeId'])
@Index(['cycleId', 'evaluatorId'])
@Index(['cycleId', 'status'])
export class Evaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cycle_id' })
  cycleId: string;

  @ManyToOne(() => EvaluationCycle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cycle_id' })
  cycle: EvaluationCycle;

  @Column({ name: 'company_id' })
  companyId: string;

  /** 피평가자 */
  @Column({ name: 'evaluatee_id' })
  evaluateeId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluatee_id' })
  evaluatee: User;

  /** 평가자 */
  @Column({ name: 'evaluator_id' })
  evaluatorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluator_id' })
  evaluator: User;

  @Column({ type: 'varchar', length: 20 })
  type: EvalType;

  @Column({ type: 'varchar', length: 20, default: EvalStatus.PENDING })
  status: EvalStatus;

  /** 제출 시 계산된 종합 점수 (null = 미제출) */
  @Column({ name: 'total_score', type: 'numeric', precision: 4, scale: 2, nullable: true })
  totalScore: number | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
