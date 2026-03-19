import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',

  // 성능 추적: 프로덕션 5%, 개발 100%
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

  // 세션 리플레이: 일반 1%, 에러 발생 시 100% (개인정보 보호 모드)
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,    // 텍스트 전체 마스킹 (개인정보 보호)
      blockAllMedia: true,  // 이미지/비디오 차단
    }),
  ],

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
