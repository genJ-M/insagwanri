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
  AttendanceQueryDto, AttendanceReportQueryDto, AuditLogQueryDto,
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
   * GET /api/v1/attendance/audit-log
   * 감사 대비 출퇴근 원본 로그 (owner, manager — 공공기관 특화)
   *
   * Example:
   * GET /api/v1/attendance/audit-log?start_date=2026-01-01&end_date=2026-03-31&user_id=uuid
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get('audit-log')
  async getAuditLog(
    @GetUser() user: AuthenticatedUser,
    @Query() query: AuditLogQueryDto,
  ) {
    const data = await this.attendanceService.getAuditLog(user, query);
    return { success: true, data };
  }

  /**
   * GET /api/v1/attendance/weekly-hours
   * 이번 주 누적 근무시간 (52시간 위젯용) — 전 직원 본인 조회 가능
   */
  @Get('weekly-hours')
  async getWeeklyHours(@GetUser() user: AuthenticatedUser) {
    const data = await this.attendanceService.getWeeklyHours(user);
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

  // ─────────────────────────────────────────────────────────────────────────
  // 사업주 현황판 — :id 라우트보다 반드시 앞에 위치
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/attendance/board
   * 오늘 현황 요약 + 현재 근무 중 직원 (owner/manager)
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get('board')
  async getOwnerBoard(@GetUser() user: AuthenticatedUser) {
    const data = await this.attendanceService.getOwnerBoard(user);
    return { success: true, data };
  }

  /**
   * GET /api/v1/attendance/who-was-there?date=YYYY-MM-DD&time=HH:mm
   * 특정 날짜·시각에 근무 중이었던 직원 조회 (owner/manager)
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get('who-was-there')
  async whoWasThere(
    @GetUser() user: AuthenticatedUser,
    @Query('date') date: string,
    @Query('time') time: string,
  ) {
    const data = await this.attendanceService.whoWasThere(user, date, time);
    return { success: true, data };
  }

  /**
   * GET /api/v1/attendance/trend?days=30
   * 일별 출근 추이 (owner/manager)
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get('trend')
  async getDailyTrend(
    @GetUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    const data = await this.attendanceService.getDailyTrend(user, days ? Number(days) : 30);
    return { success: true, data };
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

  /**
   * GET /api/v1/attendance/wage-report
   * 파트타임 임금 리포트 (기간별 분 단위 임금 계산)
   * - 본인 조회 또는 관리자 타인 조회 가능
   * - 주휴수당 발생 여부 포함
   *
   * Example:
   * GET /api/v1/attendance/wage-report?start_date=2026-04-07&end_date=2026-04-13
   * GET /api/v1/attendance/wage-report?user_id=uuid&start_date=2026-04-01&end_date=2026-04-30
   */
  @Get('wage-report')
  async getWageReport(
    @GetUser() user: AuthenticatedUser,
    @Query('user_id') userId: string | undefined,
    @Query('start_date') startDate: string,
    @Query('end_date')   endDate:   string,
  ) {
    const data = await this.attendanceService.getWageReport(user, {
      user_id:    userId,
      start_date: startDate,
      end_date:   endDate,
    });
    return { success: true, data };
  }
}
