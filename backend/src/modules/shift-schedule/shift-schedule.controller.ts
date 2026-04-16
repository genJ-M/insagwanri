import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ShiftScheduleService } from './shift-schedule.service';
import {
  CreateShiftScheduleDto, UpdateShiftScheduleDto, ShiftScheduleQueryDto,
  BulkUpsertAssignmentsDto, UpsertAvailabilityDto, AvailabilityQueryDto,
  CreateHandoverDto, SignHandoverDto, HandoverQueryDto,
} from './dto/shift-schedule.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';

@Controller('shift-schedule')
export class ShiftScheduleController {
  constructor(private readonly svc: ShiftScheduleService) {}

  // ── 근무표 ────────────────────────────────────────────────────────────────
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ShiftScheduleQueryDto) {
    return this.svc.findAll(user, query);
  }

  @Get('team-availability')
  getTeamAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Query('week_start') weekStart: string,
    @Query('department') department?: string,
  ) {
    return this.svc.getTeamAvailability(user, weekStart, department);
  }

  @Get('availability')
  getAvailability(@CurrentUser() user: AuthenticatedUser, @Query() query: AvailabilityQueryDto) {
    return this.svc.getAvailability(user, query);
  }

  /** 내 월간 배정 목록 (발행된 근무표 기준) — :id 보다 앞에 위치 필수 */
  @Get('my-monthly')
  getMyMonthlyAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('month') month: string,
  ) {
    return this.svc.getMyMonthlyAssignments(user, month);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateShiftScheduleDto) {
    return this.svc.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftScheduleDto,
  ) {
    return this.svc.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(user, id);
  }

  @Post(':id/publish')
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.publish(user, id);
  }

  @Post(':id/unpublish')
  unpublish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.unpublish(user, id);
  }

  // ── 근무 배정 ─────────────────────────────────────────────────────────────
  @Post(':id/assignments')
  upsertAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkUpsertAssignmentsDto,
  ) {
    return this.svc.upsertAssignments(user, id, dto);
  }

  @Delete(':id/assignments')
  deleteAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('user_id') userId: string,
    @Query('date') date: string,
  ) {
    return this.svc.deleteAssignment(user, id, userId, date);
  }

  @Post(':id/assignments/:assignmentId/confirm')
  confirmAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.svc.confirmAssignment(user, id, assignmentId);
  }

  @Post(':id/recommend')
  recommend(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.recommend(user, id);
  }

  // ── 가용시간 ──────────────────────────────────────────────────────────────
  @Post('availability')
  upsertAvailability(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertAvailabilityDto) {
    return this.svc.upsertAvailability(user, dto);
  }

  @Delete('availability/:id')
  deleteAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.deleteAvailability(user, id);
  }

  // ── 교대 인수인계 ─────────────────────────────────────────────────────────
  @Get('handovers')
  listHandovers(@CurrentUser() user: AuthenticatedUser, @Query() query: HandoverQueryDto) {
    return this.svc.listHandovers(user, query);
  }

  @Post('handovers')
  createHandover(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateHandoverDto) {
    return this.svc.createHandover(user, dto);
  }

  @Post('handovers/:id/sign-from')
  signHandoverFrom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SignHandoverDto,
  ) {
    return this.svc.signHandoverFrom(user, id, dto);
  }

  @Post('handovers/:id/sign-to')
  signHandoverTo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SignHandoverDto,
  ) {
    return this.svc.signHandoverTo(user, id, dto);
  }
}
