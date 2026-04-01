import {
  Injectable, HttpException, HttpStatus, InternalServerErrorException,
  BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AiRequest, AiFeature, AiRequestStatus, AiRefType } from '../../database/entities/ai-request.entity';
import { Company } from '../../database/entities/company.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  DraftDto, SummarizeDto, AnnouncementDto,
  ScheduleSummaryDto, RefineDto, AiUsageQueryDto,
} from './dto/ai.dto';
import {
  AI_DISCLAIMER, TOKEN_COST, AiResult, OpenAiCallOptions,
} from './ai.types';
import {
  SYSTEM_PROMPTS,
  buildDraftPrompt,
  buildSummarizePrompt,
  buildAnnouncementPrompt,
  buildScheduleSummaryPrompt,
  buildRefinePrompt,
} from './ai.prompts';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(
    @InjectRepository(AiRequest)
    private aiRequestRepo: Repository<AiRequest>,

    @InjectRepository(Company)
    private companyRepo: Repository<Company>,

    private configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
      timeout: parseInt(this.configService.get<string>('OPENAI_TIMEOUT_MS', '30000'), 10),
    });
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o');
  }

  // ─────────────────────────────────────────
  // 1. 업무 문장 작성 (draft)
  // ─────────────────────────────────────────
  async draft(currentUser: AuthenticatedUser, dto: DraftDto): Promise<AiResult> {
    await this.checkRateLimit(currentUser);

    const userPrompt = buildDraftPrompt(
      dto.input_text,
      dto.tone ?? 'formal',
      dto.document_type ?? 'task_instruction',
    );

    return this.callOpenAi(currentUser, AiFeature.DRAFT, dto.input_text, {
      systemPrompt: `${SYSTEM_PROMPTS.BASE}\n\n${SYSTEM_PROMPTS.DRAFT}`,
      userPrompt,
      maxTokens: 800,
      temperature: 0.7,
    }, {
      refType: dto.ref_type as AiRefType,
      refId: dto.ref_id,
    });
  }

  // ─────────────────────────────────────────
  // 2. 업무 보고 요약 (summarize)
  // ─────────────────────────────────────────
  async summarize(currentUser: AuthenticatedUser, dto: SummarizeDto): Promise<AiResult> {
    await this.checkRateLimit(currentUser);

    const userPrompt = buildSummarizePrompt(dto.input_text, dto.format ?? 'bullet');

    return this.callOpenAi(currentUser, AiFeature.SUMMARIZE, dto.input_text, {
      systemPrompt: `${SYSTEM_PROMPTS.BASE}\n\n${SYSTEM_PROMPTS.SUMMARIZE}`,
      userPrompt,
      maxTokens: 600,
      temperature: 0.3,   // 요약은 낮은 temperature — 일관된 출력
    }, {
      refType: dto.task_id ? AiRefType.TASK : dto.report_id ? AiRefType.TASK_REPORT : null,
      refId: dto.task_id ?? dto.report_id ?? null,
    });
  }

  // ─────────────────────────────────────────
  // 3. 공지 메시지 생성 (announcement)
  // ─────────────────────────────────────────
  async generateAnnouncement(
    currentUser: AuthenticatedUser,
    dto: AnnouncementDto,
  ): Promise<AiResult> {
    await this.checkRateLimit(currentUser);

    const userPrompt = buildAnnouncementPrompt(
      dto.input_text,
      dto.tone ?? 'formal',
      dto.announcement_type ?? 'general',
    );

    return this.callOpenAi(currentUser, AiFeature.ANNOUNCEMENT, dto.input_text, {
      systemPrompt: `${SYSTEM_PROMPTS.BASE}\n\n${SYSTEM_PROMPTS.ANNOUNCEMENT}`,
      userPrompt,
      maxTokens: 600,
      temperature: 0.6,
    }, {
      refType: dto.channel_id ? AiRefType.MESSAGE : null,
      refId: dto.channel_id ?? null,
    });
  }

  // ─────────────────────────────────────────
  // 4. 일정 정리 (schedule_summary)
  // ─────────────────────────────────────────
  async summarizeSchedules(
    currentUser: AuthenticatedUser,
    dto: ScheduleSummaryDto,
  ): Promise<AiResult> {
    if (!dto.schedules?.length) {
      throw new BadRequestException('정리할 일정을 1개 이상 입력해주세요.');
    }
    if (dto.schedules.length > 50) {
      throw new BadRequestException('한 번에 최대 50개의 일정만 처리할 수 있습니다.');
    }

    await this.checkRateLimit(currentUser);

    const targetDate = dto.target_date ?? new Date().toISOString().split('T')[0];
    const inputText  = dto.schedules.join('\n');

    const userPrompt = buildScheduleSummaryPrompt(
      dto.schedules,
      targetDate,
      dto.period ?? 'daily',
    );

    return this.callOpenAi(currentUser, AiFeature.SCHEDULE_SUMMARY, inputText, {
      systemPrompt: `${SYSTEM_PROMPTS.BASE}\n\n${SYSTEM_PROMPTS.SCHEDULE_SUMMARY}`,
      userPrompt,
      maxTokens: 800,
      temperature: 0.2,   // 일정 정리는 가장 낮은 temperature — 사실 중심
    });
  }

  // ─────────────────────────────────────────
  // 문장 다듬기 (refine) — 범용
  // ─────────────────────────────────────────
  async refine(currentUser: AuthenticatedUser, dto: RefineDto): Promise<AiResult> {
    await this.checkRateLimit(currentUser);

    const userPrompt = buildRefinePrompt(dto.input_text, dto.tone ?? 'formal');

    return this.callOpenAi(currentUser, AiFeature.REFINE, dto.input_text, {
      systemPrompt: `${SYSTEM_PROMPTS.BASE}\n\n${SYSTEM_PROMPTS.REFINE}`,
      userPrompt,
      maxTokens: 500,
      temperature: 0.5,
    });
  }

  // ─────────────────────────────────────────
  // AI 사용량 조회
  // ─────────────────────────────────────────
  async getUsage(currentUser: AuthenticatedUser, query: AiUsageQueryDto) {
    const now   = new Date();
    const today = now.toISOString().split('T')[0];

    const startDate = query.start_date
      ? new Date(query.start_date)
      : new Date(now.getFullYear(), now.getMonth(), 1); // 이번 달 1일

    const endDate = query.end_date
      ? new Date(query.end_date + 'T23:59:59Z')
      : now;

    const baseWhere: any = {
      companyId: currentUser.companyId,
      status: AiRequestStatus.SUCCESS,
    };

    if (query.user_id && currentUser.role === UserRole.OWNER) {
      baseWhere.userId = query.user_id;
    }

    // 이번 달 전체 사용량
    const monthlyRecords = await this.aiRequestRepo.find({
      where: {
        ...baseWhere,
        createdAt: Between(startDate, endDate),
      },
      select: ['feature', 'totalTokens', 'estimatedCostUsd', 'createdAt'],
    });

    // 오늘 사용량
    const todayStart = new Date(today + 'T00:00:00Z');
    const usedToday  = await this.aiRequestRepo.count({
      where: {
        ...baseWhere,
        createdAt: Between(todayStart, now),
      },
    });

    // 플랜별 일일 제한
    const company = await this.companyRepo.findOne({
      where: { id: currentUser.companyId },
      select: ['plan'],
    });
    const { dailyLimit } = this.getRateLimitByPlan(company?.plan ?? 'free');

    // 기능별 집계
    const breakdown = monthlyRecords.reduce(
      (acc, r) => {
        acc[r.feature] = (acc[r.feature] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalTokens   = monthlyRecords.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
    const totalCostUsd  = monthlyRecords.reduce((s, r) => s + (Number(r.estimatedCostUsd) ?? 0), 0);

    return {
      period: {
        start: startDate.toISOString().split('T')[0],
        end:   endDate.toISOString().split('T')[0],
      },
      plan_limit:       dailyLimit,
      used_today:       usedToday,
      used_this_month:  monthlyRecords.length,
      breakdown,
      total_tokens_used: totalTokens,
      estimated_cost_usd: Math.round(totalCostUsd * 1000000) / 1000000,
    };
  }

  // ─────────────────────────────────────────
  // AI 요청 히스토리 조회
  // ─────────────────────────────────────────
  async getHistory(currentUser: AuthenticatedUser, page = 1, limit = 10) {
    const [records, total] = await this.aiRequestRepo.findAndCount({
      where: {
        companyId: currentUser.companyId,
        userId: currentUser.id,
        status: AiRequestStatus.SUCCESS,
      },
      select: ['id', 'feature', 'outputText', 'totalTokens', 'modelName', 'createdAt'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      records: records.map((r) => ({
        id: r.id,
        feature: r.feature,
        output_text: r.outputText,
        tokens_used: r.totalTokens,
        model_name: r.modelName,
        created_at: r.createdAt,
      })),
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  // ─────────────────────────────────────────
  // OpenAI API 호출 (공통 로직)
  // ─────────────────────────────────────────
  private async callOpenAi(
    currentUser: AuthenticatedUser,
    feature: AiFeature,
    inputText: string,
    options: OpenAiCallOptions,
    refs?: { refType?: AiRefType | null; refId?: string | null },
  ): Promise<AiResult> {
    // DB에 요청 레코드 먼저 생성 (pending 상태)
    const record = this.aiRequestRepo.create({
      companyId:       currentUser.companyId,
      userId:          currentUser.id,
      feature,
      inputText,
      status:          AiRequestStatus.PENDING,
      modelName:       this.model,
      disclaimerShown: true,
      refType:         refs?.refType ?? null,
      refId:           refs?.refId ?? null,
    });
    const savedRecord = await this.aiRequestRepo.save(record) as AiRequest;

    try {
      // OpenAI API 호출
      const response = await this.openai.chat.completions.create({
        model:       this.model,
        max_tokens:  options.maxTokens ?? this.configService.get<number>('OPENAI_MAX_TOKENS', 2000),
        temperature: options.temperature ?? 0.7,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user',   content: options.userPrompt },
        ],
      });

      const outputText       = response.choices[0]?.message?.content?.trim() ?? '';
      const promptTokens     = response.usage?.prompt_tokens ?? 0;
      const completionTokens = response.usage?.completion_tokens ?? 0;
      const totalTokens      = response.usage?.total_tokens ?? 0;

      // 비용 추산
      const estimatedCostUsd =
        promptTokens * TOKEN_COST.INPUT + completionTokens * TOKEN_COST.OUTPUT;

      // DB 업데이트 — success
      await this.aiRequestRepo.update(savedRecord.id, {
        outputText,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
        status: AiRequestStatus.SUCCESS,
      });

      this.logger.log(
        `AI [${feature}] success — tokens: ${totalTokens}, cost: $${estimatedCostUsd.toFixed(6)}`,
      );

      return {
        id:                 savedRecord.id,
        feature,
        output_text:        outputText,
        disclaimer:         AI_DISCLAIMER,       // 면책 문구 항상 포함
        tokens_used:        totalTokens,
        prompt_tokens:      promptTokens,
        completion_tokens:  completionTokens,
        estimated_cost_usd: Math.round(estimatedCostUsd * 1000000) / 1000000,
        model_name:         this.model,
        created_at:         savedRecord.createdAt,
      };
    } catch (error) {
      // DB 업데이트 — failed
      await this.aiRequestRepo.update(savedRecord.id, {
        status:       AiRequestStatus.FAILED,
        errorMessage: error.message,
      });

      this.logger.error(`AI [${feature}] failed: ${error.message}`, error.stack);

      if (error?.status === 429) {
        throw new HttpException('OpenAI API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.', HttpStatus.TOO_MANY_REQUESTS);
      }
      if (error?.status === 401) {
        throw new InternalServerErrorException('AI 서비스 인증 오류가 발생했습니다.');
      }

      throw new InternalServerErrorException('AI 요청 처리 중 오류가 발생했습니다.');
    }
  }

  // ─────────────────────────────────────────
  // 일일 Rate Limit 검사
  // ─────────────────────────────────────────
  private async checkRateLimit(currentUser: AuthenticatedUser) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // ── 1차: 글로벌 일일 토큰 상한선 (전체 테넌트 합산) ────────────────
    const globalDailyTokenLimit = this.configService.get<number>('OPENAI_DAILY_TOKEN_LIMIT', 0);
    if (globalDailyTokenLimit > 0) {
      const globalTokensResult = await this.aiRequestRepo
        .createQueryBuilder('r')
        .select('SUM(r.totalTokens)', 'total')
        .where('r.createdAt >= :todayStart', { todayStart })
        .andWhere('r.status = :status', { status: AiRequestStatus.SUCCESS })
        .getRawOne<{ total: string }>();

      const globalTokensUsed = parseInt(globalTokensResult?.total ?? '0', 10);
      if (globalTokensUsed >= globalDailyTokenLimit) {
        this.logger.warn(
          `[AI] 글로벌 일일 토큰 상한선 도달: ${globalTokensUsed}/${globalDailyTokenLimit}`,
        );
        throw new HttpException(
          'AI 서비스의 일일 사용량 한도에 도달했습니다. 내일 다시 시도해 주세요.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }

    // ── 2차: 테넌트(회사)별 플랜 기반 일일 요청 한도 ─────────────────
    const company = await this.companyRepo.findOne({
      where: { id: currentUser.companyId },
      select: ['plan'],
    });

    const { dailyLimit } = this.getRateLimitByPlan(company?.plan ?? 'free');

    const usedToday = await this.aiRequestRepo.count({
      where: {
        companyId: currentUser.companyId,
        userId:    currentUser.id,
        status:    AiRequestStatus.SUCCESS,
        createdAt: MoreThanOrEqual(todayStart),
      },
    });

    if (usedToday >= dailyLimit) {
      throw new HttpException(
        `오늘의 AI 사용 한도(${dailyLimit}회)에 도달했습니다. 내일 다시 사용하거나 플랜을 업그레이드하세요.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private getRateLimitByPlan(plan: string): { dailyLimit: number } {
    const limits: Record<string, number> = {
      free:       this.configService.get<number>('AI_RATE_LIMIT_FREE', 10),
      basic:      this.configService.get<number>('AI_RATE_LIMIT_BASIC', 50),
      pro:        this.configService.get<number>('AI_RATE_LIMIT_PRO', 200),
      enterprise: 9999,
    };
    return { dailyLimit: limits[plan] ?? 10 };
  }
}
