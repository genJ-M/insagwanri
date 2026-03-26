# 서비스 완성을 위한 잔여 작업 목록

> 작성일: 2026-03-11
> 최종 업데이트: 2026-03-26 (안정성 점검 + 교육 관리 + Admin 미구현 기능 구현)
> 참조 문서: `saas-design.md`, `admin-system-design.md`, `infra/ARCHITECTURE.md`
> 상세 디자인 스펙: `docs/reference-design-analysis.md`

## 완료 표기 규칙
- `[DONE]` : 코드 구현 완료 + 프로덕션 정상 동작 확인.
- `[CODE]` : 코드 작성 완료, 프로덕션 동작 미검증.
- `[ ]`    : 미완료. 작업 필요.
- `[~]`    : 부분 완료. 추가 작업 필요.
- `[MANUAL]` : 코드 외 수동 작업 필요 (콘솔/계약/법무 등).

> ⚠️ **중요**: 섹션 2~7의 항목들은 코드가 작성된 상태(CODE)이며,
> 프로덕션에서 실제 동작 검증은 섹션 0의 환경 셋업 완료 후 순차적으로 진행 필요.

---

## 0. 프로덕션 환경 셋업

### 0-1. 배포 인프라

| 항목 | 상태 | 비고 |
|------|------|------|
| Vercel 프론트엔드 배포 | [DONE] | `insagwanri-nine.vercel.app` |
| Tailwind CSS 빌드 (postcss.config.js) | [DONE] | 누락으로 스타일 미적용 → 수정 완료 |
| API URL 폴백 (`localhost` → `/api/v1`) | [DONE] | 수정 완료 |
| Vercel → Render 프록시 rewrite | [DONE] | `vercel.json` rewrites |
| Render 백엔드 배포 (health 응답) | [DONE] | `insagwanri-backend.onrender.com` |
| DB 연결 (health에서 database:up 확인) | [DONE] | Render PostgreSQL |

### 0-2. Render 환경변수 설정 ← 완료

| 환경변수 | 값 | 상태 |
|----------|-----|------|
| `NODE_ENV` | `production` | [DONE] |
| `PORT` | `3001` | [DONE] |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` | Render PostgreSQL | [DONE] |
| `REDIS_URL` | Render 내부 Redis URL | [DONE] |
| `JWT_ACCESS_SECRET` | 랜덤 64자 이상 문자열 | [DONE] |
| `JWT_REFRESH_SECRET` | 랜덤 64자 이상 문자열 (ACCESS와 다르게) | [DONE] |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | [DONE] |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | [DONE] |
| `FRONTEND_URL` | `https://insagwanri-nine.vercel.app` | [DONE] |
| `ALLOWED_ORIGINS` | CORS 허용 Origin | [DONE] |
| `RESEND_API_KEY` | Resend 대시보드에서 발급 | [DONE] |
| `EMAIL_FROM` | noreply 주소 | [DONE] |
| `OPENAI_API_KEY` | OpenAI 대시보드에서 발급 | [DONE] |
| `OPENAI_MODEL` | 사용 모델 | [DONE] |
| `OPENAI_MAX_TOKENS` | 최대 토큰 수 | [DONE] |
| `OPENAI_TIMEOUT_MS` | 타임아웃 | [DONE] |
| `AI_RATE_LIMIT_FREE` / `AI_RATE_LIMIT_BASIC` / `AI_RATE_LIMIT_PRO` | 플랜별 AI 한도 | [DONE] |
| `AWS_REGION` / `AWS_S3_BUCKET` / `AWS_S3_PUBLIC_BUCKET` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_ENDPOINT` | R2 설정값 | [DONE] |

### 0-3. DB 마이그레이션 실행

| 항목 | 상태 | 비고 |
|------|------|------|
| Render에서 migration:run 실행 | [ ] | Render Shell: `npm run migration:run` |
| 마스터 데이터 시드 실행 | [ ] | 초기 플랜/권한 데이터 |
| salary 테이블 마이그레이션 | [ ] | `1741910405000-CreateSalaryTable` |
| hr_notes 테이블 마이그레이션 | [ ] | `1741910406000-CreateHrNotesTable` |
| vacation 테이블 마이그레이션 | [ ] | `1741910408000-CreateVacationTables` |
| approvals 테이블 마이그레이션 | [ ] | `1741910409000-CreateApprovalsTables` |
| contracts 테이블 마이그레이션 | [ ] | `1741910410000-CreateContractsTable` |
| calendar_events 테이블 마이그레이션 | [ ] | `1741910411000-CreateCalendarEventsTable` |
| evaluation 테이블 마이그레이션 | [ ] | `1741910412000-CreateEvaluationTables` |
| user_careers/educations/documents 테이블 마이그레이션 | [ ] | `1741910413000-CreateUserProfileTables` |
| 브랜딩 컬럼 마이그레이션 | [ ] | `1741910414000-AddBrandingColumns` |
| training 테이블 마이그레이션 | [ ] | `1741910415000-CreateTrainingTables` |

### 0-4. E2E 동작 검증 (환경변수 + 마이그레이션 후)

| 항목 | 상태 |
|------|------|
| 회원가입 → 이메일 인증 → 로그인 | [ ] |
| 온보딩 플랜 선택 | [ ] |
| 대시보드 진입 | [ ] |
| 직원 초대 | [ ] |
| 출퇴근 기록 | [ ] |
| 로그아웃 / 토큰 갱신 | [ ] |

---

## 1. 설계 완료 현황

| 영역 | 상태 | 파일 |
|------|------|------|
| Customer 도메인 DB 설계 | [DONE] | saas-design.md |
| Customer REST API 명세 | [DONE] | saas-design.md |
| Customer 권한 구조 (RBAC) | [DONE] | saas-design.md |
| AI 정책 및 면책 문구 | [DONE] | saas-design.md |
| Admin 아키텍처 | [DONE] | admin-system-design.md |
| Admin DB 설계 (결제/구독/세무) | [DONE] | admin-system-design.md |
| Feature Flags 시스템 | [DONE] | admin-system-design.md |
| 결제/Dunning/세무 로직 | [DONE] | admin-system-design.md |
| Admin REST API 명세 | [DONE] | admin-system-design.md |
| Admin Dashboard UI 화면 설계 | [DONE] | admin-system-design.md |
| AWS 인프라 구조 | [DONE] | infra/ARCHITECTURE.md |
| Socket.io 이벤트 명세 | [DONE] | docs/realtime-event-spec.md |
| 알림 시스템 설계 (트리거/큐/이메일) | [DONE] | docs/notification-system-spec.md |
| 셀프서브 온보딩 플로우 | [DONE] | docs/onboarding-flow-spec.md |
| 파일 업로드 전략 (S3 Presigned URL) | [DONE] | docs/file-upload-spec.md |
| GPS 출퇴근 검증 정책 | [DONE] | docs/gps-attendance-spec.md |
| Customer Web 화면 설계 | [DONE] | docs/screen-design-spec.md |
| 플랜 변경 일할 정산 로직 | [DONE] | docs/onboarding-flow-spec.md §9 |

---

## 2. Customer 서비스 — 코드 완성 현황

> [CODE] = 코드 작성 완료, 프로덕션 검증 필요 / [DONE] = 프로덕션 동작 확인

### Backend 모듈

| 모듈 | 상태 | 검증 필요 항목 |
|------|------|--------------|
| auth | [CODE] | 회원가입/로그인/토큰갱신/로그아웃 |
| attendance | [CODE] | 출퇴근 기록/조회 |
| tasks | [CODE] | 업무 CRUD |
| schedules | [CODE] | 일정 CRUD, rrule 반복 |
| collaboration | [CODE] | 채팅/메시지 |
| ai | [CODE] | OpenAI 연동 — OPENAI_API_KEY 필요 |
| users | [CODE] | 직원 초대/관리 |
| workspace | [CODE] | 워크스페이스 설정 |
| files | [CODE] | S3/R2 업로드 — AWS 환경변수 필요 |
| notifications | [CODE] | 이메일 알림 — RESEND_API_KEY 필요 |
| socket | [CODE] | 실시간 이벤트 — REDIS_URL 필요 |
| subscriptions | [CODE] | 구독/플랜 |
| salary | [CODE] | 급여 CRUD, 4대보험 자동계산, 상태전환 |
| hr-notes | [CODE] | 인사노트 CRUD, 비공개 권한 제어 |
| vacations | [CODE] | 연차 관리, 신청/승인 워크플로우 |
| approvals | [CODE] | 전자결재, 결재선 단계 처리 |
| contracts | [CODE] | 계약 관리, 만료 감지 |
| calendar | [CODE] | 이벤트 캘린더, 범위별 권한 |
| evaluations | [CODE] | 인사평가 사이클, 3단계 프라이버시 |
| users (org-stats) | [CODE] | GET /users/org-stats — 조직 통계 |
| training | [CODE] | 교육 관리, 수강 등록/수료 워크플로우 |

### Frontend — Customer Web

| 페이지 | 상태 |
|--------|------|
| /login, /register | [CODE] |
| /invite | [CODE] |
| / (대시보드) | [CODE] — 실시간 출퇴근, 팀 현황 아바타, D-day 업무 |
| /attendance | [CODE] — 3탭: 내 근태/오늘 현황/팀 통계 |
| /tasks, /tasks/reports | [CODE] |
| /schedule | [CODE] |
| /messages | [CODE] |
| /ai | [CODE] |
| /team | [CODE] |
| /team/[id] | [CODE] — 5탭: 기본정보/인사정보/근무설정/인사노트/경력(준비중) |
| /team/notes | [CODE] — 전체 인사노트 목록, 직원 사이드바 |
| /salary | [CODE] — 급여 등록/명세서/확정/지급완료 워크플로우 |
| /settings | [CODE] |
| /subscription | [CODE] |
| /onboarding/plan, /onboarding/payment | [CODE] |
| /training | [CODE] — 교육 목록/등록/수강 관리, 내 수강 현황 |

---

## 3. Admin 시스템

### 3-1. 기존 구현 (배포 대기)

| 항목 | 상태 | 비고 |
|------|------|------|
| Admin Backend (NestJS :4001) | [CODE] | admin-backend/ |
| Admin Auth (TOTP MFA, 2단계) | [CODE] | |
| Companies / Plans / Payments / Coupons 모듈 | [CODE] | |
| Feature Flags (Redis TTL 5분 캐시) | [CODE] | |
| Admin Users / AuditInterceptor / RolesGuard | [CODE] | |
| IP 화이트리스트 미들웨어 | [CODE] | ADMIN_ALLOWED_IPS |
| Toss Payments 빌링키 자동결제 + Dunning | [CODE] | D+1/D+3/D+7 |
| PG 빌링키 AES-256 암호화 | [CODE] | BILLING_KEY_ENCRYPTION_KEY |
| Admin DB 마이그레이션 | [CODE] | 1741910500000-AdminSchema |
| Admin Web Dashboard (Next.js :3002) — 9개 페이지 | [CODE] | admin-web/ |
| e-세금계산서 API 연동 | [MANUAL] | 별도 영업 계약 필요 |

### 3-2. Admin 배포 인프라

| 항목 | 상태 | 비고 |
|------|------|------|
| admin-backend `render.yaml` 서비스 항목 추가 | [CODE] | 완료 |
| admin-backend `data-source.prod.ts` (SSL 프로덕션용) | [CODE] | 완료 |
| admin-backend health 엔드포인트 (`GET /admin/v1/health`) | [CODE] | 완료 |
| admin-web `vercel.json` (API 리라이트 + 보안 헤더) | [CODE] | 완료 |
| admin-web `next.config.js` (로컬 개발 프록시) | [CODE] | 완료 |
| admin-web `api.ts` BASE_URL 프록시 경로로 수정 | [CODE] | 완료 |
| **Render — admin-backend 서비스 실제 생성** | [ ] | `docs/admin-deploy-guide.md` 참조 |
| admin-backend 환경변수 설정 | [CODE] | render.yaml에 자동 주입 (Toss 키 · ADMIN_FRONTEND_URL 2개만 수동) |
| admin-backend DB 마이그레이션 실행 | [ ] | Render Shell 또는 배포 후 자동 실행 |
| **Vercel — admin-web 신규 프로젝트 생성** | [ ] | Root Directory: `admin-web` 로 설정 |
| ADMIN_ALLOWED_IPS 설정 | [ ] | 초기: 비워두기(전체허용) → 이후 VPN IP로 제한 |
| admin-web 배포 후 ADMIN_FRONTEND_URL → Render에 입력 | [ ] | 배포 완료 후 순환 의존 해소 |

### 3-3. Admin Backend 환경변수 (Render)

| 환경변수 | 설명 |
|---------|------|
| `NODE_ENV` | `production` |
| `ADMIN_PORT` | `4001` |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` | Customer DB와 동일 (같은 Render PostgreSQL) |
| `REDIS_URL` | Customer Redis와 동일 |
| `ADMIN_JWT_SECRET` | 랜덤 64자 이상 (Customer JWT와 별도) |
| `ADMIN_JWT_EXPIRES_IN` | `8h` |
| `ADMIN_FRONTEND_URL` | Vercel 배포 후 admin-web URL |
| `ADMIN_ALLOWED_IPS` | 허용 IP 목록 (콤마 구분) — 초기엔 `0.0.0.0/0` 허용 후 VPN으로 전환 |
| `BILLING_KEY_ENCRYPTION_KEY` | AES-256 키 (32바이트 hex) |
| `TOSS_PAYMENTS_SECRET_KEY` | Toss 시크릿 키 |
| `CUSTOMER_DB_URL` | Impersonation용 Customer DB 접근 (Customer와 동일 DB면 동일 값) |

### 3-4. 추가 구현 완료 (2026-03-26)

| 항목 | 상태 | 비고 |
|------|------|------|
| **고객사 임시 로그인 (Impersonation)** | [CODE] | `POST /admin/v1/companies/:id/impersonate` — TTL 30분, Customer JWT 발급 |
| Admin Web — Impersonation 버튼 | [CODE] | 기업 목록 테이블 "임시접속" 버튼 |
| **공지 브로드캐스트** | [CODE] | `POST /admin/v1/broadcast` — target: all/plan/companies, channel: in_app/email/both |
| Admin Web — 브로드캐스트 페이지 | [CODE] | `/broadcast` 페이지, 수신 대상 선택·메시지 작성·발송 이력 |
| **실시간 사용량 대시보드** | [CODE] | `GET /admin/v1/analytics/realtime` — DAU, 현재 출근 중, 구독 현황, AI 부하 |
| **온보딩 퍼널 현황** | [CODE] | `GET /admin/v1/analytics/funnel` — 4단계 퍼널, 이탈율 |
| Admin Web — Analytics 3탭 확장 | [CODE] | 사용량/실시간/퍼널 탭 |
| **고객사 데이터 삭제 도구** | [CODE] | `DELETE /admin/v1/companies/:id/data` — SUPER_ADMIN 전용 soft delete |
| **역할 세분화** | [DONE] | 이미 5종 구현: SUPER_ADMIN/OPERATIONS/BILLING/SUPPORT/READONLY |

### Customer Backend — `CUSTOMER_JWT_ACCESS_SECRET` 환경변수 추가 필요
Impersonation 기능이 Customer 백엔드 JWT 시크릿으로 토큰을 발급하므로,
Admin Backend의 Render 환경변수에 `CUSTOMER_JWT_ACCESS_SECRET` (Customer의 `JWT_ACCESS_SECRET`과 동일 값) 추가 필요.

---

## 4. 온보딩 & 결제 UI

| 항목 | 상태 |
|------|------|
| 플랜 선택 (`/onboarding/plan`) | [CODE] |
| Toss Payments 카드 등록 (`/onboarding/payment`) | [CODE] — Toss 연동 키 필요 |
| 구독 관리 (`/subscription`) | [CODE] |

---

## 5. 모바일 앱

| 항목 | 상태 |
|------|------|
| Expo 프로젝트 초기 설정 (mobile/) | [CODE] |
| 인증 / 근태(GPS) / 업무 / 채팅 / 프로필 화면 | [CODE] |
| 홈 개선 (실시간 시계, 출퇴근 버튼, 잔여연차, 입사기념일) | [CODE] |
| 휴가 탭 (연차 현황 + 신청 목록 + 신청 모달) | [CODE] |
| 출근부 탭 (달력 그리드, 출근·미출근 dot) | [CODE] |
| useLocation.ts 공통 GPS 훅 | [CODE] |
| Expo Push Notifications (usePushNotifications) | [CODE] |
| GPS 출퇴근 (expo-location Accuracy.High) | [CODE] |
| eas.json (development / preview / production 프로필) | [CODE] |
| app.json runtimeVersion + OTA updates 설정 | [CODE] |
| .env.example (EXPO_PUBLIC_API_URL) | [CODE] |
| EAS_DEPLOY_GUIDE.md 배포 절차 문서 | [CODE] |
| assets/ 폴더 및 README (아이콘/스플래시 안내) | [CODE] |
| 앱 아이콘 / 스플래시 이미지 제작 | [MANUAL] — Figma/icon.kitchen |
| eas init (EAS Project ID 발급 후 app.json 교체) | [MANUAL] — `eas init` 실행 필요 |
| Apple Developer / Google Play 계정 설정 | [MANUAL] |
| eas build --profile production | [MANUAL] — 에셋 + 계정 준비 후 |
| eas submit (앱스토어 제출) | [MANUAL] |

---

## 6. 보안 검증 & 운영 준비

| 항목 | 상태 | 비고 |
|------|------|------|
| 멀티테넌트 격리 통합 테스트 | [CODE] | 로컬 14/14 통과, 프로덕션 미검증 |
| 출퇴근 기록 3년 보관 아카이브 | [CODE] | AttendanceArchiveService |
| Redis Adapter (Socket.io 멀티서버) | [CODE] | REDIS_URL 설정 후 동작 |

---

## 7. 개발 환경 & 운영

| 항목 | 상태 | 비고 |
|------|------|------|
| docker-compose.yml | [DONE] | 로컬 개발용 |
| .env.example | [DONE] | |
| TypeORM Migration 파일 | [DONE] | 코드 완성, 프로덕션 실행 필요 (섹션 0-3) |
| 마스터 데이터 시드 | [DONE] | 코드 완성, 프로덕션 실행 필요 (섹션 0-3) |
| GitHub Actions CI/CD | [CODE] | 로컬 작성, 미검증 |
| Sentry (Backend + Frontend) | [CODE] | SENTRY_AUTH_TOKEN 미설정 |
| Winston 구조화 로깅 | [CODE] | |
| Vercel 프로젝트 연결 | [DONE] | 완료 |
| Render 배포 | [DONE] | health 응답 확인 |
| Render 환경변수 설정 | [DONE] | 2026-03-25 완료 |

---

## 8. 보안 체크리스트

| 항목 | 상태 |
|------|------|
| 멀티테넌트 격리 통합 테스트 | [DONE] |
| Rate Limiting (IP Throttler + 계정 잠금) | [DONE] |
| PG 빌링키 AES-256 암호화 저장 | [DONE] |
| Admin VPN/IP 화이트리스트 | [DONE] |
| TOTP MFA (SUPER_ADMIN) | [DONE] |
| HTTPS 강제 (HSTS 헤더) | [DONE] |
| JWT 시크릿 분리 (Access/Refresh 별도) | [DONE] |
| Refresh Token Hash 저장 | [DONE] |
| Soft Delete 패턴 (deleted_at) | [DONE] |
| 개인정보처리방침 / 이용약관 법무 검토 | [MANUAL] |
| GPS 데이터 개인정보보호법 준수 명문화 | [MANUAL] |

---

## 9. 성능 & 운영 준비

| 항목 | 상태 | 비고 |
|------|------|------|
| Entity 인덱스 설계 | [DONE] | |
| DB 인덱스 실제 생성 확인 | [MANUAL] | migration:run 후 DB 직접 확인 |
| Feature Flags Redis 캐시 | [DONE] | TTL 5분 |
| 구독 갱신 스케줄러 | [DONE] | DunningScheduler 3종 |
| S3 Lifecycle Policy (Export 7일 TTL) | [MANUAL] | AWS 콘솔 |
| RDS 자동 백업 (7일 보존) | [MANUAL] | AWS 콘솔 |
| 출퇴근 기록 3년 보관 아카이브 | [DONE] | 매일 02:00 스케줄러 |
| 로드 테스트 | [MANUAL] | 피크 시간대 시뮬레이션 |

---

## 9-1. 확인된 버그 및 해결 이력

| 항목 | 상태 | 원인 | 해결 |
|------|------|------|------|
| Tailwind CSS 프로덕션 미적용 | [DONE] | `postcss.config.js` 누락 | `web/postcss.config.js` 추가, 캐시 없이 Redeploy |
| "네트워크 연결을 확인해주세요" 반복 토스트 | [DONE] | Render cold start > axios 15초 timeout | timeout 60s 상향, 에러 메시지 구분 |
| API 요청이 localhost:3001로 날아감 | [DONE] | `vercel.json` env 빌드타임 미적용, 폴백 localhost | `api.ts` 폴백 `/api/v1`로 변경 |
| 서버 500 오류 (auth) | [DONE] | Render 환경변수 미설정 (JWT_SECRET 등) | 환경변수 설정 완료 (2026-03-25) |

---

## 10. 미결 의사결정

| 항목 | 선택지 | 비고 |
|------|--------|------|
| 이메일 발송 서비스 | **Resend** | 구현 완료 |
| 이미지 스토리지 | **Cloudflare R2** | 설정 완료 |
| 반복 일정 처리 | **rrule 라이브러리** | 구현 완료 |
| e-세금계산서 연동 | 케이세인 / 아이스크림 / 비즈인포 | 영업 계약 필요 |
| 모노레포 도구 | 현재 단일 레포 (Turborepo 전환 가능) | |
| 모바일 배포 | **EAS Build** | 앱스토어 배포 시 필요 |
| 차트 라이브러리 | **recharts** | 조직통계 구현 시 설치 필요 |
| 전자서명 | 직접 구현 또는 외부 API | 계약관리 구현 시 결정 필요 |

---

## 11. UI/기능 구현 현황 (2026-03-23 기준)

### 11-1. 공통 UI 컴포넌트

| 항목 | 상태 | 파일 |
|------|------|------|
| 컬러풀 Avatar 컴포넌트 | [CODE] | `web/src/components/ui/Avatar.tsx` |
| 파스텔 뱃지 시스템 (역할/고용형태/근태/업무) | [CODE] | `web/src/components/ui/Badge.tsx` |
| 데이터 테이블 공통 (정렬/검색/페이지네이션) | [CODE] | `web/src/components/ui/DataTable.tsx` |
| 좌측 트리 사이드바 레이아웃 | [ ] | 부서트리 + 우측 콘텐츠 |
| Rich Text 에디터 | [ ] | 결재문서, 퇴직/휴직사유 등 |
| 로딩 화면 & 로딩 모션 | [CODE] | `Spinner`, `PageLoader`, `RouteProgressBar`, `loading.tsx` 10개 라우트, 모바일 `LoadingScreen` |

### 11-1-1. 브랜딩 & 테마 커스터마이징

> 회사별로 대시보드 분위기를 다르게 줄 수 있는 브랜딩 기능.
> **원칙**: 웹에서 설정한 모든 브랜딩은 모바일에도 동일하게 반영되어야 하며, 플랫폼별 최적화 옵션을 함께 제공한다.

#### 배경 이미지 시스템 (3단계 우선순위)

| 우선순위 | 주체 | 설명 |
|---------|------|------|
| 1 (최우선) | 사원 개인 | 본인이 직접 설정한 개인 배경 (웹/모바일 각각 독립) |
| 2 | 회사 (관리자) | 워크스페이스 설정에서 지정한 전사 기본 배경 |
| 3 (기본값) | 시스템 | 관리왕 기본 배경 (단색 또는 기본 그라디언트) |

- 관리자가 전사 배경을 바꿔도 개인 배경 설정이 있는 사원은 본인 것으로 유지됨
- 개인 배경 초기화 시 전사 배경으로 복귀

#### 웹/모바일 각각의 이미지 관리 구조

각 배경은 **웹용**과 **모바일용** 두 가지 URL을 따로 저장한다.

| 필드 | 설명 |
|------|------|
| `cover_image_url` | 웹 대시보드용 (와이드, 1920×400) |
| `cover_image_mobile_url` | 모바일 홈 화면용 (세로형, 390×260 기준) |

모바일용 이미지가 없을 경우 웹용 이미지를 `object-fit: cover` center로 폴백.

#### 모바일 커버 이미지 설정 방식 (2가지 중 선택)

**방식 A — 웹 이미지에서 모바일 영역 크롭**
- 웹용 이미지 업로드 후 "모바일 영역 설정" 버튼 클릭
- 모바일 비율(9:6) 프레임을 이미지 위에 오버레이로 표시
- 드래그로 프레임 위치 조정 → 프레임 안 영역이 모바일 커버로 저장
- 크롭 좌표(x, y, width, height %)를 DB에 저장하고 CDN/서버사이드에서 자동 생성하거나, 클라이언트에서 canvas로 크롭 후 업로드

**방식 B — 모바일 전용 이미지 별도 업로드**
- "모바일 전용 이미지 업로드" 버튼으로 별도 파일 선택
- 방식 A로 설정된 크롭 영역보다 우선 적용

#### DB 컬럼 추가 항목

| 테이블 | 추가 컬럼 | 설명 |
|--------|---------|------|
| `companies` | `cover_image_url` | 전사 웹 배경 |
| `companies` | `cover_image_mobile_url` | 전사 모바일 배경 |
| `companies` | `cover_mobile_crop` (jsonb) | 웹 이미지 크롭 좌표 `{x, y, w, h}` (%) |
| `companies` | `logo_url` | 회사 로고 |
| `companies` | `branding_text_color` | 커버 위 텍스트 색상 (light/dark) |
| `users` | `cover_image_url` | 개인 웹 배경 |
| `users` | `cover_image_mobile_url` | 개인 모바일 배경 |
| `users` | `cover_mobile_crop` (jsonb) | 개인 웹 이미지 크롭 좌표 |

#### 구현 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| DB 컬럼 추가 및 마이그레이션 (companies + users) | [CODE] | `1741910414000-AddBrandingColumns` |
| 워크스페이스 설정 — "브랜딩" 탭 신설 | [CODE] | `/settings` → 브랜딩 탭, owner only |
| 웹 이미지 업로드 + 모바일 크롭 UI (방식 A) | [CODE] | `CoverCropModal` — 드래그 9:6 프레임 |
| 모바일 전용 이미지 별도 업로드 (방식 B) | [~] | 크롭 URL 재사용, 별도 업로드 UI 미구현 |
| 내 프로필 설정 — 개인 배경 설정 (동일 2가지 방식) | [ ] | "회사 기본으로 되돌리기" 버튼 포함 |
| 대시보드 상단 커버 렌더링 (Web) | [CODE] | `DashboardCover` — 3단계 폴백 + 그라디언트 오버레이 |
| 모바일 홈 상단 커버 렌더링 | [CODE] | `ImageBackground` — 3단계 폴백 + overlay |
| 회사 로고 + 사명 오버레이 (Web + Mobile 공통) | [~] | 웹 커버에 사명/날짜 텍스트 오버레이 구현, 로고 미포함 |

#### 세부 UX 기획

- **웹 커버 영역**: 대시보드 상단, 1920×400, 어두운 그라디언트 오버레이 → 좌하단에 로고 + 사명 + 직원 이름/직위
- **모바일 커버 영역**: 홈 화면 상단, 390×260, 동일 오버레이 구조
- **크롭 UI**: react-image-crop 또는 커스텀 canvas 구현 (드래그·리사이즈 불필요, 프레임 위치만 이동)
- **이미지 가이드라인**: 웹 권장 1920×400 / 모바일 권장 390×260, jpg/png/webp, 최대 5MB
- **설정 위치**: `/settings` → "브랜딩" 탭 (관리자) / 내 프로필 → "배경 설정" (전 직원)

#### 전체 플랫폼 Web↔Mobile 최적화 원칙 (브랜딩 외 전체 기능 공통)

> 브랜딩뿐 아니라 서비스 전반에서 아래 원칙을 일관되게 적용한다.

| 원칙 | 설명 |
|------|------|
| 데이터 단일 소스 | 웹에서 설정한 값은 API를 통해 모바일에 동일하게 반영 |
| 플랫폼별 레이아웃 최적화 | 동일 데이터를 웹은 와이드, 모바일은 세로형으로 렌더링 |
| 이미지 이중 저장 | 와이드 이미지가 필요한 모든 곳(커버, 배너 등)에 웹/모바일 URL 분리 저장 |
| 크롭 도구 공통화 | 이미지 업로드가 있는 모든 설정 화면에 모바일 크롭 옵션 일관 제공 |
| 기능 패리티 | 웹에서 가능한 설정은 원칙적으로 모바일 앱에서도 조회·변경 가능해야 함 |

### 11-2. 직원 관리 (`/team`)

| 항목 | 상태 | 상세 |
|------|------|------|
| 직원 목록 (DataTable, Avatar, Badge) | [CODE] | `/team` |
| 직원 상세 탭 페이지 | [CODE] | `/team/[id]` — 기본정보/인사정보/근무설정/인사노트 |
| 인사노트 탭 (직원 상세 내) | [CODE] | `/team/[id]` → 노트 탭 |
| 전체 인사노트 목록 페이지 | [CODE] | `/team/notes` |
| 퇴직신청 / 휴직신청 모달 | [CODE] | `/team/[id]` ActionModal |
| 직원 목록 — 부서 트리 사이드바 | [ ] | 현재는 탭 필터 방식 |
| 직원 상세 — 경력/학력 | [CODE] | 경력/학력 CRUD, 현재 재직 중 토글 |
| 직원 상세 — 첨부문서 | [CODE] | 8종 서류 유형, Presigned URL 업로드, 다운로드 |
| 증명서 발급 (재직/경력) | [CODE] | `/certificates` 페이지 + 인쇄 |

### 11-3. 근무 관리 (`/attendance`)

| 항목 | 상태 | 상세 |
|------|------|------|
| 내 근태 탭 | [CODE] | 월간 기록 조회 |
| 오늘 현황 탭 (관리자) | [CODE] | 팀 출근 현황 |
| 팀 통계 탭 (관리자) | [CODE] | 근무율 바, 4개 요약 카드 |
| 팀별 주간 스케줄 카드 뷰 | [ ] | 요일별 색상 카드 |
| 월별 캘린더 출퇴근 뷰 | [ ] | 직원×날짜 교차 테이블 |

### 11-4. 급여 관리 (`/salary`)

| 항목 | 상태 | 상세 |
|------|------|------|
| 급여 목록 테이블 | [CODE] | 월 네비, 요약 카드, 기본급/수당/공제/차인지급액 |
| 급여 명세서 모달 + 인쇄 | [CODE] | 지급/공제 2단 레이아웃 |
| 급여 등록/수정 폼 | [CODE] | 14개 항목, 4대보험 자동계산 |
| 상태 워크플로우 | [CODE] | 초안 → 확정 → 지급완료 |
| 최저시급 위반 감지 | [ ] | |

### 11-5. 인사 노트 (`/team/notes`)

| 항목 | 상태 | 상세 |
|------|------|------|
| 전체 노트 목록 (직원 사이드바) | [CODE] | 카테고리 필터, 검색, 더보기 |
| 노트 작성/수정/삭제 | [CODE] | 비공개 토글, canEdit 제어 |
| 카테고리 5종 | [CODE] | 상담/경고/칭찬/인사발령/기타 |

### 11-6. 대시보드 (`/`)

| 항목 | 상태 | 상세 |
|------|------|------|
| 실시간 출퇴근 카드 (API 직접 호출) | [CODE] | clock-in/out POST |
| 팀 현황 아바타 그리드 (관리자) | [CODE] | 상태 도트, 60초 자동 갱신 |
| 직원 이번달 통계 | [CODE] | 근무일/지각/총시간 |
| 업무 테이블 (우선순위 바, D-day) | [CODE] | |

---

## 12. 다음 구현 우선순위

### 즉시 필요 (프로덕션 오픈 필수)
1. **Render 환경변수 설정** (섹션 0-2) — 수동 작업
2. **DB 마이그레이션 실행** — salary, hr_notes 포함
3. **E2E 검증** — 회원가입/로그인/출퇴근 플로우

### 다음 세션 구현 추천 순서

| 순위 | 항목 | 예상 규모 |
|------|------|---------|
| 1 | **휴가 관리** (`/vacations`) — 연차 부여/사용, 신청/승인 | [CODE] 2026-03-24 구현 완료 |
| 2 | **월별 캘린더** — 이벤트+근태, 전사/팀/개인 범위 | [CODE] 2026-03-24 구현 완료 |
| 3 | **전자결재** (`/approvals`) — 결재함/결재문서/결재선 | [CODE] 2026-03-24 구현 완료 |
| 4 | **계약 관리** (`/contracts`) — 계약서 현황/뷰어 | [CODE] 2026-03-24 구현 완료 |
| 5 | **조직 통계** (`/team/stats`) — recharts 차트 | [CODE] 2026-03-24 구현 완료 |
| 6 | **증명서 발급** — 재직/경력증명서 모달 + 인쇄 | [CODE] 2026-03-24 구현 완료 |
| 7 | **인사평가** (`/evaluations`) | [CODE] 2026-03-24 구현 완료 |
| 8 | **교육 관리** (`/training`) | 백엔드 신규 + 프론트 |

### 모바일 앱 (별도 세션)
- 홈 화면 개선 (잔여휴가/출근부/생일 카드)
- 휴가신청 폼 결재선 연동
- EAS Build 배포 준비
