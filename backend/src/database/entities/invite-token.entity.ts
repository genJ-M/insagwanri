import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';
import { UserRole } from '../../common/types/jwt-payload.type';

export enum InviteStatus {
  PENDING  = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED  = 'expired',
  CANCELED = 'canceled',
}

export enum InviteType {
  EMAIL = 'email',    // 이메일 직접 초대
  PHONE = 'phone',    // 전화번호 SMS 초대
  LINK  = 'link',     // 공유 링크 (불특정 다수)
}

@Entity('invite_tokens')
export class InviteToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'invited_by' })
  invitedBy: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_by' })
  inviter: User;

  /** 이메일 초대 시 수신자 이메일 (nullable — 전화번호·링크 초대는 null) */
  @Index()
  @Column({ length: 255, nullable: true, default: null })
  email: string | null;

  /** 전화번호 초대 시 수신자 전화번호 */
  @Column({ name: 'recipient_phone', length: 20, nullable: true, default: null })
  recipientPhone: string | null;

  /** 초대 시 미리 지정한 수신자 이름 (전화번호·링크 초대) */
  @Column({ name: 'recipient_name', length: 100, nullable: true, default: null })
  recipientName: string | null;

  /** 초대 유형: email | phone | link */
  @Column({ name: 'invite_type', type: 'varchar', length: 10, default: InviteType.EMAIL })
  inviteType: InviteType;

  /** 링크 초대 최대 사용 횟수 (null = 무제한) */
  @Column({ name: 'max_uses', type: 'int', nullable: true, default: null })
  maxUses: number | null;

  /** 링크 초대 사용 횟수 */
  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({ type: 'varchar', length: 20, default: UserRole.EMPLOYEE })
  role: UserRole;

  @Index()
  @Column({ length: 64, unique: true })
  token: string;

  @Column({ type: 'varchar', length: 20, default: InviteStatus.PENDING })
  status: InviteStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'created_user_id', type: 'uuid', nullable: true })
  createdUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
