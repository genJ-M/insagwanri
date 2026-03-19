import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

/**
 * HTTP 요청/응답 구조화 로깅 인터셉터
 * 응답 시간, 상태 코드, 경로를 JSON으로 기록합니다.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

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
}
