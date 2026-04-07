import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import { ShareRecipientType } from '../../database/entities/calendar-event-share.entity';
import {
  CreateCalendarEventDto, UpdateCalendarEventDto, CalendarQueryDto,
} from './dto/calendar.dto';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

class ShareEventDto {
  @IsEnum(ShareRecipientType)
  recipient_type: ShareRecipientType;

  @IsOptional() @IsUUID()
  recipient_user_id?: string;

  @IsOptional() @IsString()
  recipient_department?: string;

  @IsOptional() @IsString()
  note?: string;
}

class DecideShareRequestDto {
  approve: boolean;
}

@Controller('calendar')
export class CalendarController {
  constructor(private readonly svc: CalendarService) {}

  /** 해당 월 이벤트 목록 (프라이버시 강화) */
  @Get('events')
  getEvents(@CurrentUser() user: AuthenticatedUser, @Query() query: CalendarQueryDto) {
    return this.svc.getEvents(user, query);
  }

  /** 근태 캘린더 데이터 (관리자) */
  @Get('attendance')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getAttendanceCalendar(@CurrentUser() user: AuthenticatedUser, @Query() query: CalendarQueryDto) {
    return this.svc.getAttendanceCalendar(user, query);
  }

  /** 부서 목록 */
  @Get('departments')
  getDepartments(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getDepartments(user);
  }

  /** 이벤트 생성 */
  @Post('events')
  createEvent(@Body() dto: CreateCalendarEventDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.createEvent(dto, user);
  }

  /** 이벤트 수정 */
  @Patch('events/:id')
  updateEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.updateEvent(id, dto, user);
  }

  /** 이벤트 삭제 */
  @Delete('events/:id')
  deleteEvent(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.deleteEvent(id, user);
  }

  // ─── 공유 관련 ─────────────────────────────────────

  /** 이벤트 공유 (개인→유저 / 팀→팀, 팀원은 요청으로) */
  @Post('events/:id/share')
  @HttpCode(HttpStatus.CREATED)
  shareEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShareEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.shareEvent(
      id, user,
      dto.recipient_type,
      dto.recipient_user_id,
      dto.recipient_department,
      dto.note,
    );
  }

  /** 공유 철회 */
  @Delete('events/:id/shares/:shareId')
  revokeShare(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('shareId', ParseUUIDPipe) shareId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.revokeShare(shareId, user);
  }

  /** 이벤트 공유 목록 조회 */
  @Get('events/:id/shares')
  getEventShares(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.getEventShares(id, user);
  }

  /** 팀장: 공유 요청 처리 (승인/거절) */
  @Patch('share-requests/:requestId/decide')
  decideShareRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: DecideShareRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.decideShareRequest(requestId, user, dto.approve);
  }

  /** 팀장: 대기 중인 공유 요청 목록 */
  @Get('share-requests/pending')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getPendingShareRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getPendingShareRequests(user);
  }
}
