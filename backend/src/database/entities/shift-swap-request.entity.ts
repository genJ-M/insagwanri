import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';
import { ShiftAssignment } from './shift-schedule.entity';

export enum SwapType {
  SWAP  = 'swap',   // 1:1 교환 (내 시프트 ↔ 상대방 시프트)
  COVER = 'cover',  // 대타 모집 (내 시프트를 아무나 대신 해달라)
}

export enum SwapStatus {
  /** cover: 대타 모집 중 / swap: 상대방 응답 대기 중 */
  PENDING_PEER     = 'pending_peer',
  /** 상대방(B)이 수락 → 업주 최종 승인 대기 */
  PENDING_APPROVAL = 'pending_approval',
  /** 업주 최종 승인 완료 — 시프트 실제 교환됨 */
  APPROVED         = 'approved',
  /** 상대방(B) 거절 */
  PEER_DECLINED    = 'peer_declined',
  /** 업주 거절 (cover는 다시 pending_peer로 복귀) */
  REJECTED         = 'rejected',
  /** 요청자(A) 직접 취소 */
  CANCELLED        = 'cancelled',
}

@Entity('shift_swap_requests')
@Index(['companyId', 'status'])
@Index(['requesterId'])
@Index(['targetUserId'])
export class ShiftSwapRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  // ── 요청자(A) ──────────────────────────────────────────
  @Column({ name: 'requester_id' })
  requesterId: string;

  /** A가 내놓는 시프트 */
  @Column({ name: 'requester_assignment_id', type: 'uuid', nullable: true })
  requesterAssignmentId: string | null;

  /** A의 시프트 정보 스냅샷 (삭제 대비) */
  @Column({ name: 'requester_shift_snapshot', type: 'jsonb', nullable: true })
  requesterShiftSnapshot: {
    date: string;
    startTime: string | null;
    endTime: string | null;
    shiftType: string;
  } | null;

  // ── 대상(B) — swap은 지정, cover는 자원자가 채움 ──────
  @Column({ name: 'target_user_id', type: 'uuid', nullable: true })
  targetUserId: string | null;

  /** B가 내놓는 시프트 (cover이면 null) */
  @Column({ name: 'target_assignment_id', type: 'uuid', nullable: true })
  targetAssignmentId: string | null;

  /** B의 시프트 정보 스냅샷 */
  @Column({ name: 'target_shift_snapshot', type: 'jsonb', nullable: true })
  targetShiftSnapshot: {
    date: string;
    startTime: string | null;
    endTime: string | null;
    shiftType: string;
  } | null;

  // ── 요청 유형·상태 ─────────────────────────────────────
  @Column({ type: 'varchar', length: 10 })
  type: SwapType;

  @Column({ type: 'varchar', length: 20, default: SwapStatus.PENDING_PEER })
  status: SwapStatus;

  // ── 메모 ───────────────────────────────────────────────
  @Column({ name: 'requester_note', type: 'text', nullable: true })
  requesterNote: string | null;

  @Column({ name: 'peer_note', type: 'text', nullable: true })
  peerNote: string | null;

  @Column({ name: 'approver_id', type: 'uuid', nullable: true })
  approverId: string | null;

  @Column({ name: 'approver_note', type: 'text', nullable: true })
  approverNote: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  // ── Relations ──────────────────────────────────────────
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requester_id' })
  requester: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'target_user_id' })
  targetUser: User | null;

  @ManyToOne(() => ShiftAssignment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requester_assignment_id' })
  requesterAssignment: ShiftAssignment | null;

  @ManyToOne(() => ShiftAssignment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_assignment_id' })
  targetAssignment: ShiftAssignment | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approver_id' })
  approver: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
