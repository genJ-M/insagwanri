import {
  Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Message } from './message.entity';
import { User } from './user.entity';

/**
 * 공지(announcement) 채널 메세지의 개별 확인 기록
 * 일반 채팅에는 사용하지 않음 — channel.type === 'announcement' 메세지만 기록
 */
@Entity('message_reads')
@Index(['messageId'])
@Index(['userId'])
export class MessageRead {
  @PrimaryColumn({ name: 'message_id' })
  messageId: string;

  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @CreateDateColumn({ name: 'read_at', type: 'timestamptz' })
  readAt: Date;

  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
