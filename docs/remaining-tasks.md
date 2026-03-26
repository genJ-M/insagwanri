# 서비스 완성을 위한 잔여 작업 목록

> 작성일: 2026-03-11
> 최종 업데이트: 2026-03-26 (소셜 로그인 + AES-256-GCM 암호화 + 통신비밀보호법 활동 로그)
> 참조 문서: `saas-design.md`, `admin-system-design.md`, `infra/ARCHITECTURE.md`

## 완료 표기 규칙
- `[DONE]` : 코드 구현 완료 + 프로덕션 정상 동작 확인
- `[CODE]` : 코드 작성 완료, 프로덕션 동작 미검증
- `[ ]`    : 미완료. 작업 필요
- `[~]`    : 부분 완료. 추가 작업 필요
- `[MANUAL]` : 코드 외 수동 작업 필요 (콘솔/계약/법무 등)

---

## 0. 프로덕션 환경 셋업

### 0-1. 배포 인프라

| 항목 | 상태 | 비고 |
|------|------|------|
| Vercel 프론트엔드 배포 | [DONE] | `insagwanri-nine.vercel.app` |
| Tailwind CSS 빌드 (postcss.config.js) | [DONE] | 누락 → 수정 완료 |
| API URL 폴백 (`localhost` → `/api/v1`) | [DONE] | 수정 완료 |
| Vercel → Render 프록시 rewrite | [DONE] | `vercel.json` rewrites |
| Render 백엔드 배포 (health 응답) | [DONE] | `insagwanri-backend.onrender.com` |
| DB 연결 (health에서 database:up 확인) | [DONE] | Render PostgreSQL |
| `backend/data-source.prod.ts` | [CODE] | 신규 생성 — render.yaml startCommand 참조 |

### 0-2. Render 환경변수 설정

| 환경변수 | 상태 | 비고 |
|----------|------|------|
| `NODE_ENV`, `PORT` | [DONE] | |
| `DB_HOST/PORT/NAME/USERNAME/PASSWORD` | [DONE] | Render PostgreSQL |
| `REDIS_URL` | [DONE] | |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | [DONE] | |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | [DONE] | |
| `FRONTEND_URL`, `ALLOWED_ORIGINS` | [DONE] | |
| `RESEND_API_KEY`, `EMAIL_FROM` | [DONE] | |
| `OPENAI_API_KEY`, `OPENAI_MODEL` 등 | [DONE] | |
| `AWS_*` (R2 설정) | [DONE] | |
| `GOOGLE_CLIENT_ID` | [ ] | Google Cloud Console → OAuth 2.0 앱 등록 후 |
| `GOOGLE_CLIENT_SECRET` | [ ] | |
| `GOOGLE_CALLBACK_URL` | [CODE] | render.yaml에 고정값 설정됨 |
| `KAKAO_CLIENT_ID` | [ ] | Kakao Developers → REST API 키 |
| `KAKAO_CLIENT_SECRET` | [ ] | |
| `KAKAO_CALLBACK_URL` | [CODE] | render.yaml에 고정값 설정됨 |
| `ENCRYPTION_KEY` | [ ] | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `HMAC_SECRET` | [ ] | 위와 동일 방법 — ENCRYPTION_KEY와 다른 값으로 |
| `CUSTOMER_JWT_ACCESS_SECRET` | [ ] | Admin Backend용 — Customer JWT_ACCESS_SECRET과 동일값 |

> ⚠️ `ENCRYPTION_KEY` + `HMAC_SECRET`은 설정 후 절대 변경 불가. 변경 시 암호화된 기존 데이터 복호화 불가.

### 0-3. DB 마이그레이션 실행 (Render Shell)

Render Shell에서 `npm run migration:run` 또는 배포 후 자동 실행 (startCommand에 포함)

| 마이그레이션 | 상태 | 비고 |
|-------------|------|------|
| `1741910405000-CreateSalaryTable` | [ ] | |
| `1741910406000-CreateHrNotesTable` | [ ] | |
| `1741910408000-CreateVacationTables` | [ ] | |
| `1741910409000-CreateApprovalsTables` | [ ] | |
| `1741910410000-CreateContractsTable` | [ ] | |
| `1741910411000-CreateCalendarEventsTable` | [ ] | |
| `1741910412000-CreateEvaluationTables` | [ ] | |
| `1741910413000-CreateUserProfileTables` | [ ] | |
| `1741910414000-AddBrandingColumns` | [ ] | |
| `1741910415000-CreateTrainingTables` | [ ] | |
| `1741910416000-AddOAuthColumns` | [ ] | provider, provider_account_id, password_hash nullable |
| `1741910419000-AddEncryptedColumns` | [ ] | email_hash, email_encrypted, name_encrypted |
| `1741910420000-CreateActivityLogsTable` | [ ] | user_activity_logs |

### 0-4. OAuth 앱 등록 (수동)

| 항목 | 상태 | 비고 |
|------|------|------|
| Google Cloud Console — Web OAuth 앱 등록 | [ ] | Redirect URI: `https://insagwanri-backend.onrender.com/api/v1/auth/google/callback` |
| Google Cloud Console — Web 로그인용 origin 등록 | [ ] | `https://insagwanri-nine.vercel.app` |
| Google Cloud Console — iOS 클라이언트 ID 발급 | [MANUAL] | 모바일 배포 시 필요 |
| Google Cloud Console — Android 클라이언트 ID 발급 | [MANUAL] | 모바일 배포 시 필요 |
| Kakao Developers — 앱 등록 + REST API 키 발급 | [ ] | |
| Kakao Redirect URI 등록 | [ ] | `https://insagwanri-backend.onrender.com/api/v1/auth/kakao/callback` |
| Kakao Web 도메인 등록 | [ ] | `https://insagwanri-nine.vercel.app` |

### 0-5. E2E 동작 검증 (환경변수 + 마이그레이션 후)

| 항목 | 상태 |
|------|------|
| 이메일 회원가입 → 인증 → 로그인 | [ ] |
| Google 소셜 로그인 (신규 + 기존) | [ ] |
| Kakao 소셜 로그인 (신규 + 기존) | [ ] |
| 대시보드 진입 + 출퇴근 기록 | [ ] |
| 직원 초대 + 수락 | [ ] |
| 토큰 갱신 (15분 후) | [ ] |
| 암호화 백필 (기존 데이터 email_hash 채워졌는지) | [ ] |

---

## 1. 설계 완료 현황

| 영역 | 상태 |
|------|------|
| Customer 도메인 DB 설계 | [DONE] |
| Customer REST API 명세 | [DONE] |
| Customer 권한 구조 (RBAC) | [DONE] |
| Admin 아키텍처 + DB + UI | [DONE] |
| 결제/Dunning/세무 로직 | [DONE] |
| AWS 인프라 구조 | [DONE] |
| Socket.io 이벤트 명세 | [DONE] |
| 알림 시스템 설계 | [DONE] |
| GPS 출퇴근 정책 | [DONE] |

---

## 2. Customer 서비스 — 코드 완성 현황

### Backend 모듈

| 모듈 | 상태 | 비고 |
|------|------|------|
| auth (이메일/비밀번호) | [CODE] | 회원가입/로그인/토큰갱신/로그아웃 |
| auth (Google OAuth) | [CODE] | passport-google-oauth20 + GoogleStrategy |
| auth (Kakao OAuth) | [CODE] | 직접 HTTP fetch |
| auth (소셜 모바일) | [CODE] | POST /auth/social/mobile |
| attendance | [CODE] | 출퇴근 기록/조회, GPS 플래그 |
| tasks | [CODE] | 업무 CRUD |
| schedules | [CODE] | 일정 CRUD, rrule 반복 |
| collaboration | [CODE] | 채팅/메시지 |
| ai | [CODE] | OpenAI 연동 |
| users | [CODE] | 직원 초대/관리, org-stats |
| workspace | [CODE] | 설정, 브랜딩 |
| files | [CODE] | S3/R2 업로드 |
| notifications | [CODE] | 이메일 알림 |
| socket | [CODE] | 실시간 이벤트 |
| subscriptions | [CODE] | 구독/플랜 |
| salary | [CODE] | 급여 CRUD, 4대보험 자동계산 |
| hr-notes | [CODE] | 인사노트 CRUD |
| vacations | [CODE] | 연차 관리, 신청/승인 |
| approvals | [CODE] | 전자결재, 결재선 처리 |
| contracts | [CODE] | 계약 관리, 만료 감지 |
| calendar | [CODE] | 이벤트 캘린더, 범위별 권한 |
| evaluations | [CODE] | 인사평가 사이클 |
| training | [CODE] | 교육 관리, 수강/수료 |
| activity-logs | [CODE] | 통신비밀보호법, 90일 Cron 자동삭제 |
| crypto (공통) | [CODE] | AES-256-GCM + HMAC-SHA256 |

### Frontend — Customer Web

| 페이지 | 상태 |
|--------|------|
| /login, /register (이메일) | [CODE] |
| /login, /register (소셜 버튼) | [CODE] |
| /auth/callback (소셜 토큰 수신) | [CODE] |
| /auth/social-complete (신규 소셜 유저) | [CODE] |
| /invite | [CODE] |
| / (대시보드) | [CODE] |
| /attendance (3탭) | [CODE] |
| /tasks, /tasks/reports | [CODE] |
| /schedule | [CODE] |
| /messages | [CODE] |
| /ai | [CODE] |
| /team | [CODE] |
| /team/[id] (5탭) | [CODE] |
| /team/notes | [CODE] |
| /team/stats (recharts) | [CODE] |
| /salary | [CODE] |
| /vacations | [CODE] |
| /approvals | [CODE] |
| /contracts | [CODE] |
| /calendar | [CODE] |
| /certificates | [CODE] |
| /evaluations | [CODE] |
| /training | [CODE] |
| /settings (브랜딩 탭 포함) | [CODE] |
| /subscription, /onboarding/* | [CODE] |

---

## 3. Admin 시스템

### 3-1. Admin Backend/Web 코드

| 항목 | 상태 |
|------|------|
| Admin Backend (NestJS :4001) | [CODE] |
| Admin Auth (TOTP MFA, 2단계) | [CODE] |
| Companies / Plans / Payments / Coupons | [CODE] |
| Feature Flags (Redis TTL 5분 캐시) | [CODE] |
| IP 화이트리스트 미들웨어 | [CODE] |
| Toss Payments 빌링키 자동결제 + Dunning | [CODE] |
| PG 빌링키 AES-256 암호화 | [CODE] |
| Impersonation (POST /companies/:id/impersonate) | [CODE] |
| 브로드캐스트 (POST /broadcast) | [CODE] |
| Analytics 실시간 대시보드 + 퍼널 분석 | [CODE] |
| 고객사 데이터 삭제 (SUPER_ADMIN 전용) | [CODE] |
| Admin Web — 9개 페이지 (Next.js) | [CODE] |
| e-세금계산서 API 연동 | [MANUAL] |

### 3-2. Admin 배포 (수동 작업 필요)

| 항목 | 상태 | 비고 |
|------|------|------|
| render.yaml — admin-backend 서비스 항목 | [CODE] | 작성 완료 |
| admin-backend data-source.prod.ts | [CODE] | 작성 완료 |
| admin-web vercel.json | [CODE] | 작성 완료 |
| **Render — admin-backend 서비스 실제 생성** | [ ] | `docs/admin-deploy-guide.md` 참조 |
| admin-backend DB 마이그레이션 실행 | [ ] | 배포 후 Render Shell |
| **Vercel — admin-web 신규 프로젝트 생성** | [ ] | Root Directory: `admin-web` |
| ADMIN_ALLOWED_IPS 설정 | [ ] | 초기: 전체허용 → 이후 VPN IP로 제한 |
| admin-web 배포 후 ADMIN_FRONTEND_URL → Render 입력 | [ ] | 순환 의존 해소 |
| CUSTOMER_JWT_ACCESS_SECRET → Admin Render 입력 | [ ] | Impersonation 기능 필수 |

---

## 4. 온보딩 & 결제

| 항목 | 상태 |
|------|------|
| 플랜 선택 (`/onboarding/plan`) | [CODE] |
| Toss Payments 카드 등록 (`/onboarding/payment`) | [CODE] — Toss 키 필요 |
| 구독 관리 (`/subscription`) | [CODE] |

---

## 5. 모바일 앱

| 항목 | 상태 | 비고 |
|------|------|------|
| Expo 기본 구조 (auth + tabs) | [CODE] | |
| 홈 (시계, 출퇴근 버튼, 잔여연차, 입사기념일) | [CODE] | |
| 근태 탭 (달력 그리드) | [CODE] | |
| 휴가 탭 (현황 + 신청 모달) | [CODE] | |
| 업무 / 채팅 / 프로필 탭 | [CODE] | |
| GPS 출퇴근 (expo-location) | [CODE] | |
| Push Notifications | [CODE] | |
| 이메일 로그인 | [CODE] | |
| Google 소셜 로그인 (expo-auth-session PKCE) | [CODE] | EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS/ANDROID 필요 |
| Kakao 소셜 로그인 (WebBrowser) | [CODE] | EXPO_PUBLIC_KAKAO_CLIENT_ID 필요 |
| social-complete 화면 | [CODE] | |
| 모바일 커버 이미지 (ImageBackground) | [CODE] | |
| eas.json + app.json 배포 설정 | [CODE] | |
| 앱 아이콘 / 스플래시 이미지 제작 | [MANUAL] | |
| eas init (EAS Project ID 발급) | [MANUAL] | |
| Apple Developer / Google Play 계정 설정 | [MANUAL] | |
| eas build --profile production | [MANUAL] | 에셋 + 계정 준비 후 |
| eas submit | [MANUAL] | |

---

## 6. 보안 & 법규 현황

| 항목 | 상태 | 비고 |
|------|------|------|
| JWT 시크릿 분리 (Access/Refresh) | [DONE] | |
| Refresh Token Hash 저장 | [DONE] | |
| 로그인 Rate Limit (5회/60초 잠금) | [DONE] | |
| 멀티테넌트 격리 (company_id) | [DONE] | |
| Soft Delete (deleted_at) | [DONE] | |
| HTTPS 강제 (HSTS 헤더) | [DONE] | vercel.json |
| PG 빌링키 AES-256 암호화 | [CODE] | Admin Backend |
| Admin IP 화이트리스트 | [CODE] | ADMIN_ALLOWED_IPS |
| Admin TOTP MFA | [CODE] | |
| **개인정보 AES-256-GCM 암호화** | [CODE] | users.email, users.name — 백필 자동 |
| **HMAC-SHA256 이메일 해시 조회** | [CODE] | WHERE email_hash = hmac(input) |
| **통신비밀보호법 활동 로그** | [CODE] | user_activity_logs, 90일 자동삭제 |
| **IP 주소 AES-256-GCM 암호화** | [CODE] | activity_logs.ip_address_encrypted |
| **ScheduleModule.forRoot()** | [CODE] | @Cron 작동 — 버그 수정 완료 |
| 개인정보처리방침 / 이용약관 법무 검토 | [MANUAL] | |
| GPS 데이터 개인정보보호법 명문화 | [MANUAL] | |

---

## 7. 개발 환경 & 운영

| 항목 | 상태 | 비고 |
|------|------|------|
| docker-compose.yml | [DONE] | 로컬 개발용 |
| .env.example | [DONE] | |
| TypeORM Migration 파일 | [CODE] | 작성 완료, 프로덕션 실행 필요 (섹션 0-3) |
| Winston 구조화 로깅 | [CODE] | |
| GitHub Actions CI/CD | [CODE] | 로컬 작성, 미검증 |
| Sentry (Backend + Frontend) | [CODE] | SENTRY_AUTH_TOKEN 미설정 |
| Vercel 배포 | [DONE] | |
| Render 배포 | [DONE] | health 응답 확인 |

---

## 8. 확인된 버그 및 해결 이력

| 항목 | 상태 | 원인 | 해결 |
|------|------|------|------|
| Tailwind CSS 프로덕션 미적용 | [DONE] | postcss.config.js 누락 | 추가 + Redeploy |
| 반복 네트워크 에러 토스트 | [DONE] | Render cold start > axios 15s timeout | timeout 60s 상향 |
| API 요청이 localhost:3001로 | [DONE] | 폴백 localhost | `/api/v1`로 변경 |
| 서버 500 오류 (auth) | [DONE] | 환경변수 미설정 | 환경변수 설정 완료 |
| findByIds deprecated | [DONE] | TypeORM 0.3 | `find({ where: { id: In([...]) } })` |
| authStore import 경로 오류 | [DONE] | `@/store/authStore` | `@/store/auth.store` |
| @Cron 미작동 | [DONE] | ScheduleModule 누락 | `ScheduleModule.forRoot()` 추가 |
| data-source.prod.ts 없음 | [DONE] | 파일 미생성 | 신규 생성 |
| CryptoModule 초기화 순서 | [DONE] | ConfigModule 이전 등록 | 순서 변경 |

---

## 9. 미결 의사결정 / 추후 구현

| 항목 | 상태 | 비고 |
|------|------|------|
| e-세금계산서 연동 | [MANUAL] | 케이세인/아이스크림/비즈인포 — 영업 계약 |
| 전자서명 | [ ] | 계약관리 고도화 시 결정 |
| 최저시급 위반 감지 | [ ] | 급여 모듈 추가 기능 |
| 부서 트리 사이드바 | [ ] | `/team` — 현재 탭 필터 방식 |
| Rich Text 에디터 | [ ] | 결재문서, 퇴직/휴직 사유 등 |
| 팀별 주간 스케줄 카드 뷰 | [ ] | 요일별 색상 카드 |
| 월별 캘린더 출퇴근 뷰 | [ ] | 직원×날짜 교차 테이블 |
| 개인 배경 설정 (내 프로필) | [ ] | "회사 기본으로 되돌리기" 포함 |
| 모바일 전용 이미지 별도 업로드 | [~] | 방식 B — 크롭 URL 재사용, 업로드 UI 미구현 |
| 로드 테스트 | [MANUAL] | 피크 시간대 시뮬레이션 |
| DB 인덱스 실제 생성 확인 | [MANUAL] | migration:run 후 DB 직접 확인 |
| S3 Lifecycle Policy (Export 7일 TTL) | [MANUAL] | AWS 콘솔 |
| Sentry 토큰 설정 | [ ] | SENTRY_AUTH_TOKEN |

---

## 10. 다음 작업 우선순위

### 즉시 (프로덕션 오픈 필수)

| 순위 | 작업 | 방법 |
|------|------|------|
| 1 | **Google OAuth 앱 등록** | Google Cloud Console → Web 클라이언트 ID |
| 2 | **Kakao 앱 등록** | Kakao Developers → REST API 키 |
| 3 | **Render 환경변수 추가** | GOOGLE_*, KAKAO_*, ENCRYPTION_KEY, HMAC_SECRET |
| 4 | **DB 마이그레이션 실행** | render.yaml startCommand에 포함 (배포 시 자동) |
| 5 | **E2E 검증** | 회원가입 → 소셜 로그인 → 출퇴근 → 로그아웃 |

### 코드 구현 (다음 세션 추천)

| 순위 | 항목 | 규모 |
|------|------|------|
| 1 | **최저시급 위반 감지** | 급여 등록/수정 시 경고 표시 — 소규모 |
| 2 | **개인 배경 설정** (내 프로필) | 브랜딩 방식과 동일 패턴 — 소규모 |
| 3 | **부서 트리 사이드바** (`/team`) | 중간 규모 |
| 4 | **Rich Text 에디터** (결재문서/사유) | 중간 규모 |
| 5 | **Admin 배포** | Render + Vercel 서비스 생성 — 수동 |
| 6 | **모바일 EAS Build** | 앱 아이콘 + eas init 후 |

### 선택적 개선 (MVP 이후)

- 팀별 주간 스케줄 카드 뷰
- 월별 캘린더 출퇴근 뷰 (직원×날짜 교차)
- 전자서명 연동 (계약서)
- e-세금계산서 API 연동
- Sentry 오류 모니터링 설정
- 로드 테스트
