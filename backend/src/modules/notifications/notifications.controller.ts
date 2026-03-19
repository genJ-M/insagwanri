import {
  Controller, Get, Patch, Delete, Post,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';
import {
  NotificationQueryDto,
  UpdateNotificationSettingsDto,
  RegisterDeviceTokenDto,
} from './dto/notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications
   * 인앱 알림 목록 (페이지네이션)
   */
  @Get()
  async findAll(
    @GetUser() user: AuthenticatedUser,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.findAll(user, query);
  }

  /**
   * GET /notifications/unread-count
   * 미읽음 알림 개수
   */
  @Get('unread-count')
  async getUnreadCount(@GetUser() user: AuthenticatedUser) {
    const count = await this.notificationsService.getUnreadCount(user);
    return { count };
  }

  /**
   * GET /notifications/settings
   * 알림 설정 조회
   */
  @Get('settings')
  async getSettings(@GetUser() user: AuthenticatedUser) {
    return this.notificationsService.getSettings(user);
  }

  /**
   * PATCH /notifications/settings
   * 알림 설정 수정
   */
  @Patch('settings')
  async updateSettings(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationsService.updateSettings(user, dto);
  }

  /**
   * PATCH /notifications/read-all
   * 전체 읽음 처리
   */
  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@GetUser() user: AuthenticatedUser) {
    await this.notificationsService.markAllRead(user);
  }

  /**
   * PATCH /notifications/:id/read
   * 단건 읽음 처리
   */
  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.notificationsService.markRead(user, id);
  }

  /**
   * DELETE /notifications/:id
   * 알림 삭제
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.notificationsService.delete(user, id);
  }

  /**
   * POST /notifications/device-token
   * Expo Push Token 등록
   */
  @Post('device-token')
  @HttpCode(HttpStatus.CREATED)
  async registerDeviceToken(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    await this.notificationsService.registerDeviceToken(user, dto);
    return { message: '디바이스 토큰이 등록되었습니다.' };
  }

  /**
   * DELETE /notifications/device-token/:token
   * 토큰 삭제 (로그아웃 시)
   */
  @Delete('device-token/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDeviceToken(
    @GetUser() user: AuthenticatedUser,
    @Param('token') token: string,
  ) {
    await this.notificationsService.removeDeviceToken(user, token);
  }
}
