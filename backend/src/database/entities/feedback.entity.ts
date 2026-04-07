import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum FeedbackType {
  BUG        = 'bug',
  SUGGESTION = 'suggestion',
  CONTACT    = 'contact',
}

export enum FeedbackStatus {
  OPEN = 'open',
  READ = 'read',
}

@Entity('feedbacks')
@Index(['companyId'])
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, default: FeedbackType.BUG })
  type: FeedbackType;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'context_json', type: 'jsonb', nullable: true })
  contextJson: Record<string, any> | null;

  @Column({ name: 'screenshot_url', type: 'text', nullable: true })
  screenshotUrl: string | null;

  @Column({ type: 'varchar', length: 20, default: FeedbackStatus.OPEN })
  status: FeedbackStatus;

  @Column({ name: 'company_id', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'company_id' })
  company: Company | null;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
