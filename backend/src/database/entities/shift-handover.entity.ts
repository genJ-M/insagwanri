import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';
import { ShiftAssignment } from './shift-schedule.entity';

export enum HandoverStatus {
  PENDING      = 'pending',       // 생성됨 (인계자 서명 전)
  FROM_SIGNED  = 'from_signed',   // 인계자 서명 완료 (인수자 서명 대기)
  COMPLETED    = 'completed',     // 양방 서명 완료
  DISPUTED     = 'disputed',      // 이의 제기
}

/**
 * 교대 인수인계 기록
 * 인계자(from_user) → 인수자(to_user) 양방 서명으로 완료
 */
@Entity('shift_handovers')
@Index(['companyId', 'shiftDate'])
@Index(['fromUserId'])
@Index(['toUserId'])
export class ShiftHandover {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  /** 인계자 (현재 교대 담당자) */
  @Column({ name: 'from_user_id' })
  fromUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'from_user_id' })
  fromUser: User;

  /** 인수자 (다음 교대 담당자) */
  @Column({ name: 'to_user_id' })
  toUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'to_user_id' })
  toUser: User;

  /** 연결된 근무 배정 ID (인수자의 배정) */
  @Column({ name: 'assignment_id', type: 'uuid', nullable: true })
  assignmentId: string | null;

  @ManyToOne(() => ShiftAssignment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: ShiftAssignment | null;

  /** 인수인계 날짜 */
  @Column({ name: 'shift_date', type: 'date' })
  shiftDate: string;

  /** 교대 시간 (HH:mm) */
  @Column({ name: 'handover_time', type: 'varchar', length: 5, nullable: true })
  handoverTime: string | null;

  @Column({ type: 'varchar', length: 20, default: HandoverStatus.PENDING })
  status: HandoverStatus;

  /** 인계 내용 (인계자 작성) */
  @Column({ name: 'from_note', type: 'text', nullable: true })
  fromNote: string | null;

  /** 인수 확인 메모 (인수자 작성) */
  @Column({ name: 'to_note', type: 'text', nullable: true })
  toNote: string | null;

  /** 이의 제기 사유 */
  @Column({ name: 'dispute_reason', type: 'text', nullable: true })
  disputeReason: string | null;

  @Column({ name: 'from_signed_at', type: 'timestamptz', nullable: true })
  fromSignedAt: Date | null;

  @Column({ name: 'to_signed_at', type: 'timestamptz', nullable: true })
  toSignedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
