import {
  Entity, PrimaryColumn, ManyToOne, JoinColumn, Column, CreateDateColumn,
} from 'typeorm';
import { Channel } from './channel.entity';
import { User } from './user.entity';

@Entity('channel_members')
export class ChannelMember {
  @PrimaryColumn({ name: 'channel_id' })
  channelId: string;

  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Channel) @JoinColumn({ name: 'channel_id' }) channel: Channel;
  @ManyToOne(() => User)    @JoinColumn({ name: 'user_id' })    user: User;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt: Date;

  @Column({ name: 'last_read_at', type: 'timestamptz', nullable: true })
  lastReadAt: Date;
}
