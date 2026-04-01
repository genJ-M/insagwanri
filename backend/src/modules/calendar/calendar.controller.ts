import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateCalendarEventDto, UpdateCalendarEventDto, CalendarQueryDto,
} from './dto/calendar.dto';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly svc: CalendarService) {}

  /** 해당 월 이벤트 목록 (권한별 필터) */
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
}
