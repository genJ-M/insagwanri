import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole, AuthenticatedUser } from '../../common/types/jwt-payload.type';
import {
  CreateTaskDto, UpdateTaskDto, CreateReportDto, FeedbackDto, TaskQueryDto,
  RequestTimeAdjustDto, RespondTimeAdjustDto,
} from './dto/tasks.dto';

@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ───────────── Templates ─────────────

  @Get('tasks/templates')
  getTemplates() {
    return { success: true, data: this.tasksService.getTemplates() };
  }

  // ───────────── Tasks ─────────────

  /**
   * POST /api/v1/tasks
   * 업무 생성 (owner, manager)
   *
   * Example Request:
   * {
   *   "title": "3월 영업 현황 보고서 작성",
   *   "description": "3월 한 달간 영업 실적을 정리하여 제출",
   *   "assignee_id": "uuid-user-001",
   *   "priority": "high",
   *   "category": "보고",
   *   "due_date": "2026-03-15"
   * }
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post('tasks')
  @HttpCode(HttpStatus.CREATED)
  async createTask(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: CreateTaskDto,
  ) {
    const data = await this.tasksService.createTask(user, dto);
    return { success: true, data };
  }

  /**
   * GET /api/v1/tasks
   * 업무 목록 (employee: 본인 배정 업무만)
   *
   * Example Request:
   * GET /api/v1/tasks?status=in_progress&priority=high&page=1&limit=20
   */
  @Get('tasks')
  async getTasks(
    @GetUser() user: AuthenticatedUser,
    @Query() query: TaskQueryDto,
  ) {
    return this.tasksService.getTasks(user, query);
  }

  /**
   * GET /api/v1/tasks/:id
   * 업무 상세
   */
  @Get('tasks/:id')
  async getTask(
    @Param('id') id: string,
    @GetUser() user: AuthenticatedUser,
  ) {
    const data = await this.tasksService.findTaskById(id, user);
    return { success: true, data };
  }

  /**
   * PATCH /api/v1/tasks/:id
   * 업무 수정
   * employee: status만 변경 가능 (본인 업무)
   * manager/owner: 모든 필드
   *
   * Example Request:
   * { "status": "review" }
   * { "priority": "urgent", "due_date": "2026-03-14", "assignee_id": "uuid" }
   */
  @Patch('tasks/:id')
  async updateTask(
    @Param('id') id: string,
    @GetUser() user: AuthenticatedUser,
    @Body() dto: UpdateTaskDto,
  ) {
    const data = await this.tasksService.updateTask(id, user, dto);
    return { success: true, data };
  }

  /**
   * DELETE /api/v1/tasks/:id
   * 업무 삭제 (owner, manager) — Soft Delete
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Delete('tasks/:id')
  async deleteTask(
    @Param('id') id: string,
    @GetUser() user: AuthenticatedUser,
  ) {
    const data = await this.tasksService.deleteTask(id, user);
    return { success: true, data };
  }

  /**
   * PATCH /api/v1/tasks/:id/request-deletion
   * 업무 삭제 요청 (관리자 또는 담당자)
   */
  @Patch('tasks/:id/request-deletion')
  async requestDeletion(
    @Param('id') id: string,
    @GetUser() user: AuthenticatedUser,
  ) {
    const data = await this.tasksService.requestDeletion(id, user);
    return { success: true, data };
  }

  /**
   * PATCH /api/v1/tasks/:id/approve-deletion
   * 업무 삭제 승인 (요청자의 반대편)
   */
  @Patch('tasks/:id/approve-deletion')
  async approveDeletion(
    @Param('id') id: string,
    @GetUser() user: AuthenticatedUser,
  ) {
    const data = await this.tasksService.approveDeletion(id, user);
    return { success: true, data };
  }

  // ───────────── Reports ─────────────

  /**
   * POST /api/v1/tasks/:taskId/reports
   * 업무 보고 제출
   *
   * Example Request:
   * POST /api/v1/tasks/uuid-task-001/reports
   * {
   *   "content": "초안 작성을 완료하였습니다. 주요 수치 데이터 정리 중입니다.",
   *   "progress_percent": 60,
   *   "is_ai_assisted": false
   * }
   */
  @Post('tasks/:taskId/reports')
  @HttpCode(HttpStatus.CREATED)
  async createReport(
    @Param('taskId') taskId: string,
    @GetUser() user: AuthenticatedUser,
    @Body() dto: CreateReportDto,
  ) {
    const data = await this.tasksService.createReport(taskId, user, dto);
    return { success: true, data };
  }

  /**
   * GET /api/v1/tasks/:taskId/reports
   * 업무별 보고 목록
   */
  @Get('tasks/:taskId/reports')
  async getReports(
    @Param('taskId') taskId: string,
    @GetUser() user: AuthenticatedUser,
  ) {
    const data = await this.tasksService.getReports(taskId, user);
    return { success: true, data };
  }

  /**
   * PATCH /api/v1/tasks/:taskId/reports/:reportId/feedback
   * 보고 피드백 (owner, manager)
   *
   * Example Request:
   * { "feedback": "수치 데이터 기준을 1월~3월로 수정 필요합니다." }
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Patch('tasks/:taskId/reports/:reportId/feedback')
  async addFeedback(
    @Param('taskId') taskId: string,
    @Param('reportId') reportId: string,
    @GetUser() user: AuthenticatedUser,
    @Body() dto: FeedbackDto,
  ) {
    const data = await this.tasksService.addFeedback(taskId, reportId, user, dto);
    return { success: true, data };
  }

  /**
   * GET /api/v1/reports/me
   * 내 보고 이력 전체
   */
  @Get('reports/me')
  async getMyReports(@GetUser() user: AuthenticatedUser) {
    const data = await this.tasksService.getMyReports(user);
    return { success: true, data };
  }

  // ───────────── 기한 조정 ─────────────

  /**
   * POST /api/v1/tasks/:id/time-adjust-request
   * 담당자: 기한 조정 제안
   */
  @Post('tasks/:id/time-adjust-request')
  async requestTimeAdjust(
    @Param('id') id: string,
    @GetUser() user: AuthenticatedUser,
    @Body() dto: RequestTimeAdjustDto,
  ) {
    const data = await this.tasksService.requestTimeAdjust(id, user, dto);
    return { success: true, data };
  }

  /**
   * PATCH /api/v1/tasks/:id/time-adjust-respond
   * 지시자/관리자: 기한 조정 승인·거절
   */
  @Patch('tasks/:id/time-adjust-respond')
  async respondTimeAdjust(
    @Param('id') id: string,
    @GetUser() user: AuthenticatedUser,
    @Body() dto: RespondTimeAdjustDto,
  ) {
    const data = await this.tasksService.respondTimeAdjust(id, user, dto);
    return { success: true, data };
  }
}
