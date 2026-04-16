import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { FieldVisitsService } from './field-visits.service';
import {
  CreateFieldLocationDto, UpdateFieldLocationDto, FieldLocationQueryDto,
  FieldCheckInDto, FieldCheckOutDto, AddVehicleEventDto,
  FieldVisitQueryDto, UpdateFieldVisitSettingsDto,
} from './dto/field-visits.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';

@Controller('field-visits')
export class FieldVisitsController {
  constructor(private readonly svc: FieldVisitsService) {}

  // ─── 방문지 관리 (manager/owner) ──────────────────────────────────────────

  @Post('locations')
  createLocation(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFieldLocationDto) {
    return this.svc.createLocation(user, dto);
  }

  @Get('locations')
  listLocations(@CurrentUser() user: AuthenticatedUser, @Query() query: FieldLocationQueryDto) {
    return this.svc.listLocations(user, query);
  }

  @Get('locations/:id')
  getLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getLocation(user, id);
  }

  @Patch('locations/:id')
  updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFieldLocationDto,
  ) {
    return this.svc.updateLocation(user, id, dto);
  }

  @Delete('locations/:id')
  deleteLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.deleteLocation(user, id);
  }

  // ─── 현장 체크인 / 체크아웃 ───────────────────────────────────────────────

  @Post('check-in')
  checkIn(@CurrentUser() user: AuthenticatedUser, @Body() dto: FieldCheckInDto) {
    return this.svc.checkIn(user, dto);
  }

  @Patch(':id/check-out')
  checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FieldCheckOutDto,
  ) {
    return this.svc.checkOut(user, id, dto);
  }

  // ─── 차량 이벤트 ─────────────────────────────────────────────────────────

  @Post(':id/vehicle-event')
  addVehicleEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddVehicleEventDto,
  ) {
    return this.svc.addVehicleEvent(user, id, dto);
  }

  // ─── 조회 ─────────────────────────────────────────────────────────────────

  @Get('my')
  getMyVisits(@CurrentUser() user: AuthenticatedUser, @Query() query: FieldVisitQueryDto) {
    return this.svc.getMyVisits(user, query);
  }

  @Get()
  getVisits(@CurrentUser() user: AuthenticatedUser, @Query() query: FieldVisitQueryDto) {
    return this.svc.getVisits(user, query);
  }

  @Get('daily-summary')
  getDailyRouteSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('userId') userId: string,
    @Query('date') date: string,
  ) {
    return this.svc.getDailyRouteSummary(user, userId, date);
  }

  // ─── 설정 ─────────────────────────────────────────────────────────────────

  @Patch('settings')
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateFieldVisitSettingsDto) {
    return this.svc.updateSettings(user, dto);
  }
}
