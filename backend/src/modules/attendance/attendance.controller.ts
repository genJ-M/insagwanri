import {
  Controller, Post, Get, Patch, Body, Param,
  Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole, AuthenticatedUser } from '../../common/types/jwt-payload.type';
import {
  ClockInDto, ClockOutDto, UpdateAttendanceDto,
  AttendanceQueryDto, AttendanceReportQueryDto,
} from './dto/attendance.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * GET /api/v1/attendance/methods
   * 회사의 출퇴근 방식 설정 조회 (전 직원)
   */
  @Get('methods')
  async getMethods(@GetUser() user: AuthenticatedUser) {
    const data = await this.attendanceService.getAttendanceMethods(user);
    return { success: true, data };
  }

  /**
   * GET /api/v1/attendance/qr-token
   * QR 코드 토큰 발급 (관리자 전용 — 화면에 띄울 값)
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get('qr-token')
  async getQrToken(@GetUser() user: AuthenticatedUser) {
    const data = await this.attendanceService.getQrToken(user);
    return { success: true, data };
  }

  /**
   * POST /api/v1/attendance/clock-in
   * 출근 등록
   *
   * Example Request:
   * POST /api/v1/attendance/clock-in
   * Authorization: Bearer {access_token}
   * {
   *   "latitude": 37.5665,
   *   "longitude": 126.9780
   * }
   */
  @Post('clock-in')
  @HttpCode(HttpStatus.CREATED)
  async clockIn(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: ClockInDto,
  ) {
    const data = await this.attendanceService.clockIn(user, dto);
    return { success: true, data };
  }

  /**
   * POST /api/v1/attendance/clock-out
   * 퇴근 등록
   *
   * Example Request:
   * POST /api/v1/attendance/clock-out
   * Authorization: Bearer {access_token}
   * {
   *   "latitude": 37.5665,
   *   "longitude": 126.9780
   * }
   */
  @Post('clock-out')
  @HttpCode(HttpStatus.OK)
  async clockOut(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: ClockOutDto,
  ) {
    const data = await this.attendanceService.clockOut(user, dto);
    return { success: true, data };
  }

  /**
   * GET /api/v1/attendance
   * 전체 근태 목록 (owner, manager)
   *
   * Example Request:
   * GET /api/v1/attendance?date=2026-03-10&status=late
   * GET /api/v1/attendance?start_date=2026-03-01&end_date=2026-03-31&user_id=uuid
   */
  @Get()
  async getAttendanceList(
    @GetUser() user: AuthenticatedUser,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.attendanceService.getAttendanceList(user, query);
  }

  /**
   * GET /api/v1/attendance/report
   * 월별 근태 리포트 (owner, manager)
   *
   * Example Request:
   * GET /api/v1/attendance/report?year=2026&month=3
   */
  @Get('report')
  async getMonthlyReport(
    @GetUser() user: AuthenticatedUser,
    @Query() query: AttendanceReportQueryDto,
  ) {
    const data = await this.attendanceService.getMonthlyReport(user, query);
    return { success: true, data };
  }

  /**
   * GET /api/v1/attendance/me
   * 내 근태 조회
   *
   * Example Request:
   * GET /api/v1/attendance/me?start_date=2026-03-01&end_date=2026-03-31
   */
  @Get('me')
  async getMyAttendance(
    @GetUser() user: AuthenticatedUser,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.attendanceService.getMyAttendance(user, query);
  }

  /**
   * PATCH /api/v1/attendance/:id
   * 근태 수동 수정 (owner, manager)
   *
   * Example Request:
   * PATCH /api/v1/attendance/uuid-att-001
   * {
   *   "clock_in_at": "2026-03-10T09:00:00+09:00",
   *   "clock_out_at": "2026-03-10T18:00:00+09:00",
   *   "status": "normal",
   *   "note": "시스템 오류로 인한 수동 수정"
   * }
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Patch(':id')
  async updateAttendance(
    @Param('id') id: string,
    @GetUser() user: AuthenticatedUser,
    @Body() dto: UpdateAttendanceDto,
  ) {
    const data = await this.attendanceService.updateAttendance(id, user, dto);
    return { success: true, data };
  }
}
