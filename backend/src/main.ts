// Sentry는 앱 부트스트랩보다 먼저 초기화되어야 합니다
import './instrument';

import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // 부트스트랩 단계 로그를 Winston으로 라우팅
    bufferLogs: true,
  });

  // NestJS 내장 Logger를 Winston으로 교체
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Redis Adapter (Socket.io 멀티서버 — ECS 수평 확장 지원)
  // Redis 연결 실패 시 기본 인메모리 어댑터로 폴백 (개발/테스트 환경 호환)
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const redisIoAdapter = new RedisIoAdapter(app);
  try {
    await redisIoAdapter.connectToRedis(redisUrl);
    app.useWebSocketAdapter(redisIoAdapter);
  } catch (err) {
    const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
    logger.warn(
      `Redis Adapter 연결 실패, 인메모리 어댑터로 폴백: ${(err as Error).message}`,
      'Bootstrap',
    );
  }

  // 보안 헤더 (helmet)
  const isProd = process.env.NODE_ENV === 'production';
  app.use(
    helmet({
      // HSTS: 1년, 서브도메인 포함, preload 등록 가능
      strictTransportSecurity: isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      // CSP: API 서버는 JSON 응답만 하므로 최소한으로 설정
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      // 기타 helmet 기본값 활성화
      // X-Content-Type-Options: nosniff
      // X-Frame-Options: DENY
      // X-XSS-Protection: 0 (모던 브라우저는 비권장)
      // Referrer-Policy: no-referrer
      crossOriginEmbedderPolicy: false, // API 서버는 불필요
    }),
  );

  // API 버전 전역 prefix
  app.setGlobalPrefix('api/v1');

  // CORS 설정
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // 전역 유효성 검사 파이프
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // DTO에 없는 필드 자동 제거
      forbidNonWhitelisted: true, // DTO에 없는 필드 있으면 400 에러
      transform: true,          // 타입 자동 변환 (string → number 등)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);

  app.get(WINSTON_MODULE_NEST_PROVIDER).log(
    `Server running on http://localhost:${port}/api/v1`,
    'Bootstrap',
  );
}

bootstrap();
