import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Optional,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { ActivityLogService } from '../../modules/activity-logs/activity-log.service';
import { ActivityAction } from '../../database/entities/user-activity-log.entity';

/** 활동 로그를 DB에 저장하지 않을 경로 패턴 */
const SKIP_LOG_PATHS = ['/api/v1/health', '/favicon.ico', '/_next'];

/**
 * HTTP 요청/응답 구조화 로깅 인터셉터
 *
 * 1. 콘솔(Winston) 로깅 — 모든 요청
 * 2. DB 활동 로그 저장 — 인증된 사용자의 주요 요청 (통신비밀보호법)
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(
    @Optional() private readonly activityLogService?: ActivityLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = req;
    const userAgent = req.headers['user-agent'] ?? '';
    const companyId = (req.user as any)?.companyId ?? '-';
    const userId = (req.user as any)?.id ?? '-';
    const startAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          const ms = Date.now() - startAt;

          this.logger.log({
            message: `${method} ${url} ${res.statusCode} ${ms}ms`,
            method,
            url,
            statusCode: res.statusCode,
            responseTimeMs: ms,
            ip,
            userAgent,
            companyId,
            userId,
          });

          // 통신비밀보호법 — 인증된 사용자 활동 DB 저장 (fire-and-forget)
          this.saveActivityLog({
            userId: userId !== '-' ? userId : null,
            companyId: companyId !== '-' ? companyId : null,
            method,
            url,
            statusCode: res.statusCode,
            ip: ip ?? null,
            userAgent: userAgent as string,
          });
        },
        error: () => {
          const ms = Date.now() - startAt;
          this.logger.warn({
            message: `${method} ${url} ERROR ${ms}ms`,
            method,
            url,
            responseTimeMs: ms,
            ip,
            companyId,
            userId,
          });
        },
      }),
    );
  }

  private saveActivityLog(params: {
    userId: string | null;
    companyId: string | null;
    method: string;
    url: string;
    statusCode: number;
    ip: string | null;
    userAgent: string;
  }) {
    if (!this.activityLogService) return;
    // 헬스체크·정적자산 스킵
    if (SKIP_LOG_PATHS.some((p) => params.url.startsWith(p))) return;
    // 미인증 GET 요청 스킵 (로그인/페이지 방문만 기록)
    if (!params.userId && params.method === 'GET') return;

    this.activityLogService.log({
      userId: params.userId,
      companyId: params.companyId,
      action: ActivityAction.API_CALL,
      ip: params.ip,
      userAgent: params.userAgent,
      path: params.url,
      method: params.method,
      statusCode: params.statusCode,
    });
  }
}
