import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

/** 회사 단위 크레딧 잔액 */
@Entity('credits')
@Index(['companyId'], { unique: true })
export class Credit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  /** 현재 잔액 */
  @Column({ type: 'int', default: 0 })
  balance: number;

  /** 이번 달 무료 지급량 (구독 플랜별 설정) */
  @Column({ name: 'monthly_grant', type: 'int', default: 20 })
  monthlyGrant: number;

  /** 마지막 월 지급일 */
  @Column({ name: 'last_grant_at', type: 'timestamptz', nullable: true })
  lastGrantAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/** 크레딧 트랜잭션 이력 */
@Entity('credit_transactions')
@Index(['companyId', 'userId', 'createdAt'])
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  /** 사용자 (null = 시스템 자동 지급) */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  /**
   * 양수 = 충전 (grant/purchase)
   * 음수 = 차감 (ocr/ai_classify/ai_analyze/ai_report)
   */
  @Column({ type: 'int' })
  amount: number;

  /** 차감/충전 후 잔액 */
  @Column({ name: 'balance_after', type: 'int' })
  balanceAfter: number;

  /**
   * monthly_grant | purchase | ocr | ai_classify
   * | ai_analyze | ai_report | manual_adjust
   */
  @Column({ type: 'varchar', length: 30 })
  type: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string | null;

  /** 참조 ID (계약 ID, task ID 등) */
  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
