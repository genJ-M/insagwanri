# 서비스 완성을 위한 잔여 작업 목록

> 작성일: 2026-03-11
> 최종 업데이트: 2026-04-16 (현장직·돌봄직·다지점·교대교환·팀관리·랜딩·구독 자동결제·마케팅 스튜디오 추가 반영)
> 참조 문서: `saas-design.md`, `admin-system-design.md`, `infra/ARCHITECTURE.md`, `docs/claude-build-guide.md`

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
| **Render DB 유료 플랜 전환** | [ ] | 무료 DB는 90일 만료·백업 없음 → 첫 유료 고객 전 반드시 업그레이드 |

> ⚠️ Render 무료 Web Service는 15분 비활성 시 슬립됩니다. 실제 고객용 프로덕션에는 Starter 플랜 이상을 사용하세요.

### 0-1-1. Vercel 환경변수 설정

| 환경변수 | 상태 | 비고 |
|----------|------|------|
| `NEXT_PUBLIC_API_URL` | [DONE] | `vercel.json`에 `/api/v1` 고정 |
| `SENTRY_AUTH_TOKEN` | [ ] | 미설정 시 Sentry 래핑 자동 비활성화 (조건부 처리 완료) |
| `SENTRY_ORG` | [ ] | sentry.io 조직 슬러그 |
| `SENTRY_PROJECT` | [ ] | sentry.io 프로젝트 슬러그 |

> Sentry를 실제로 사용하려면 3개 모두 Vercel 환경변수에 추가. 미설정 시 빌드는 정상 진행 (`next.config.mjs` 조건부 처리).

---

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
| `ENCRYPTION_KEY` | [ ] | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `HMAC_SECRET` | [ ] | 위와 동일 방법 — ENCRYPTION_KEY와 다른 값으로 |
| `CUSTOMER_JWT_ACCESS_SECRET` | [ ] | Admin Backend용 — Customer JWT_ACCESS_SECRET과 동일값 |
| `OPENAI_DAILY_TOKEN_LIMIT` | [ ] | 글로벌 일일 토큰 상한선 (예: `1000000`) — 0이면 비활성 |
| `MARKETING_STUDIO_KEY` | [ ] | 마케팅 스튜디오 접속 비밀키 (최소 8자, 임의 문자열) |

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
| `1741910421000-ExtendInviteTokensAndPhoneOtp` | [ ] | invite_tokens 확장 + phone_otps 생성 |
| `1741910422000-AddCompanyTypeAndUserPermissions` | [ ] | company.company_type 등 5컬럼 + users.managed_departments/permissions |
| `1744000000000-AddAttendanceMethods` | [ ] | attendance_methods 테이블 |
| `1744001000000-AddUserWorkSchedule` | [ ] | user_work_schedules 테이블 |
| `1744100000000-CreateFeedbackTable` | [ ] | feedbacks 테이블 |
| `1744500000000-AddApprovalTaskLinks` | [ ] | approvals.related_task_ids JSONB |
| `1744600000000-ExtendTasksForInstructions` | [ ] | tasks 컬럼 확장 |
| `1744900000000-AddAnnouncementTargeting` | [ ] | messages 5컬럼 추가 |
| `1745000000000-AddCalendarSettingsAndVisibility` | [ ] | recurring_calendar_events + dept_page_visibility |
| `1745100000000-ExtendInviteTokens` | [ ] | invite_tokens 확장 (그룹 링크) |
| `1745200000000-AddDocumentSealingAndRetention` | [ ] | approvals 봉인 컬럼 |
| `1745300000000-AddUserBirthday` | [ ] | users.birthday |
| `1745400000000-AddSubscriptionRenewalTracking` | [ ] | 구독 갱신 추적 컬럼 |
| `1745400000000-CreateTeamsTables` | [ ] | teams 테이블 |
| `1745500000000-CreateSubscriptionTables` | [ ] | 구독 이력 테이블 |
| `1745600000000-AddItWorkFeatures` | [ ] | IT 직군 기능 컬럼 |
| `1745700000000-AddPublicSectorFeatures` | [ ] | 공공기관 기능 컬럼 |
| `1745800000000-AddShiftWorkerFeatures` | [ ] | 교대 근무 기능 컬럼 |
| `1745900000000-AddPartTimeFeatures` | [ ] | 파트타임 기능 컬럼 |
| `1746000000000-AddFieldVisitFeatures` | [ ] | 현장 방문 테이블 |
| `1746100000000-AddCareWorkerFeatures` | [ ] | 돌봄 자격증·세션 테이블 |
| `1746200000000-AddBusinessLocations` | [ ] | business_locations 테이블 |
| `1746300000000-AddCurrentSessionId` | [ ] | users.current_session_id |
| `1746400000000-CreateShiftSwapRequests` | [ ] | shift_swap_requests 테이블 |
| `1746500000000-CreateMarketingTables` | [ ] | marketing_blocks / marketing_banners / marketing_popups |

### 0-4. OAuth 앱 등록 (수동)

| 항목 | 상태 | 비고 |
|------|------|------|
| Google Cloud Console — Web OAuth 앱 등록 | [ ] | Redirect URI: `https://insagwanri-backend.onrender.com/api/v1/auth/google/callback` |
| Google Cloud Console — Web 로그인용 origin 등록 | [ ] | `https://insagwanri-nine.vercel.app` |
| Google Cloud Console — iOS 클라이언트 ID 발급 | [MANUAL] | 모바일 배포 시 필요 |
| Google Cloud Console — Android 클라이언트 ID 발급 | [MANUAL] | 모바일 배포 시 필요 |

> Kakao 로그인은 현재 범위에서 제외되었습니다. 필요 시 `SocialStrategy` 패턴으로 별도 추가 가능합니다.

### 0-5. E2E 동작 검증 (환경변수 + 마이그레이션 후)

| 항목 | 상태 |
|------|------|
| 이메일 회원가입 → 인증 → 로그인 | [ ] |
| Google 소셜 로그인 (신규 + 기존) | [ ] |
| 대시보드 진입 + 출퇴근 기록 | [ ] |
| 직원 초대 (이메일/전화/링크) + 수락 | [ ] |
| 비밀번호 찾기 — 전화번호 OTP 흐름 | [ ] |
| 토큰 갱신 (15분 후) | [ ] |
| 암호화 백필 (기존 데이터 email_hash 채워졌는지) | [ ] |
| AI 기능 — 글로벌 토큰 상한선 초과 시 503 반환 | [ ] |

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
| auth (이메일/비밀번호) | [CODE] | 회원가입(사업자유형 포함)/로그인/토큰갱신/로그아웃 |
| auth (Google OAuth) | [CODE] | passport-google-oauth20 + GoogleStrategy |
| auth (소셜 모바일) | [CODE] | POST /auth/social/mobile |
| auth (비밀번호 찾기 — 전화OTP) | [CODE] | send-phone-otp / verify-phone-otp |
| attendance | [CODE] | 출퇴근 기록/조회, GPS 플래그 |
| tasks | [CODE] | 업무 CRUD |
| schedules | [CODE] | 일정 CRUD, rrule 반복 |
| collaboration | [CODE] | 채팅/메시지 |
| ai | [CODE] | OpenAI 연동, 플랜별 일일 한도 + **글로벌 토큰 상한** |
| users | [CODE] | 직원 초대 3경로(이메일/전화/링크), org-stats, 권한위임(PATCH /users/:id/permissions) |
| workspace | [CODE] | 설정(사업자정보 포함), 브랜딩 |
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
| tax-documents | [CODE] | 세무·노무 서류 자동생성 + Cron 알림 (2026-03-31) |
| attendance-methods | [CODE] | 5가지 방식(manual/gps/wifi/qr/face), QR HMAC 토큰 (2026-04-07) |
| user-work-schedule | [CODE] | 직원별 근무시간 설정, 법정휴게 자동계산 (2026-04-07) |
| feedback | [CODE] | 우클릭 신고, 스크린샷, ? 버튼 (2026-04-07) |
| invitations | [CODE] | 개인/그룹 초대 링크, 이메일 인증 플로우 (2026-04-08) |
| calendar-settings | [CODE] | 팀별 반복일정, 사이드바 가시성 설정 (2026-04-08) |
| approvals (봉인) | [CODE] | SHA-256 해시 체인, 5년 보존, 인쇄/검증 (2026-04-09) |
| teams | [CODE] | 팀 CRUD, 구성원 관리 (2026-04-09) |
| field-visits | [CODE] | GPS 체크인, 방문지, 차량 연동 (2026-04-13) |
| care-worker | [CODE] | 자격증, 세션, 야간/휴일 수당, 피로도 Cron (2026-04-13) |
| locations | [CODE] | 다지점 CRUD, 직원 배정, 애드온 ₩9,900/월 (2026-04-13) |
| shift-swap | [CODE] | 교대 교환 요청·승인 워크플로우 (2026-04-13) |
| subscriptions (자동결제) | [CODE] | 빌링 Cron, 만료 알림, 애드온 카탈로그 (2026-04-13) |
| marketing | [CODE] | 텍스트 블록/배너/팝업 CMS — Public + Studio API (2026-04-16) |

### Frontend — Customer Web

| 페이지 | 상태 |
|--------|------|
| /login, /register (이메일, 사업자유형 선택 포함) | [CODE] |
| /login, /register (소셜 버튼 — Google) | [CODE] |
| /auth/callback (소셜 토큰 수신) | [CODE] |
| /auth/social-complete (신규 소셜 유저) | [CODE] |
| /forgot-password (전화OTP + 이메일 링크 탭) | [CODE] |
| /invite (전화/링크 초대 이메일 직접입력 지원) | [CODE] |
| / (대시보드) | [CODE] |
| /attendance (3탭) | [CODE] |
| /tasks, /tasks/reports | [CODE] |
| /schedule | [CODE] |
| /messages | [CODE] |
| /ai | [CODE] |
| /team (초대 3탭 모달, 관리자 권한설정 모달) | [CODE] |
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
| /tax-documents (6탭: 할일·원천징수·4대보험·연말정산·퇴직금·연간캘린더) | [CODE] |
| /settings (브랜딩 탭 + 사업자정보 카드 + 알림설정 탭) | [CODE] |
| /subscription, /onboarding/* | [CODE] |
| /invitations (관리자 — 초대 링크 관리) | [CODE] |
| /join/[token] (공개 가입 페이지) | [CODE] |
| /calendar-settings (3탭: 반복일정·예정일정·팀별화면설정) | [CODE] |
| /shift-swap (교대 교환 요청 관리) | [CODE] |
| /locations (다지점 관리 대시보드) | [CODE] |
| / (랜딩 페이지 — 비로그인) | [CODE] |
| /quote (요금 견적 계산기) | [CODE] |
| /marketing-studio (마케팅 스튜디오 CMS) | [CODE] |

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
| **테넌트별 AI 사용량 + 예상 비용 모니터링** | [CODE] | AiRequest 엔티티 기반 — Admin 대시보드 연결 필요 |
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
| social-complete 화면 | [CODE] | |
| 모바일 커버 이미지 (ImageBackground) | [CODE] | |
| eas.json + app.json 배포 설정 | [CODE] | |
| 앱 아이콘 / 스플래시 이미지 제작 | [MANUAL] | |
| eas init (EAS Project ID 발급) | [MANUAL] | |
| Apple Developer / Google Play 계정 설정 | [MANUAL] | |
| eas build --profile production | [MANUAL] | 에셋 + 계정 준비 후 |
| eas submit | [MANUAL] | |

> Kakao 모바일 로그인 코드는 제거되었습니다. 향후 필요 시 `SocialStrategy` 인터페이스로 확장 추가 가능합니다.

---

## 6. 보안 & 법규 현황

### 기술적 보호조치

| 항목 | 상태 | 비고 |
|------|------|------|
| JWT 시크릿 분리 (Access/Refresh) | [DONE] | |
| Refresh Token Hash 저장 | [DONE] | |
| 로그인 Rate Limit (5회/60초 잠금) | [DONE] | |
| 멀티테넌트 격리 (company_id) — 1차 방어선 | [DONE] | |
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
| **글로벌 AI 일일 토큰 상한선** | [CODE] | `OPENAI_DAILY_TOKEN_LIMIT` 환경변수 설정 필요 |
| 멀티테넌트 2차 방어선 (DB RLS) | [ ] | 초기 유료 고객 확보 후 도입 권장 (Phase 2 가이드 참고) |
| 암호화 키 KMS 관리 체계 | [ ] | 프로덕션 매출 발생 후 — AWS KMS 등 도입 권장 |

### PIPA(개인정보보호법) 비기술 체크리스트

> 아래 항목은 개인정보보호위원회 공식 가이드라인 및 법률 자문 병행 필요

| 항목 | 상태 | 비고 |
|------|------|------|
| 개인정보 처리방침 작성 및 서비스 게시 | [MANUAL] | 수집 항목, 이용 목적, 보유 기간, 제3자 제공/국외 이전 명시 |
| 동의서 설계 (필수/선택 구분, 철회 절차) | [MANUAL] | |
| OpenAI 국외 이전·처리 위탁 처리방침 기재 | [MANUAL] | PIPA 국외 이전에 해당할 수 있음 |
| 파기 절차 수립 (보유 기간 만료 데이터) | [MANUAL] | |
| 침해사고 신고·통지 프로세스 수립 | [MANUAL] | 72시간 이내 개보위 신고, 정보주체 통지 |
| 접속기록 위·변조 방지 체계 | [ ] | 현재: DB 직접 저장. 향후 별도 로그 서버 또는 WORM 스토리지 도입 검토 |
| GPS 데이터 개인정보보호법 처리방침 명문화 | [MANUAL] | |
| 개인정보처리방침 / 이용약관 법무 검토 | [MANUAL] | |

---

## 7. 개발 환경 & 운영

| 항목 | 상태 | 비고 |
|------|------|------|
| docker-compose.yml | [DONE] | 로컬 개발용 |
| .env.example | [DONE] | |
| TypeORM Migration 파일 | [CODE] | 작성 완료, 프로덕션 실행 필요 (섹션 0-3) |
| Winston 구조화 로깅 | [CODE] | |
| GitHub Actions CI/CD | [CODE] | 로컬 작성, 미검증 |
| Sentry (Backend + Frontend) | [CODE] | Vercel 환경변수 3개 추가 시 활성화 (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`) |
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
| Vercel 빌드 오류 (`page_client-reference-manifest.js`) | [DONE] | `SENTRY_AUTH_TOKEN` 미설정 시 `withSentryConfig`가 빌드 실패시킴 | `next.config.mjs` 조건부 래핑 (`process.env.SENTRY_AUTH_TOKEN ? withSentryConfig(...) : nextConfig`) |

---

## 9. 미결 의사결정 / 추후 구현

| 항목 | 상태 | 비고 |
|------|------|------|
| e-세금계산서 연동 | [MANUAL] | 케이세인/아이스크림/비즈인포 — 영업 계약 |
| 전자서명 | [ ] | 계약관리 고도화 시 결정 |
| 최저시급 위반 감지 | [ ] | 급여 모듈 추가 기능 |
| 부서 트리 사이드바 | [ ] | `/team` — 현재 탭 필터 방식 |
| Rich Text 에디터 | [ ] | 결재문서, 퇴직/휴직 사유 등 |
| 팀별 주간 스케줄 카드 뷰 | [CODE] | `/schedule` 주간/목록 뷰 전환 토글, 요일별 색상 카드 |
| 월별 캘린더 출퇴근 뷰 | [CODE] | `/attendance` 월간 뷰 탭, 직원×날짜 교차 테이블, 상태 뱃지 |
| 개인 배경 설정 (내 프로필) | [ ] | "회사 기본으로 되돌리기" 포함 |
| 모바일 전용 이미지 별도 업로드 | [CODE] | 방식 B 구현 완료 — 브랜딩 탭 "영역 선택/별도 업로드" 토글 |
| 로드 테스트 | [MANUAL] | 피크 시간대 시뮬레이션 |
| DB 인덱스 실제 생성 확인 | [MANUAL] | migration:run 후 DB 직접 확인 |
| S3 Lifecycle Policy (Export 7일 TTL) | [MANUAL] | AWS 콘솔 |
| Sentry 토큰 설정 | [ ] | SENTRY_AUTH_TOKEN |
| **DB RLS 2차 방어선 도입** | [ ] | 초기 유료 고객 확보 후 — NestJS CLS + PostgreSQL RLS |
| **Kakao 소셜 로그인 추가** | [ ] | 선택적 — SocialStrategy 패턴으로 별도 Phase에서 추가 가능 |
| **접속기록 무결성 보호** | [ ] | 별도 로그 서버 또는 WORM 스토리지 — 3단계(매출 발생 후) 도입 권장 |

---

## 10. 다음 작업 우선순위

### 즉시 (프로덕션 오픈 필수)

| 순위 | 작업 | 방법 |
|------|------|------|
| 1 | **Google OAuth 앱 등록** | Google Cloud Console → Web 클라이언트 ID |
| 2 | **Render 환경변수 추가** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ENCRYPTION_KEY`, `HMAC_SECRET`, `OPENAI_DAILY_TOKEN_LIMIT`, `MARKETING_STUDIO_KEY` |
| 3 | **DB 마이그레이션 실행** | render.yaml startCommand에 포함 (배포 시 자동) |
| 4 | **Render DB 유료 플랜 전환** | 무료 DB 90일 만료·백업 없음 — 데이터 보장 필수 |
| 5 | **E2E 검증** | 회원가입 → Google 로그인 → 출퇴근 → 로그아웃 |

### 코드 구현 (다음 세션 추천)

| 순위 | 항목 | 규모 |
|------|------|------|
| 1 | **최저시급 위반 감지** | [CODE] — 급여 폼 실시간 경고 배너, 연도별 시급 테이블 |
| 2 | **개인 배경 설정** (내 프로필) | [CODE] — 설정>내 프로필 하단 PersonalCoverCard |
| 3 | **부서 트리 사이드바** (`/team`) | [CODE] — DeptTree 컴포넌트, 부서별 인원 수 표시 |
| 4 | **Rich Text 에디터** (결재문서) | [CODE] — Tiptap 기반 RichTextEditor 공통 컴포넌트, 전자결재 적용 |
| 5 | **Admin 배포** | Render + Vercel 서비스 생성 — 수동 |
| 6 | **모바일 EAS Build** | 앱 아이콘 + eas init 후 |

### 선택적 개선 (MVP 이후 / 2단계~3단계)

- DB RLS 2차 방어선 도입 (초기 유료 고객 확보 후)
- Tamper-evident 감사 로그 (WORM 스토리지)
- 암호화 키 KMS 관리 체계 (AWS KMS)
- 팀별 주간 스케줄 카드 뷰
- 월별 캘린더 출퇴근 뷰 (직원×날짜 교차)
- 전자서명 연동 (계약서)
- e-세금계산서 API 연동
- Sentry 오류 모니터링 설정 (Vercel 환경변수 3개 추가: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`)
- 로드 테스트
- Kakao 소셜 로그인 (SocialStrategy 확장)
- PIPA 정식 컨설팅 + 처리방침 법무 검토
