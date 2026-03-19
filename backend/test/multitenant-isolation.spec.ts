/**
 * 멀티테넌트 격리 통합 테스트
 *
 * 목적: company_id 기반 Row-Level Isolation이 실제로 동작하는지 검증합니다.
 *   - 테넌트 A가 테넌트 B의 데이터를 조회/수정/삭제할 수 없어야 합니다.
 *   - 각 API 엔드포인트에서 company_id 필터가 강제 적용되어야 합니다.
 *
 * 실행: npm run test:integration
 * 요구사항: TEST_DB_* 환경변수 또는 .env.test 파일 (로컬 테스트 DB)
 */

import * as request from 'supertest';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  createTestApp,
  closeTestApp,
  createTestTenant,
  cleanTestTenant,
  getApp,
  TestTenant,
} from './helpers/app.helper';

describe('멀티테넌트 격리 통합 테스트', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let dataSource: DataSource;

  beforeAll(async () => {
    await createTestApp();
    dataSource = getApp().get(getDataSourceToken());
    tenantA = await createTestTenant('owner');
    tenantB = await createTestTenant('employee');
  });

  afterAll(async () => {
    await cleanTestTenant(tenantA.companyId);
    await cleanTestTenant(tenantB.companyId);
    await closeTestApp();
  });

  // ──────────────────────────────────────
  // 출퇴근 기록 격리
  // ──────────────────────────────────────
  describe('출퇴근 기록 (attendance)', () => {
    let recordIdOfB: string;

    beforeAll(async () => {
      // 테넌트 B의 출퇴근 기록을 직접 삽입
      recordIdOfB = uuidv4();
      await dataSource.query(
        `INSERT INTO attendance_records
           (id, company_id, user_id, work_date, status, clock_in_out_of_range, gps_bypassed, is_late, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_DATE, 'normal', false, false, false, NOW(), NOW())`,
        [recordIdOfB, tenantB.companyId, tenantB.userId],
      );
    });

    it('테넌트 A는 자신의 출퇴근 목록만 조회해야 한다', async () => {
      const res = await request(getApp().getHttpServer())
        .get('/api/v1/attendance')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .expect(200);

      const records = res.body.data ?? res.body;
      const leaked = (Array.isArray(records) ? records : []).find(
        (r: any) => r.company_id === tenantB.companyId || r.companyId === tenantB.companyId,
      );
      expect(leaked).toBeUndefined();
    });

    it('테넌트 A 토큰으로 테넌트 B의 기록을 직접 조회하면 404 또는 403이어야 한다', async () => {
      const res = await request(getApp().getHttpServer())
        .get(`/api/v1/attendance/${recordIdOfB}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  // ──────────────────────────────────────
  // 업무 (tasks) 격리
  // ──────────────────────────────────────
  describe('업무 (tasks)', () => {
    let taskIdOfB: string;

    beforeAll(async () => {
      taskIdOfB = uuidv4();
      await dataSource.query(
        `INSERT INTO tasks
           (id, company_id, creator_id, title, status, priority, created_at, updated_at)
         VALUES ($1, $2, $3, '테넌트B 업무', 'todo', 'medium', NOW(), NOW())`,
        [taskIdOfB, tenantB.companyId, tenantB.userId],
      );
    });

    it('테넌트 A 목록에 테넌트 B 업무가 포함되지 않아야 한다', async () => {
      const res = await request(getApp().getHttpServer())
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .expect(200);

      const tasks = res.body.data ?? res.body;
      const leaked = (Array.isArray(tasks) ? tasks : []).find(
        (t: any) => t.id === taskIdOfB,
      );
      expect(leaked).toBeUndefined();
    });

    it('테넌트 A 토큰으로 테넌트 B 업무를 단건 조회하면 404 또는 403이어야 한다', async () => {
      const res = await request(getApp().getHttpServer())
        .get(`/api/v1/tasks/${taskIdOfB}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect([403, 404]).toContain(res.status);
    });

    it('테넌트 A 토큰으로 테넌트 B 업무를 수정하면 실패해야 한다', async () => {
      const res = await request(getApp().getHttpServer())
        .patch(`/api/v1/tasks/${taskIdOfB}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ title: '탈취 시도' });

      expect([403, 404]).toContain(res.status);
    });

    it('테넌트 A 토큰으로 테넌트 B 업무를 삭제하면 실패해야 한다', async () => {
      const res = await request(getApp().getHttpServer())
        .delete(`/api/v1/tasks/${taskIdOfB}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  // ──────────────────────────────────────
  // 팀원 목록 (users) 격리
  // ──────────────────────────────────────
  describe('팀원 목록 (users)', () => {
    it('테넌트 A 팀원 목록에 테넌트 B 사용자가 없어야 한다', async () => {
      const res = await request(getApp().getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .expect(200);

      const users = res.body.data ?? res.body;
      const leaked = (Array.isArray(users) ? users : []).find(
        (u: any) =>
          u.company_id === tenantB.companyId || u.companyId === tenantB.companyId,
      );
      expect(leaked).toBeUndefined();
    });
  });

  // ──────────────────────────────────────
  // 일정 (schedules) 격리
  // ──────────────────────────────────────
  describe('일정 (schedules)', () => {
    let scheduleIdOfB: string;

    beforeAll(async () => {
      scheduleIdOfB = uuidv4();
      await dataSource.query(
        `INSERT INTO schedules
           (id, company_id, creator_id, title, start_at, end_at, is_all_day, created_at, updated_at)
         VALUES ($1, $2, $3, '테넌트B 일정', NOW(), NOW() + INTERVAL '1 hour', false, NOW(), NOW())`,
        [scheduleIdOfB, tenantB.companyId, tenantB.userId],
      );
    });

    it('테넌트 A 일정 목록에 테넌트 B 일정이 없어야 한다', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(getApp().getHttpServer())
        .get(`/api/v1/schedules?start_date=${today}&end_date=${today}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .expect(200);

      const schedules = res.body.data ?? res.body;
      const leaked = (Array.isArray(schedules) ? schedules : []).find(
        (s: any) => s.id === scheduleIdOfB,
      );
      expect(leaked).toBeUndefined();
    });

    it('테넌트 A 토큰으로 테넌트 B 일정을 삭제하면 실패해야 한다', async () => {
      const res = await request(getApp().getHttpServer())
        .delete(`/api/v1/schedules/${scheduleIdOfB}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  // ──────────────────────────────────────
  // 구독 정보 격리
  // ──────────────────────────────────────
  describe('구독 (subscriptions)', () => {
    it('테넌트 A 토큰으로 구독 조회 시 자사 구독만 반환해야 한다', async () => {
      const res = await request(getApp().getHttpServer())
        .get('/api/v1/subscriptions/current')
        .set('Authorization', `Bearer ${tenantA.token}`);

      // 구독이 없으면 404, 있으면 200
      if (res.status === 200) {
        const sub = res.body.data ?? res.body;
        expect(sub.company_id ?? sub.companyId).toBe(tenantA.companyId);
      } else {
        expect(res.status).toBe(404);
      }
    });
  });

  // ──────────────────────────────────────
  // 인증 없이 접근 차단
  // ──────────────────────────────────────
  describe('인증 없이 접근 차단', () => {
    const protectedEndpoints = [
      '/api/v1/attendance',
      '/api/v1/tasks',
      '/api/v1/users',
      '/api/v1/schedules',
    ];

    it.each(protectedEndpoints)(
      '%s — 토큰 없이 접근하면 401이어야 한다',
      async (endpoint) => {
        const res = await request(getApp().getHttpServer()).get(endpoint);
        expect(res.status).toBe(401);
      },
    );
  });
});
