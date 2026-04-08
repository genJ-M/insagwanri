# 관리왕 — 실서비스 전환 체크리스트

> 작성일: 2026-04-08  
> 목적: 현재 임시/데모 상태와 실서비스 전환 작업을 명확히 구분

---

## 1부. 현재 임시 상태 전체 정리

### 🔴 즉시 위험 (보안)

| 항목 | 위치 | 현재 상태 | 필요 조치 |
|------|------|-----------|-----------|
| Resend API Key | `backend/.env` | **실제 키가 git에 커밋됨** | 즉시 key rotation |
| R2 Access Key | `backend/.env` | **실제 키 노출** | 즉시 rotation |
| R2 Secret Key | `backend/.env` | **실제 키 노출** | 즉시 rotation |
| JWT 시크릿 | `backend/.env` | `gwanri_wang_access_secret_change_this_in_production_32ch` | 강력한 난수로 교체 |
| 암호화 키 | `backend/.env` | 개발용 고정값 | 환경별 고유값 생성 |
| `.env` 파일 | `backend/.env` | git에 포함됨 | `.gitignore` 추가 + 히스토리 제거 |

### 🟡 임시 구현 (기능)

| 항목 | 위치 | 현재 상태 |
|------|------|-----------|
| SMS 발송 | `backend/src/common/sms/sms.service.ts` | 콘솔 출력만 (실제 발송 안 됨) |
| Toss 결제 | `backend/src/modules/subscriptions/` | 코드는 완성, Toss 가입+키 없음 |
| Expo 푸시 | `backend/.env` | `EXPO_ACCESS_TOKEN=your_expo_access_token` 미설정 |
| Google OAuth | `backend/.env` | `local-placeholder` 미설정 |
| Sentry 오류 추적 | `backend/.env` | `SENTRY_DSN` 비어있음 |
| S3/R2 버킷 | `backend/.env` | `my-bucket` 플레이스홀더 |

### 🟢 이미 실제 구현 (전환 작업 불필요)

| 항목 | 상태 |
|------|------|
| OpenAI (AI 기능) | 완전 실제 연동. 키만 설정하면 바로 동작 |
| 이메일 (Resend) | 완전 실제 연동 (키 rotation 후 재사용 가능) |
| 급여 계산 로직 | 한국 4대보험 + 소득세 실제 계산 |
| 파일 업로드 (R2) | Presigned URL 방식 실제 연동 |
| 푸시 알림 코드 | 완성. Access Token만 설정하면 동작 |
| 결제 코드 (Toss) | 완성. Toss 가입 + 키 설정만 필요 |
| 인사평가 | 완전 구현 |
| 교육 관리 | 완전 구현 |
| 출퇴근/급여/계약 | 완전 구현 |

### 📦 데모 데이터 (실서비스 전 반드시 삭제)

```
(주)한빛솔루션 — 더미 회사
├── 사업자번호: 123-45-67890 (가짜)
├── 직원 20명 (*.demo 이메일)
│   └── 공통 비밀번호: Demo1234!
├── 업무 24건 (더미)
├── 출퇴근 기록 30건 (더미)
├── 급여 데이터 2개월치 (더미)
└── 결재 문서 5건 (더미)
```

실행 경로: `backend/src/database/seeds/demo.seed.ts`

---

## 2부. 단계별 실서비스 전환 가이드

---

### ▶ STEP 0: 시작 전 준비사항 (계정 생성)

아래 서비스에 **미리 가입**해야 합니다. 가입 후 키를 발급받아 보관하세요.

| 서비스 | 용도 | 가입 URL | 무료 여부 |
|--------|------|----------|-----------|
| **Render** | 백엔드 + DB 호스팅 | render.com | 무료 플랜 있음 |
| **Vercel** | 프론트엔드 호스팅 | vercel.com | 무료 플랜 있음 |
| **OpenAI** | AI 기능 | platform.openai.com | 유료 (사용량 과금) |
| **Resend** | 이메일 발송 | resend.com | 무료 3000건/월 |
| **Cloudflare R2** | 파일 저장소 | dash.cloudflare.com | 무료 10GB/월 |
| **Toss Payments** | 구독 결제 | developers.tosspayments.com | 무료 (수수료 3.3%) |
| **Coolsms** | SMS OTP 발송 | coolsms.co.kr | 건당 과금 (약 8원) |
| **Google Cloud** | 소셜 로그인 | console.cloud.google.com | 무료 |
| **Sentry** (선택) | 오류 추적 | sentry.io | 무료 플랜 있음 |

---

### ▶ STEP 1: 보안 긴급 조치 (오늘 바로)

#### 1-1. Resend API Key 재발급

```
1. resend.com 로그인
2. API Keys 메뉴 클릭
3. 기존 키 (re_BEECUAFZ_...) 옆 Delete 클릭 → 삭제
4. Create API Key 클릭 → 이름: "gwanriwang-prod" → Create
5. 새 키 복사해서 안전한 곳에 보관 (다시 못 봄)
```

#### 1-2. Cloudflare R2 키 재발급

```
1. dash.cloudflare.com 로그인
2. R2 → Manage R2 API Tokens
3. 기존 토큰 찾아서 Revoke
4. Create API Token → 권한: Object Read & Write → Create
5. Access Key ID, Secret Access Key 복사 보관
```

#### 1-3. .env 파일 git에서 제거

터미널에서 실행:
```bash
# 1. .gitignore에 추가
echo "backend/.env" >> .gitignore
echo "web/.env.local" >> .gitignore

# 2. git 추적에서 제거 (파일은 유지)
git rm --cached backend/.env
git rm --cached web/.env.local 2>/dev/null || true

# 3. 커밋
git add .gitignore
git commit -m "chore: env 파일 git 추적 제거"
git push origin master
```

> ⚠️ 이미 git 히스토리에 올라간 키는 **반드시 rotation** 해야 합니다.  
> 히스토리에서 완전 제거하려면 `git filter-repo` 사용 (복잡하므로 일단 키 재발급이 우선)

#### 1-4. 강력한 시크릿 키 생성

아래 명령어로 각각 생성 (Node.js 설치 필요):
```bash
# JWT Access Secret (64자 난수)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# JWT Refresh Secret (다른 값으로)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Encryption Key (32바이트 = 64자 hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# HMAC Secret (32바이트)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

생성된 값들을 메모장에 복사해 두세요.

---

### ▶ STEP 2: Cloudflare R2 버킷 설정

#### 2-1. 버킷 생성

```
1. dash.cloudflare.com → R2 → Create Bucket
2. 첫 번째 버킷 이름: gwanriwang-private   (비공개용 — 계약서, 급여명세서)
3. Create Bucket
4. 같은 방법으로 두 번째: gwanriwang-public  (공개용 — 프로필 사진)
```

#### 2-2. 공개 버킷 설정

```
gwanriwang-public 버킷 클릭
→ Settings 탭
→ Public Access: Allow Access
→ 생성되는 URL 복사 (예: pub-xxxx.r2.dev)
```

#### 2-3. CORS 설정 (백엔드에서 Presigned URL 사용 시 필요)

```
gwanriwang-private 버킷 → Settings → CORS Policy

아래 내용 붙여넣기:
[
  {
    "AllowedOrigins": ["https://insagwanri-nine.vercel.app"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

### ▶ STEP 3: Google OAuth 설정

#### 3-1. Google Cloud Console 프로젝트 생성

```
1. console.cloud.google.com 접속
2. 상단 프로젝트 선택 → New Project
3. 프로젝트 이름: 관리왕 → Create
```

#### 3-2. OAuth 동의 화면 설정

```
1. 왼쪽 메뉴: APIs & Services → OAuth consent screen
2. User Type: External → Create
3. 앱 이름: 관리왕
4. 사용자 지원 이메일: 본인 이메일
5. 승인된 도메인: insagwanri-nine.vercel.app
6. Save and Continue (범위 설정은 기본값 유지)
```

#### 3-3. 자격증명 생성

```
1. APIs & Services → Credentials
2. Create Credentials → OAuth client ID
3. Application type: Web application
4. 이름: 관리왕 Web
5. Authorized JavaScript origins:
   - https://insagwanri-nine.vercel.app
6. Authorized redirect URIs:
   - https://insagwanri-backend.onrender.com/api/v1/auth/google/callback
7. Create
8. Client ID, Client Secret 복사 보관
```

---

### ▶ STEP 4: SMS (Coolsms) 설정

#### 4-1. Coolsms 가입 및 발신번호 등록

```
1. coolsms.co.kr → 회원가입
2. 충전: 최소 1,000원 이상 (테스트용)
3. 왼쪽 메뉴: 발신번호 관리 → 발신번호 등록
4. 회사 대표 전화번호 등록 (인증 필요)
```

#### 4-2. API 키 발급

```
1. 우측 상단 아이콘 → API Key 관리
2. API Key 생성 → 이름: gwanriwang
3. API Key, API Secret 복사 보관
```

---

### ▶ STEP 5: Toss Payments 설정

#### 5-1. 개발자 계정 생성

```
1. developers.tosspayments.com → 회원가입
2. 로그인 후 → 내 개발 정보
3. 테스트 키 확인 (sk_test_..., ck_test_...)
```

#### 5-2. 실제 서비스 전환 (실제 결제 받으려면)

```
1. Toss Payments 비즈니스 센터 (https://merchant.toss.im) 가입
2. 사업자 정보 입력 + 서류 제출
3. 심사 완료 후 라이브 키 발급 (sk_live_..., ck_live_...)
4. 처음에는 sk_test 키로 개발/테스트
```

> 💡 테스트 키로도 모든 기능 동작합니다. 실제 결제만 안 됩니다.

---

### ▶ STEP 6: Render 환경변수 설정

Render 대시보드 → insagwanri-backend → Environment 탭에서 아래 환경변수를 **모두** 설정합니다.

#### 필수 (없으면 앱 동작 안 함)

```
NODE_ENV=production
PORT=3001
DATABASE_URL=(Render이 자동 제공 — Internal Database URL 복사)
REDIS_URL=(Render Redis 서비스 URL)
FRONTEND_URL=https://insagwanri-nine.vercel.app

JWT_ACCESS_SECRET=(STEP 1-4에서 생성한 값)
JWT_REFRESH_SECRET=(STEP 1-4에서 생성한 값, 다른 값)
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

ENCRYPTION_KEY=(STEP 1-4에서 생성한 32바이트 hex)
HMAC_SECRET=(STEP 1-4에서 생성한 32바이트 hex)

RESEND_API_KEY=(STEP 1-1에서 재발급한 키)
RESEND_FROM=noreply@yourdomain.com  ← 도메인 없으면: onboarding@resend.dev

AWS_ENDPOINT=https://[계정ID].r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=(STEP 1-2에서 재발급한 키)
AWS_SECRET_ACCESS_KEY=(STEP 1-2에서 재발급한 키)
AWS_REGION=auto
AWS_S3_BUCKET=gwanriwang-private
AWS_S3_PUBLIC_BUCKET=gwanriwang-public
CDN_BASE_URL=https://pub-xxxx.r2.dev  ← 2-2에서 복사한 URL

OPENAI_API_KEY=(OpenAI 대시보드에서 발급)
OPENAI_MODEL=gpt-4o
```

#### 선택 (없어도 기본 동작)

```
GOOGLE_CLIENT_ID=(STEP 3-3에서 복사)
GOOGLE_CLIENT_SECRET=(STEP 3-3에서 복사)

SMS_PROVIDER=coolsms
SMS_API_KEY=(STEP 4-2에서 복사)
SMS_API_SECRET=(STEP 4-2에서 복사)
SMS_FROM=01012345678  ← STEP 4-1에서 등록한 번호

TOSS_PAYMENTS_SECRET_KEY=sk_test_...  ← 처음엔 테스트 키
TOSS_PAYMENTS_CLIENT_KEY=ck_test_...

EXPO_ACCESS_TOKEN=(Expo 대시보드에서 발급)

SENTRY_DSN=(Sentry 프로젝트 DSN)

DEV_FEEDBACK_EMAIL=(피드백 받을 이메일)
```

#### Render에서 설정하는 방법

```
1. render.com → Dashboard → insagwanri-backend 클릭
2. 왼쪽 메뉴: Environment
3. Add Environment Variable 클릭
4. Key, Value 입력 → Save
5. 모든 변수 입력 후 Manual Deploy → Deploy latest commit
```

---

### ▶ STEP 7: DB 마이그레이션 실행

환경변수 설정 완료 후, 마이그레이션을 실행해야 합니다.

#### Render Shell에서 실행

```
1. render.com → insagwanri-backend → Shell 탭
2. 아래 명령어 실행:
```

```bash
# 마이그레이션 실행 (한 번에 전체)
npm run migration:run
```

#### 마이그레이션 실행 순서 확인

아래 22개 파일이 순서대로 실행됩니다:
```
(기존 마이그레이션들...)
1744000000000-AddAttendanceMethods
1744001000000-AddUserWorkSchedule
1744100000000-CreateFeedbackTable
1744200000000-AddTaskDeletionWorkflow
1744300000000-AddCalendarSharing
1744400000000-EnhanceContracts
1744500000000-AddApprovalTaskLinks
1744600000000-ExtendTasksForInstructions
1744700000000-AddShiftScheduleAndTemplates  ← 가장 최근
```

> ⚠️ 마이그레이션은 **한 번만** 실행합니다. 두 번 실행하면 오류가 납니다.  
> 이미 실행된 항목은 자동으로 건너뜁니다.

---

### ▶ STEP 8: Vercel 환경변수 설정

Vercel 대시보드 → insagwanri-nine → Settings → Environment Variables

```
NEXT_PUBLIC_API_URL=https://insagwanri-backend.onrender.com/api/v1
NEXT_PUBLIC_TOSS_CLIENT_KEY=ck_test_...  ← Toss 클라이언트 키
```

설정 후 Vercel → Deployments → Redeploy

---

### ▶ STEP 9: 데모 데이터 처리

#### 개발/테스트 환경용 (선택)

데모 데이터가 필요하면 Render Shell에서:
```bash
npm run seed:demo
```

이렇게 하면 (주)한빛솔루션 + 직원 20명 + 각종 더미 데이터가 생성됩니다.

#### 실서비스에서는 사용하지 마세요

- 데모 데이터는 가입 없이 기능 시연용입니다
- 실제 고객이 가입하면 자동으로 본인 회사 데이터가 생성됩니다
- 데모 데이터가 이미 있다면 아래로 삭제:

```bash
# Render Shell에서
# 특정 회사 삭제 (cascade로 하위 데이터 모두 삭제)
npx ts-node -e "
const { AppDataSource } = require('./src/database/data-source');
AppDataSource.initialize().then(async () => {
  await AppDataSource.query(\"DELETE FROM companies WHERE name = '(주)한빛솔루션'\");
  console.log('삭제 완료');
  process.exit(0);
});
"
```

---

### ▶ STEP 10: 도메인 연결 (선택, 프리미엄 서비스 시)

도메인이 없으면 건너뛰어도 됩니다.  
도메인 구매 후 (가비아, 카페24 등):

#### Vercel 커스텀 도메인

```
Vercel → Settings → Domains → Add
yourdomain.com 입력
→ CNAME 레코드를 도메인 등록기관에서 설정
```

#### Resend 이메일 도메인 인증

```
resend.com → Domains → Add Domain
yourdomain.com 입력
→ DNS 레코드 3개 추가 (MX, TXT, DKIM)
→ 인증 완료 후 RESEND_FROM=noreply@yourdomain.com 으로 변경
```

---

### ▶ STEP 11: 서비스 오픈 전 최종 점검

아래 체크리스트를 직접 해보세요:

#### 회원가입/로그인

- [ ] 새 이메일로 회원가입 → 이메일 인증 메일 수신 확인
- [ ] 로그인 5회 실패 → 계정 잠금 동작 확인
- [ ] 비밀번호 재설정 → 이메일 수신 확인
- [ ] Google 소셜 로그인 동작 확인

#### 핵심 기능

- [ ] 직원 초대 → 초대 이메일 수신 확인
- [ ] 출근/퇴근 버튼 동작 확인
- [ ] 파일 업로드 → 실제 저장 확인 (프로필 사진)
- [ ] 업무 생성 → AI 기능 동작 확인
- [ ] SMS OTP 발송 확인 (번호 등록 후)

#### 결제 (Toss 테스트 모드)

- [ ] 플랜 업그레이드 클릭 → Toss 결제창 열림 확인
- [ ] 테스트 카드로 결제 시도 (카드번호: `4242424242424242`)

---

## 3부. 운영 중 정기 유지보수

### 매년 8월 (필수)

**최저시급 업데이트**  
고용노동부에서 다음 해 최저시급을 고시합니다.

파일 위치: `backend/src/modules/salary/salary.service.ts`

```typescript
// 이 부분 찾아서 해당 연도 추가
const MIN_WAGE_BY_YEAR: Record<number, number> = {
  2024: 9860,
  2025: 10030,
  2026: 10030,
  2027: XXXX,  // ← 8월에 발표된 값으로 추가
};
```

수정 후 배포하면 다음 해 급여 계산이 자동으로 올바른 값을 사용합니다.

### 매년 1월 (필수)

**4대보험 요율 업데이트**  
건강보험공단, 국민연금공단에서 연간 요율을 공지합니다.

파일 위치: `backend/src/modules/salary/salary.service.ts`

```typescript
const INSURANCE_RATES = {
  nationalPension:  0.045,   // 국민연금 (공단 고시 확인)
  healthInsurance:  0.03545, // 건강보험 (공단 고시 확인)
  longTermCare:     0.1295,  // 장기요양 (건보료 대비 비율)
  employmentInsurance: 0.009, // 고용보험
};
```

### 분기별 (권장)

- 의존성 업데이트: `npm audit` 실행 → 보안 취약점 확인
- Render/Vercel 로그 점검 → 반복 오류 패턴 확인
- OpenAI 모델 버전 검토 (더 저렴하거나 성능 좋은 버전 출시 시)

---

## 4부. 비용 예상 (월간)

| 서비스 | 무료 한도 | 초과 비용 | 비고 |
|--------|-----------|-----------|------|
| Render (백엔드) | $0 (무료 인스턴스) | $7/월 (유료 인스턴스) | 무료는 15분 슬립 |
| Render (DB) | $0 (90일 무료) | $7/월 | 90일 후 유료 |
| Render (Redis) | $0 (90일 무료) | $10/월 | Upstash 대체 시 $0 |
| Vercel | 무료 | $20/월 (Pro) | 무료로 충분 |
| Cloudflare R2 | 10GB/월 무료 | $0.015/GB | 사실상 무료 |
| Resend | 3,000건/월 무료 | $20/월 (50,000건) | 초기엔 무료 |
| OpenAI | 없음 | 사용량 과금 | GPT-4o 약 $5/100만 토큰 |
| Coolsms SMS | 없음 | 건당 약 8원 | OTP 위주라 소량 |
| Toss Payments | 없음 | 3.3% 수수료 | 결제액 기준 |
| **합계 (최소)** | | **~$14/월** | Render 유료 전환 후 |

> 💡 **초기 0원 운영 전략**:  
> - Render 무료 인스턴스 + DB/Redis 90일 무료 이용  
> - 90일 후 Upstash(Redis 무료) 전환 → DB만 $7/월  
> - 사용자 100명 전까지는 월 $7~14로 운영 가능

---

## 5부. 긴급 상황 대응

### 앱이 응답 없을 때

```
1. Render → insagwanri-backend → Logs 탭 확인
2. 에러 메시지 검색 → 원인 파악
3. Manual Deploy → Restart service
```

### DB 연결 오류

```
1. Render → PostgreSQL 서비스 → Logs 확인
2. DATABASE_URL 환경변수 재확인
3. Render 내부 네트워크 주소 사용 중인지 확인
   (Internal: dpg-xxxx.internal / External: dpg-xxxx.oregon-postgres.render.com)
```

### 이메일 발송 안 될 때

```
1. Resend 대시보드 → Logs → 실패 이유 확인
2. RESEND_API_KEY 환경변수 정확한지 확인
3. 발신 도메인 인증 상태 확인
```

### 파일 업로드 안 될 때

```
1. R2 버킷 이름 오타 확인 (대소문자 구분)
2. CORS 설정 확인 (Vercel 도메인 허용됐는지)
3. AWS_ENDPOINT 값 확인
   형식: https://[계정ID].r2.cloudflarestorage.com
   계정ID: Cloudflare 대시보드 오른쪽 하단 Account ID
```
