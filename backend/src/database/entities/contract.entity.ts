import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum ContractType {
  EMPLOYMENT  = 'employment',   // 근로계약
  PART_TIME   = 'part_time',    // 단시간근로계약
  CONTRACT    = 'contract',     // 용역계약
  NDA         = 'nda',          // 비밀유지계약
  OTHER       = 'other',        // 기타
}

export enum ContractStatus {
  ACTIVE      = 'active',       // 유효
  EXPIRED     = 'expired',      // 만료
  TERMINATED  = 'terminated',   // 해지
}

@Entity('contracts')
@Index(['companyId', 'userId'])
@Index(['companyId', 'status'])
@Index(['companyId', 'endDate'])
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 30 })
  type: ContractType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null; // null = 무기한

  @Column({ type: 'varchar', length: 20, default: ContractStatus.ACTIVE })
  status: ContractStatus;

  @Column({ name: 'file_url', type: 'text', nullable: true })
  fileUrl: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'terminated_at', type: 'timestamptz', nullable: true })
  terminatedAt: Date | null;

  @Column({ name: 'terminate_reason', type: 'text', nullable: true })
  terminateReason: string | null;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
