# 확장 대비 체크리스트

> 작성일: 2026-03-31
> 현재 스택: Render (NestJS + PostgreSQL + Redis) + Vercel (Next.js)
> 기본 방침: 현재 스택 유지, 단계별 확장

---

## 우선순위 1 — 지금 당장 (1~2일)

### Upstash Redis 교체
- Render Redis $10/월 → Upstash 무료~$3/월
- `.env`의 `REDIS_URL`만 교체, 코드 변경 없음
- 가입: upstash.com → Redis DB 생성 → REST URL 복사

### Sentry 에러 트래킹 연동
- 무료 5,000 이벤트/월
- Backend: `@sentry/node` + NestJS 인터셉터
- Frontend: `@sentry/nextjs`
- 실서비스 버그 조기 발견에 필수

### 주요 테이블 인덱스 추가
```sql
-- 사용 빈도 높은 쿼리 기준
CREATE INDEX idx_users_company ON users(company_id, deleted_at);
CREATE INDEX idx_attendance_user_date ON attendances(user_id, work_date);
CREATE INDEX idx_approvals_company_status ON approval_documents(company_id, status);
CREATE INDEX idx_salary_company_month ON salaries(company_id, year, month);
CREATE INDEX idx_vacations_user_status ON vacation_requests(user_id, status);
CREATE INDEX idx_activity_logs_user ON user_activity_logs(user_id, created_at);
```

### DB 백업 자동화 확인
- Render PostgreSQL 자동 백업 주기 확인 (유료 플랜 여부)
- `pg_dump` 스케줄 스크립트 + Cloudflare R2 저장 검토

---

## 우선순위 2 — 500명 도달 전

### 슬로우 쿼리 점검
- `pg_stat_statements` 활성화 (Render PostgreSQL 설정)
- EXPLAIN ANALYZE로 N+1 쿼리 탐지
- TypeORM eager 로딩 남용 여부 점검

### 페이지네이션 전 구간 통일
- 현재 일부 목록 API에 페이지네이션 미적용 가능성
- offset 방식 통일: `?page=1&limit=20`
- 대용량 목록: cursor 방식 전환 검토

### API Rate Limit 세분화
- 현재: 전역 5회/60초 (로그인 전용)
- 추가 필요: 일반 API 100회/분, 파일 업로드 10회/분, AI API 20회/분

### UptimeRobot 설정
- 무료 외부 업타임 모니터링
- 다운 시 이메일/슬랙 알림

---

## 우선순위 3 — 1,000명 도달 전

### Bull Queue 도입 (무거운 작업 비동기화)
- 대상 작업:
  - 급여 일괄 계산
  - 대량 알림 발송 (브로드캐스트)
  - 증명서 PDF 생성
  - 교육 수료 처리 배치
- 패키지: `@nestjs/bull` + Redis (Upstash)

### Railway 이전 검토
- Render 대비 30~50% 비용 절감
- Usage-based 과금 → 업무시간 집중 트래픽에 유리
- 이전 절차: pg_dump → Railway PostgreSQL restore → 환경변수 복붙

### 읽기/쓰기 분리 준비
- TypeORM DataSource 설정에 `replication` 옵션 구조 추가
- 실제 레플리카는 3,000명 이후 추가

### Cloudflare 도입
- DNS를 Cloudflare로 이전
- DDoS 기본 방어 + CDN (정적 파일 캐싱)
- 무료 플랜으로 충분

---

## 우선순위 4 — 3,000명 도달 전

### AWS 이전 계획 수립
- 대상: RDS (PostgreSQL) + ElastiCache (Redis) + EC2 or ECS (NestJS)
- 읽기 레플리카 추가
- VPC 내 Private 통신 구성

### 환경변수 Secret Manager 이전
- Render 환경변수 → AWS SSM Parameter Store or Doppler
- 팀 확장 시 시크릿 관리 체계화

### 모니터링 강화
- Datadog or Grafana Cloud 도입
- DB 커넥션 수, 응답시간 P95, 에러율 대시보드

---

## 우선순위 5 — 5,000명+ / 안정기

### AWS 예약 인스턴스 전환
- On-demand 대비 40% 절감
- 1년 약정 기준

### DB 파티셔닝 검토
- `attendances`, `user_activity_logs` 등 시계열 테이블
- 월별 파티션 (PostgreSQL 네이티브 파티셔닝)

### CDN + 이미지 최적화
- 커버 이미지, 프로필 사진 → Cloudflare Images or imgix
- Next.js Image Optimization과 연동

---

## 비용 추이 참고

| 규모 | 현재(Render) | Railway | AWS |
|------|-------------|---------|-----|
| 100명 | $24/월 | $13/월 | - |
| 1,000명 | $75/월 | $60/월 | - |
| 10,000명 | $415/월 | $285/월 | $200~250/월 |

---

## 지금 당장 실행 가능한 것 요약

```bash
# 1. Upstash Redis 생성 후 환경변수 교체
REDIS_URL=rediss://...@...upstash.io:6379

# 2. Sentry 설치
cd backend && npm install @sentry/node @sentry/profiling-node
cd web && npm install @sentry/nextjs

# 3. 인덱스 migration 파일 생성
npx typeorm migration:create src/database/migrations/AddPerformanceIndexes
```
