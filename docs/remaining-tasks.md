# 서비스 완성을 위한 잔여 작업 목록

> 작성일: 2026-03-11
> 최종 업데이트: 2026-03-23 (배포 환경 문제 진단 및 현실 기반 재정리)
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

## 0. 프로덕션 환경 셋업 ← 지금 여기

> 이 섹션이 완료되어야 나머지가 의미 있음

### 0-1. 배포 인프라 (오늘 수정 완료)

| 항목 | 상태 | 비고 |
|------|------|------|
| Vercel 프론트엔드 배포 | [DONE] | `insagwanri-nine.vercel.app` |
| Tailwind CSS 빌드 (postcss.config.js) | [DONE] | 누락으로 스타일 미적용 → 오늘 수정 |
| API URL 폴백 (`localhost` → `/api/v1`) | [DONE] | 오늘 수정 |
| Vercel → Render 프록시 rewrite | [DONE] | `vercel.json` rewrites |
| Render 백엔드 배포 (health 응답) | [DONE] | `insagwanri-backend.onrender.com` |
| DB 연결 (health에서 database:up 확인) | [DONE] | Render PostgreSQL |

### 0-2. Render 환경변수 설정 ← 지금 필요

| 환경변수 | 값 | 상태 |
|----------|-----|------|
| `NODE_ENV` | `production` | [ ] |
| `PORT` | `3001` | [ ] |
| `DATABASE_URL` | Render 내부 PostgreSQL URL | [ ] |
| `REDIS_URL` | Render 내부 Redis URL | [ ] |
| `JWT_ACCESS_SECRET` | 랜덤 64자 이상 문자열 | [ ] |
| `JWT_REFRESH_SECRET` | 랜덤 64자 이상 문자열 (ACCESS와 다르게) | [ ] |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | [ ] |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | [ ] |
| `FRONTEND_URL` | `https://insagwanri-nine.vercel.app` | [ ] |
| `RESEND_API_KEY` | Resend 대시보드에서 발급 | [ ] |
| `EMAIL_FROM` | `noreply@gwanriwang.com` 등 | [ ] |
| `OPENAI_API_KEY` | OpenAI 대시보드에서 발급 | [ ] |
| `AWS_REGION` / `AWS_S3_BUCKET` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | R2 설정값 | [ ] |

### 0-3. DB 마이그레이션 실행

| 항목 | 상태 | 비고 |
|------|------|------|
| Render에서 migration:run 실행 | [ ] | 테이블 생성 — Render Shell 또는 migration Task |
| 마스터 데이터 시드 실행 | [ ] | 초기 플랜/권한 데이터 |

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
| auth | [CODE] | 회원가입/로그인/토큰갱신/로그아웃 — 섹션 0-4에서 검증 |
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

### Frontend — Customer Web

| 페이지 | 상태 |
|--------|------|
| /login, /register | [CODE] — 오늘 API 연결 확인 중 |
| /invite | [CODE] |
| / (대시보드) | [CODE] |
| /attendance | [CODE] |
| /tasks, /tasks/reports | [CODE] |
| /schedule | [CODE] |
| /messages | [CODE] |
| /ai | [CODE] |
| /team | [CODE] |
| /settings | [CODE] |
| /subscription | [CODE] |
| /onboarding/plan, /onboarding/payment | [CODE] |

---

## 3. Admin 시스템

| 항목 | 상태 | 비고 |
|------|------|------|
| Admin Backend (NestJS :4001) | [CODE] | admin-backend/ — 미배포 |
| Admin Auth (TOTP MFA, 2단계) | [CODE] | |
| Companies / Plans / Payments / Coupons 모듈 | [CODE] | |
| Feature Flags (Redis TTL 5분 캐시) | [CODE] | |
| Admin Users / AuditInterceptor / RolesGuard | [CODE] | |
| IP 화이트리스트 미들웨어 | [CODE] | ADMIN_ALLOWED_IPS |
| Toss Payments 빌링키 자동결제 + Dunning | [CODE] | D+1/D+3/D+7 |
| PG 빌링키 AES-256 암호화 | [CODE] | BILLING_KEY_ENCRYPTION_KEY |
| Admin DB 마이그레이션 | [CODE] | 1741910500000-AdminSchema |
| Admin Web Dashboard (Next.js :3002) | [CODE] | admin-web/ — 9개 페이지, 미배포 |
| e-세금계산서 API 연동 | [MANUAL] | 별도 영업 계약 필요 |

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
| Expo Push Notifications (usePushNotifications) | [CODE] |
| GPS 출퇴근 (expo-location Accuracy.High) | [CODE] |

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
| Vercel 프로젝트 연결 | [DONE] | 오늘 완료 |
| Render 배포 | [DONE] | health 응답 확인 |
| Render 환경변수 설정 | [ ] | 섹션 0-2 참조 |

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
| Tailwind CSS 프로덕션 미적용 | [DONE] | `postcss.config.js` 누락 → Vercel 클린 빌드에서 @tailwind 미처리 | `web/postcss.config.js` 추가, Redeploy 캐시 없이 |
| "네트워크 연결을 확인해주세요" 반복 토스트 | [DONE] | Render cold start > axios 15초 timeout | timeout 60s로 상향, timeout/네트워크 에러 메시지 구분 |
| API 요청이 localhost:3001로 날아감 | [DONE] | `vercel.json` env는 빌드타임 NEXT_PUBLIC_* 미적용, 폴백이 localhost | `api.ts` 폴백을 `/api/v1`로 변경, Vercel 대시보드에 env 추가 |
| 서버 500 오류 (auth) | [ ] | Render 환경변수 미설정 (JWT_SECRET 등) | 섹션 0-2 환경변수 설정 필요 |

---

## 10. 미결 의사결정

| 항목 | 선택지 | 비고 |
|------|--------|------|
| 이메일 발송 서비스 | **Resend** | 구현 완료 |
| 이미지 스토리지 | **Cloudflare R2** | 설정 완료 (2026-03-22) |
| 반복 일정 처리 | **rrule 라이브러리** | 구현 완료 |
| e-세금계산서 연동 | 케이세인 / 아이스크림 / 비즈인포 | 영업 계약 필요 |
| 모노레포 도구 | 현재 단일 레포 (Turborepo 전환 가능) | |
| 모바일 배포 | **EAS Build** | 앱스토어 배포 시 필요 |
| 차트 라이브러리 | **recharts** | 조직통계, 급여차트 구현 시 설치 필요 |
| 전자서명 | 직접 구현 또는 외부 API | 계약관리 구현 시 결정 필요 |

---

## 11. 레퍼런스 분석 기반 신규 구현 항목 (2026-03-22 추가)

> 상세 스펙: `docs/reference-design-analysis.md` 참조

### 11-1. 공통 UI 컴포넌트

| 항목 | 상태 | 상세 |
|------|------|------|
| 컬러풀 Avatar 컴포넌트 | [ ] | 이름 해시 → 고정 배경색, sm/md/lg/xl 사이즈 |
| 파스텔 뱃지 시스템 개선 | [ ] | 정규직/계약직/의무/회사/개인 등 |
| 데이터 테이블 공통 (정렬/필터/검색/페이지네이션) | [ ] | |
| 좌측 트리 사이드바 레이아웃 | [ ] | 부서트리 + 우측 콘텐츠 |
| Rich Text 에디터 | [ ] | 결재문서, 퇴직/휴직사유 등 |

### 11-2. 직원 관리 확장 (`/team`)

| 항목 | 상태 | 상세 |
|------|------|------|
| 직원 목록 — 부서 트리 사이드바 + 아바타 | [ ] | 현재는 단순 목록 |
| 직원 상세 — 탭 페이지 (`/team/[id]`) | [ ] | 기본정보/인사정보/계약/부가/근무휴기 탭 |
| 직원 상세 — 경력/학력 | [ ] | |
| 직원 상세 — 첨부문서 (카테고리별 파일) | [ ] | 가족관계증명서, 주민등록등본 등 |
| 퇴직신청 모달 | [ ] | 퇴직구분, 마지막근무일, 퇴직사유 |
| 휴직신청 모달 | [ ] | 휴직구분, 휴직기간, 사유 |
| 복직 처리 모달 | [ ] | 복직일, 인사기록 유지/초기화 |
| 인사노트 (`/team/notes`) | [ ] | 직원별 노트 목록/작성 |
| 증명서 발급 (재직/경력) | [ ] | 발급 모달 + 미리보기 |

### 11-3. 근무 관리 확장 (`/attendance`)

| 항목 | 상태 | 상세 |
|------|------|------|
| 팀별 주간 스케줄 카드 뷰 | [ ] | 요일별 색상 카드, 팀 멤버 아바타 |
| 직원별 근태 통계 테이블 | [ ] | 근무일%, 결근, 조퇴, 지각, 휴가, 연장 |
| 연장근무 hover 툴팁 | [ ] | |
| 월별 캘린더 출퇴근 뷰 | [ ] | 직원×날짜 교차 테이블, 지각/조퇴 뱃지 |

### 11-4. 급여 관리 (`/salary`) — 신규

| 항목 | 상태 | 상세 |
|------|------|------|
| 급여 목록 테이블 | [ ] | 근무일, 지급(비과세/과세), 공제, 차인지급액 |
| 급여 명세서 상세 | [ ] | 지급/공제 항목 상세, PDF 출력 |
| 급여 계산 로직 (백엔드) | [ ] | 기본급 + 수당 - 4대보험 - 소득세 |
| 최저시급 위반 감지 | [ ] | |
| Backend API (`/salary`) | [ ] | |

### 11-5. 계약 관리 (`/contracts`) — 신규

| 항목 | 상태 | 상세 |
|------|------|------|
| 직원별 계약서 현황 목록 | [ ] | 계약서 칩, 최근 계약일 |
| 계약서 뷰어 (근로/연봉/동의서 등) | [ ] | |
| 전자서명 플로우 (요청→서명→PDF) | [ ] | |
| Backend API (`/contracts`) | [ ] | |

### 11-6. 전자결재 (`/approvals`) — 신규

| 항목 | 상태 | 상세 |
|------|------|------|
| 결재함 목록 (필터/검색) | [ ] | 결재대기/결재중/반려/완료 |
| 결재 문서 상세 | [ ] | 첨부파일 뷰어, 결재현황, 댓글 |
| 결재하기/반려 액션 | [ ] | |
| 새 문서 작성 (Rich text + 첨부) | [ ] | |
| 결재선 설정 (결재자/참조자) | [ ] | |
| Backend API (`/approvals`) | [ ] | |

### 11-7. 휴가 관리 (`/vacations`) — 신규

| 항목 | 상태 | 상세 |
|------|------|------|
| 직원별 연차 현황 테이블 (월별) | [ ] | +부여/-사용 뱃지, 월별 사용일 |
| 연차 매니저 설정 | [ ] | 자동부여 기준, 회계일, 미사용 처리 |
| 휴가 신청/승인 플로우 | [~] | 전자결재 연동 필요 |
| Backend API (`/vacations`) | [ ] | |

### 11-8. 조직 통계 (`/team/stats`) — 신규

| 항목 | 상태 | 상세 |
|------|------|------|
| 월별 입사/퇴사/전체 혼합 차트 (recharts) | [ ] | |
| 근속 집계 파이 차트 | [ ] | |
| 나이 분포 파이 차트 | [ ] | |
| 부서/직위 집계 테이블 | [ ] | |

### 11-9. 인사평가 (`/evaluations`) — 신규

| 항목 | 상태 | 상세 |
|------|------|------|
| 평가 목록 및 스킴 관리 | [ ] | |
| 평가자 배정 (부서×직원 그리드) | [ ] | |
| 평가 시트 (다면평가/본인평가) | [ ] | |

### 11-10. 교육 관리 (`/training`) — 신규

| 항목 | 상태 | 상세 |
|------|------|------|
| 교육계획 목록 (테이블/카드 뷰) | [ ] | 의무/회사/개인 구분, 이수현황 % |
| 교육신청 및 이수 처리 | [ ] | |
| 교육계획 등록/수정 | [ ] | |

### 11-11. 앱 (모바일) 개선

| 항목 | 상태 | 상세 |
|------|------|------|
| 홈 화면 — 잔여휴가/출근부/생일 카드 | [ ] | |
| 홈 화면 — 이번주 근무일정 미니 캘린더 | [ ] | |
| 근무 상태 드롭다운 (근무중/휴식/퇴근) | [ ] | |
| 휴가신청 폼 개선 | [~] | 결재선 선택 추가 필요 |
