import {
  Controller, Post, Get, Body, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole, AuthenticatedUser } from '../../common/types/jwt-payload.type';
import {
  DraftDto, SummarizeDto, AnnouncementDto,
  ScheduleSummaryDto, RefineDto, AiUsageQueryDto, AiHistoryQueryDto,
} from './dto/ai.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * POST /api/v1/ai/draft
   * 업무 문장 작성
   *
   * ─── Request Example ───────────────────────────────
   * POST /api/v1/ai/draft
   * Authorization: Bearer {access_token}
   * Content-Type: application/json
   *
   * {
   *   "input_text": "김철수에게 3월 15일까지 영업 보고서 작성 요청",
   *   "tone": "formal",
   *   "document_type": "task_instruction",
   *   "ref_id": "uuid-task-001",
   *   "ref_type": "task"
   * }
   *
   * ─── Response Example ──────────────────────────────
   * {
   *   "success": true,
   *   "data": {
   *     "id": "uuid-ai-001",
   *     "feature": "draft",
   *     "output_text": "안녕하세요, 김철수 님.\n\n3월 영업 현황 보고서 작성을 요청드립니다.\n\n[제출 기한] 2026년 3월 15일(일요일)까지\n[보고 내용] 3월 한 달간 영업 실적 및 주요 활동 내역\n\n기한 내 제출 부탁드립니다. 문의 사항은 언제든지 말씀해 주세요.\n\n감사합니다.",
   *     "disclaimer": "※ AI가 생성한 내용입니다. 정확하지 않을 수 있으므로 검토 후 사용하시기 바랍니다.",
   *     "tokens_used": 285,
   *     "prompt_tokens": 180,
   *     "completion_tokens": 105,
   *     "estimated_cost_usd": 0.002475,
   *     "model_name": "gpt-4o",
   *     "created_at": "2026-03-10T09:00:00Z"
   *   }
   * }
   */
  @Post('draft')
  @HttpCode(HttpStatus.OK)
  async draft(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: DraftDto,
  ) {
    const data = await this.aiService.draft(user, dto);
    return { success: true, data };
  }

  /**
   * POST /api/v1/ai/summarize
   * 업무 보고 요약
   *
   * ─── Request Example ───────────────────────────────
   * {
   *   "input_text": "오늘 오전에는 거래처 A사와 미팅을 진행하였습니다. 주요 내용으로는 신규 계약 건에 대한 조건 협의가 있었으며 단가 조정 요청이 있었습니다. 오후에는 내부 보고서 초안을 작성하였고 팀장님 검토 후 최종 수정 예정입니다. 또한 B사 이메일 문의에 대한 회신을 완료하였습니다.",
   *   "format": "bullet",
   *   "task_id": "uuid-task-001"
   * }
   *
   * ─── Response Example ──────────────────────────────
   * {
   *   "success": true,
   *   "data": {
   *     "id": "uuid-ai-002",
   *     "feature": "summarize",
   *     "output_text": "- A사 미팅: 신규 계약 조건 협의 진행, 단가 조정 요청 접수\n- 내부 보고서 초안 작성 완료 → 팀장 검토 후 최종 수정 예정\n- B사 이메일 문의 회신 완료",
   *     "disclaimer": "※ AI가 생성한 내용입니다. 정확하지 않을 수 있으므로 검토 후 사용하시기 바랍니다.",
   *     "tokens_used": 312,
   *     ...
   *   }
   * }
   */
  @Post('summarize')
  @HttpCode(HttpStatus.OK)
  async summarize(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: SummarizeDto,
  ) {
    const data = await this.aiService.summarize(user, dto);
    return { success: true, data };
  }

  /**
   * POST /api/v1/ai/announcement
   * 공지 메시지 생성
   *
   * ─── Request Example (회의 공지) ───────────────────
   * {
   *   "input_text": "3월 16일 월요일 오전 10시, 2층 회의실에서 전체 주간 회의",
   *   "tone": "formal",
   *   "announcement_type": "meeting",
   *   "channel_id": "uuid-ch-001"
   * }
   *
   * ─── Response Example ──────────────────────────────
   * {
   *   "success": true,
   *   "data": {
   *     "id": "uuid-ai-003",
   *     "feature": "announcement",
   *     "output_text": "안녕하세요.\n\n3월 주간 전체 회의 일정을 안내드립니다.\n\n■ 일시: 2026년 3월 16일(월) 오전 10:00\n■ 장소: 2층 회의실\n■ 대상: 전 직원\n\n원활한 회의 진행을 위해 시간 내 참석 부탁드립니다.\n문의 사항은 담당자에게 연락 주시기 바랍니다.\n\n감사합니다.",
   *     "disclaimer": "※ AI가 생성한 내용입니다. 정확하지 않을 수 있으므로 검토 후 사용하시기 바랍니다.",
   *     "tokens_used": 290,
   *     ...
   *   }
   * }
   *
   * ─── Request Example (긴급 공지) ───────────────────
   * {
   *   "input_text": "오늘 오후 3시 이후 사무실 인터넷 공사, 재택 또는 모바일로 업무",
   *   "announcement_type": "urgent"
   * }
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post('announcement')
  @HttpCode(HttpStatus.OK)
  async generateAnnouncement(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: AnnouncementDto,
  ) {
    const data = await this.aiService.generateAnnouncement(user, dto);
    return { success: true, data };
  }

  /**
   * POST /api/v1/ai/schedule-summary
   * 일정 정리
   *
   * ─── Request Example ───────────────────────────────
   * {
   *   "schedules": [
   *     "오후 2시 - 오후 3시: A사 미팅 (강남구 역삼동)",
   *     "오전 10시 - 오전 11시: 주간 팀 회의 (2층 회의실)",
   *     "오후 4시 - 오후 5시: B사 계약 검토",
   *     "오전 9시 - 오전 10시: 출근 전 개인 업무"
   *   ],
   *   "target_date": "2026-03-16",
   *   "period": "daily"
   * }
   *
   * ─── Response Example ──────────────────────────────
   * {
   *   "success": true,
   *   "data": {
   *     "id": "uuid-ai-004",
   *     "feature": "schedule_summary",
   *     "output_text": "📅 2026년 3월 16일 (월) 일정\n\n09:00 - 10:00 | 출근 전 개인 업무\n10:00 - 11:00 | 주간 팀 회의 | 2층 회의실\n14:00 - 15:00 | A사 미팅 | 강남구 역삼동\n16:00 - 17:00 | B사 계약 검토",
   *     "disclaimer": "※ AI가 생성한 내용입니다. 정확하지 않을 수 있으므로 검토 후 사용하시기 바랍니다.",
   *     "tokens_used": 340,
   *     ...
   *   }
   * }
   */
  @Post('schedule-summary')
  @HttpCode(HttpStatus.OK)
  async summarizeSchedules(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: ScheduleSummaryDto,
  ) {
    const data = await this.aiService.summarizeSchedules(user, dto);
    return { success: true, data };
  }

  /**
   * POST /api/v1/ai/refine
   * 문장 다듬기 (범용)
   *
   * ─── Request Example ───────────────────────────────
   * {
   *   "input_text": "오늘 거래처 만났는데 가격 좀 낮춰달라고 해서 검토해보기로 함",
   *   "tone": "formal"
   * }
   *
   * ─── Response Example ──────────────────────────────
   * {
   *   "success": true,
   *   "data": {
   *     "id": "uuid-ai-005",
   *     "feature": "refine",
   *     "output_text": "오늘 거래처와의 미팅에서 단가 인하 요청이 있었으며, 내부 검토 후 회신하기로 하였습니다.",
   *     "disclaimer": "※ AI가 생성한 내용입니다. 정확하지 않을 수 있으므로 검토 후 사용하시기 바랍니다.",
   *     "tokens_used": 180,
   *     ...
   *   }
   * }
   */
  @Post('refine')
  @HttpCode(HttpStatus.OK)
  async refine(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: RefineDto,
  ) {
    const data = await this.aiService.refine(user, dto);
    return { success: true, data };
  }

  /**
   * GET /api/v1/ai/usage
   * AI 사용량 조회 (owner, manager)
   *
   * ─── Request Example ───────────────────────────────
   * GET /api/v1/ai/usage
   * GET /api/v1/ai/usage?start_date=2026-03-01&end_date=2026-03-31
   * GET /api/v1/ai/usage?user_id=uuid-user-001    (owner만)
   *
   * ─── Response Example ──────────────────────────────
   * {
   *   "success": true,
   *   "data": {
   *     "period": { "start": "2026-03-01", "end": "2026-03-31" },
   *     "plan_limit": 50,
   *     "used_today": 3,
   *     "used_this_month": 28,
   *     "breakdown": {
   *       "summarize": 15,
   *       "draft": 8,
   *       "refine": 5
   *     },
   *     "total_tokens_used": 12480,
   *     "estimated_cost_usd": 0.124000
   *   }
   * }
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get('usage')
  async getUsage(
    @GetUser() user: AuthenticatedUser,
    @Query() query: AiUsageQueryDto,
  ) {
    const data = await this.aiService.getUsage(user, query);
    return { success: true, data };
  }

  /**
   * GET /api/v1/ai/history
   * 내 AI 요청 히스토리 조회
   *
   * ─── Request Example ───────────────────────────────
   * GET /api/v1/ai/history?page=1&limit=10
   *
   * ─── Response Example ──────────────────────────────
   * {
   *   "success": true,
   *   "data": {
   *     "records": [
   *       {
   *         "id": "uuid-ai-001",
   *         "feature": "draft",
   *         "output_text": "안녕하세요...",
   *         "tokens_used": 285,
   *         "model_name": "gpt-4o",
   *         "created_at": "2026-03-10T09:00:00Z"
   *       }
   *     ],
   *     "total": 42,
   *     "page": 1,
   *     "limit": 10,
   *     "total_pages": 5
   *   }
   * }
   */
  @Get('history')
  async getHistory(
    @GetUser() user: AuthenticatedUser,
    @Query() query: AiHistoryQueryDto,
  ) {
    const data = await this.aiService.getHistory(user, query.page, query.limit);
    return { success: true, data };
  }
}
