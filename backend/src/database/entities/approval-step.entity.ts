import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from './user.entity';
import { ApprovalDocument } from './approval-document.entity';

export enum StepStatus {
  PENDING  = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('approval_steps')
@Index(['documentId', 'step'])
@Index(['approverId'])
export class ApprovalStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @ManyToOne(() => ApprovalDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: ApprovalDocument;

  @Column({ name: 'approver_id' })
  approverId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approver_id' })
  approver: User;

  @Column({ type: 'int' })
  step: number; // 1, 2, 3 ...

  @Column({ type: 'varchar', length: 20, default: StepStatus.PENDING })
  status: StepStatus;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'acted_at', type: 'timestamptz', nullable: true })
  actedAt: Date | null;

  // SHA-256(document_id + step + approver_id + status + comment + acted_at + prev_hash)
  // 결재 완료 시 생성. 이전 단계 해시를 체인으로 연결해 위변조 감지
  @Column({ name: 'step_hash', type: 'varchar', length: 64, nullable: true })
  stepHash: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
