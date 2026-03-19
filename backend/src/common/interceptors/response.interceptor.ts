import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 전역 응답 인터셉터
 * 컨트롤러에서 이미 { success, data } 형식으로 반환하면 그대로 통과합니다.
 * 단순 객체/배열을 반환하면 자동으로 래핑합니다.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // 컨트롤러에서 이미 success 필드를 포함한 경우 그대로 반환
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
