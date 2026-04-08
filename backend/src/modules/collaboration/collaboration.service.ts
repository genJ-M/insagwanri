import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, MoreThan, IsNull } from 'typeorm';
import { Channel, ChannelType } from '../../database/entities/channel.entity';
import { ChannelMember } from '../../database/entities/channel-member.entity';
import { Message, ContentType } from '../../database/entities/message.entity';
import { MessageRead } from '../../database/entities/message-read.entity';
import { User } from '../../database/entities/user.entity';
import { Schedule, ScheduleType } from '../../database/entities/schedule.entity';
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

    @InjectRepository(MessageRead)
    private readRepo: Repository<MessageRead>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(Schedule)
    private scheduleRepo: Repository<Schedule>,

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
  // 메시지 목록 (cursor 기반 페이지네이션 + 대상 필터)
  // ─────────────────────────────────────────
  async getMessages(
    channelId: string,
    currentUser: AuthenticatedUser,
    query: MessageQueryDto,
  ) {
    await this.assertChannelMember(channelId, currentUser);

    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    const isAnnouncement = channel?.type === ChannelType.ANNOUNCEMENT;

    // 현재 사용자 부서 조회 (대상 필터링용)
    let myDepartment: string | null = null;
    if (isAnnouncement) {
      const me = await this.userRepo.findOne({ where: { id: currentUser.id }, select: ['department'] });
      myDepartment = me?.department ?? null;
    }

    const { before, after, limit } = query;
    const take = Math.min(limit ?? 50, 100);

    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoin('m.user', 'u')
      .addSelect(['u.id', 'u.name', 'u.profileImageUrl'])
      .where('m.channel_id = :channelId', { channelId })
      .andWhere('m.deleted_at IS NULL');

    // 공지 채널 대상 필터: 본인 발신 메세지는 항상 보임
    if (isAnnouncement) {
      qb.andWhere(
        `(m.user_id = :me
          OR m.target_type = 'all'
          OR (m.target_type = 'department' AND m.target_department = :dept)
          OR (m.target_type = 'custom' AND m.target_user_ids @> :uid::jsonb)
        )`,
        { me: currentUser.id, dept: myDepartment ?? '', uid: JSON.stringify([currentUser.id]) },
      );
    }

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

    qb.take(take + 1);
    const messages = await qb.getMany();
    const hasMore  = messages.length > take;
    if (hasMore) messages.pop();
    messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // 공지 채널: confirmedByMe + 전달률 부착
    if (isAnnouncement && messages.length) {
      const msgIds = messages.map((m) => m.id);

      // 내가 확인한 메세지 ID 셋
      const myReads = await this.readRepo
        .createQueryBuilder('r')
        .where('r.message_id IN (:...ids)', { ids: msgIds })
        .andWhere('r.user_id = :uid', { uid: currentUser.id })
        .getMany();
      const myReadSet = new Set(myReads.map((r) => r.messageId));

      // 메세지별 확인 수 (관리자만 의미 있음)
      const counts = await this.readRepo
        .createQueryBuilder('r')
        .select('r.message_id', 'messageId')
        .addSelect('COUNT(*)', 'cnt')
        .where('r.message_id IN (:...ids)', { ids: msgIds })
        .groupBy('r.message_id')
        .getRawMany() as { messageId: string; cnt: string }[];
      const countMap = new Map(counts.map((c) => [c.messageId, parseInt(c.cnt, 10)]));

      // 채널 멤버 수 (전달률 분모)
      const totalMembers = await this.memberRepo.count({ where: { channelId } });

      const isAdmin = currentUser.role !== UserRole.EMPLOYEE;

      return {
        messages: messages.map((m) => ({
          ...m,
          // BCC 모드이고 발신자가 아닌 경우 수신자 목록 숨김
          targetUserIds: (m.isPrivateRecipients && m.userId !== currentUser.id) ? undefined : m.targetUserIds,
          confirmedByMe:  myReadSet.has(m.id),
          confirmedCount: isAdmin ? (countMap.get(m.id) ?? 0) : undefined,
          totalCount:     isAdmin ? totalMembers : undefined,
        })),
        meta: { has_more: hasMore, next_cursor: hasMore ? messages[0]?.id : null },
      };
    }

    return {
      messages,
      meta: { has_more: hasMore, next_cursor: hasMore ? messages[0]?.id : null },
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

    // 캘린더 이벤트 먼저 생성 (ID가 필요하므로)
    let linkedScheduleId: string | null = null;
    if (dto.schedule_event && channel?.type === ChannelType.ANNOUNCEMENT) {
      const ev = dto.schedule_event;
      const sched = this.scheduleRepo.create({
        companyId:    currentUser.companyId,
        creatorId:    currentUser.id,
        title:        ev.title,
        description:  dto.content.substring(0, 500),
        location:     ev.location ?? null,
        startAt:      new Date(ev.start_at),
        endAt:        new Date(ev.end_at),
        isAllDay:     ev.is_all_day ?? false,
        type:         ScheduleType.GENERAL,
        targetUserId: null, // 공지 대상 범위에 따라 전체 공개
      });
      const savedSched = await this.scheduleRepo.save(sched);
      linkedScheduleId = savedSched.id;
    }

    const message = this.messageRepo.create({
      companyId:            currentUser.companyId,
      channelId,
      userId:               currentUser.id,
      content:              dto.content,
      contentType:          (dto.content_type as ContentType) ?? ContentType.TEXT,
      parentMessageId:      dto.parent_message_id ?? null,
      attachmentUrl:        dto.attachment_url ?? null,
      attachmentName:       dto.attachment_name ?? null,
      attachmentSize:       dto.attachment_size ?? null,
      targetType:           dto.target_type ?? 'all',
      targetDepartment:     dto.target_department ?? null,
      targetUserIds:        dto.target_user_ids ?? null,
      isPrivateRecipients:  dto.is_private_recipients ?? false,
      linkedScheduleId,
    });

    const saved = await this.messageRepo.save(message) as Message;

    const full = await this.messageRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    // DB 저장 성공 후 소켓 이벤트 발행
    this.socketService.emitToChannel(channelId, 'message:new', {
      id:                   full!.id,
      channelId:            full!.channelId,
      user: {
        id:                 full!.user?.id,
        name:               full!.user?.name,
        profileImageUrl:    full!.user?.profileImageUrl,
      },
      content:              full!.content,
      contentType:          full!.contentType,
      attachmentUrl:        full!.attachmentUrl,
      attachmentName:       full!.attachmentName,
      attachmentSize:       full!.attachmentSize,
      parentMessageId:      full!.parentMessageId,
      isEdited:             full!.isEdited,
      targetType:           full!.targetType,
      targetDepartment:     full!.targetDepartment,
      isPrivateRecipients:  full!.isPrivateRecipients,
      linkedScheduleId:     full!.linkedScheduleId,
      createdAt:            full!.createdAt,
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
  // 공지 메세지 개별 확인 (직원 "확인했습니다")
  // ─────────────────────────────────────────
  async confirmMessage(
    channelId: string,
    messageId: string,
    currentUser: AuthenticatedUser,
  ) {
    await this.assertChannelMember(channelId, currentUser);

    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    if (channel?.type !== ChannelType.ANNOUNCEMENT) {
      throw new BadRequestException('공지 채널의 메세지만 개별 확인할 수 있습니다.');
    }

    const message = await this.messageRepo.findOne({
      where: { id: messageId, channelId },
    });
    if (!message || message.deletedAt) throw new NotFoundException('메세지를 찾을 수 없습니다.');

    // 이미 확인한 경우 멱등 처리
    const existing = await this.readRepo.findOne({
      where: { messageId, userId: currentUser.id },
    });
    if (existing) return { message_id: messageId, already_confirmed: true, read_at: existing.readAt };

    const read = this.readRepo.create({ messageId, userId: currentUser.id });
    await this.readRepo.save(read);

    // 소켓으로 관리자에게 실시간 전달률 업데이트
    const total = await this.memberRepo.count({ where: { channelId } });
    const confirmed = await this.readRepo.count({ where: { messageId } });
    this.socketService.emitToChannel(channelId, 'message:confirmed', {
      messageId,
      userId: currentUser.id,
      confirmed,
      total,
    });

    return { message_id: messageId, already_confirmed: false, read_at: read.readAt };
  }

  // ─────────────────────────────────────────
  // 공지 메세지 읽은 사람 목록 (관리자용)
  // ─────────────────────────────────────────
  async getMessageReads(
    channelId: string,
    messageId: string,
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('관리자만 조회할 수 있습니다.');
    }
    await this.assertChannelMember(channelId, currentUser);

    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    if (channel?.type !== ChannelType.ANNOUNCEMENT) {
      throw new BadRequestException('공지 채널만 조회할 수 있습니다.');
    }

    // 채널 전체 멤버
    const members = await this.memberRepo
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.user', 'u')
      .where('m.channel_id = :channelId', { channelId })
      .getMany();

    // 확인한 멤버 ID 셋
    const reads = await this.readRepo.find({ where: { messageId } });
    const readMap = new Map(reads.map((r) => [r.userId, r.readAt]));

    const confirmed   = members.filter((m) => readMap.has(m.userId)).map((m) => ({
      user: { id: m.user.id, name: m.user.name, department: m.user.department },
      read_at: readMap.get(m.userId),
    }));
    const unconfirmed = members.filter((m) => !readMap.has(m.userId)).map((m) => ({
      user: { id: m.user.id, name: m.user.name, department: m.user.department },
    }));

    return {
      message_id:        messageId,
      total_members:     members.length,
      confirmed_count:   confirmed.length,
      unconfirmed_count: unconfirmed.length,
      confirmed,
      unconfirmed,
    };
  }

  // ─────────────────────────────────────────
  // 내 미확인 공지 수 (모바일 홈 배지용)
  // ─────────────────────────────────────────
  async getMyUnconfirmedCount(currentUser: AuthenticatedUser) {
    // 참여 중인 announcement 채널 찾기
    const memberships = await this.memberRepo
      .createQueryBuilder('m')
      .innerJoin('m.channel', 'c')
      .where('m.user_id = :uid', { uid: currentUser.id })
      .andWhere('c.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('c.type = :type', { type: ChannelType.ANNOUNCEMENT })
      .andWhere('c.deleted_at IS NULL')
      .select(['m.channelId'])
      .getMany();

    if (!memberships.length) return { count: 0, announcements: [] };

    const channelIds = memberships.map((m) => m.channelId);

    // 각 채널의 전체 공지 메세지 중 내가 아직 확인 안 한 것
    const unconfirmed = await this.messageRepo
      .createQueryBuilder('msg')
      .leftJoin(
        'message_reads', 'mr',
        'mr.message_id = msg.id AND mr.user_id = :uid',
        { uid: currentUser.id },
      )
      .leftJoin('msg.user', 'u')
      .addSelect(['u.id', 'u.name'])
      .where('msg.channel_id IN (:...channelIds)', { channelIds })
      .andWhere('msg.deleted_at IS NULL')
      .andWhere('mr.message_id IS NULL')  // 미확인 = reads 레코드 없음
      .orderBy('msg.created_at', 'DESC')
      .limit(10)
      .getMany();

    return {
      count:         unconfirmed.length,
      announcements: unconfirmed.map((m) => ({
        id:         m.id,
        channelId:  m.channelId,
        content:    m.content.substring(0, 100),
        createdAt:  m.createdAt,
        senderName: (m as any).user?.name ?? '',
      })),
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
