# 셀프서브 온보딩 플로우 설계 명세

> B2B SaaS 직원 관리 플랫폼 — 고객 온보딩
> 작성일: 2026-03-11
> 범위: 회원가입 → 이메일 인증 → 회사 설정 → 무료 체험 → 유료 전환 → 직원 초대

---

## 목차

1. [전체 온보딩 플로우 개요](#1-전체-온보딩-플로우-개요)
2. [DB 테이블 설계](#2-db-테이블-설계)
3. [Step 1. 회원가입 & 이메일 인증](#3-step-1-회원가입--이메일-인증)
4. [Step 2. 회사 정보 입력](#4-step-2-회사-정보-입력)
5. [Step 3. 무료 체험 시작](#5-step-3-무료-체험-시작)
6. [Step 4. 직원 초대 플로우](#6-step-4-직원-초대-플로우)
7. [Step 5. 유료 전환 플로우](#7-step-5-유료-전환-플로우)
8. [Toss Payments 카드 등록](#8-toss-payments-카드-등록)
9. [플랜 업그레이드 중간 정산](#9-플랜-업그레이드-중간-정산)
10. [온보딩 REST API 전체 목록](#10-온보딩-rest-api-전체-목록)
11. [온보딩 진행률 추적](#11-온보딩-진행률-추적)

---

## 1. 전체 온보딩 플로우 개요

```
[회원가입]
  이메일 + 비밀번호 입력
       │
       ▼
[이메일 인증]
  인증 메일 발송 → 링크 클릭 → 인증 완료
       │
       ▼
[회사 정보 입력]
  회사명, 업종, 직원 규모 (최소 필수)
       │
       ▼
[무료 체험 시작] ← 구독 레코드 생성 (status: trialing, 14일)
       │
       ├─ 직원 초대 (선택, 나중에 해도 됨)
       │
       └─ 서비스 사용 시작
              │
         (D+7, D+13 체험 만료 안내 이메일)
              │
       ┌──────▼──────────────────────────────┐
       │      플랜 선택 & 유료 전환             │
       │  플랜 선택 → 결제 수단 등록            │
       │  → 청구 프로필 입력 → 구독 활성화      │
       └─────────────────────────────────────┘
```

### 핵심 원칙
- **최소 마찰**: 회원가입 → 서비스 사용까지 이메일+비밀번호+회사명 3개 필드로 가능
- **지연 수집**: 사업자번호, 결제 수단은 유료 전환 시에만 요구
- **온보딩 체크리스트**: 대시보드에 진행률 표시로 완성도 유도
- **초대 선행**: 직원 초대는 체험 기간 중 언제든지 가능

---

## 2. DB 테이블 설계

### email_verifications (이메일 인증 토큰)

```sql
CREATE TABLE email_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL,
  token       VARCHAR(64) NOT NULL UNIQUE,  -- crypto.randomBytes(32).toString('hex')
  token_type  VARCHAR(30) NOT NULL,
  -- signup | password_reset | email_change
  user_id     UUID REFERENCES users(id),    -- signup은 NULL (가입 전)
  is_used     BOOLEAN NOT NULL DEFAULT false,
  expires_at  TIMESTAMPTZ NOT NULL,         -- signup: 24시간, password_reset: 30분
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  INDEX idx_email_verifications_token (token) WHERE is_used = false
);
```

### invite_tokens (직원 초대 토큰)

```sql
CREATE TABLE invite_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id),
  invited_by     UUID NOT NULL REFERENCES users(id),
  email          VARCHAR(255) NOT NULL,
  role           VARCHAR(20) NOT NULL DEFAULT 'employee',  -- manager | employee
  token          VARCHAR(64) NOT NULL UNIQUE,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | accepted | expired | canceled
  expires_at     TIMESTAMPTZ NOT NULL,   -- 발급 후 48시간
  accepted_at    TIMESTAMPTZ,
  created_user_id UUID REFERENCES users(id),   -- 수락 후 생성된 user ID
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(company_id, email, status)  -- 동일 이메일 중복 초대 방지 (pending 상태)
);
```

### onboarding_progress (온보딩 체크리스트 추적)

```sql
CREATE TABLE onboarding_progress (
  company_id            UUID PRIMARY KEY REFERENCES companies(id),
  email_verified        BOOLEAN NOT NULL DEFAULT false,
  company_info_set      BOOLEAN NOT NULL DEFAULT false,  -- 회사 상세 정보 입력
  first_employee_invited BOOLEAN NOT NULL DEFAULT false,
  gps_location_set      BOOLEAN NOT NULL DEFAULT false,  -- 회사 위치 등록
  first_schedule_created BOOLEAN NOT NULL DEFAULT false,
  payment_method_added  BOOLEAN NOT NULL DEFAULT false,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 3. Step 1. 회원가입 & 이메일 인증

### 3-1. 회원가입 요청 → 인증 이메일 발송

```
POST /auth/register
```

**Request**
```json
{
  "email": "owner@company.com",
  "password": "password123!",
  "name": "홍길동",
  "companyName": "테스트 회사"
}
```

**서버 처리 순서**
```
1. 이메일 중복 확인 (전체 users 테이블에서 email 고유 확인)
2. 비밀번호 강도 검증 (8자 이상, 영문+숫자+특수문자)
3. companies 레코드 생성 (status: 'pending', plan: 'free')
4. users 레코드 생성 (role: 'owner', status: 'pending' — 미인증 상태)
5. onboarding_progress 레코드 초기화
6. email_verifications 토큰 생성 (type: 'signup', expires: 24시간 후)
7. 이메일 발송 큐 추가 (auth-email-verify 템플릿)
8. 응답: 201 Created (토큰 미포함 — 이메일 인증 전 로그인 불가)
```

**Response**
```json
{
  "success": true,
  "data": {
    "message": "가입 확인 이메일을 발송했습니다. 이메일을 확인해 주세요.",
    "email": "owner@company.com"
  }
}
```

**이메일 인증 링크 형식**
```
https://app.gwanriwang.com/auth/verify-email?token={64자리 hex 토큰}
```

---

### 3-2. 이메일 인증 처리

```
POST /auth/verify-email
```

**Request**
```json
{ "token": "a3f2c1...64자리" }
```

**서버 처리**
```
1. email_verifications에서 token 조회
2. is_used = false AND expires_at > now() 확인
3. users.status = 'active', companies.status = 'active' 업데이트
4. email_verifications.is_used = true 업데이트
5. onboarding_progress.email_verified = true
6. Access Token + Refresh Token 발급 (인증 완료 후 자동 로그인)
```

**Response**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "uuid", "name": "홍길동", "role": "owner" },
    "company": { "id": "uuid", "name": "테스트 회사" },
    "onboardingStep": "company_info"   ← 다음 단계 안내
  }
}
```

---

### 3-3. 인증 이메일 재발송

```
POST /auth/resend-verification
```

```json
{ "email": "owner@company.com" }
```

- 기존 미사용 토큰 모두 만료 처리 후 신규 발급
- 분당 1회 제한 (Rate Limit)

---

## 4. Step 2. 회사 정보 입력

회원가입 직후 대시보드에 표시되는 온보딩 체크리스트 화면에서 입력.
필수는 아니며 건너뛰기 가능, 나중에 설정 화면에서도 수정 가능.

```
PATCH /workspace/setup
Authorization: Bearer <access_token>
```

**Request**
```json
{
  "industry": "retail",
  "employeeCount": "10-30",
  "phone": "02-1234-5678",
  "address": "서울시 강남구 테헤란로 123",
  "workStartTime": "09:00",
  "workEndTime": "18:00",
  "workDays": [1, 2, 3, 4, 5],
  "lateThresholdMin": 10
}
```

**서버 처리**
```
1. companies 레코드 업데이트
2. onboarding_progress.company_info_set = true
```

---

## 5. Step 3. 무료 체험 시작

이메일 인증 완료 시 자동으로 생성됨 (별도 API 호출 없음).

**subscriptions 레코드 자동 생성**
```sql
INSERT INTO subscriptions (
  company_id,
  plan_id,             -- free 플랜 ID
  status,              -- 'trialing'
  billing_cycle,       -- 'monthly' (기본)
  trial_start_at,      -- now()
  trial_end_at,        -- now() + 14 days
  current_period_start, -- now()
  current_period_end,   -- now() + 14 days
  auto_renew           -- false (체험 중에는 자동 갱신 없음)
)
```

**체험 기간 중 이메일 알림**
| 시점 | 이메일 템플릿 |
|------|-------------|
| 가입 직후 | `welcome` — 시작 가이드 |
| D+7 | `trial-expiring-7d` — 기능 소개 + 업그레이드 CTA |
| D+13 | `trial-expiring-1d` — 긴급 업그레이드 안내 |
| D+14 (만료 당일) | `trial-expired` — 업그레이드 또는 데이터 유지 안내 |

---

## 6. Step 4. 직원 초대 플로우

### 6-1. 초대 발송

```
POST /users/invite
Authorization: Bearer <access_token> (owner, manager만)
```

**Request**
```json
{
  "email": "employee@company.com",
  "role": "employee",
  "name": "김철수"    // 선택 — 초대 이메일에 표기용
}
```

**서버 처리**
```
1. 플랜별 max_employees 한도 확인
   (현재 active 직원 수 + pending 초대 수 < max_employees)
2. 동일 이메일 pending 초대 중복 확인
3. invite_tokens 레코드 생성 (expires: 48시간 후)
4. 이메일 발송 큐 추가 (user-invite 템플릿)
5. onboarding_progress.first_employee_invited = true (첫 초대 시)
```

**초대 링크 형식**
```
https://app.gwanriwang.com/invite?token={64자리 토큰}
```

---

### 6-2. 초대 수락 (신규 가입자)

초대 링크 클릭 시 표시되는 화면에서 처리.

```
GET /auth/invite?token={token}   ← 토큰 유효성 확인 (회사명, 초대자 이름 반환)
POST /auth/accept-invite          ← 계정 생성 + 수락 처리
```

**POST /auth/accept-invite Request**
```json
{
  "token": "초대 토큰",
  "password": "password123!",
  "name": "김철수",
  "phone": "010-1234-5678"   // 선택
}
```

**서버 처리**
```
1. invite_tokens에서 token 조회 (status: pending, expires_at 유효 확인)
2. users 레코드 생성
   - company_id: 초대한 회사
   - role: 초대 시 지정한 role
   - status: 'active' (별도 이메일 인증 없음 — 초대 이메일이 인증 역할)
3. invite_tokens.status = 'accepted', accepted_at = now()
4. Access Token + Refresh Token 발급
5. 직원 초대 알림 → 초대자에게 notification
```

---

### 6-3. 초대 관리 API

```
GET    /users/invites          대기 중인 초대 목록 (owner, manager)
DELETE /users/invites/:id      초대 취소
POST   /users/invites/:id/resend  초대 재발송 (토큰 갱신, 48시간 연장)
```

---

## 7. Step 5. 유료 전환 플로우

### 7-1. 플랜 선택 화면 API

```
GET /subscriptions/plans   공개 플랜 목록 + 현재 구독 정보
```

**Response**
```json
{
  "success": true,
  "data": {
    "currentSubscription": {
      "status": "trialing",
      "trialEndAt": "2026-03-25T00:00:00Z",
      "daysRemaining": 14
    },
    "plans": [
      {
        "id": "uuid",
        "name": "basic",
        "displayName": "Basic",
        "priceMonthlyKrw": 29000,
        "priceYearlyKrw": 290000,
        "yearlyDiscountRate": 17,
        "maxEmployees": 10,
        "aiRequestsPerDay": 20,
        "storageGb": 10,
        "features": {
          "attendanceGps": true,
          "tasksSubtasks": false,
          "reportsAdvanced": false,
          "sso": false
        }
      }
    ]
  }
}
```

---

### 7-2. 구독 업그레이드 (체험 → 유료)

```
POST /subscriptions/upgrade
Authorization: Bearer <access_token> (owner만)
```

**Request**
```json
{
  "planId": "uuid",
  "billingCycle": "monthly",       // monthly | yearly
  "paymentMethodId": "uuid",       // 등록된 결제 수단 ID
  "couponCode": "LAUNCH2026"       // 선택
}
```

**서버 처리**
```
1. 플랜 유효성 확인 (is_active, is_public)
2. 쿠폰 유효성 확인 (있는 경우)
3. 결제 금액 계산
   - 공급가액 = 플랜 월가격 × (1 - 할인율)
   - 부가세 = 공급가액 × 10%
   - 합계 = 공급가액 + 부가세
4. payments 레코드 생성 (status: pending)
5. Toss Payments 빌링키 결제 API 호출
6. 성공 시:
   - payments.status = 'completed'
   - subscriptions.status = 'active'
   - subscriptions.plan_id 업데이트
   - subscriptions.trial_end_at 무효화
   - next_billing_at = 오늘 + 1개월(또는 1년)
   - 세금계산서 발행 큐 추가 (billing_profile에 tax_invoice_required인 경우)
7. 실패 시:
   - payments.status = 'failed'
   - 에러 응답 (카드 번호 오류, 한도 초과 등 사유 포함)
```

---

## 8. Toss Payments 카드 등록

### 8-1. 빌링키 발급 플로우

```
클라이언트                          서버                        Toss Payments
    │                               │                               │
    ├─ GET /payments/toss/client-key ──▶ TossPayments 위젯 초기화 키 반환
    │                               │                               │
    ├─ Toss SDK 카드 등록 UI 표시     │                               │
    │  (iframe으로 카드 정보 입력)    │                               │
    │                               │                               │
    ├─ 카드 등록 완료                 │                               │
    │  (Toss SDK → 서버로 authKey 전달)                              │
    │                               │                               │
    ├─ POST /payments/billing-key   ──▶ POST /v1/billing/authorizations/issue
    │    { authKey, customerKey }    │       (Toss API)              │
    │                               │◀── billingKey 반환             │
    │                               │                               │
    │                               ├─ payment_methods 레코드 생성   │
    │                               │  (pg_billing_key AES-256 암호화)
    │◀── 카드 등록 완료 응답          │                               │
```

### 8-2. 카드 등록 API

```
GET  /payments/toss/client-key     Toss Payments 위젯 초기화 (clientKey 반환)
POST /payments/billing-key         빌링키 발급 및 결제 수단 저장
GET  /payments/methods             등록된 결제 수단 목록
DELETE /payments/methods/:id       결제 수단 삭제
PATCH /payments/methods/:id/default 기본 결제 수단 변경
```

**POST /payments/billing-key Request**
```json
{
  "authKey": "Toss SDK에서 받은 authKey",
  "customerKey": "company_id를 기반으로 생성한 고객 키"
}
```

**customerKey 생성 규칙**
```typescript
// 회사 ID를 기반으로 Toss Payments 고객 키 생성
// UUID에서 하이픈 제거 후 사용 (Toss 고객키 형식: 영문+숫자, 2~50자)
const customerKey = companyId.replace(/-/g, '');
```

**서버 처리**
```
1. Toss Payments /v1/billing/authorizations/issue 호출
2. 응답에서 billingKey, 카드 정보 추출
   - card.number (마스킹), card.issuerCode, card.cardType, card.ownerType
3. payment_methods 레코드 생성
   - pg_billing_key: AES-256-CBC 암호화 후 저장 (복호화 키는 AWS Secrets Manager)
   - card_number_masked: 앞6자리+****+뒤4자리
   - is_default: 첫 번째 카드이면 true
```

---

### 8-3. 청구 프로필 입력 (사업자 정보)

세금계산서 발행을 원하는 고객만 필수. 일반 카드 결제는 선택.

```
GET  /billing/profile         청구 프로필 조회
POST /billing/profile         청구 프로필 생성
PATCH /billing/profile        청구 프로필 수정
POST /billing/profile/verify  사업자번호 진위 확인 (국세청 API)
```

**POST /billing/profile Request**
```json
{
  "entityType": "corporation",       // corporation | sole_proprietor | individual
  "legalName": "(주)테스트",
  "representativeName": "홍길동",
  "businessRegistrationNumber": "123-45-67890",
  "businessType": "서비스업",
  "businessItem": "소프트웨어 개발",
  "addressPostalCode": "06234",
  "addressLine1": "서울시 강남구 테헤란로 123",
  "addressLine2": "5층",
  "taxInvoiceRequired": true,
  "taxInvoiceEmail": "tax@company.com",
  "taxInvoiceIssueType": "on_payment",   // on_payment | monthly
  "billingEmail": "billing@company.com",
  "billingPhone": "02-1234-5678"
}
```

---

## 9. 플랜 업그레이드 중간 정산

### 9-1. 즉시 업그레이드 일할 정산

```
예시: Basic(29,000원/월) → Pro(59,000원/월), 결제일로부터 15일 경과

남은 일수 = 30 - 15 = 15일
기존 플랜 환불액 = 29,000 × (15/30) = 14,500원 (부가세 별도)
신규 플랜 청구액 = 59,000 × (15/30) = 29,500원 (부가세 별도)
실제 청구 = 29,500 - 14,500 = 15,000원 (+ 부가세 1,500원) = 16,500원
```

**계산 로직**
```typescript
function calculateUpgradeProration(
  currentPlanPriceKrw: number,
  newPlanPriceKrw: number,
  periodStartAt: Date,
  periodEndAt: Date,
): { chargeAmountKrw: number; supplyAmountKrw: number; taxAmountKrw: number } {
  const totalDays = differenceInDays(periodEndAt, periodStartAt);
  const remainingDays = differenceInDays(periodEndAt, new Date());

  const dailyRateCurrent = currentPlanPriceKrw / totalDays;
  const dailyRateNew = newPlanPriceKrw / totalDays;

  const refundAmount = Math.floor(dailyRateCurrent * remainingDays);
  const chargeAmount = Math.ceil(dailyRateNew * remainingDays);
  const supplyAmount = chargeAmount - refundAmount;
  const taxAmount = Math.floor(supplyAmount * 0.1);

  return {
    chargeAmountKrw: supplyAmount + taxAmount,
    supplyAmountKrw: supplyAmount,
    taxAmountKrw: taxAmount,
  };
}
```

### 9-2. 다운그레이드 정책

- 다운그레이드는 **즉시 적용하지 않음**
- `subscriptions.cancel_at_period_end` 대신 `downgrade_at_period_end` 패턴 적용
- 현재 기간 종료 후 다음 결제일에 새 플랜으로 자동 전환

```sql
-- subscriptions 테이블에 추가 컬럼
pending_plan_id    UUID REFERENCES plans(id)   -- 다운그레이드 예약 플랜
pending_plan_at    TIMESTAMPTZ                  -- 적용 시점 (다음 갱신일)
```

---

## 10. 온보딩 REST API 전체 목록

```
# 회원가입 / 인증
POST   /auth/register                    회원가입 (이메일 인증 메일 발송)
POST   /auth/verify-email                이메일 인증 토큰 검증
POST   /auth/resend-verification         인증 메일 재발송
POST   /auth/login                       로그인
POST   /auth/refresh                     Access Token 갱신
POST   /auth/logout                      로그아웃
POST   /auth/password/reset-request      비밀번호 재설정 메일 발송
POST   /auth/password/reset              비밀번호 재설정

# 초대
GET    /auth/invite                      초대 토큰 정보 조회 (회사명, 초대자)
POST   /auth/accept-invite               초대 수락 (계정 생성)
POST   /users/invite                     직원 초대 발송
GET    /users/invites                    대기 중인 초대 목록
DELETE /users/invites/:id                초대 취소
POST   /users/invites/:id/resend         초대 재발송

# 회사 설정
PATCH  /workspace/setup                  회사 기본 정보 초기 설정

# 구독/플랜
GET    /subscriptions/plans              공개 플랜 목록
GET    /subscriptions/me                 현재 구독 상태
POST   /subscriptions/upgrade            유료 전환 / 플랜 업그레이드
POST   /subscriptions/downgrade-schedule 다운그레이드 예약
POST   /subscriptions/cancel             구독 해지 (기간 종료 시 해지)
POST   /subscriptions/reactivate         해지 취소 (기간 종료 전)
GET    /subscriptions/upgrade/preview    업그레이드 일할 정산 미리보기

# 결제 수단
GET    /payments/toss/client-key         Toss 위젯 초기화 키
POST   /payments/billing-key             빌링키 등록 (카드 등록)
GET    /payments/methods                 결제 수단 목록
DELETE /payments/methods/:id             결제 수단 삭제
PATCH  /payments/methods/:id/default     기본 결제 수단 변경

# 청구 프로필
GET    /billing/profile                  청구 프로필 조회
POST   /billing/profile                  청구 프로필 생성
PATCH  /billing/profile                  청구 프로필 수정
POST   /billing/profile/verify           사업자번호 진위 확인

# 결제 이력 (고객용)
GET    /payments                         결제 이력 목록
GET    /payments/:id                     결제 상세
GET    /payments/:id/invoice             인보이스 다운로드 (PDF)

# 온보딩 진행률
GET    /onboarding/progress              온보딩 체크리스트 진행률
```

---

## 11. 온보딩 진행률 추적

### GET /onboarding/progress Response

```json
{
  "success": true,
  "data": {
    "progressPercent": 40,
    "checklist": [
      { "key": "email_verified",          "label": "이메일 인증",          "done": true },
      { "key": "company_info_set",        "label": "회사 정보 입력",        "done": true },
      { "key": "first_employee_invited",  "label": "첫 번째 직원 초대",     "done": false },
      { "key": "gps_location_set",        "label": "회사 위치 등록",        "done": false },
      { "key": "first_schedule_created",  "label": "첫 번째 일정 등록",     "done": false },
      { "key": "payment_method_added",    "label": "결제 수단 등록",        "done": false }
    ],
    "trialDaysRemaining": 12,
    "trialEndAt": "2026-03-25T00:00:00Z"
  }
}
```

**온보딩 완료 이벤트 자동 감지**
- 직원 초대 완료 → `onboarding_progress.first_employee_invited = true`
- GPS 위치 등록 → `onboarding_progress.gps_location_set = true`
- 일정 생성 → `onboarding_progress.first_schedule_created = true`
- 카드 등록 → `onboarding_progress.payment_method_added = true`
