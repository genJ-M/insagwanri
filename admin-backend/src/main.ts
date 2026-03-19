import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const isProd = process.env.NODE_ENV === 'production';

  // 보안 헤더
  app.use(
    helmet({
      strictTransportSecurity: isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // IP 화이트리스트 (프로덕션: VPN 내부망만 허용)
  if (isProd) {
    const allowedIps = (process.env.ADMIN_ALLOWED_IPS || '').split(',').map((ip) => ip.trim()).filter(Boolean);

    app.use((req: any, res: any, next: any) => {
      const clientIp = req.ip || req.headers['x-forwarded-for'];
      const ip = Array.isArray(clientIp) ? clientIp[0] : clientIp?.split(',')[0]?.trim();

      if (allowedIps.length > 0 && !allowedIps.includes(ip)) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
      next();
    });
  }

  // Global prefix
  app.setGlobalPrefix('admin/v1');

  // CORS — Admin은 Admin Web 도메인만 허용
  app.enableCors({
    origin: process.env.ADMIN_FRONTEND_URL || 'http://localhost:4000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // 전역 유효성 검사
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.ADMIN_PORT || 4001;
  await app.listen(port);

  console.log(`Admin Backend running on http://localhost:${port}/admin/v1`);
}

bootstrap();
