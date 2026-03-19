import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';

/**
 * 전역 HTTP 예외 필터
 * 모든 예외를 공통 응답 형식으로 변환합니다.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();
    let message: string = exception.message;
    let code: string = this.getErrorCode(status);

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      code = this.getErrorCode(status);
    } else if (typeof exceptionResponse === 'object') {
      const res = exceptionResponse as any;
      // class-validator 유효성 검사 에러 배열 처리
      message = Array.isArray(res.message)
        ? res.message[0]
        : res.message || exception.message;
      code = res.code || this.getErrorCode(status);
    }

    // 서버 에러: 로그 + Sentry 리포트
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} — ${status}: ${message}`,
        exception.stack,
      );
      Sentry.captureException(exception, {
        extra: {
          method: request.method,
          url: request.url,
          statusCode: status,
        },
      });
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }

  private getErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return codes[status] || 'ERROR';
  }
}
