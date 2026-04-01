# Claude Code로 SaaS 서비스 만들기 — 완전 가이드

> 이 문서는 "관리왕" 프로젝트를 처음부터 끝까지 Claude Code로 만드는 과정에서 검증된
> **순서, 패턴, 프롬프트**를 정리한 것입니다.
>
> 목표: 이 가이드를 참고하여 **완전히 다른 서비스**를 빠르고 견고하게 만들 수 있도록.

---

## 전체 빌드 순서 한눈에 보기

```
Phase 0 — 설계 & 컨텍스트 주입
Phase 1 — 백엔드 뼈대 (NestJS + DB + Auth)
Phase 2 — 멀티테넌트 기반 & 핵심 엔티티
Phase 3 — 비즈니스 기능 모듈 (반복 패턴)
Phase 4 — 웹 프론트엔드 (Next.js)
Phase 5 — 실시간 & AI 연동
Phase 6 — 모바일 앱 (React Native + Expo)
Phase 7 — 관리자(Admin) 시스템
Phase 8 — 보안 & 법규 준수
Phase 9 — 배포 & 인프라
Phase 10 — 안정성 점검
```

---

## 개인 프로젝트에서 사업용 SaaS로 가는 현실적인 단계

> 처음부터 "엔터프라이즈급" 구조를 구축할 필요는 없습니다.
> 아래 단계별 로드맵은 "혼자 시작해서 끊김 없이 업그레이드"하는 전략을 제시합니다.
> 각 단계의 기술 구현 세부사항은 이후 Phase들에서 다룹니다.

### 1단계 — 개인·사이드 프로젝트

**목표**: 최소 비용으로 작동하는 서비스를 만들어 아이디어를 검증한다.

- 단일 PostgreSQL + 공유 테넌트 구조, `service` 레이어에서 `companyId` 필터만 사용
- Render 무료 티어 (백엔드 슬립 허용) + Vercel 무료 (프론트) 조합
- 보안은 최소 수준: HTTPS, bcrypt 비밀번호 해시, 기본 활동 로그
- PIPA 준수는 개인정보보호위원회 가이드를 읽고 최소 요건(암호화, 개인정보 처리방침 게시) 파악

**우선순위**: 기능 완성 → 고객 반응 검증 → 그 다음에 인프라 업그레이드

### 2단계 — 초기 유료 고객 확보 (월 수십만 원 수준)

**목표**: 실제 고객 데이터를 안전하게 다루는 구조로 전환한다.

- 멀티테넌트 구조 정비: 모든 쿼리에 `companyId` 명시적 포함 (RLS 도입 대비)
- **DB는 유료 플랜으로 전환**: 무료 DB는 데이터 보장이 없음 (아래 인프라 주의사항 참고)
- 감사 로그·접속기록 강화, 이메일 인증 필수화
- Render Starter 플랜 이상: 슬립 없는 상시 기동, 자동 백업
- RLS(Row-Level Security) 도입 검토 시작

### 3단계 — 월 수백만~수천만 원 수준 매출

**목표**: 보안과 신뢰를 제품 경쟁력으로 삼는다.

- Admin 시스템 분리 배포, per-tenant rate limit 적용
- RLS + 서비스 레이어 **2중 방어** 구조 완성 (Phase 2 참고)
- Tamper-evident 감사 로그 (별도 로그 서버 또는 WORM 스토리지)
- **정식 PIPA 컨설팅** 및 개인정보 처리방침·수탁 계약서 정비
- 침해사고 대응 프로세스, 백업 복구 훈련 수행

### 4단계 — 엔터프라이즈 검토

**목표**: 대형 고객의 보안·컴플라이언스 요구사항에 대응한다.

- 테넌트 분리 전략 옵션 검토: schema-per-tenant 또는 DB-per-tenant
- 전용 인스턴스 제공, SLA 계약, 보안 감사 대응
- SOC2, ISO 27001 등 인증 취득 검토

> **핵심 메시지**: 1단계에서 "companyId를 모든 쿼리에 명시"하는 습관만 들여도
> 3단계의 RLS 전환이 훨씬 쉬워집니다. 처음부터 구조적으로 올바르게 설계하되,
> 불필요하게 복잡한 인프라는 매출이 정당화될 때 추가하세요.

---

## Phase 0 — 설계 & 컨텍스트 주입

> **가장 중요한 단계.** Claude에게 도메인 전체를 한 번에 이해시키는 것이 이후 모든 작업의 품질을 결정합니다.

### 0-1. 서비스 설계 문서 먼저 작성 (Claude와 함께)

```
[프롬프트 0-1: 서비스 설계]

나는 [서비스 설명: 예: 소규모 헬스장을 위한 회원 관리 SaaS]를 만들려고 한다.

다음 항목을 포함한 설계 문서를 작성해줘:

1. 서비스 개요 및 핵심 가치
2. 타깃 사용자 (회사 규모, 업종)
3. 기능 목록 (MVP / 추후 확장 분리)
4. 데이터 모델 (핵심 엔티티 5~10개)
5. 사용자 역할과 권한 구조
6. 과금 모델 (플랜별 기능 제한)
7. 기술 스택 추천 및 이유
8. 법적 요구사항 (개인정보보호법, 통신비밀보호법 등)

마크다운으로 작성하고 파일로 저장해줘.
```

**왜 중요한가**: Claude는 컨텍스트가 길수록 일관된 결정을 내립니다. 설계 문서가 없으면 Phase 3~5에서 서로 충돌하는 코드를 생성하게 됩니다.

### 0-2. 기술 스택 확정

이 프로젝트에서 검증된 스택:

| 레이어 | 기술 | 이유 |
|--------|------|------|
| 백엔드 | NestJS + TypeORM 0.3 | 데코레이터 기반, 모듈화 최적, Claude 친화적 |
| DB | PostgreSQL + Redis | JSONB, 파티셔닝, Row-Level Security |
| 웹 | Next.js 14 (App Router) | SSR/SSG, 파일 기반 라우팅 |
| 모바일 | React Native + Expo | 코드 공유, OTA 업데이트 |
| 상태관리 | Zustand + TanStack Query | 단순하고 Claude가 잘 생성함 |
| 배포 | Render (백엔드) + Vercel (프론트) | 저비용, 자동 배포 — 단, 아래 인프라 주의사항 필독 |

---

## Phase 1 — 백엔드 뼈대

### 1-1. 프로젝트 초기화

```
[프롬프트 1-1: NestJS 프로젝트 초기화]

NestJS 백엔드를 처음부터 설정해줘.

요구사항:
- TypeORM 0.3 + PostgreSQL
- JWT 인증 (Access Token 15분 + Refresh Token 7일)
- Refresh Token Rotation (DB에 해시 저장)
- 전역 응답 인터셉터: { success: true, data: ... }
- 전역 예외 필터 (HttpException + AllExceptions)
- @nestjs/throttler 전역 Rate Limiting (120req/60s)
- Winston 로거 (JSON 포맷, 파일 + 콘솔)
- .env 환경변수 분리
- health check 엔드포인트 (/api/v1/health)
- CORS 설정 (FRONTEND_URL 환경변수 기반)

파일 구조:
backend/
  src/
    common/            # 전역 interceptors, filters, guards
    database/entities/ # TypeORM 엔티티
    database/migrations/
    modules/           # 기능 모듈
  data-source.ts       # 로컬 CLI용
  data-source.prod.ts  # 프로덕션용

synchronize: false 고정, 모든 스키마 변경은 Migration으로.
```

**핵심 패턴**: `synchronize: false`는 절대 변경하지 말 것. 프로덕션 데이터 날아감.

### 1-2. 인증 모듈

```
[프롬프트 1-2: JWT 인증 완성]

다음을 구현해줘:

AuthModule:
- POST /auth/register — 회사 + owner 계정 동시 생성 (트랜잭션)
- POST /auth/login — 이메일/비밀번호, Rate Limit 5회/60초
- POST /auth/refresh — Refresh Token Rotation
- POST /auth/logout — DB refresh_token_hash null 처리
- GET /auth/me — 현재 사용자 정보

보안:
- bcrypt ROUNDS=12 비밀번호 해시
- 로그인 실패 5회 → 15분 잠금 (Redis)
- @Public() 데코레이터로 비인증 라우트 표시
- JwtAuthGuard 전역 적용

이메일 인증:
- 가입 시 인증 메일 발송 (비동기, 실패해도 가입 완료)
- GET /auth/verify-email?token=
- POST /auth/resend-verification

비밀번호 재설정:
- POST /auth/forgot-password (이메일 존재 여부 노출 금지)
- POST /auth/reset-password

User 엔티티에는 반드시:
- Soft Delete (DeleteDateColumn deleted_at)
- status: ACTIVE | INACTIVE | PENDING
- role: OWNER | MANAGER | EMPLOYEE
- companyId (멀티테넌트 격리)
```

---

## Phase 2 — 멀티테넌트 기반

> B2B SaaS의 핵심. 이 패턴을 처음부터 올바르게 설정해야 나중에 데이터 격리 버그가 없습니다.

### 멀티테넌트 격리 — 2중 방어 개념

이 서비스는 **2중 방어(Defense in Depth)** 원칙으로 테넌트 격리를 설계합니다.

```
1차 방어선: 서비스 레이어의 currentUser 기반 필터링
  → 모든 서비스 메서드에 currentUser.companyId를 명시적으로 포함

2차 방어선: DB Row Level Security(RLS) 또는 공통 Repository/쿼리 레이어에서의 강제 필터링
  → 초기에는 선택적이지만, 유료 고객 확보 시점부터 도입을 강력히 권장
```

**초기 전략**: service 레이어 필터만으로 시작하되, 모든 쿼리에 `companyId`를 명시해서 나중에 RLS를 도입하기 쉽도록 설계하라.

**장기 전략**: PostgreSQL RLS와 NestJS CLS(Continuation Local Storage) 또는 Request-scoped provider를 활용해 DB 레벨에서 한 번 더 테넌트 격리를 강제하는 방식을 권장한다. 이를 통해 서비스 레이어에서 companyId 필터를 빠뜨리는 실수가 있어도 DB 레벨에서 차단된다.

**역할과 테넌트 경계**: 모든 역할(OWNER/MANAGER/EMPLOYEE)은 특정 company(tenant)에 종속된 **tenant-scoped RBAC** 구조를 따른다. Admin, 실시간 이벤트, AI 기능에서도 역할 검사는 항상 해당 테넌트 컨텍스트 안에서 이루어져야 한다.

```
[프롬프트 2-1: 멀티테넌트 격리 패턴]

이 서비스는 멀티테넌트 B2B SaaS야.
모든 비즈니스 엔티티에 company_id를 포함하고,
서비스 레이어에서 항상 companyId 필터를 강제해.

패턴 예시:
- 모든 findAll에 where: { companyId: currentUser.companyId }
- 단일 조회도 반드시 companyId 포함 (다른 회사 데이터 접근 차단)
- JWT payload에 companyId 포함

다음을 구현해줘:

1. Company 엔티티 (name, plan, status, businessNumber 등)
2. WorkspaceModule: GET/PATCH /workspace (회사 정보 조회/수정)
3. InviteToken 엔티티 + 초대 링크 시스템
   - POST /workspace/invite-member
   - POST /auth/accept-invite?token=
4. UsersModule:
   - GET /users (같은 회사 직원 목록, 페이지네이션)
   - GET /users/:id (프로필)
   - PATCH /users/:id (수정 — 본인 또는 OWNER/MANAGER)
   - DELETE /users/:id (Soft Delete)

OWNER만 가능: 회사 설정 변경, 직원 강제 삭제
MANAGER: 일반 관리 기능
EMPLOYEE: 본인 정보만 수정
```

**핵심 패턴**: 서비스 메서드 시그니처에 항상 `currentUser` 포함

```typescript
// 좋은 패턴
async findAll(currentUser: AuthenticatedUser) {
  return this.repo.find({ where: { companyId: currentUser.companyId } });
}

// 나쁜 패턴 (companyId 없으면 전체 데이터 노출)
async findAll() {
  return this.repo.find();
}
```

---

## Phase 3 — 비즈니스 기능 모듈 (반복 패턴)

> Phase 3부터는 동일한 프롬프트 패턴을 반복합니다. 한 모듈을 완성하면 같은 구조로 다음 모듈을 만듭니다.

### 표준 모듈 프롬프트 템플릿

```
[프롬프트 3-X: [기능명] 모듈]

[기능명] 기능을 구현해줘.

## 엔티티 설계
[엔티티 이름]: {
  - id: UUID PK
  - company_id: UUID FK (멀티테넌트 격리)
  - [도메인 필드들]
  - created_at, updated_at, deleted_at (Soft Delete)
}

## 비즈니스 로직
- [상태 전이 규칙]
- [역할별 권한]
- [자동화 규칙]

## API 엔드포인트
- GET /[resource] — 목록 (페이지네이션, companyId 필터 필수)
- POST /[resource] — 생성
- GET /[resource]/:id — 단일 조회
- PATCH /[resource]/:id — 수정
- DELETE /[resource]/:id — Soft Delete

## Migration
타임스탬프: [현재시각 + 순서 번호]
테이블명: snake_case

## 프론트엔드 페이지 (/[resource])
- 목록 테이블 + 필터
- 등록/수정 모달 또는 슬라이드오버
- 상태 뱃지 (색상 구분)
- 로딩 스켈레톤 loading.tsx

반드시:
- 모든 조회에 companyId 필터
- 역할 체크 (@Roles() 데코레이터)
- DTO 유효성 검사 (class-validator)
- API 에러 핸들링 (try/catch + Alert)
```

### 이 프로젝트에서 구현한 모듈 목록 (참고용)

| 모듈 | 핵심 엔티티 | 특이사항 |
|------|------------|---------|
| Attendance | AttendanceRecord | GPS 플래그 정책, 3년 보관 Cron |
| Salary | Salary | 4대보험 자동계산 공식 |
| Vacation | VacationRequest, VacationBalance | 연차 자동 계산 |
| Approvals | ApprovalDocument, ApprovalStep | 순차 결재 워크플로우 |
| Contracts | Contract | 만료일 자동 감지 |
| Calendar | CalendarEvent | scope: company/team/personal |
| Evaluations | EvaluationCycle, Evaluation | 3단계 프라이버시 설정 |
| Training | Training, TrainingEnrollment | 수료율 추적 |
| HrNotes | HrNote | 관리자 전용 메모 |
| Certificates | (users 기반) | PDF 출력용 HTML 렌더링 |

---

## Phase 4 — 웹 프론트엔드

### 4-1. Next.js 초기화

```
[프롬프트 4-1: Next.js 프론트엔드 초기화]

Next.js 14 App Router 기반 프론트엔드를 만들어줘.

구조:
web/src/
  app/
    (auth)/         # 로그인, 회원가입
    (dashboard)/    # 인증 필요한 페이지들
  components/
    layout/         # Sidebar, Header
    ui/             # 공통 컴포넌트
  lib/
    api.ts          # axios 인스턴스 (토큰 인터셉터)
  store/
    auth.store.ts   # Zustand 인증 상태

요구사항:
- Tailwind CSS (다른 UI 라이브러리 없이)
- axios 인터셉터: 401 → refresh → retry
- 토큰 localStorage 저장 (SSR 고려한 클라이언트 전용)
- Sidebar: 서비스 메뉴 + 회사명 + 사용자 아바타
- (dashboard)/layout.tsx: 인증 체크 + 레이아웃
- TanStack Query + QueryClientProvider
- loading.tsx 패턴 (스켈레톤 UI)

환경변수:
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

### 4-2. 프론트엔드 페이지 패턴

```
[프롬프트 4-2: [기능명] 페이지]

/[기능경로] 페이지를 만들어줘.

백엔드 API:
- GET [API_URL]/[resource] — 파라미터: [목록 파라미터]
- POST [API_URL]/[resource]
- PATCH [API_URL]/[resource]/:id
- DELETE [API_URL]/[resource]/:id

화면 구성:
- 상단: 제목 + [주요 액션 버튼]
- 필터 바: [필터 항목들]
- 메인: [테이블 또는 카드 레이아웃]
- 모달: [등록/수정 폼]

상태 뱃지 색상:
- [상태1]: 초록 (bg-green-100 text-green-700)
- [상태2]: 노랑 (bg-yellow-100 text-yellow-700)
- [상태3]: 빨강 (bg-red-100 text-red-700)

반드시 포함:
- TanStack Query useQuery (캐싱)
- 낙관적 업데이트 또는 invalidateQueries
- 로딩 스켈레톤
- 빈 상태 메시지
- 에러 토스트
- loading.tsx (SkeletonTablePage 사용)
```

---

## Phase 5 — 실시간 & AI 연동

### 5-1. WebSocket (Socket.IO)

```
[프롬프트 5-1: 실시간 채팅/알림]

Socket.IO 기반 실시간 기능을 구현해줘.

채널 시스템:
- Channel 엔티티 (type: DIRECT | GROUP | COMPANY_WIDE)
- ChannelMember, Message 엔티티
- 회사별 네임스페이스 격리 (company_id)

Socket 이벤트:
- join-channel, leave-channel
- send-message → message-received (브로드캐스트)
- typing → typing-indicator
- read-receipt

알림 시스템:
- Notification 엔티티 (type, isRead, targetUserId)
- 이벤트 발생 시 DB 저장 + Socket 전송
- POST /notifications/read-all

프론트엔드:
- socket.io-client
- 읽지 않은 수 뱃지
- 실시간 메시지 스크롤
```

### 5-2. AI 기능

> **비용 및 법규 주의사항** — AI 기능 도입 전 반드시 확인

**비용 관리**:
- 테넌트 전체 합산 기준 일일/월별 글로벌 상한선을 설정하고, 임계치 도달 시 AI 기능을 일시 제한하거나 Slack/이메일 알림을 발송하는 구조를 구현하라.
- Admin 대시보드에서 테넌트별 AI 사용량과 예상 비용을 모니터링할 수 있도록 `AiRequest` 엔티티에 토큰 수와 예상 비용 컬럼을 포함하라.

**법규 주의 (한국 PIPA)**:
- 한국 사용자의 개인정보·민감정보를 OpenAI 등 해외 API 공급자에게 전송하는 것은 PIPA 상 **개인정보 국외 이전 및 처리 위탁**에 해당할 수 있다. 이 경우 개인정보 처리방침에 국외 이전 사실(수탁 업체명, 국가, 이전 항목, 목적 등)을 명시하고, 필요한 경우 별도 동의 절차를 구현해야 한다.
- **민감정보(건강정보, 평가 내용, 인사 기록 등)를 AI 프롬프트에 직접 포함하지 않도록** UI/백엔드에서 제한하거나 경고를 표시하는 패턴을 갖추는 것을 권장한다. 예: 평가 요약 AI 기능에서는 직원 이름 등 식별자를 프롬프트에서 제거하고 익명 처리 후 전송.

```
[프롬프트 5-2: AI 연동]

OpenAI API를 활용한 [AI 기능]을 구현해줘.

사용 사례: [예: 성과 평가 초안 자동 생성, 계약서 요약, 리포트 작성]

요구사항:
- AiModule: AiRequest 엔티티로 사용 이력 추적
  - 컬럼: userId, companyId, feature, promptTokens, completionTokens, estimatedCostUsd, createdAt
- 플랜별 일일 사용량 제한 (FREE: 10회, BASIC: 50회, PRO: 200회)
- 테넌트 전체 일일 글로벌 상한선 (환경변수로 설정, 초과 시 503 + 알림)
- 프롬프트 템플릿 분리 (코드에 하드코딩 금지)
- 스트리밍 응답 (Server-Sent Events)
- 에러 시 재시도 1회
- 모든 AI 결과에 면책 문구: "이 결과는 참고용이며 전문가의 검토가 필요합니다"
- 민감정보를 프롬프트에 포함하지 않도록 입력 전처리 단계 포함

OpenAI 설정:
- model: gpt-4o (환경변수로)
- max_tokens: 2000
- timeout: 30초
```

---

## Phase 6 — 모바일 앱

```
[프롬프트 6-1: React Native + Expo 초기화]

React Native + Expo 모바일 앱을 만들어줘.

스택:
- Expo SDK 51, expo-router (파일 기반 라우팅)
- Zustand (인증 상태)
- axios (API 클라이언트)
- expo-secure-store (토큰 저장 — Keychain/Keystore)
- expo-location (GPS)
- TanStack Query

구조:
mobile/src/
  app/
    (auth)/    # 로그인
    (tabs)/    # 탭 네비게이션
  store/
    auth.store.ts
  lib/
    api.ts

탭 구성: [앱에 맞는 탭 목록]

공통 패턴:
- 토큰 만료 시 자동 refresh + retry
- 네트워크 오류 시 오프라인 표시
- Pull-to-refresh
- 무한 스크롤
```

```
[프롬프트 6-2: 소셜 로그인 (모바일)]

모바일 Google 소셜 로그인을 구현해줘.

Google:
- expo-auth-session AuthRequest (PKCE)
- 코드 → POST /auth/social/mobile { provider: 'google', code, redirect_uri }

신규 유저 처리:
- 서버에서 { type: 'register', pending_token } 반환 시
- /(auth)/social-complete 화면으로 이동
- 회사명/추가 정보 입력 후 가입 완료

소셜 로그인 구조는 SocialProvider 인터페이스/전략 패턴으로 설계하여
Kakao, Naver 등 다른 IdP를 나중에 쉽게 추가할 수 있도록 확장 가능하게 구성해줘.

환경변수:
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=
```

---

## Phase 7 — 관리자(Admin) 시스템

> 고객사 데이터를 관리하는 내부 도구. 일반 서비스와 완전히 분리된 별도 서비스로 만드는 것이 원칙.

```
[프롬프트 7-1: Admin 시스템]

서비스 운영을 위한 Admin 시스템을 별도 NestJS 서비스로 만들어줘.

분리 이유:
- 보안 (IP 화이트리스트, 별도 인증)
- 고객 데이터 접근 권한 분리
- 서비스 장애 시 Admin 영향 없음

Admin Backend (포트 4001):
- 별도 JWT 시크릿 (ADMIN_JWT_SECRET)
- 관리자 역할: SUPER_ADMIN | OPERATIONS | BILLING | SUPPORT | READONLY
- IP 화이트리스트 Guard
- 모든 Admin 행동은 감사 로그에 기록 (누가 어떤 고객 데이터에 접근/수정했는지)
- Impersonation 기능은 SUPER_ADMIN/OPERATIONS 역할로 제한하고, 사용 시 반드시 감사 로그 기록

Admin 기능:
1. 회사 관리: 목록/조회/계획변경/데이터삭제
2. Impersonation: POST /companies/:id/impersonate (고객 JWT 발급, 30분 TTL)
3. 구독/결제 관리
4. 브로드캐스트: 전체/플랜별/특정회사 공지
5. Analytics:
   - 실시간 대시보드 (DAU, 출근중, API 부하)
   - 퍼널 분석 (회원가입→첫로그인→첫기능사용→구독전환)
   - 테넌트별 AI 사용량 및 예상 비용 모니터링
6. 감사 로그 (admin 행동 기록)

Admin Web (별도 Vercel 배포):
- 심플한 테이블 UI (Next.js)
- 별도 도메인 (admin.your-service.com)
```

---

## Phase 8 — 보안 & 법규 준수

> 한국에서 서비스하면 반드시 필요한 항목들. 처음부터 포함하면 나중에 리팩토링 비용이 없습니다.

> ⚠️ **중요 안내**: 아래 내용은 개발 관점의 최소 기술 패턴 예시에 가깝습니다.
> 실제 PIPA(개인정보보호법)/통신비밀보호법 준수를 위해서는
> **개인정보보호위원회·행안부 등에서 제공하는 공식 가이드라인과
> 별도의 법률 자문을 반드시 병행**해야 합니다.
> 기술 구현만으로 법적 요건이 충족되지 않을 수 있으며,
> 서비스 규모와 처리하는 개인정보의 성격에 따라 추가 의무가 발생합니다.

### PIPA 준수 체크리스트 (기술 구현 외 필수 확인 항목)

개인정보보호위원회 고시 및 PIPA 요건 중 기술 구현과 병행해야 할 비기술적 항목:

- [ ] **개인정보 처리방침** 작성 및 서비스 내 게시 (수집 항목, 이용 목적, 보유 기간, 제3자 제공/국외 이전 명시)
- [ ] **동의서** 설계: 필수/선택 항목 구분, 철회 절차 마련
- [ ] **제3자 제공·국외 이전**: OpenAI 등 해외 서비스 활용 시 처리방침에 기재 및 필요 시 동의 절차 구현
- [ ] **파기 절차**: 보유 기간 만료 데이터의 안전한 파기(물리적 삭제 또는 복원 불가 조치)
- [ ] **침해사고 신고·통지 의무**: 72시간 이내 개인정보보호위원회 신고 절차 수립, 정보주체 통지 프로세스 마련
- [ ] **기술적·관리적 보호조치**: 접속기록 위·변조 방지, 접근권한 관리 및 최소 권한 원칙 적용
- [ ] **개인정보 처리방침 버전 관리**: 변경 시 변경 이력 보관 및 공지

### 8-1. 개인정보 암호화

> 암호화 키(ENCRYPTION_KEY, HMAC_SECRET)는 환경변수에 직접 저장하는 것 외에,
> 프로덕션 환경에서는 AWS KMS, GCP Cloud KMS, HashiCorp Vault 등
> **별도 키 관리 체계(KMS)를 통해 주기적 키 교체와 접근 통제를 설계**해야 한다.
> 키가 소스코드나 로그에 노출되면 암호화 전체가 무의미해진다.

```
[프롬프트 8-1: 개인정보 암호화]

개인정보보호법 준수를 위한 암호화를 구현해줘.

암호화 대상:
- users.email — HMAC-SHA256 해시(검색용) + AES-256-GCM(저장)
- users.name — AES-256-GCM
- [서비스 특성에 따른 민감 필드 추가]

구현 방식:
1. CryptoService (AES-256-GCM + HMAC-SHA256)
   - ENCRYPTION_KEY: 32바이트 hex 환경변수
   - HMAC_SECRET: 32바이트 hex 환경변수
2. TypeORM UserSubscriber
   - BeforeInsert/BeforeUpdate: 평문 → 암호화
   - AfterLoad: 암호화 → 평문 (투명 복호화)
3. 로그인 쿼리: email_hash로 조회 (평문 email WHERE 절 제거)
4. CryptoMigrationService: 앱 기동 시 기존 데이터 자동 백필

Migration:
- email_hash VARCHAR(64), email_encrypted TEXT, name_encrypted TEXT 추가
- 기존 UNIQUE(email, company_id) → UNIQUE(email_hash, company_id) 변경
```

### 8-2. 통신비밀보호법 활동 로그

> 활동 로그는 **관리자 최소 권한 원칙**으로 열람을 제한해야 한다.
> 즉, 운영 담당자라도 업무상 필요한 범위의 로그만 열람 가능하도록 역할 기반 접근 제어를 적용하라.
> 또한 로그의 위·변조를 방지하기 위해 별도 로그 서버로 전송하거나,
> WORM(Write Once Read Many) 스토리지, 또는 타임스탬프 서명 등
> **무결성 보호 방안을 장기적으로 도입**하는 것을 강력히 권장한다.

```
[프롬프트 8-2: 통신비밀보호법 활동 로그]

통신비밀보호법 준수를 위한 활동 로그를 구현해줘.

요구사항:
- 보관 기간: 90일 (법정 최소)
- 기록 항목: 로그인/로그아웃/API 요청
- IP 주소: AES-256-GCM 암호화 저장

구현:
1. UserActivityLog 엔티티
   - action: LOGIN | LOGOUT | API_CALL
   - ip_address_encrypted, user_agent, path, method, status_code
2. ActivityLogService
   - log(): fire-and-forget (메인 요청 블로킹 없음)
   - @Cron('30 2 * * *'): 90일 경과 자동 삭제
3. 통합:
   - LoggingInterceptor: 인증 사용자 API 요청 저장
   - AuthService.login/logout: 직접 기록

반드시:
- ScheduleModule.forRoot()를 app.module.ts에 추가
- 삭제는 DELETE 아닌 physical delete (보관 의무 충족 후 삭제이므로 OK)
- 로그 열람 API는 SUPER_ADMIN/OPERATIONS 역할로만 접근 제한
```

### 8-3. OAuth 소셜 로그인

소셜 로그인 기본 구현은 **Google만** 포함한다. Kakao, Naver 등 추가 IdP가 필요한 경우 `SocialStrategy` 인터페이스를 확장해 별도로 구현할 수 있다.

```
[프롬프트 8-3: OAuth 소셜 로그인]

Google 소셜 로그인을 구현해줘.
나중에 Kakao·Naver 등 다른 IdP를 쉽게 추가할 수 있도록
SocialProvider 인터페이스/전략 패턴으로 확장 가능하게 설계해줘.

백엔드:
- Google: passport-google-oauth20 + GoogleStrategy
- handleSocialLogin(): provider+accountId → 기존 계정 조회 → 이메일 자동 연결
- completeSocialRegister(): pending JWT → 회사명 입력 → 가입 완료
- POST /auth/social/mobile: 모바일 코드 교환 엔드포인트

웹 리다이렉트 플로우:
  GET /auth/google → Google 로그인 → GET /auth/google/callback
  → 기존 유저: /auth/callback?access_token=...&refresh_token=...
  → 신규 유저: /auth/social-complete?pending_token=...

User 엔티티 추가 컬럼:
- provider (VARCHAR 20 nullable)
- provider_account_id (VARCHAR 255 nullable)
- password_hash: NOT NULL → nullable (소셜 전용 계정 허용)

환경변수:
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL
```

---

## Phase 9 — 배포 & 인프라

> **비용 절감 vs 데이터 안전** — 이 섹션을 반드시 읽고 시작하세요.

### 인프라 비용 원칙

개발·실험 단계에서는 무료/저렴한 조합으로 시작하되, **데이터와 보안에 해당하는 부분만은 초기부터 최소한의 비용을 투자**해야 합니다.

무료 플랜으로 절감할 수 있는 항목과 투자해야 할 항목을 명확히 구분하세요:

| 항목 | 무료 가능 여부 | 이유 |
|------|--------------|------|
| 백엔드 Web Service (슬립 허용) | 개발/실험 단계만 | 프로덕션에서는 슬립/웜업 지연으로 사용자 경험 저하 |
| 프론트엔드 (Vercel) | 가능 | 정적 자산, 슬립 없음 |
| PostgreSQL | **사용 불가** | 무료 DB는 만료·백업 미지원 → 데이터 손실 위험 |
| Redis | 무료 가능 | 세션/캐시는 휘발성 허용 가능 |
| 로그/백업 | **투자 필요** | 데이터 복구 불가 시 서비스 종료 수준 피해 |

> **핵심**: DB와 로그/백업만은 돈을 아껴서는 안 되는 영역입니다.
> Render 무료 PostgreSQL은 90일 만료, 자동 백업 미지원으로
> 실제 고객 데이터가 들어가는 순간부터 **Render Starter 플랜 이상 또는
> Supabase, PlanetScale 등 관리형 DB 서비스 사용을 강력히 권장**합니다.

### Render 무료 플랜 주의사항

- **무료 Web Service**: 15분 비활성 시 슬립 → 첫 요청 웜업에 30초~1분 소요. 실제 고객용 프로덕션에는 적합하지 않음.
- **무료 PostgreSQL**: 90일 후 만료, 자동 백업 없음, 데이터 손실 시 복구 불가. **절대 프로덕션 데이터에 사용 금지.**
- 초기 유료 고객 유입 전까지는 무료 플랜으로 실험하되, 첫 결제 고객 확보 즉시 DB를 유료 플랜으로 업그레이드하라.

```
[프롬프트 9-1: Render 배포 설정]

Render.com 배포를 위한 render.yaml을 작성해줘.

서비스 구성:
1. insagwanri-backend (Web Service, Node, 포트 3001)
   - rootDir: backend
   - buildCommand: npm install --legacy-peer-deps --include=dev && npm run build
   - startCommand: node node_modules/typeorm/cli.js migration:run -d dist/data-source.prod.js && node dist/main.js
   - healthCheckPath: /api/v1/health

2. insagwanri-db (PostgreSQL) — 반드시 유료 플랜 사용 (데이터 보장)
3. insagwanri-redis (Redis)

환경변수 (sync: false = 대시보드에서 직접 입력):
- JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
- ENCRYPTION_KEY, HMAC_SECRET
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- RESEND_API_KEY
- OPENAI_API_KEY

주의사항:
- startCommand에서 migration:run 먼저 실행 (롤링 배포 안전성)
- DATABASE_URL 또는 개별 DB 환경변수 중 하나 선택
```

```
[프롬프트 9-2: Vercel 배포 설정]

Next.js 프론트엔드 Vercel 배포 설정을 해줘.

vercel.json:
- headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- CSP에 반드시 포함: connect-src 백엔드 도메인 + wss:// (WebSocket)
- rewrites: /api/* → 백엔드 URL (CORS 우회는 선택사항)

next.config.js:
- images.remotePatterns: S3/R2 도메인
- env: NEXT_PUBLIC_API_URL

Vercel 환경변수:
- NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api/v1
```

---

## Phase 10 — 안정성 점검

> 각 Phase 완료 후 또는 대규모 기능 추가 후 반드시 실행합니다.

```
[프롬프트 10-1: 전체 안정성 점검]

다음 항목을 분석하고 문제를 찾아 수정해줘:

## 백엔드 점검
1. app.module.ts — 모든 엔티티/모듈이 등록되었는지
2. 모든 서비스 메서드 — companyId 격리 누락 없는지
3. TypeORM deprecated API 사용 (findByIds → find+In 등)
4. Migration 파일 — 누락된 마이그레이션 없는지
5. ScheduleModule.forRoot() 등록 여부 (@Cron 사용 시)
6. import 경로 오류 (@/store/authStore vs @/store/auth.store)

## 프론트엔드 점검
1. 모든 (dashboard) 페이지에 loading.tsx 존재 여부
2. API 호출 에러 핸들링 누락
3. 인증 상태 확인 없는 페이지
4. next.config.js CSP 헤더 wss:// 포함 여부

## 보안 점검
1. Public 라우트에 민감 정보 노출 없는지
2. 관리자 전용 기능에 역할 체크
3. 파일 업로드 타입/크기 검증
4. AI 기능 — 민감정보가 프롬프트에 포함될 수 있는 경로 점검
5. 활동 로그 열람 API — SUPER_ADMIN/OPERATIONS 역할 제한 확인

수정 후 테스트:
- 로그인 → 각 기능 → 로그아웃 플로우
- 다른 회사 데이터 접근 시도 → 403 반환 확인
```

---

## 핵심 프롬프트 패턴 & 팁

### 1. 컨텍스트 전달 방식

```
# 매 세션 시작 시 이렇게 시작하면 좋음:
"현재 프로젝트 구조를 파악해줘. remaining-tasks.md와 app.module.ts,
주요 엔티티 파일들을 읽고 현재 상태를 파악한 후 [다음 작업]을 진행해줘."
```

### 2. 대규모 기능 추가 패턴

```
# 먼저 계획 수립
"[기능 설명]을 구현하기 전에 현재 코드베이스를 분석하고
최적화된 구현 계획을 세워줘. 수정이 필요한 파일 목록과
각 파일에서 할 변경사항을 정리해줘."

# 계획 확인 후 실행
"계획대로 구현해줘."
```

### 3. 마이그레이션 생성 패턴

```
"다음 변경사항을 위한 TypeORM Migration 파일을 만들어줘:
- [변경 내용]

타임스탬프: [현재 Unix 시간]000
주의: DROP 쿼리가 포함되면 반드시 알려줘."
```

### 4. 디버깅 패턴

```
"다음 에러가 발생했어:
[에러 메시지 전체]

관련 파일: [파일 경로]
재현 조건: [어떤 상황에서 발생]

근본 원인을 찾고 수정해줘. 임시방편이 아닌 근본 해결책으로."
```

### 5. 반복 모듈 생성 시 템플릿 활용

```
"기존 [모듈명] 모듈 (backend/src/modules/[기존모듈]/)과
동일한 패턴으로 [새모듈명] 모듈을 만들어줘.

차이점:
- 엔티티 필드: [차이나는 필드]
- 비즈니스 로직: [차이나는 규칙]
- API 엔드포인트: [추가/변경 엔드포인트]"
```

---

## 자주 하는 실수와 예방법

### TypeORM

| 실수 | 예방 |
|------|------|
| `synchronize: true`로 변경 | 절대 변경 금지. 프로덕션 데이터 삭제됨 |
| `findByIds()` 사용 | → `find({ where: { id: In([...]) } })` |
| migration generate 후 바로 run | DROP 쿼리 확인 필수 |
| Subscriber 등록 누락 | app.module.ts providers에 추가 확인 |
| ScheduleModule 누락 | @Cron 사용 시 반드시 등록 |

### NestJS

| 실수 | 예방 |
|------|------|
| 글로벌 모듈 순서 오류 | ConfigModule → CryptoModule 순서 유지 |
| companyId 필터 누락 | 서비스 메서드마다 currentUser 파라미터 |
| @Public() 과잉 사용 | 보안 리뷰 시 Public 라우트 목록 확인 |

### Next.js

| 실수 | 예방 |
|------|------|
| 백엔드 URL 하드코딩 | `process.env.NEXT_PUBLIC_API_URL` 사용 |
| CSP wss:// 누락 | WebSocket 사용 시 vercel.json 업데이트 |
| loading.tsx 누락 | 페이지 생성 시 항상 함께 생성 |
| authStore import 경로 오류 | `@/store/auth.store` (점 주의) |

---

## 이 프로젝트에서 사용한 실제 환경변수 목록

> 다른 서비스 만들 때 체크리스트로 활용

### 백엔드 (필수)
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=             # Render 유료 플랜 PostgreSQL (무료 플랜 사용 금지)
REDIS_URL=               # Render 내부 Redis
JWT_ACCESS_SECRET=       # 랜덤 64자 hex
JWT_REFRESH_SECRET=      # 랜덤 64자 hex
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://your-app.vercel.app
```

### 백엔드 (기능별)
```env
# 이메일 (Resend)
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com

# 파일 업로드 (S3 or Cloudflare R2)
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# AI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
OPENAI_DAILY_TOKEN_LIMIT=  # 글로벌 일일 상한선 (예: 1000000)

# 소셜 로그인 (Google — 기본. Kakao/Naver는 SocialStrategy 확장으로 별도 추가)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=

# 개인정보 암호화 (변경 시 기존 데이터 복호화 불가 — KMS 관리 권장)
ENCRYPTION_KEY=          # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
HMAC_SECRET=             # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 프론트엔드
```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api/v1
```

### 모바일
```env
EXPO_PUBLIC_API_URL=https://your-backend.onrender.com/api/v1
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=
```

---

## 프로젝트 복잡도별 권장 Phase 조합

### 빠른 MVP (2~3주)
```
Phase 0 → Phase 1 → Phase 2 (기본) → Phase 3 (핵심 2~3개 모듈) → Phase 4 → Phase 9
```

### 일반 B2B SaaS (1~2달)
```
Phase 0 → 1 → 2 → 3 (전체) → 4 → 5 → 8 → 9 → 10
```

### 모바일 포함 풀스택 (2~3달)
```
Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
```

---

## 한 줄 요약

> **설계 먼저 → 뼈대 → 멀티테넌트 패턴 → 기능 모듈 반복 → 보안 마무리 → 배포**
>
> Claude에게 "지금 뭘 만들고 있는지"를 항상 알려주는 것이 핵심.
> 모든 프롬프트에 **목적, 제약조건, 기존 패턴 참조**를 포함하면 일관성이 극적으로 향상됩니다.
>
> 그리고 기억하세요: **DB와 백업만은 돈을 아끼지 마세요.**
