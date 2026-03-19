import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole, AuthenticatedUser } from '../../common/types/jwt-payload.type';
import {
  CreateScheduleDto, UpdateScheduleDto, DeleteScheduleDto, ScheduleQueryDto,
} from './dto/schedules.dto';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  /**
   * POST /api/v1/schedules
   * 스케줄 생성
   *
   * Example Request (전사 공개 회의):
   * {
   *   "title": "3월 주간 영업 회의",
   *   "location": "2층 회의실 A",
   *   "start_at": "2026-03-16T10:00:00+09:00",
   *   "end_at": "2026-03-16T11:00:00+09:00",
   *   "type": "meeting",
   *   "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO",
   *   "recurrence_end_at": "2026-06-30",
   *   "notify_before_min": 30,
   *   "color": "#4A90E2"
   * }
   *
   * Example Request (개인 휴가):
   * {
   *   "title": "연차",
   *   "start_at": "2026-03-20T00:00:00+09:00",
   *   "end_at": "2026-03-20T23:59:00+09:00",
   *   "is_all_day": true,
   *   "type": "vacation",
   *   "target_user_id": "uuid-user-001"
   * }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSchedule(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: CreateScheduleDto,
  ) {
    const data = await this.schedulesService.createSchedule(user, dto);
    return { success: true, data };
  }

  /**
   * GET /api/v1/schedules
   * 스케줄 목록 (start_date, end_date 필수)
   *
   * Example Request:
   * GET /api/v1/schedules?start_date=2026-03-01&end_date=2026-03-31&type=meeting
   */
  @Get()
  async getSchedules(
    @GetUser() user: AuthenticatedUser,
    @Query() query: ScheduleQueryDto,
  ) {
    const data = await this.schedulesService.getSchedules(user, query);
    return { success: true, data };
  }

  /**
   * GET /api/v1/schedules/:id
   * 스케줄 상세
   */
  @Get(':id')
  async getSchedule(
    @Param('id') id: string,
    @GetUser() user: AuthenticatedUser,
  ) {
    const data = await this.schedulesService.findScheduleById(id, user);
    return { success: true, data };
  }

  /**
   * PATCH /api/v1/schedules/:id
   * 스케줄 수정
   *
   * Example Request:
   * {
   *   "title": "영업 회의 (시간 변경)",
   *   "start_at": "2026-03-16T14:00:00+09:00",
   *   "end_at": "2026-03-16T15:00:00+09:00",
   *   "update_recurrence": "this_and_following"
   * }
   */
  @Patch(':id')
  async updateSchedule(
    @Param('id') id: string,
    @GetUser() user: AuthenticatedUser,
    @Body() dto: UpdateScheduleDto,
  ) {
    const data = await this.schedulesService.updateSchedule(id, user, dto);
    return { success: true, data };
  }

  /**
   * DELETE /api/v1/schedules/:id
   * 스케줄 삭제
   *
   * Example Request:
   * { "delete_recurrence": "this_only" }
   */
  @Delete(':id')
  async deleteSchedule(
    @Param('id') id: string,
    @GetUser() user: AuthenticatedUser,
    @Body() dto: DeleteScheduleDto,
  ) {
    const data = await this.schedulesService.deleteSchedule(id, user, dto);
    return { success: true, data };
  }
}
