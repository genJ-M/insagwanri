import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { CareWorkerService } from './care-worker.service';
import {
  CreateCareLicenseDto, UpdateCareLicenseDto, LicenseQueryDto,
  StartCareSessionDto, EndCareSessionDto, CareSessionQueryDto,
  HolidayPayQueryDto, UpdateCareWorkerSettingsDto,
} from './dto/care-worker.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';

@Controller('care-worker')
export class CareWorkerController {
  constructor(private readonly svc: CareWorkerService) {}

  // ─── 자격증/면허 ──────────────────────────────────────────────

  @Post('licenses')
  createLicense(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCareLicenseDto,
    @Query('userId') targetUserId?: string,
  ) {
    return this.svc.createLicense(user, dto, targetUserId);
  }

  @Get('licenses')
  listLicenses(@CurrentUser() user: AuthenticatedUser, @Query() query: LicenseQueryDto) {
    return this.svc.listLicenses(user, query);
  }

  @Get('licenses/expiring')
  getExpiringLicenses(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    return this.svc.getExpiringLicenses(user, days ? parseInt(days, 10) : undefined);
  }

  @Patch('licenses/:id')
  updateLicense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCareLicenseDto,
  ) {
    return this.svc.updateLicense(user, id, dto);
  }

  @Delete('licenses/:id')
  deleteLicense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.deleteLicense(user, id);
  }

  // ─── 돌봄 세션 ────────────────────────────────────────────────

  @Post('sessions/start')
  startSession(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartCareSessionDto) {
    return this.svc.startSession(user, dto);
  }

  @Patch('sessions/:id/end')
  endSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndCareSessionDto,
  ) {
    return this.svc.endSession(user, id, dto);
  }

  @Get('sessions')
  getSessions(@CurrentUser() user: AuthenticatedUser, @Query() query: CareSessionQueryDto) {
    return this.svc.getSessions(user, query);
  }

  @Get('sessions/daily-summary')
  getDailySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('userId') userId: string,
    @Query('date')   date:   string,
  ) {
    return this.svc.getDailySummary(user, userId, date);
  }

  // ─── 가산수당 ─────────────────────────────────────────────────

  @Get('holiday-pay')
  getHolidayPayReport(@CurrentUser() user: AuthenticatedUser, @Query() query: HolidayPayQueryDto) {
    return this.svc.getHolidayPayReport(user, query);
  }

  // ─── 피로도 ───────────────────────────────────────────────────

  @Get('fatigue')
  getFatigueStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Query('userId') userId?: string,
  ) {
    return this.svc.getFatigueStatus(user, userId);
  }

  // ─── 설정 ─────────────────────────────────────────────────────

  @Patch('settings')
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateCareWorkerSettingsDto) {
    return this.svc.updateSettings(user, dto);
  }
}
