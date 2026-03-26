import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { Evaluation } from './evaluation.entity';

/** 평가 문항 카테고리 */
export enum EvalCategory {
  PERFORMANCE   = 'performance',   // 업무 성과
  COMPETENCY    = 'competency',    // 직무 역량
  COLLABORATION = 'collaboration', // 협업/소통
  GROWTH        = 'growth',        // 성장 가능성
  LEADERSHIP    = 'leadership',    // 리더십 (선택)
  COMMENT       = 'comment',       // 종합 의견 (텍스트)
}

export const EVAL_CATEGORY_LABELS: Record<EvalCategory, string> = {
  performance:   '업무 성과',
  competency:    '직무 역량',
  collaboration: '협업/소통',
  growth:        '성장 가능성',
  leadership:    '리더십',
  comment:       '종합 의견',
};

@Entity('evaluation_answers')
@Unique(['evaluationId', 'category'])
export class EvaluationAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'evaluation_id' })
  evaluationId: string;

  @ManyToOne(() => Evaluation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluation_id' })
  evaluation: Evaluation;

  @Column({ type: 'varchar', length: 30 })
  category: EvalCategory;

  /** 점수 (1–5, COMMENT 카테고리는 null) */
  @Column({ type: 'smallint', nullable: true })
  score: number | null;

  /** 텍스트 의견 */
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
