import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum CalendarEventScope {
  COMPANY  = 'company',  // 전사 공지 — owner/manager 생성
  TEAM     = 'team',     // 팀 공지    — owner/manager 생성, 팀원 열람
  PERSONAL = 'personal', // 개인 일정 — 본인만
}

@Entity('calendar_events')
@Index(['companyId', 'startDate', 'endDate'])
@Index(['companyId', 'scope'])
@Index(['companyId', 'creatorId'])
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ type: 'varchar', length: 20, default: CalendarEventScope.PERSONAL })
  scope: CalendarEventScope;

  /** team scope 시 대상 부서명 (null = 전체 팀) */
  @Column({ name: 'target_department', type: 'varchar', length: 50, nullable: true })
  targetDepartment: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string; // 'YYYY-MM-DD'

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'all_day', default: true })
  allDay: boolean;

  /** #hex 또는 tailwind color token (optional) */
  @Column({ type: 'varchar', length: 20, nullable: true })
  color: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
