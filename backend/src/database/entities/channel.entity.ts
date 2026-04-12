import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum ChannelType {
  ANNOUNCEMENT = 'announcement',
  GENERAL      = 'general',
  DIRECT       = 'direct',
  GROUP        = 'group',
  TEAM         = 'team',
}

@Entity('channels')
@Index(['companyId'])
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  type: ChannelType;

  @Column({ name: 'is_private', default: false })
  isPrivate: boolean;

  @Column({ name: 'creator_id', type: 'uuid', nullable: true })
  creatorId: string;

  /** 팀 채널인 경우 연결된 팀 ID */
  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Company) @JoinColumn({ name: 'company_id' }) company: Company;
  @ManyToOne(() => User, { nullable: true }) @JoinColumn({ name: 'creator_id' }) creator: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date;
}
