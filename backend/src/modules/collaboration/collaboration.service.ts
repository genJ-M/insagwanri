import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, MoreThan, IsNull } from 'typeorm';
import { Channel, ChannelType } from '../../database/entities/channel.entity';
import { ChannelMember } from '../../database/entities/channel-member.entity';
import { Message, ContentType } from '../../database/entities/message.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateChannelDto, SendMessageDto, EditMessageDto,
  ReadMessageDto, MessageQueryDto,
} from './dto/collaboration.dto';
import { SocketService } from '../socket/socket.service';

@Injectable()
export class CollaborationService {
  constructor(
    @InjectRepository(Channel)
    private channelRepo: Repository<Channel>,

    @InjectRepository(ChannelMember)
    private memberRepo: Repository<ChannelMember>,

    @InjectRepository(Message)
    private messageRepo: Repository<Message>,

    private dataSource: DataSource,
    private socketService: SocketService,
  ) {}

  // ─────────────────────────────────────────
  // 채널 목록 (참여 중인 채널 + 읽지 않은 수)
  // ─────────────────────────────────────────
  async getChannels(currentUser: AuthenticatedUser) {
    // 참여 중인 채널 id 조회
    const memberships = await this.memberRepo.find({
      where: { userId: currentUser.id },
      select: ['channelId', 'lastReadAt'],
    });

    if (!memberships.length) return [];

    const channelIds = memberships.map(m => m.channelId);
    const lastReadMap = new Map(memberships.map(m => [m.channelId, m.lastReadAt]));

    const channels = await this.channelRepo
      .createQueryBuilder('c')
      .leftJoin('c.creator', 'creator')
      .addSelect(['creator.id', 'creator.name'])
      .where('c.id IN (:...ids)', { ids: channelIds })
      .andWhere('c.deleted_at IS NULL')
      .orderBy('c.created_at', 'ASC')
      .getMany();

    // 각 채널의 마지막 메시지 + 읽지 않은 메시지 수 조회
    const result = await Promise.all(
      channels.map(async (ch) => {
        const lastMessage = await this.messageRepo.findOne({
          where: { channelId: ch.id, deletedAt: IsNull() },
          order: { createdAt: 'DESC' },
          relations: ['user'],
          select: {
            id: true, content: true, createdAt: true,
            user: { id: true, name: true },
          },
        });

        const lastReadAt = lastReadMap.get(ch.id);
        const unreadCount = lastReadAt
          ? await this.messageRepo.count({
              where: {
                channelId: ch.id,
                createdAt: MoreThan(lastReadAt),
                deletedAt: IsNull(),
              },
            })
          : await this.messageRepo.count({
              where: { channelId: ch.id, deletedAt: IsNull() },
            });

        return {
          ...ch,
          unread_count: unreadCount,
          last_message: lastMessage
            ? {
                content: lastMessage.content,
                created_at: lastMessage.createdAt,
                user_name: lastMessage.user?.name,
              }
            : null,
        };
      }),
    );

    return result;
  }

  // ─────────────────────────────────────────
  // 채널 생성
  // ─────────────────────────────────────────
  async createChannel(currentUser: AuthenticatedUser, dto: CreateChannelDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const channel = queryRunner.manager.create(Channel, {
        companyId: currentUser.companyId,
        name:      dto.name,
        type:      dto.type as ChannelType,
        isPrivate: dto.is_private ?? false,
        creatorId: currentUser.id,
      });
      const savedChannel = await queryRunner.manager.save(channel);

      // 생성자를 기본 멤버로 추가
      const memberIds = Array.from(new Set([currentUser.id, ...(dto.member_ids ?? [])]));
      const members = memberIds.map(uid =>
        queryRunner.manager.create(ChannelMember, {
          channelId: savedChannel.id,
          userId: uid,
        }),
      );
      await queryRunner.manager.save(members);

      await queryRunner.commitTransaction();

      return this.channelRepo.findOne({
        where: { id: savedChannel.id },
        relations: ['creator'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─────────────────────────────────────────
  // 메시지 목록 (cursor 기반 페이지네이션)
  // ─────────────────────────────────────────
  async getMessages(
    channelId: string,
    currentUser: AuthenticatedUser,
    query: MessageQueryDto,
  ) {
    await this.assertChannelMember(channelId, currentUser);

    const { before, after, limit } = query;
    const take = Math.min(limit ?? 50, 100);

    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoin('m.user', 'u')
      .addSelect(['u.id', 'u.name', 'u.profileImageUrl'])
      .where('m.channel_id = :channelId', { channelId })
      .andWhere('m.deleted_at IS NULL');

    if (before) {
      const pivot = await this.messageRepo.findOne({ where: { id: before } });
      if (pivot) qb.andWhere('m.created_at < :pivot', { pivot: pivot.createdAt });
      qb.orderBy('m.created_at', 'DESC');
    } else if (after) {
      const pivot = await this.messageRepo.findOne({ where: { id: after } });
      if (pivot) qb.andWhere('m.created_at > :pivot', { pivot: pivot.createdAt });
      qb.orderBy('m.created_at', 'ASC');
    } else {
      qb.orderBy('m.created_at', 'DESC');
    }

    qb.take(take + 1);   // +1로 다음 페이지 존재 여부 확인

    const messages = await qb.getMany();
    const hasMore  = messages.length > take;
    if (hasMore) messages.pop();

    // 최신순 정렬 통일
    messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return {
      messages,
      meta: {
        has_more: hasMore,
        next_cursor: hasMore ? messages[0]?.id : null,
      },
    };
  }

  // ─────────────────────────────────────────
  // 메시지 전송
  // ─────────────────────────────────────────
  async sendMessage(
    channelId: string,
    currentUser: AuthenticatedUser,
    dto: SendMessageDto,
  ) {
    await this.assertChannelMember(channelId, currentUser);

    // announcement 채널: owner, manager만 전송
    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    if (
      channel?.type === ChannelType.ANNOUNCEMENT &&
      currentUser.role === UserRole.EMPLOYEE
    ) {
      throw new ForbiddenException('공지 채널에는 관리자만 메시지를 보낼 수 있습니다.');
    }

    // 스레드 답글 검증
    if (dto.parent_message_id) {
      const parent = await this.messageRepo.findOne({
        where: { id: dto.parent_message_id, channelId },
      });
      if (!parent) throw new NotFoundException('원본 메시지를 찾을 수 없습니다.');
    }

    const message = this.messageRepo.create({
      companyId:       currentUser.companyId,
      channelId,
      userId:          currentUser.id,
      content:         dto.content,
      contentType:     (dto.content_type as ContentType) ?? ContentType.TEXT,
      parentMessageId: dto.parent_message_id ?? null,
      attachmentUrl:   dto.attachment_url ?? null,
      attachmentName:  dto.attachment_name ?? null,
      attachmentSize:  dto.attachment_size ?? null,
    });

    const saved = await this.messageRepo.save(message) as Message;

    const full = await this.messageRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    // DB 저장 성공 후 소켓 이벤트 발행
    this.socketService.emitToChannel(channelId, 'message:new', {
      id:               full!.id,
      channelId:        full!.channelId,
      user: {
        id:             full!.user?.id,
        name:           full!.user?.name,
        profileImageUrl: full!.user?.profileImageUrl,
      },
      content:          full!.content,
      contentType:      full!.contentType,
      attachmentUrl:    full!.attachmentUrl,
      attachmentName:   full!.attachmentName,
      attachmentSize:   full!.attachmentSize,
      parentMessageId:  full!.parentMessageId,
      isEdited:         full!.isEdited,
      createdAt:        full!.createdAt,
    });

    return full;
  }

  // ─────────────────────────────────────────
  // 메시지 수정 (본인만)
  // ─────────────────────────────────────────
  async editMessage(
    channelId: string,
    messageId: string,
    currentUser: AuthenticatedUser,
    dto: EditMessageDto,
  ) {
    const message = await this.messageRepo.findOne({
      where: { id: messageId, channelId, companyId: currentUser.companyId },
    });

    if (!message || message.deletedAt) {
      throw new NotFoundException('메시지를 찾을 수 없습니다.');
    }

    if (message.userId !== currentUser.id) {
      throw new ForbiddenException('본인 메시지만 수정할 수 있습니다.');
    }

    message.content  = dto.content;
    message.isEdited = true;
    message.editedAt = new Date();

    const updated = await this.messageRepo.save(message);

    this.socketService.emitToChannel(channelId, 'message:update', {
      id:        updated.id,
      channelId: updated.channelId,
      content:   updated.content,
      isEdited:  updated.isEdited,
      editedAt:  updated.editedAt,
    });

    return updated;
  }

  // ─────────────────────────────────────────
  // 메시지 삭제 (본인 또는 관리자)
  // ─────────────────────────────────────────
  async deleteMessage(
    channelId: string,
    messageId: string,
    currentUser: AuthenticatedUser,
  ) {
    const message = await this.messageRepo.findOne({
      where: { id: messageId, channelId, companyId: currentUser.companyId },
    });

    if (!message || message.deletedAt) {
      throw new NotFoundException('메시지를 찾을 수 없습니다.');
    }

    const canDelete =
      message.userId === currentUser.id ||
      currentUser.role === UserRole.OWNER ||
      currentUser.role === UserRole.MANAGER;

    if (!canDelete) throw new ForbiddenException('삭제 권한이 없습니다.');

    message.deletedAt = new Date();
    message.content   = '삭제된 메시지입니다.';   // 내용 마스킹
    await this.messageRepo.save(message);

    this.socketService.emitToChannel(channelId, 'message:delete', {
      id:        messageId,
      channelId,
      deletedAt: message.deletedAt,
    });

    return null;
  }

  // ─────────────────────────────────────────
  // 읽음 처리
  // ─────────────────────────────────────────
  async markAsRead(
    channelId: string,
    currentUser: AuthenticatedUser,
    dto: ReadMessageDto,
  ) {
    const member = await this.memberRepo.findOne({
      where: { channelId, userId: currentUser.id },
    });
    if (!member) throw new ForbiddenException('채널 참여자가 아닙니다.');

    const message = await this.messageRepo.findOne({
      where: { id: dto.last_read_message_id, channelId },
    });
    if (!message) throw new NotFoundException('메시지를 찾을 수 없습니다.');

    member.lastReadAt = message.createdAt;
    await this.memberRepo.save(member);

    const unreadCount = await this.messageRepo.count({
      where: {
        channelId,
        createdAt: MoreThan(message.createdAt),
        deletedAt: IsNull(),
      },
    });

    return {
      channel_id:   channelId,
      last_read_at: member.lastReadAt,
      unread_count: unreadCount,
    };
  }

  // ─────────────────────────────────────────
  // 채널 멤버 검증 유틸
  // ─────────────────────────────────────────
  private async assertChannelMember(channelId: string, user: AuthenticatedUser) {
    const member = await this.memberRepo.findOne({
      where: { channelId, userId: user.id },
    });
    if (!member) throw new ForbiddenException('채널 참여자가 아닙니다.');
    return member;
  }
}
