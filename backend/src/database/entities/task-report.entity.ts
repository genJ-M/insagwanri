import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';
import { Task } from './task.entity';

@Entity('task_reports')
@Index(['taskId', 'createdAt'])
@Index(['userId', 'createdAt'])
export class TaskReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'task_id' })
  taskId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'progress_percent', type: 'smallint', nullable: true })
  progressPercent: number | null;

  @Column({ name: 'attachment_urls', type: 'text', array: true, default: () => "'{}'" })
  attachmentUrls: string[];

  @Column({ name: 'is_ai_assisted', default: false })
  isAiAssisted: boolean;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  @Column({ name: 'feedback_by', type: 'uuid', nullable: true })
  feedbackBy: string | null;

  @Column({ name: 'feedback_at', type: 'timestamptz', nullable: true })
  feedbackAt: Date | null;

  @ManyToOne(() => Company) @JoinColumn({ name: 'company_id' }) company: Company;
  @ManyToOne(() => Task)    @JoinColumn({ name: 'task_id' })    task: Task;
  @ManyToOne(() => User)    @JoinColumn({ name: 'user_id' })    user: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'feedback_by' })
  feedbackUser: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
