import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { Channel } from './channel.entity';
import { User } from './user.entity';

export enum ContentType {
  TEXT   = 'text',
  IMAGE  = 'image',
  FILE   = 'file',
  SYSTEM = 'system',
}

@Entity('messages')
@Index(['channelId', 'createdAt'])
@Index(['parentMessageId'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'channel_id' })
  channelId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'content_type', type: 'varchar', length: 20, default: ContentType.TEXT })
  contentType: ContentType;

  @Column({ name: 'attachment_url', type: 'text', nullable: true })
  attachmentUrl: string | null;

  @Column({ name: 'attachment_name', type: 'varchar', length: 255, nullable: true })
  attachmentName: string | null;

  @Column({ name: 'attachment_size', type: 'integer', nullable: true })
  attachmentSize: number | null;

  @Column({ name: 'parent_message_id', type: 'uuid', nullable: true })
  parentMessageId: string | null;          // 스레드 답글용 자기참조

  @Column({ name: 'is_edited', default: false })
  isEdited: boolean;

  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // ─── 공지 대상 설정 (announcement 채널 전용) ─────────────────────────────
  @Column({ name: 'target_type', type: 'varchar', length: 20, default: 'all' })
  targetType: string; // 'all' | 'department' | 'custom'

  @Column({ name: 'target_department', type: 'varchar', length: 100, nullable: true })
  targetDepartment: string | null;

  @Column({ name: 'target_user_ids', type: 'jsonb', nullable: true })
  targetUserIds: string[] | null;

  @Column({ name: 'is_private_recipients', default: false })
  isPrivateRecipients: boolean; // BCC 모드 (수신자 목록 비공개)

  @Column({ name: 'linked_schedule_id', type: 'uuid', nullable: true })
  linkedScheduleId: string | null;

  @ManyToOne(() => Company) @JoinColumn({ name: 'company_id' }) company: Company;
  @ManyToOne(() => Channel) @JoinColumn({ name: 'channel_id' }) channel: Channel;
  @ManyToOne(() => User)    @JoinColumn({ name: 'user_id' })    user: User;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'parent_message_id' })
  parentMessage: Message;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
