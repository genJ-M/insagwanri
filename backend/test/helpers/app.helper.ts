import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { v4 as uuidv4 } from 'uuid';

export interface TestTenant {
  companyId: string;
  userId: string;
  token: string;
}

let app: INestApplication;
let dataSource: DataSource;
let jwtService: JwtService;
let configService: ConfigService;

/**
 * 통합 테스트용 NestJS 앱을 부트스트랩합니다.
 * 테스트 DB는 환경변수 TEST_DB_* 또는 .env.test 에서 로드됩니다.
 */
export async function createTestApp(): Promise<INestApplication> {
  process.env.NODE_ENV = 'test';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api/v1');
  await app.init();

  // { strict: false } — 모듈 스코프에 관계없이 어느 프로바이더든 조회 가능
  dataSource = app.get(getDataSourceToken(), { strict: false });
  jwtService = app.get(JwtService, { strict: false });
  configService = app.get(ConfigService, { strict: false });

  return app;
}

export async function closeTestApp(): Promise<void> {
  if (app) await app.close();
}

/**
 * 테스트용 테넌트(회사 + 사용자)를 DB에 직접 삽입하고
 * 해당 사용자의 JWT 액세스 토큰을 반환합니다.
 */
export async function createTestTenant(
  role: string = 'employee',
): Promise<TestTenant> {
  const companyId = uuidv4();
  const userId = uuidv4();

  // 회사 삽입
  await dataSource.query(
    `INSERT INTO companies (id, name, status, plan, created_at, updated_at)
     VALUES ($1, $2, 'active', 'free', NOW(), NOW())`,
    [companyId, `테스트회사_${companyId.slice(0, 8)}`],
  );

  // 사용자 삽입
  await dataSource.query(
    `INSERT INTO users (id, company_id, email, password_hash, name, role, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'hashed', $4, $5, 'active', NOW(), NOW())`,
    [userId, companyId, `user_${userId.slice(0, 8)}@test.com`, `TestUser_${userId.slice(0, 8)}`, role],
  );

  // JWT 생성
  const token = await jwtService.signAsync(
    { sub: userId, companyId, role, email: `user_${userId.slice(0, 8)}@test.com` },
    {
      secret: configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '1h',
    },
  );

  return { companyId, userId, token };
}

/**
 * 테스트 종료 후 삽입한 테넌트 데이터를 정리합니다.
 */
export async function cleanTestTenant(companyId: string): Promise<void> {
  // 연관 데이터를 역순으로 삭제
  const tables = [
    'attendance_records',
    'tasks',
    'schedules',
    'messages',
    'channel_members',
    'channels',
    'notifications',
    'device_tokens',
    'notification_settings',
    'ai_requests',
    'files',
    'users',
    'companies',
  ];

  for (const table of tables) {
    await dataSource.query(
      `DELETE FROM ${table} WHERE company_id = $1`,
      [companyId],
    ).catch(() => {
      // company_id 컬럼이 없는 테이블은 무시
    });
  }
}

export function getApp(): INestApplication {
  return app;
}
