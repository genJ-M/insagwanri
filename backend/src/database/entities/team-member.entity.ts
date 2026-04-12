import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Team } from './team.entity';
import { User } from './user.entity';

/**
 * primary  — 소속 팀 (1인 1팀 원칙)
 * secondary — 겸직 팀
 * tf        — 태스크포스 (임시)
 * dispatch  — 파견
 */
export type MembershipType = 'primary' | 'secondary' | 'tf' | 'dispatch';

@Entity('team_members')
@Index(['teamId'])
@Index(['userId'])
export class TeamMember {
  @PrimaryColumn({ name: 'team_id' })
  teamId: string;

  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @Column({
    name: 'membership_type',
    type: 'varchar',
    length: 20,
    default: 'primary',
  })
  membershipType: MembershipType;

  @ManyToOne(() => Team, (t) => t.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt: Date;
}
