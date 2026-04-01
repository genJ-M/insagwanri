# 관리왕 — 프로젝트 전체 개요

> 다른 AI에게 전달하기 위한 프로젝트 컨텍스트 문서.
> 코드 변경이 있을 때마다 이 파일도 함께 업데이트한다.
>
> 마지막 업데이트: 2026-03-31

---

## 1. 서비스 개요

**관리왕**은 중소사업장(5~200명 규모)을 타깃으로 하는 B2B SaaS 직원 관리 플랫폼이다.

- 출퇴근 관리(GPS), 업무 관리, 일정, 메시지, AI 문서 보조 기능을 통합 제공
- 멀티테넌트 SaaS 구조 (회사별 데이터 완전 격리)
- 구독 기반 과금 (무료/Basic/Pro/Enterprise), Toss Payments 자동결제
- Customer 서비스 + Admin 백오피스 이중 구조

---

## 2. 기술 스택

### Customer Backend (`backend/`)
| 항목 | 기술 |
|------|------|
| 런타임 | Node.js 20, TypeScript |
| 프레임워크 | NestJS 10 |
| ORM | TypeORM 0.3 |
| DB | PostgreSQL 15 |
| 캐시/세션 | Redis 7 |
| 인증 | JWT (HS256) — Access 15분 + Refresh 7일, Refresh Token Hash 저장 |
| 실시간 | Socket.io + Redis Adapter (멀티서버 지원) |
| 파일 | AWS S3 / Cloudflare R2 (Presigned URL 방식) |
| 이메일 | Resend (React Email) |
| 푸시 | Expo Push Notifications |
| AI | OpenAI API (gpt-4o) |
| 결제 | Toss Payments (빌링키 자동결제) |
| 로깅 | Winston + CloudWatch |
| 모니터링 | Sentry |
| Rate Limit | @nestjs/throttler 전역 + 로그인 5회/60초 잠금 |
| 포트 | 3001 |

### Customer Frontend (`web/`)
| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS |
| 상태 관리 | Zustand (auth, UI) |
| 서버 상태 | TanStack Query v5 |
| 실시간 | Socket.io-client |
| 폼/유효성 | 직접 구현 (react-hook-form 미사용) |
| 알림 Toast | react-hot-toast (id 기반 dedup) |
| 모니터링 | Sentry |
| 포트 | 3000 (개발), Vercel (배포) |

### Admin Backend (`admin-backend/`)
| 항목 | 기술 |
|------|------|
| 프레임워크 | NestJS 10 |
| 포트 | 4001 |
| 접근 제한 | VPN/IP 화이트리스트 미들웨어 (`ADMIN_ALLOWED_IPS`) |
| 인증 | JWT + TOTP MFA (SUPER_ADMIN) |
| 역할 | SUPER_ADMIN > OPERATIONS > BILLING > SUPPORT > READONLY |

### Admin Frontend (`admin-web/`)
| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 |
| 포트 | 3002 |
| 페이지 | 9개 (기업, 구독, 결제, 플랜, 쿠폰, Feature Flags, 세무, 감사로그, 어드민유저) |

### Mobile (`mobile/`)
| 항목 | 기술 |
|------|------|
| 프레임워크 | React Native + Expo SDK 51 |
| 빌드 | EAS Build (`eas.json` 구성 완료) |
| 화면 | 홈, 근태(GPS), 휴가, 업무, 채팅, 내정보 (6탭) |
| 환경변수 | `EXPO_PUBLIC_API_URL` — `.env.example` 참조 |
| OTA 업데이트 | `runtimeVersion: appVersion` 정책, `eas update` 지원 |
| 배포 가이드 | `mobile/EAS_DEPLOY_GUIDE.md` |
| 앱 ID | iOS: `kr.gwanriwang.app` / Android: `kr.gwanriwang.app` |
| 미완료 | `eas init` 실행 → EAS Project ID 발급 후 `app.json` 교체 필요 |

### 인프라
| 항목 | 기술 |
|------|------|
| 컨테이너 | Docker + docker-compose (로컬), AWS ECS Fargate (운영) |
| CI/CD | GitHub Actions (ci, deploy-staging, deploy-production) |
| 컨테이너 레지스트리 | AWS ECR |
| DB 운영 | AWS RDS PostgreSQL (자동 백업 7일) |
| 파일 스토리지 | AWS S3 / Cloudflare R2 |
| CDN | CloudFront (public 파일) |
| 로컬 개발 | docker-compose (PostgreSQL, Redis, MinIO) |

---

## 3. 프로젝트 폴더 구조

```
gwanri_wang/
├── backend/                  # Customer NestJS API (:3001)
│   ├── src/
│   │   ├── modules/          # 도메인 모듈
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── attendance/
│   │   │   ├── tasks/
│   │   │   ├── schedules/
│   │   │   ├── collaboration/ (메시지/채널)
│   │   │   ├── ai/
│   │   │   ├── workspace/
│   │   │   ├── files/
│   │   │   ├── notifications/
│   │   │   ├── subscriptions/
│   │   │   ├── socket/
│   │   │   ├── health/
│   │   │   ├── salary/           # 급여 관리, 4대보험 자동계산
│   │   │   ├── hr-notes/         # 인사노트
│   │   │   ├── vacations/        # 연차 관리
│   │   │   ├── approvals/        # 전자결재
│   │   │   ├── contracts/        # 계약 관리
│   │   │   ├── calendar/         # 이벤트 캘린더
│   │   │   ├── evaluations/      # 인사평가
│   │   │   ├── training/         # 교육 관리
│   │   │   ├── tax-documents/    # 세무·노무 서류 + Cron 알림 (2026-03-31 신규)
│   │   │   └── activity-logs/    # 통신비밀보호법 활동 로그
│   │   ├── database/
│   │   │   ├── entities/     # TypeORM 엔티티
│   │   │   ├── migrations/   # 마이그레이션 파일
│   │   │   └── seeds/
│   │   ├── common/           # 공통 필터/인터셉터/타입
│   │   └── adapters/         # Redis Socket.io Adapter
│   ├── data-source.ts        # CLI용 DataSource (migration용)
│   └── test/                 # 통합 테스트 (multitenant-isolation.spec.ts)
│
├── web/                      # Customer Next.js (:3000)
│   └── src/
│       ├── app/
│       │   ├── (auth)/       # 로그인/회원가입/초대/비밀번호
│       │   ├── (dashboard)/  # 대시보드 전체 페이지 (홈, 근태, 급여, 휴가, 결재, 계약, 캘린더, 평가, 교육, 세무·노무)
│       │   └── onboarding/   # 플랜선택/카드등록
│       ├── components/
│       │   ├── layout/       # Header, Sidebar
│       │   └── ui/           # Button, Card, Badge, Modal, Skeleton, EmptyState, ImageUploader, Spinner, PageLoader
│       ├── hooks/            # usePageTitle, useUnsavedChanges
│       ├── lib/              # api.ts (axios), socket.ts
│       ├── store/            # auth.store, ui.store (Zustand)
│       └── types/            # index.ts (공통 타입)
│
├── admin-backend/            # Admin NestJS API (:4001)
├── admin-web/                # Admin Next.js (:3002)
├── mobile/                   # Expo React Native
├── docs/                     # 설계 문서
│   ├── remaining-tasks.md
│   ├── ux-improvements.md
│   ├── admin-system-design.md
│   ├── file-upload-spec.md
│   ├── gps-attendance-spec.md
│   ├── notification-system-spec.md
│   ├── onboarding-flow-spec.md
│   ├── realtime-event-spec.md
│   └── screen-design-spec.md
├── infra/                    # AWS 인프라 설정
│   ├── ecs/                  # ECS Task Definition
│   └── nginx/
├── docker-compose.yml        # 로컬 개발용
└── docker-compose.prod.yml   # 운영용
```

---

## 4. 핵심 설계 원칙

### 멀티테넌트 격리
- 모든 테이블에 `company_id` 컬럼 + 인덱스
- TypeORM 쿼리 시 항상 `companyId` where 조건 포함
- Row-Level Isolation (RLS 미사용, 서비스 레이어에서 강제)
- 통합 테스트: `test/multitenant-isolation.spec.ts` (14개 케이스)

### 인증 구조
```
Access Token (15분, HS256) → Authorization: Bearer
Refresh Token (7일)       → HttpOnly Cookie
Refresh Token Hash         → DB 저장 (bcrypt)
→ 토큰 탈취 시 DB 무효화 가능
```
- 5회 로그인 실패 시 60초 잠금 (Redis)
- 401 응답 시 axios 인터셉터가 자동 refresh → 재시도

### API 응답 형식
```json
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 100 } }
```
- 전역 `ResponseInterceptor` 적용 (`src/common/interceptors/response.interceptor.ts`)
- 프론트엔드에서 `res.data.data`로 접근

### Soft Delete
- `deleted_at TIMESTAMPTZ` 컬럼 패턴 전체 적용
- TypeORM `@DeleteDateColumn()` + `@SoftRemove()`

### GPS 출퇴근 정책 (flag-not-reject)
- 범위 밖이어도 출퇴근 허용, `gps_flagged=true`로 표시
- 엄격 모드(`gpsStrictMode`) 활성 시 관리자에게 즉시 알림

### 파일 업로드 (Presigned URL)
```
1. POST /files/upload-url → fileId + presigned PUT URL 반환
2. 클라이언트 → fetch PUT → S3 직접 업로드 (서버 경유 없음)
3. POST /files/confirm → S3 HeadObject 검증 → 확정
4. 24시간 후 cleanup scheduler → S3 실제 삭제
```
- public 버킷: profiles, logo (CDN 직접 접근)
- private 버킷: tasks, messages, reports (Presigned GET URL)

---

## 5. 주요 도메인 모델

### User
```
id, companyId, email(encrypted), emailHash(HMAC), emailEncrypted, nameEncrypted,
passwordHash, provider, providerAccountId, refreshTokenHash,
name, phone, department, position,
role(owner/manager/employee), status(active/inactive/pending),
profileImageUrl, employeeNumber,
managedDepartments(jsonb, null=전체), permissions(jsonb — canInvite/canManagePayroll 등),
lastLoginAt, joinedAt, createdAt, deletedAt
```

### Company
```
id, name,
companyType(individual/corporation/none), businessNumber, corporateNumber,
representativeName, businessType, businessItem,
industry, phone, address, logoUrl,
coverImageUrl, coverImageMobileUrl, coverMobileCrop, brandingTextColor,
plan(free/basic/pro/enterprise),
workStartTime, workEndTime, lateThresholdMin, workDays[],
gpsEnabled, gpsLat, gpsLng, gpsRadiusM, gpsStrictMode,
createdAt, deletedAt
```

### AttendanceRecord
```
id, companyId, userId, workDate, clockInAt, clockOutAt,
status(pending/normal/late/early_leave/absent/half_day/vacation),
isLate, lateMinutes, totalWorkMinutes,
clockInLat, clockInLng, clockOutLat, clockOutLng,
gpsInRadius, clockInFlagged, clockOutFlagged
```

### Task
```
id, companyId, creatorId, assigneeId, title, description,
status(pending/in_progress/review/done/cancelled),
priority(low/normal/high/urgent), category, dueDate
```

### AiRequest
```
id, companyId, userId, feature(draft/summarize/announcement/schedule_summary/refine),
inputText, outputText, status(pending/success/failed),
modelName, promptTokens, completionTokens, totalTokens, estimatedCostUsd,
disclaimerShown, refType, refId, createdAt
```

### File
```
id, companyId, uploadedBy, originalName, fileKey, bucket, contentType,
fileSizeBytes, feature(profiles/logo/tasks/messages/reports),
status(pending/confirmed/deleted), s3Deleted,
refType, refId, confirmedAt, deletedAt
```

---

## 6. REST API 엔드포인트 목록 (Customer Backend)

Base URL: `/api/v1`

### Auth
| Method | Path | 설명 |
|--------|------|------|
| POST | /auth/register | 회원가입 + 회사 생성 |
| POST | /auth/login | 로그인 → Access/Refresh Token |
| POST | /auth/refresh | 토큰 갱신 |
| POST | /auth/logout | 로그아웃 (Refresh 무효화) |
| POST | /auth/forgot-password | 비밀번호 재설정 이메일 발송 |
| POST | /auth/reset-password | 비밀번호 재설정 (토큰) |
| POST | /auth/send-phone-otp | 전화번호 OTP 발송 (비밀번호 찾기용) |
| POST | /auth/verify-phone-otp | OTP 검증 → resetToken 반환 |
| POST | /auth/google | Google OAuth 시작 |
| GET | /auth/google/callback | Google OAuth 콜백 |
| POST | /auth/social/mobile | 모바일 소셜 로그인 (코드 교환 → JWT) |
| POST | /auth/social-complete | 신규 소셜 유저 회사명 등록 후 가입 완료 |

### Users
| Method | Path | 설명 |
|--------|------|------|
| GET | /users | 전체 팀원 목록 (owner/manager) |
| GET | /users/me | 내 프로필 |
| PATCH | /users/me | 내 프로필 수정 (profileImageUrl 포함) |
| PATCH | /users/me/password | 비밀번호 변경 |
| POST | /users/invite | 직원 이메일 초대 |
| POST | /users/invite/phone | 전화번호 SMS 초대 |
| POST | /users/invite/link | 공유 초대 링크 생성 |
| GET | /users/invite-info | 초대 토큰 정보 조회 (Public) |
| POST | /users/accept-invite | 초대 수락 + 계정 생성 (Public) |
| GET | /users/invites | 초대 대기 목록 |
| DELETE | /users/invites/:id | 초대 취소 |
| POST | /users/invites/:id/resend | 초대 재발송 |
| PATCH | /users/:id/role | 역할 변경 (owner) |
| PATCH | /users/:id/permissions | 관리자 세부 권한 설정 (owner → manager) |
| DELETE | /users/:id | 직원 비활성화 (Soft Delete) |

### Attendance
| Method | Path | 설명 |
|--------|------|------|
| POST | /attendance/clock-in | 출근 (GPS 선택적) |
| POST | /attendance/clock-out | 퇴근 |
| GET | /attendance/me | 내 근태 이력 (start_date, end_date) |
| GET | /attendance | 전체 근태 (owner/manager, user_id 필터 가능) |
| GET | /attendance/report | 월별 리포트 (owner/manager) |
| PATCH | /attendance/:id | 근태 수정 (owner/manager) |

### Tasks
| Method | Path | 설명 |
|--------|------|------|
| GET | /tasks | 업무 목록 (필터: status, priority, assignee_id) |
| POST | /tasks | 업무 생성 |
| GET | /tasks/:id | 업무 상세 |
| PATCH | /tasks/:id | 업무 수정 |
| DELETE | /tasks/:id | 업무 삭제 |
| GET | /tasks/reports | 전체 업무 보고서 목록 |
| POST | /tasks/:id/reports | 업무 보고서 작성 |
| PATCH | /tasks/reports/:id | 보고서 수정 |

### Schedules
| Method | Path | 설명 |
|--------|------|------|
| GET | /schedules | 일정 목록 (year, month) |
| POST | /schedules | 일정 생성 |
| PATCH | /schedules/:id | 일정 수정 |
| DELETE | /schedules/:id | 일정 삭제 |

### Collaboration (메시지)
| Method | Path | 설명 |
|--------|------|------|
| GET | /collaboration/channels | 채널 목록 |
| POST | /collaboration/channels | 채널 생성 |
| GET | /collaboration/channels/:id/messages | 메시지 목록 (cursor 페이징) |
| POST | /collaboration/channels/:id/messages | 메시지 전송 |
| PATCH | /collaboration/messages/:id | 메시지 수정 |
| DELETE | /collaboration/messages/:id | 메시지 삭제 |

### AI
| Method | Path | 설명 |
|--------|------|------|
| POST | /ai/draft | 업무 문장 작성 |
| POST | /ai/summarize | 업무 보고 요약 |
| POST | /ai/announcement | 공지 메시지 생성 (owner/manager) |
| POST | /ai/schedule-summary | 일정 정리 |
| POST | /ai/refine | 문장 다듬기 |
| GET | /ai/usage | 사용량 조회 (owner/manager) |
| GET | /ai/history | 내 AI 요청 히스토리 (page, limit) |

### Workspace
| Method | Path | 설명 |
|--------|------|------|
| GET | /workspace/settings | 회사 설정 조회 |
| PATCH | /workspace/settings | 회사 기본 정보 수정 (logoUrl 포함) |
| PATCH | /workspace/work-settings | 근무 설정 (시간, 요일, 지각 허용) |
| PATCH | /workspace/gps-settings | GPS 설정 |

### Files
| Method | Path | 설명 |
|--------|------|------|
| POST | /files/upload-url | Presigned PUT URL 발급 |
| POST | /files/confirm | 업로드 확정 |
| GET | /files/usage | 저장 용량 사용 현황 |
| GET | /files/:id/download | 비공개 파일 다운로드 URL |
| DELETE | /files/:id | 파일 삭제 |

### Subscriptions
| Method | Path | 설명 |
|--------|------|------|
| GET | /subscriptions/plans | 플랜 목록 + 현재 구독 상태 |
| POST | /subscriptions/upgrade | 플랜 변경/업그레이드 |
| GET | /subscriptions/payment-methods | 등록된 결제 수단 목록 |
| DELETE | /subscriptions/payment-methods/:id | 결제 수단 삭제 |
| GET | /subscriptions/toss/client-key | Toss Payments 클라이언트 키 |
| POST | /subscriptions/toss/billing-key | 빌링키 등록 (카드 등록) |

---

## 7. Frontend 페이지 목록

### Auth (`/app/(auth)/`)
| 경로 | 설명 |
|------|------|
| /login | 로그인 (이메일 + Google 소셜) |
| /register | 회원가입 + 회사 생성 (사업자유형 선택 포함) → /onboarding/plan |
| /forgot-password | 비밀번호 찾기 (전화OTP 4단계 + 이메일 링크 탭) |
| /reset-password | 비밀번호 재설정 (토큰) |
| /invite | 초대 수락 + 계정 생성 (이메일/전화/링크 3경로 지원) |
| /auth/callback | 소셜 로그인 콜백 토큰 수신 |
| /auth/social-complete | 신규 소셜 유저 회사명 입력 |

### Dashboard (`/app/(dashboard)/`)
| 경로 | 설명 |
|------|------|
| / | 대시보드 (내 근태, 관리자용 통계, 진행 중 업무, 커버 이미지) |
| /attendance | 출퇴근 (실시간 시계, GPS, 관리자용 전체 현황 + 직원 상세 모달) |
| /tasks, /tasks/reports | 업무 관리 + 보고서 |
| /schedule | 일정 캘린더 (월간 뷰, 수정 모달) |
| /messages | 메시지 (채널 목록, 실시간 채팅) |
| /ai | AI 문서 보조 (5가지 기능 + ⌘K 커맨드팔레트) |
| /salary | 급여 관리 (4대보험 자동계산) |
| /vacations | 연차 관리 |
| /approvals | 전자결재 (기안/수신/전체 3탭) |
| /contracts | 계약 관리 (만료예정 배너) |
| /calendar | 캘린더 이벤트 + 근태 그리드 뷰 |
| /certificates | 재직/경력증명서 발급 + 인쇄 |
| /evaluations | 인사평가 사이클 |
| /training | 교육 관리 |
| /team | 팀 관리 (초대 3탭, 역할변경, 관리자권한설정, 비활성화) |
| /team/[id] | 직원 상세 (5탭: 기본/근태/급여/계약/노트) |
| /team/notes, /team/stats | 인사노트 목록 / 조직통계 (recharts) |
| /settings | 설정 (프로필/회사+사업자정보/브랜딩/근무/GPS/알림) |
| /subscription, /onboarding/* | 구독 관리 + 온보딩 플랜/카드등록 |

### Onboarding (`/app/onboarding/`)
| 경로 | 설명 |
|------|------|
| /onboarding/plan | 플랜 선택 (상태 sessionStorage 유지) |
| /onboarding/payment | Toss Payments 카드 등록 |

---

## 8. Socket.io 이벤트

서버 → 클라이언트:
```
message:new       { channelId, message }   새 메시지 수신
message:updated   { channelId, message }   메시지 수정
message:deleted   { channelId, messageId } 메시지 삭제
notification:new  { notification }         새 알림
```
클라이언트 → 서버:
```
join:channel  { channelId }   채널 룸 참여
leave:channel { channelId }   채널 룸 떠나기
```
- 인증: JWT Access Token (소켓 핸드셰이크 auth.token)
- namespace: `/` (default)
- Redis Adapter로 멀티서버 pub/sub

---

## 9. AI 기능

### 지원 기능 (feature)
| feature | 엔드포인트 | 설명 |
|---------|-----------|------|
| draft | POST /ai/draft | 업무 문장 작성 |
| summarize | POST /ai/summarize | 업무 보고 요약 |
| announcement | POST /ai/announcement | 공지 메시지 생성 |
| schedule_summary | POST /ai/schedule-summary | 일정 정리 |
| refine | POST /ai/refine | 문장 다듬기 |

### 일일 사용 한도 (플랜별)
| 플랜 | 한도 |
|------|------|
| free | 10회/일 |
| basic | 50회/일 |
| pro | 200회/일 |
| enterprise | 무제한 |

### AI 응답 공통 필드
```json
{
  "id": "uuid",
  "feature": "draft",
  "output_text": "...",
  "disclaimer": "※ AI가 생성한 내용입니다...",
  "tokens_used": 285,
  "model_name": "gpt-4o",
  "created_at": "2026-03-19T...",
  "used_count": 3,
  "plan_limit": 50
}
```

---

## 10. 구독/결제 구조

### 플랜
| 플랜 | 직원 수 | AI/일 | 스토리지 |
|------|---------|-------|---------|
| free | 5명 | 10회 | 1GB |
| basic | 30명 | 50회 | 10GB |
| pro | 100명 | 200회 | 50GB |
| enterprise | 무제한 | 무제한 | 500GB |

### 결제 흐름 (Toss Payments)
```
1. GET /subscriptions/toss/client-key → clientKey + customerKey
2. Toss 위젯 렌더링 → requestBillingAuth
3. Toss 콜백 → authKey + customerKey 수신
4. POST /subscriptions/toss/billing-key → 빌링키 발급 + AES-256 암호화 저장
5. POST /subscriptions/upgrade → 즉시 결제 실행
```

### Dunning (결제 실패 시)
- 실패 → status: past_due
- D+1, D+3, D+7 재시도
- 최종 실패 → status: suspended (서비스 접근 차단)

---

## 11. 환경 변수 요약

### backend
```
DATABASE_URL            PostgreSQL 연결 문자열
REDIS_URL               Redis 연결 문자열
JWT_ACCESS_SECRET       Access Token 시크릿
JWT_REFRESH_SECRET      Refresh Token 시크릿
OPENAI_API_KEY          OpenAI API 키
OPENAI_MODEL            사용 모델 (기본: gpt-4o)
AWS_REGION              S3 리전
AWS_S3_BUCKET           S3 버킷명
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
CDN_BASE_URL            CloudFront CDN URL
RESEND_API_KEY          이메일 발송
TOSS_PAYMENTS_SECRET_KEY
BILLING_KEY_ENCRYPTION_KEY  빌링키 AES-256 암호화 키
FRONTEND_URL            CORS 허용 Origin
```

### web
```
NEXT_PUBLIC_API_URL     백엔드 API URL
NEXT_PUBLIC_SOCKET_URL  Socket.io URL
```

---

## 12. 로컬 개발 환경

```bash
# 1. 인프라 실행
docker-compose up -d   # PostgreSQL:5432, Redis:6379, MinIO:9000

# 2. DB 마이그레이션
cd backend
npm run migration:run

# 3. 시드 데이터
npm run seed

# 4. 백엔드 실행
npm run start:dev     # :3001

# 5. 프론트엔드 실행
cd web
npm run dev           # :3000
```

---

## 13. 구현 완료 현황

> 최종 업데이트: 2026-03-27

| 영역 | 상태 |
|------|------|
| Customer Backend (NestJS) — 24개 모듈 | ✅ [CODE] |
| Customer Frontend (Next.js) — 30개 페이지 | ✅ [CODE] |
| Admin Backend (NestJS :4001) — 배포 준비 완료 | ✅ [CODE] |
| Admin Frontend (Next.js :3002) — 배포 준비 완료 | ✅ [CODE] |
| Mobile (Expo) — 6탭, GPS, Push | ✅ [CODE] |
| EAS Build 배포 준비 (eas.json, app.json, 가이드) | ✅ [CODE] |
| CI/CD (GitHub Actions) | ✅ [CODE] |
| UX 개선 (ux-improvements.md 전체) | ✅ [CODE] |
| 파일 업로드 (S3 Presigned URL) | ✅ [CODE] |
| Render 환경변수 설정 (28개) | ✅ [DONE] |
| DB 마이그레이션 실행 (프로덕션) | ⏳ [MANUAL] — Render Shell 필요 |
| 앱 아이콘/스플래시 이미지 | 🔧 [MANUAL] — 디자인 에셋 필요 |
| eas init + EAS Project ID 설정 | 🔧 [MANUAL] — `eas init` 실행 필요 |
| 이메일 실제 발송 테스트 | 🔧 [MANUAL] — 환경변수 설정 완료, E2E 미검증 |
| Toss Payments E2E 테스트 | 🔧 [MANUAL] — 테스트 키 필요 |
| 브랜드 favicon | 🔧 [MANUAL] — 디자인 에셋 필요 |
| e-세금계산서 연동 | 🔧 [MANUAL] — 영업 계약 필요 |
| e-세금계산서 연동 | 🔧 MANUAL (영업 계약 필요) |

---

## 14. 주요 파일 경로 레퍼런스

| 역할 | 경로 |
|------|------|
| Customer API 진입점 | `backend/src/main.ts` |
| App Module | `backend/src/app.module.ts` |
| JWT Strategy | `backend/src/modules/auth/strategies/jwt.strategy.ts` |
| 전역 응답 인터셉터 | `backend/src/common/interceptors/response.interceptor.ts` |
| TypeORM Migration CLI | `backend/data-source.ts` |
| Axios 인스턴스 (토큰 자동갱신) | `web/src/lib/api.ts` |
| Zustand Auth Store | `web/src/store/auth.store.ts` |
| Zustand UI Store (사이드바) | `web/src/store/ui.store.ts` |
| 공통 타입 | `web/src/types/index.ts` |
| UX 개선 현황 | `docs/ux-improvements.md` |
| 잔여 작업 | `docs/remaining-tasks.md` |
