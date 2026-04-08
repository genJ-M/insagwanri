import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CollaborationService } from './collaboration.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole, AuthenticatedUser } from '../../common/types/jwt-payload.type';
import {
  CreateChannelDto, SendMessageDto, EditMessageDto,
  ReadMessageDto, MessageQueryDto,
} from './dto/collaboration.dto';

@Controller()
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  /**
   * GET /api/v1/channels
   * 참여 중인 채널 목록 (읽지 않은 메시지 수 포함)
   */
  @Get('channels')
  async getChannels(@GetUser() user: AuthenticatedUser) {
    const data = await this.collaborationService.getChannels(user);
    return { success: true, data };
  }

  /**
   * POST /api/v1/channels
   * 채널 생성 (owner, manager)
   *
   * Example Request (공지 채널):
   * {
   *   "name": "전체 공지",
   *   "type": "announcement",
   *   "is_private": false,
   *   "member_ids": []
   * }
   *
   * Example Request (팀 채널):
   * {
   *   "name": "영업팀",
   *   "type": "general",
   *   "member_ids": ["uuid-user-001", "uuid-user-002"]
   * }
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post('channels')
  @HttpCode(HttpStatus.CREATED)
  async createChannel(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: CreateChannelDto,
  ) {
    const data = await this.collaborationService.createChannel(user, dto);
    return { success: true, data };
  }

  /**
   * GET /api/v1/channels/:channelId/messages
   * 메시지 목록 (cursor 페이지네이션)
   *
   * Example Request:
   * GET /api/v1/channels/uuid-ch-001/messages?limit=50
   * GET /api/v1/channels/uuid-ch-001/messages?before=uuid-msg-050&limit=50
   */
  @Get('channels/:channelId/messages')
  async getMessages(
    @Param('channelId') channelId: string,
    @GetUser() user: AuthenticatedUser,
    @Query() query: MessageQueryDto,
  ) {
    return this.collaborationService.getMessages(channelId, user, query);
  }

  /**
   * POST /api/v1/channels/:channelId/messages
   * 메시지 전송
   *
   * Example Request (일반 메시지):
   * {
   *   "content": "내일 오전 10시 전체 회의 있습니다.",
   *   "content_type": "text"
   * }
   *
   * Example Request (스레드 답글):
   * {
   *   "content": "확인했습니다.",
   *   "parent_message_id": "uuid-msg-001"
   * }
   *
   * Example Request (파일 첨부):
   * {
   *   "content": "자료 공유드립니다.",
   *   "content_type": "file",
   *   "attachment_url": "https://s3.../report.pdf",
   *   "attachment_name": "3월_보고서.pdf",
   *   "attachment_size": 204800
   * }
   */
  @Post('channels/:channelId/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('channelId') channelId: string,
    @GetUser() user: AuthenticatedUser,
    @Body() dto: SendMessageDto,
  ) {
    const data = await this.collaborationService.sendMessage(channelId, user, dto);
    return { success: true, data };
  }

  /**
   * PATCH /api/v1/channels/:channelId/messages/:messageId
   * 메시지 수정 (본인만)
   *
   * Example Request:
   * { "content": "내일 오전 10시 → 오후 2시로 변경되었습니다." }
   */
  @Patch('channels/:channelId/messages/:messageId')
  async editMessage(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @GetUser() user: AuthenticatedUser,
    @Body() dto: EditMessageDto,
  ) {
    const data = await this.collaborationService.editMessage(channelId, messageId, user, dto);
    return { success: true, data };
  }

  /**
   * DELETE /api/v1/channels/:channelId/messages/:messageId
   * 메시지 삭제 (본인 또는 관리자)
   */
  @Delete('channels/:channelId/messages/:messageId')
  async deleteMessage(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @GetUser() user: AuthenticatedUser,
  ) {
    await this.collaborationService.deleteMessage(channelId, messageId, user);
    return { success: true, data: null };
  }

  /**
   * POST /api/v1/channels/:channelId/read
   * 읽음 처리
   */
  @Post('channels/:channelId/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('channelId') channelId: string,
    @GetUser() user: AuthenticatedUser,
    @Body() dto: ReadMessageDto,
  ) {
    const data = await this.collaborationService.markAsRead(channelId, user, dto);
    return { success: true, data };
  }

  /**
   * POST /api/v1/channels/:channelId/messages/:messageId/confirm
   * 공지 메세지 개별 확인 ("확인했습니다" 버튼)
   */
  @Post('channels/:channelId/messages/:messageId/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmMessage(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @GetUser() user: AuthenticatedUser,
  ) {
    const data = await this.collaborationService.confirmMessage(channelId, messageId, user);
    return { success: true, data };
  }

  /**
   * GET /api/v1/channels/:channelId/messages/:messageId/reads
   * 공지 메세지 읽은/안 읽은 사람 목록 (관리자 전용)
   */
  @Get('channels/:channelId/messages/:messageId/reads')
  async getMessageReads(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @GetUser() user: AuthenticatedUser,
  ) {
    const data = await this.collaborationService.getMessageReads(channelId, messageId, user);
    return { success: true, data };
  }

  /**
   * GET /api/v1/channels/unconfirmed-count
   * 내 미확인 공지 수 + 목록 (모바일 홈 배지)
   */
  @Get('channels/unconfirmed-count')
  async getMyUnconfirmedCount(@GetUser() user: AuthenticatedUser) {
    const data = await this.collaborationService.getMyUnconfirmedCount(user);
    return { success: true, data };
  }
}
