import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseIntPipe, HttpCode, HttpStatus,
  DefaultValuePipe,
} from '@nestjs/common';
import { CalendarSettingsService } from './calendar-settings.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, AuthenticatedUser } from '../../common/types/jwt-payload.type';
import {
  CreateRecurringEventDto, UpdateRecurringEventDto,
  SetDepartmentVisibilityDto, ApplyTemplateDto,
} from './dto/calendar-settings.dto';

@Controller('calendar-settings')
export class CalendarSettingsController {
  constructor(private readonly svc: CalendarSettingsService) {}

  // ─── 반복 일정 ────────────────────────────────────────────────────────────

  /** GET /api/v1/calendar-settings/recurring */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get('recurring')
  getRecurring(@GetUser() user: AuthenticatedUser) {
    return this.svc.getRecurringEvents(user);
  }

  /** GET /api/v1/calendar-settings/recurring/upcoming?days=60 */
  @Get('recurring/upcoming')
  getUpcoming(
    @GetUser() user: AuthenticatedUser,
    @Query('days', new DefaultValuePipe(60), ParseIntPipe) days: number,
  ) {
    return this.svc.getUpcomingRecurring(user, days);
  }

  /** POST /api/v1/calendar-settings/recurring */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post('recurring')
  createRecurring(@GetUser() user: AuthenticatedUser, @Body() dto: CreateRecurringEventDto) {
    return this.svc.createRecurringEvent(user, dto);
  }

  /** PATCH /api/v1/calendar-settings/recurring/:id */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Patch('recurring/:id')
  updateRecurring(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringEventDto,
  ) {
    return this.svc.updateRecurringEvent(user, id, dto);
  }

  /** DELETE /api/v1/calendar-settings/recurring/:id */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Delete('recurring/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRecurring(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.deleteRecurringEvent(user, id);
  }

  // ─── 팀 템플릿 ────────────────────────────────────────────────────────────

  /** GET /api/v1/calendar-settings/templates */
  @Get('templates')
  getTemplates() {
    return this.svc.getDeptTemplates();
  }

  /** POST /api/v1/calendar-settings/templates/apply */
  @Roles(UserRole.OWNER)
  @Post('templates/apply')
  applyTemplate(@GetUser() user: AuthenticatedUser, @Body() dto: ApplyTemplateDto) {
    return this.svc.applyTemplate(user, dto);
  }

  // ─── 가시성 설정 ──────────────────────────────────────────────────────────

  /** GET /api/v1/calendar-settings/visibility — 전체 설정 (관리자용) */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get('visibility')
  getVisibility(@GetUser() user: AuthenticatedUser) {
    return this.svc.getVisibility(user);
  }

  /** GET /api/v1/calendar-settings/visibility/my — 내 부서 설정 */
  @Get('visibility/my')
  getMyVisibility(@GetUser() user: AuthenticatedUser) {
    return this.svc.getMyVisibility(user);
  }

  /** PATCH /api/v1/calendar-settings/visibility */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Patch('visibility')
  setVisibility(@GetUser() user: AuthenticatedUser, @Body() dto: SetDepartmentVisibilityDto) {
    return this.svc.setDepartmentVisibility(user, dto);
  }
}
