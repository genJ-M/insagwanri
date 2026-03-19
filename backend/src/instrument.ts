/**
 * Sentry 초기화 — main.ts보다 먼저 import 되어야 합니다.
 * NestJS 앱 부트스트랩 전에 모든 에러를 캡처하기 위함입니다.
 */
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // 환경 태깅 (에러 필터링에 사용)
  environment: process.env.NODE_ENV ?? 'development',

  // 성능 추적: 프로덕션 5%, 개발 100%
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

  // 프로파일링: tracesSampleRate 중 20%만 프로파일
  profilesSampleRate: 0.2,

  integrations: [
    nodeProfilingIntegration(),
  ],

  // 로컬 개발에서는 비활성화 (DSN 없으면 자동으로 꺼짐)
  enabled: !!process.env.SENTRY_DSN,

  // 민감 데이터 제거
  beforeSend(event) {
    // Authorization 헤더 마스킹
    if (event.request?.headers) {
      const headers = event.request.headers as Record<string, string>;
      if (headers['authorization']) {
        headers['authorization'] = '[Filtered]';
      }
    }
    return event;
  },
});
