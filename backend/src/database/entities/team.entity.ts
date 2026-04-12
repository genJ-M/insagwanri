import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';
import { TeamMember } from './team-member.entity';

@Entity('teams')
@Index(['companyId'])
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** 팀 대표 색상 (#RRGGBB) */
  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  /** 팀장 (employee role 유지 — 팀 내 제한적 권한) */
  @Column({ name: 'leader_id', type: 'uuid', nullable: true })
  leaderId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'leader_id' })
  leader: User;

  /** 연결된 팀 전용 채널 ID */
  @Column({ name: 'channel_id', type: 'uuid', nullable: true })
  channelId: string | null;

  @OneToMany(() => TeamMember, (tm) => tm.team)
  members: TeamMember[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date;
}
