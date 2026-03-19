# Admin 시스템 전체 설계 명세

> B2B SaaS 직원 관리 플랫폼 — 운영자(Admin) 시스템
> 작성일: 2026-03-10

---

## 목차

1. [Admin 시스템 아키텍처](#1-admin-시스템-아키텍처)
2. [데이터베이스 설계](#2-데이터베이스-설계)
3. [기능 관리 시스템 (Feature Flags)](#3-기능-관리-시스템-feature-flags)
4. [결제 및 청구 시스템](#4-결제-및-청구-시스템)
5. [세무 데이터 구조](#5-세무-데이터-구조)
6. [Admin REST API](#6-admin-rest-api)
7. [Admin Dashboard UI](#7-admin-dashboard-ui)

---

## 1. Admin 시스템 아키텍처

### 1-1. 전체 구조

```
인터넷
  ├── gwanriwang.com            → Customer Backend  :3001  (tenant-scoped)
  └── admin.gwanriwang.com      → Admin Backend     :4001  (cross-tenant)
                                          │
                              PostgreSQL (RDS) — 공유 DB, Row 격리
```

- Admin Backend는 Customer Backend와 **물리적으로 분리된 별도 NestJS 서비스**
- Admin은 `company_id` 제약 없이 크로스 테넌트 접근 가능
- Admin 접근은 **VPN 또는 IP 화이트리스트** 강제

### 1-2. Admin Backend 모듈 구조

```
admin-backend/src/modules/
├── admin-auth/          # 운영자 인증 (별도 JWT issuer)
├── companies/           # 고객 회사 관리
├── subscriptions/       # 구독 관리
├── contracts/           # 계약 관리
├── plans/               # 서비스 플랜 관리
├── payments/            # 결제 상태 관리
├── service-control/     # 서비스 활성/비활성
├── data-management/     # 고객 데이터 관리
└── audit/               # 감사 로그
```

### 1-3. 운영자 권한 체계 (Admin RBAC)

| 역할 | 설명 |
|------|------|
| SUPER_ADMIN | 모든 권한 + 운영자 계정 관리 |
| OPERATIONS | 회사 관리, 서비스 정지, 플랜/계약 관리 |
| BILLING | 결제 조회/수정, 인보이스, 환불 |
| SUPPORT | 고객 데이터 읽기 전용, 계정 잠금 해제 |
| READONLY | 전체 읽기 전용 |

**권한 매트릭스**

| 기능 | SUPER | OPS | BILLING | SUPPORT | READONLY |
|------|:-----:|:---:|:-------:|:-------:|:--------:|
| 운영자 계정 관리 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 서비스 정지/활성 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 플랜/계약 수정 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 구독 플랜 변경 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 결제 수정/환불 | ✅ | ❌ | ✅ | ❌ | ❌ |
| 고객 데이터 조회 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 고객 데이터 삭제 | ✅ | ❌ | ❌ | ❌ | ❌ |

### 1-4. 보안 아키텍처

```
네트워크: Admin ALB → VPN/IP 화이트리스트 전용
인증:     고객용 JWT와 별도 시크릿 키, 토큰 만료 4시간
MFA:      TOTP 강제 (SUPER_ADMIN 필수)
감사:     모든 POST/PATCH/DELETE → AuditInterceptor 자동 기록
```

### 1-5. 서비스 상태 머신

```
pending → active ↔ suspended → canceled → pending_deletion → [삭제]
                 ↗
            past_due (결제 실패 7일) → suspended (자동)
                                               ↓
                                        terminated (30일 경과)
```

---

## 2. 데이터베이스 설계

### 2-1. Admin 전용 테이블

#### admin_users
```sql
id            UUID PRIMARY KEY
email         VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
name          VARCHAR(100) NOT NULL
role          VARCHAR(30) NOT NULL   -- super_admin|operations|support|billing|readonly
is_active     BOOLEAN DEFAULT true
last_login_at TIMESTAMPTZ
created_at / updated_at / deleted_at
```

#### admin_audit_logs (불변)
```sql
id            BIGSERIAL PRIMARY KEY
admin_user_id UUID FK → admin_users
action        VARCHAR(100)   -- 'company.suspend', 'plan.update' 등
target_type   VARCHAR(50)    -- 'company', 'subscription', 'user'
target_id     UUID
before_data   JSONB
after_data    JSONB
reason        TEXT           -- 민감 작업 시 필수
ip_address    INET NOT NULL
created_at    TIMESTAMPTZ    -- 수정/삭제 불가
```

### 2-2. 구독/계약/결제 테이블

#### plans
```sql
id                  UUID PRIMARY KEY
name                VARCHAR(50) UNIQUE   -- free|basic|pro|enterprise
display_name        VARCHAR(100)
price_monthly_krw   DECIMAL(12,2)        -- VAT 별도 공급가액
price_yearly_krw    DECIMAL(12,2)
yearly_discount_rate DECIMAL(5,2)
max_employees       INT DEFAULT 5
ai_requests_per_day INT DEFAULT 10
storage_limit_gb    DECIMAL(10,2)
features            JSONB DEFAULT '{}'   -- 기능 플래그
trial_days          INT DEFAULT 0
is_public           BOOLEAN DEFAULT true
is_active           BOOLEAN DEFAULT true
sort_order          INT
created_at / updated_at
```

#### contracts
```sql
id                    UUID PRIMARY KEY
company_id            UUID FK → companies
contract_number       VARCHAR(60) UNIQUE   -- CNT-2025-000001
type                  VARCHAR(30)          -- standard|custom|pilot
status                VARCHAR(20)          -- draft|active|expired|terminated
start_date            DATE
end_date              DATE
plan_id               UUID FK → plans
custom_price_monthly_krw  DECIMAL(12,2)
custom_max_employees      INT
contract_value_krw    DECIMAL(15,2)
payment_terms         VARCHAR(50)          -- monthly|quarterly|annual_prepaid
sla_uptime_percent    DECIMAL(5,2) DEFAULT 99.9
signed_at             TIMESTAMPTZ
file_url              TEXT
admin_user_id         UUID FK → admin_users
created_at / updated_at
CHECK (end_date > start_date)
```

#### subscriptions
```sql
id                      UUID PRIMARY KEY
company_id              UUID UNIQUE FK → companies   -- 회사당 1개
plan_id                 UUID FK → plans
contract_id             UUID FK → contracts          -- NULL = self-serve
status                  VARCHAR(30)
-- trialing|active|past_due|suspended|canceled|expired
billing_cycle           VARCHAR(10)                  -- monthly|yearly
current_period_start    TIMESTAMPTZ
current_period_end      TIMESTAMPTZ
trial_start_at / trial_end_at  TIMESTAMPTZ
quantity                INT DEFAULT 1                -- 활성 직원 수
discount_type           VARCHAR(20)                  -- coupon|contract|none
discount_rate           DECIMAL(5,2)
discount_amount_krw     DECIMAL(12,2)
default_payment_method_id UUID FK → payment_methods
auto_renew              BOOLEAN DEFAULT true
next_billing_at         TIMESTAMPTZ
-- 결제 실패 재시도
past_due_since          TIMESTAMPTZ
retry_count             INT DEFAULT 0
next_retry_at           TIMESTAMPTZ
-- 해지
cancel_at_period_end    BOOLEAN DEFAULT false
canceled_at             TIMESTAMPTZ
cancel_reason           TEXT
created_at / updated_at
```

#### billing_profiles
```sql
id                              UUID PRIMARY KEY
company_id                      UUID UNIQUE FK → companies
entity_type                     VARCHAR(20)   -- corporation|sole_proprietor|individual
legal_name                      VARCHAR(200)
representative_name             VARCHAR(100)
business_registration_number    VARCHAR(20) UNIQUE   -- XXX-XX-XXXXX
corporate_registration_number   VARCHAR(20)
business_type / business_item   VARCHAR(100)
address_postal_code             VARCHAR(10)
address_line1 / address_line2   VARCHAR(200)
tax_invoice_required            BOOLEAN DEFAULT false
tax_invoice_email               VARCHAR(255)
tax_invoice_issue_type          VARCHAR(20)   -- on_payment|monthly
billing_email                   VARCHAR(255)
billing_phone                   VARCHAR(30)
is_verified / verified_at
created_at / updated_at
```

#### payment_methods
```sql
id                    UUID PRIMARY KEY
company_id            UUID FK → companies
method_type           VARCHAR(20)   -- card|bank_transfer

-- 카드 전용
card_type             VARCHAR(20)   -- corporate|business|personal
card_number_masked    VARCHAR(25)   -- 앞6+뒤4자리
card_holder_name      VARCHAR(100)  -- 카드 명의인
card_issuer           VARCHAR(50)   -- 카드사
card_brand            VARCHAR(20)   -- Visa|Mastercard|local
card_expiry_year/month CHAR(4/2)
pg_billing_key        VARCHAR(200)  -- AES-256 암호화 저장 (PG 빌링키)

-- 계좌이체 전용
account_type          VARCHAR(30)   -- corporate_account|business_account|personal_account
bank_code             VARCHAR(10)
bank_name             VARCHAR(50)
account_number_masked VARCHAR(25)
account_holder_name   VARCHAR(100)
account_business_number VARCHAR(20) -- 계좌 연결 사업자번호

is_default            BOOLEAN DEFAULT false
is_active             BOOLEAN DEFAULT true
registered_at / verified_at / deactivated_at
UNIQUE INDEX: (company_id) WHERE is_default = true AND is_active = true
```

#### payments
```sql
id                    UUID PRIMARY KEY
company_id            UUID FK → companies
subscription_id       UUID FK → subscriptions
payment_method_id     UUID FK → payment_methods
invoice_number        VARCHAR(60) UNIQUE   -- INV-2025-03-000123
status                VARCHAR(30)
-- pending|processing|completed|failed|refunded|partial_refunded|void|canceled

-- 금액 (원화)
supply_amount_krw     DECIMAL(12,2)   -- 공급가액
tax_amount_krw        DECIMAL(12,2)   -- 부가세 (10%)
total_amount_krw      DECIMAL(12,2)   -- 합계
discount_amount_krw   DECIMAL(12,2)   -- 할인액
coupon_id             UUID FK → coupons

billing_period_start / billing_period_end  DATE
billing_cycle         VARCHAR(10)

-- PG 정보
pg_provider           VARCHAR(30)   -- toss_payments|bank_transfer|admin_manual
pg_transaction_id     VARCHAR(200) UNIQUE
pg_order_id           VARCHAR(200)
pg_raw_response       JSONB

paid_at               TIMESTAMPTZ
failure_code / failure_reason  VARCHAR/TEXT
refundable_until      TIMESTAMPTZ

-- 환불
refunded_amount_krw   DECIMAL(12,2) DEFAULT 0
refunded_at           TIMESTAMPTZ
refund_reason / refund_type  TEXT/VARCHAR
refund_pg_transaction_id     VARCHAR(200)

tax_invoice_id        UUID FK → tax_invoices
admin_memo            TEXT
created_at / updated_at

CONSTRAINT: total = supply + tax - discount
CONSTRAINT: refunded <= total
```

#### coupons
```sql
id                    UUID PRIMARY KEY
code                  VARCHAR(50) UNIQUE
name                  VARCHAR(100)
description           TEXT
discount_type         VARCHAR(20)   -- percentage|fixed_amount
discount_value        DECIMAL(10,2)
max_discount_amount_krw DECIMAL(12,2)   -- 정률 쿠폰 최대 할인 상한
applicable_plans      UUID[]
applicable_billing_cycles VARCHAR(20)  -- all|monthly_only|yearly_only
min_amount_krw        DECIMAL(12,2) DEFAULT 0
max_total_uses        INT
max_uses_per_company  INT DEFAULT 1
current_total_uses    INT DEFAULT 0
valid_from / valid_until  TIMESTAMPTZ
is_active             BOOLEAN DEFAULT true
is_public             BOOLEAN DEFAULT false
created_by            UUID FK → admin_users
```

#### coupon_usage
```sql
id                    BIGSERIAL PRIMARY KEY
coupon_id             UUID FK → coupons
company_id            UUID FK → companies
payment_id            UUID UNIQUE FK → payments
discount_applied_krw  DECIMAL(12,2)
used_at               TIMESTAMPTZ
```

#### tax_invoices
```sql
id                          UUID PRIMARY KEY
company_id                  UUID FK → companies
payment_id                  UUID FK → payments
billing_profile_id          UUID FK → billing_profiles
invoice_number              VARCHAR(60) UNIQUE   -- TINV-2025-03-000123
status                      VARCHAR(20)
-- pending|issued|canceled|error|re_issued

-- 공급자 (우리 회사)
supplier_name               VARCHAR(200)
supplier_business_number    VARCHAR(20)
supplier_representative     VARCHAR(100)

-- 공급받는자 (고객사)
recipient_name              VARCHAR(200)
recipient_business_number   VARCHAR(20)
recipient_email             VARCHAR(255)

-- 공급 내역
supply_date                 DATE
item_name                   VARCHAR(200)
supply_amount_krw           DECIMAL(12,2)
tax_amount_krw              DECIMAL(12,2)
total_amount_krw            DECIMAL(12,2)

-- 국세청
e_invoice_provider          VARCHAR(30)
nts_confirmation_number     VARCHAR(50)   -- 국세청 승인번호 (24자리)
nts_submitted_at / issued_at TIMESTAMPTZ

-- 취소
original_invoice_id         UUID FK → tax_invoices
canceled_at / cancel_reason

provider_raw_response       JSONB
created_at / updated_at
```

#### service_usage (월별 스냅샷)
```sql
id                    BIGSERIAL PRIMARY KEY
company_id            UUID FK → companies
subscription_id       UUID FK → subscriptions
period_year           SMALLINT
period_month          SMALLINT
active_employee_count INT
ai_request_count      INT
ai_request_success    INT
ai_estimated_cost_usd DECIMAL(10,4)
storage_used_mb       DECIMAL(12,2)
plan_employee_limit   INT   -- 집계 시점 플랜 기준값 스냅샷
snapshot_at           TIMESTAMPTZ
UNIQUE (company_id, period_year, period_month)
```

#### export_logs
```sql
id                UUID PRIMARY KEY
requested_by      UUID FK → admin_users
company_id        UUID FK → companies   -- NULL = 전체
export_type       VARCHAR(50)
-- payment_history|tax_invoice_list|tax_summary|subscription_report|refund_history
period_start / period_end  DATE
filters           JSONB
status            VARCHAR(20)  -- pending|processing|completed|failed
file_format       VARCHAR(10)  -- xlsx|csv|json
file_url          TEXT
file_size_bytes   BIGINT
row_count         INT
requested_at / started_at / completed_at / expires_at  TIMESTAMPTZ
```

### 2-3. 테이블 관계 요약

```
companies (1)
  ├── billing_profiles      (1:1)
  ├── subscriptions         (1:1 UNIQUE)
  │     ├── plans           (N:1)
  │     └── contracts       (N:1, nullable)
  ├── payment_methods       (1:N)
  ├── payments              (1:N)
  │     ├── payment_methods (N:1)
  │     ├── coupons         (N:1, nullable)
  │     ├── coupon_usage    (1:1)
  │     └── tax_invoices    (1:1, nullable)
  ├── service_usage         (1:N, 월별 UNIQUE)
  └── export_logs           (1:N)
```

---

## 3. 기능 관리 시스템 (Feature Flags)

### 3-1. 기능 해석 우선순위

```
Priority 1: company_features (회사별 override) — 만료일 체크 포함
Priority 2: plan_features (플랜 기본 설정)
Priority 3: features.default_enabled (전역 기본값)

결과 = company_override ?? plan_setting ?? global_default
```

### 3-2. 기능 유형

| 유형 | 설명 | 예시 |
|------|------|------|
| boolean | 켜짐/꺼짐 | ai_draft, sso |
| limit | 숫자 상한값 | ai_requests_per_day, max_employees |
| config | JSON 설정 | allowed_formats |

### 3-3. 테이블 구조

#### features (마스터)
```sql
id              UUID PRIMARY KEY
key             VARCHAR(100) UNIQUE   -- snake_case (코드에서 상수 참조)
category        VARCHAR(50)           -- core|collaboration|ai|analytics|admin|integration
feature_type    feature_type ENUM     -- boolean|limit|config
name            VARCHAR(100)
default_enabled BOOLEAN DEFAULT false
default_config  JSONB DEFAULT '{}'    -- limit: {"limit": 10}
is_active       BOOLEAN DEFAULT true
sort_order      INT
```

#### plan_features
```sql
plan_id      UUID FK → plans
feature_id   UUID FK → features
is_enabled   BOOLEAN DEFAULT false
limit_value  INT      -- limit 타입 전용
config_value JSONB    -- config 타입 전용
UNIQUE (plan_id, feature_id)
```

#### company_features (override)
```sql
company_id    UUID FK → companies
feature_id    UUID FK → features
override_type override_type ENUM
-- force_enable|force_disable|limit_adjust|config_override
is_enabled    BOOLEAN
limit_value   INT
config_value  JSONB
reason        TEXT NOT NULL   -- 감사 추적 필수
applied_by    UUID FK → admin_users
expires_at    TIMESTAMPTZ     -- NULL = 영구
UNIQUE (company_id, feature_id)
```

### 3-4. 기능 키 목록

```
[core]
attendance_basic / attendance_gps / attendance_report
tasks_basic / tasks_subtasks / tasks_report
schedule_basic / schedule_company_wide

[collaboration]
messages_basic / messages_channels / messages_announcements

[ai]
ai_draft / ai_summarize / ai_announcement / ai_schedule_summary / ai_refine
ai_requests_per_day (limit)

[analytics]
reports_basic / reports_advanced
data_export_csv / data_export_excel

[admin]
custom_roles / audit_logs / api_access
max_employees (limit) / storage_gb (limit)

[integration]
sso / webhooks
```

### 3-5. NestJS 구현 패턴

```typescript
// 컨트롤러 사용
@Post('draft')
@RequireFeature('ai_draft')          // boolean 체크
async generateDraft() { ... }

// 서비스에서 limit 체크
const dailyLimit = await featureService.getLimit(companyId, 'ai_requests_per_day');
if (todayUsage >= dailyLimit) throw new ForbiddenException('한도 초과');

// 캐시: Redis TTL 5분, 플랜/override 변경 시 invalidateCache(companyId)
```

---

## 4. 결제 및 청구 시스템

### 4-1. 결제 트리거 유형

```
자동 갱신 (Scheduler) → 카드: PG 빌링키 자동결제
최초 구독 (고객 직접) → 카드: PG API / 계좌이체: 가상계좌 or 지정계좌
Admin 수동             → 수동 결제 생성 또는 계좌이체 입금 확인
```

### 4-2. 카드 자동결제 흐름

```
1. payments 레코드 생성 (status: pending)
2. PG API 호출: POST /billing/{billingKey} (Toss Payments)
3. status → processing
4. PG Webhook 수신 (DONE / ABORTED)
5. 성공: status → completed, subscription 기간 연장, 세금계산서 발행
6. 실패: DunningService 재시도 스케줄 등록
```

### 4-3. 계좌이체 처리

```
방식 A (가상계좌): PG 가상계좌 발급 → 입금 감지 → Webhook → 자동 완료
방식 B (지정계좌): 고정 계좌 안내 이메일 → 운영자 수동 확인 → markBankTransferPaid()
```

### 4-4. Dunning (결제 실패 재시도)

```
실패 발생
  → retry_count = 1, next_retry_at = D+1  → 재시도 → [성공/실패]
  → retry_count = 2, next_retry_at = D+3  → 재시도 → [성공/실패]
  → retry_count = 3, next_retry_at = D+7  → 재시도 → [성공/실패]
  → 최종 실패: status = suspended, 데이터 30일 보관, 운영자 Slack 알림
```

각 단계별 고객 이메일 발송 (긴급도 low→medium→high)

### 4-5. 결제 상태 전이

```
pending → processing → completed → refunded / partial_refunded
                     → failed    (DunningService로 재시도)
                     → canceled  (결제 전 취소)
                     → void
```

### 4-6. 구독 갱신 스케줄러

```
매일 00:05 KST — processRenewals()
  WHERE status = 'active' AND auto_renew = true AND next_billing_at = TODAY
  FOR UPDATE SKIP LOCKED  (병렬 중복 방지)

매일 09:00 KST — sendRenewalNotice()
  WHERE next_billing_at = TODAY + 3days  (D-3 예고 이메일)

매시간        — retryFailedPayments()
  WHERE status = 'past_due' AND next_retry_at <= now()
```

---

## 5. 세무 데이터 구조

### 5-1. 부가세 신고 주기 (한국)

| 기간 | 대상 | 신고 기한 |
|------|------|-----------|
| 1기 예정 | 1/1 ~ 3/31 | 4/25 |
| 1기 확정 | 1/1 ~ 6/30 | 7/25 |
| 2기 예정 | 7/1 ~ 9/30 | 10/25 |
| 2기 확정 | 7/1 ~ 12/31 | 익년 1/25 |

### 5-2. 핵심 집계 뷰

#### tax_daily_summary (Materialized View, 매일 01:00 REFRESH)
```sql
summary_date          DATE     -- 공급시기 (결제 완료일)
year / month / quarter SMALLINT
method_type           VARCHAR  -- card|bank_transfer
card_type             VARCHAR  -- corporate|business|personal
tax_invoice_issued    BOOLEAN
taxation_type         VARCHAR  -- 세금계산서|법인카드|사업자카드|신용카드(개인)|계좌이체
supply_amount         DECIMAL  -- 공급가액 합계
tax_amount            DECIMAL  -- 세액 합계
discount_amount       DECIMAL
total_amount          DECIMAL
refund_amount         DECIMAL
refund_tax_amount     DECIMAL  -- 환불액의 10/110 역산
net_supply_amount     DECIMAL  -- 공급가액 - 환입 공급가액
net_tax_amount        DECIMAL  -- 순 납부세액
```

#### tax_transaction_detail (View, 건별 증빙)
주요 컬럼:
- 공급시기, 인보이스번호
- 고객사명, 사업자등록번호
- 공급가액, 세액, 할인액, 합계액, 환입액
- 결제수단, 카드유형, 카드사, 카드명의
- 세금계산서번호, 국세청승인번호
- 과세구분 (세금계산서/법인카드/사업자카드/개인카드/계좌이체)

### 5-3. Export 형식

| 형식 | 시트 구성 |
|------|----------|
| CSV | 거래 상세 또는 월별 요약 (단일) |
| Excel | 월별요약 + 거래상세 + 부가세요약 + 세금계산서목록 (4개 시트) |
| JSON | meta + summary + transactions + vatBreakdown |

### 5-4. 부가세 계산 원칙

```
공급가액(과세표준) × 10% = 매출세액
환불 시 역산: 환불액 × 10/110 = 포함 세액
납부세액 = 매출세액 - 환입세액
```

---

## 6. Admin REST API

### Base URL
```
/admin/v1
Authorization: Bearer <admin_jwt>
```

### 공통 응답

```json
// 성공(단일)
{ "success": true, "data": { ... } }

// 성공(목록)
{ "success": true, "data": [...], "meta": { "total": 128, "page": 1, "limit": 20, "totalPages": 7 } }

// 실패
{ "success": false, "error": "RESOURCE_NOT_FOUND", "message": "...", "statusCode": 404 }
```

### 엔드포인트 전체 목록

#### Companies
```
GET    /admin/v1/companies                         회사 목록 (검색/필터)
GET    /admin/v1/companies/:id                     회사 상세 (구독/결제 포함)
PATCH  /admin/v1/companies/:id/service-status      서비스 상태 변경
POST   /admin/v1/companies/:id/reset-owner-password 소유자 비밀번호 초기화
GET    /admin/v1/companies/:id/users               소속 직원 목록
GET    /admin/v1/companies/:id/stats               사용량 통계
DELETE /admin/v1/companies/:id                     데이터 삭제 예약 (SUPER_ADMIN)
```

#### Billing Profiles
```
GET    /admin/v1/billing-profiles/:companyId       청구 프로필 조회
PATCH  /admin/v1/billing-profiles/:companyId       청구 프로필 수정
POST   /admin/v1/billing-profiles/:companyId/verify 사업자번호 진위 확인
```

#### Plans
```
GET    /admin/v1/plans                 플랜 목록
GET    /admin/v1/plans/:id             플랜 상세
POST   /admin/v1/plans                 플랜 생성
PATCH  /admin/v1/plans/:id             플랜 수정
DELETE /admin/v1/plans/:id             플랜 비활성화 (SUPER_ADMIN)
```

#### Contracts
```
GET    /admin/v1/contracts             계약 목록
GET    /admin/v1/contracts/:id         계약 상세
POST   /admin/v1/contracts             계약 등록
PATCH  /admin/v1/contracts/:id         계약 수정
POST   /admin/v1/contracts/:id/sign    서명 완료 처리
POST   /admin/v1/contracts/:id/terminate 계약 해지 (SUPER_ADMIN)
```

#### Subscriptions
```
GET    /admin/v1/subscriptions                        구독 목록
GET    /admin/v1/subscriptions/:id                    구독 상세
GET    /admin/v1/subscriptions/overdue                미납 구독 목록
POST   /admin/v1/subscriptions/:id/change-plan        플랜 변경
POST   /admin/v1/subscriptions/:id/cancel             구독 해지
POST   /admin/v1/subscriptions/:id/reactivate         구독 재활성화
POST   /admin/v1/subscriptions/:id/extend-trial       체험 기간 연장
PATCH  /admin/v1/subscriptions/:id/payment-method     결제 수단 변경
```

#### Payments
```
GET    /admin/v1/payments              결제 목록 (필터: 방식/카드유형/세금계산서/회사/기간)
GET    /admin/v1/payments/:id          결제 상세 (PG응답/세금계산서/쿠폰 포함)
GET    /admin/v1/payments/stats        결제 통계
POST   /admin/v1/payments/manual       수동 결제 생성
POST   /admin/v1/payments/:id/confirm-transfer  계좌이체 입금 확인
POST   /admin/v1/payments/:id/refund   환불 처리
POST   /admin/v1/payments/:id/void     결제 취소
POST   /admin/v1/payments/:id/reissue-tax-invoice 세금계산서 재발행
```

#### Coupons
```
GET    /admin/v1/coupons               쿠폰 목록
GET    /admin/v1/coupons/:id           쿠폰 상세
POST   /admin/v1/coupons               쿠폰 생성
PATCH  /admin/v1/coupons/:id           쿠폰 수정
DELETE /admin/v1/coupons/:id           쿠폰 비활성화
GET    /admin/v1/coupons/:id/usage     쿠폰 사용 이력
POST   /admin/v1/coupons/:id/assign    특정 회사 쿠폰 부여
```

#### Tax Reports
```
GET    /admin/v1/tax/summary           기간별 부가세 요약
GET    /admin/v1/tax/monthly           월별 매출 집계
GET    /admin/v1/tax/transactions      거래 상세 목록 (건별 증빙)
GET    /admin/v1/tax/vat-filing        부가세 신고 기간 조회 (1기예정 등)
GET    /admin/v1/tax/export/csv        CSV 다운로드
GET    /admin/v1/tax/export/excel      Excel 다운로드 (4개 시트)
GET    /admin/v1/tax/export/json       JSON 다운로드
GET    /admin/v1/tax/export/logs       Export 이력
```

#### Feature Flags
```
GET    /admin/v1/features                           전체 기능 목록
GET    /admin/v1/features/:key                      기능 상세
PATCH  /admin/v1/features/:key                      전역 설정 수정 (SUPER_ADMIN)
GET    /admin/v1/features/plans/:planId             플랜별 기능 조회
PUT    /admin/v1/features/plans/:planId             플랜 기능 일괄 수정
GET    /admin/v1/features/companies/:companyId      회사별 override 조회
POST   /admin/v1/features/companies/:companyId      회사 override 설정
DELETE /admin/v1/features/companies/:companyId/:key override 제거
```

---

## 7. Admin Dashboard UI

### 7-1. 파일 구조

```
admin-web/src/
├── app/(admin)/
│   ├── layout.tsx              # 사이드바 + 헤더 레이아웃
│   ├── companies/page.tsx
│   ├── contracts/page.tsx
│   ├── subscriptions/page.tsx
│   ├── payments/page.tsx
│   ├── cards/page.tsx
│   ├── coupons/page.tsx
│   ├── tax/page.tsx
│   └── analytics/page.tsx
└── components/admin/
    ├── Sidebar.tsx
    ├── StatCard.tsx
    └── StatusBadge.tsx
```

### 7-2. 화면별 설계 요약

#### 1) 고객 회사 관리
- **목적**: 전체 테넌트 현황 파악, 서비스 상태 제어
- **주요 데이터**: 회사명/이메일, 플랜, 구독상태, 서비스상태, 직원수, 다음결제일
- **관리 기능**: 서비스 정지/활성화, 플랜 변경, 비밀번호 초기화, 상세 이동
- **필터**: 서비스상태, 구독플랜, 구독상태, 가입일 범위, 검색(이름/이메일)
- **상단 통계**: 전체 회사, 활성 구독 + MRR, 미납(past_due), 이번 달 신규

#### 2) 계약 관리
- **목적**: Enterprise 고객 계약 등록/관리, 만료 예정 모니터링
- **주요 데이터**: 계약번호, 고객사, 유형, 계약기간, 계약금액, 결제조건, 상태
- **관리 기능**: 계약 등록, 수정, 서명 처리, 해지
- **필터**: 계약상태, 계약유형, 결제조건, 만료일 범위
- **특이사항**: 30일 내 만료 예정 계약 오렌지 배너 경고

#### 3) 구독 관리
- **목적**: 전체 구독 상태 모니터링, 미납 구독 우선 처리
- **주요 데이터**: 회사, 플랜, 구독상태, 결제주기, 다음결제일, 재시도횟수
- **관리 기능**: 플랜 변경, 체험 연장, 해지/재활성화, 결제수단 변경
- **필터**: 탭(전체/미납/체험중), 플랜, 결제주기
- **특이사항**: past_due 행은 오렌지 배경 강조

#### 4) 결제 관리
- **목적**: 결제 현황 모니터링, 실패/환불 처리
- **주요 데이터**: 인보이스번호, 회사, 공급가액/세액/합계, 결제수단, 카드유형, 세금계산서, 상태
- **관리 기능**: 환불, 계좌이체 확인, 세금계산서 재발행, 수동 결제 생성
- **필터 (상세)**:
  - 결제 방식: 전체/카드/계좌이체 (토글 버튼)
  - 카드 유형: 전체/법인/사업자/개인 (카드 선택 시만 활성)
  - 세금계산서: 전체/발행/미발행/해당없음 (토글 버튼)
  - 결제 상태: 드롭다운
  - 기간: 날짜 직접 입력 + 단축키(오늘/7일/30일/이번달)
- **상단 통계**: 이달 수납액, 세금계산서 발행, 결제 실패, 환불, 성공률

#### 5) 카드 유형 관리
- **목적**: 카드 유형별 결제 현황 분석, 법인/사업자 비중 파악
- **주요 데이터**: 카드유형별 거래건수/매출액/비중, 카드사별 분포
- **관리 기능**: 카드 유형별 결제 조회
- **필터**: 기간 범위
- **UI 특이사항**: 진행 막대(progress bar)로 비중 시각화, 카드사 × 유형 크로스 테이블

#### 6) 쿠폰 관리
- **목적**: 쿠폰 CRUD, 사용 현황 모니터링
- **주요 데이터**: 쿠폰코드, 할인유형/값, 사용횟수/한도, 유효기간, 상태
- **관리 기능**: 생성, 수정, 비활성화, 특정 회사 부여, 사용 이력 조회
- **필터**: 활성여부, 할인유형, 공개여부
- **UI 특이사항**: 카드 뷰 + 사용량 progress bar

#### 7) 세무 데이터 관리
- **목적**: 부가세 신고 자료 준비, 기간별 매출/세액 집계
- **주요 데이터**: 공급가액, 세액, 결제방식별 매출, 세금계산서 발행 현황, 월별 추이
- **관리 기능**: CSV/Excel/JSON Export
- **필터**: 부가세 신고 기간 자동 선택(1기예정 등) 또는 직접 입력
- **UI 특이사항**: 세금계산서/법인카드/사업자카드 유형별 분류표, 월별 집계 테이블

#### 8) 서비스 사용량 분석
- **목적**: 플랫폼 전체 사용 현황 파악, 업그레이드 기회 발굴
- **주요 데이터**: 활성 테넌트, 전체 직원수, AI 요청수, 플랜별 분포
- **관리 기능**: 플랜 한도 초과 임박 회사 목록 확인, 업그레이드 안내 이메일
- **필터**: 연도/월 선택
- **UI 특이사항**: 한도 80% 이상 도달 회사 오렌지 배너, 직원 사용률 색상 코딩(녹색→오렌지→빨강)

### 7-3. 공통 UI 컴포넌트

#### StatusBadge 색상 기준
```
active      → green  |  suspended → red     |  canceled  → gray
trialing    → purple |  past_due  → orange  |  completed → green
pending     → yellow |  failed    → red     |  refunded  → blue
corporate   → indigo |  business  → teal    |  personal  → slate
bank_transfer → amber
```

#### 공통 레이아웃
- 좌측 사이드바: 네비게이션 (9개 메뉴, 현재 경로 하이라이트)
- 상단 헤더: 운영자 정보, 알림
- 본문: 페이지별 콘텐츠

---

## 부록. 데이터 보관 정책

| 데이터 | 보관 기간 | 근거 |
|--------|----------|------|
| 서비스 해지 후 고객 데이터 | 90일 (복구 가능) | 자사 정책 |
| Enterprise 해지 | 계약 조건 (최대 1년) | 계약서 |
| 출퇴근 기록 | 3년 | 근로기준법 |
| 감사 로그 | 5년 | 보안 정책 |
| Export 파일 (S3) | 7일 후 자동 삭제 | 비용 최적화 |
| 세금계산서 | 영구 보관 | 세법 |

---

## 부록. 인덱스 전략

| 목적 | 테이블 | 인덱스 |
|------|--------|--------|
| 자동 결제 스케줄러 | subscriptions | next_billing_at WHERE active |
| 결제 실패 재시도 | subscriptions | next_retry_at WHERE past_due |
| 세금계산서 발행 대상 | payments | status, tax_invoice_id IS NULL |
| 부가세 신고 조회 | tax_invoices | supply_date WHERE issued |
| 세무 export | payments | billing_period_start/end + status |
| 쿠폰 중복 방지 | coupon_usage | (coupon_id, company_id) |
| S3 파일 만료 | export_logs | expires_at WHERE completed |
| Feature 캐시 | Redis | features:company:{id}, TTL 5분 |
