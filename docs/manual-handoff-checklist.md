# 수동 작업 핸드오프 체크리스트

> Claude/AI가 자동화할 수 없는 **사용자 직접 수행 영역**만 정리.
> 각 항목은 우선순위 순. 체크박스(`[ ]` → `[x]`)는 진행하면서 직접 표기.
> 코드 측 잔여 작업은 모두 완료 (2026-05 기준).

---

## 우선순위 요약

| # | 항목 | 시급도 | 예상 시간 | 종속성 |
|---|------|--------|-----------|--------|
| 1 | Render 환경변수 추가 | 🔴 즉시 | 10분 | — |
| 2 | DB 마이그레이션 적용 | 🔴 즉시 | 5분 | #1 (`ENCRYPTION_KEY`/`HMAC_SECRET`) |
| 3 | Render DB 유료 플랜 전환 | 🟠 첫 유료 고객 전 | 5분 | — |
| 4 | Google OAuth 앱 등록 | 🟠 소셜 로그인 활성화 시 | 20분 | — |
| 5 | E2E 동작 검증 | 🔴 운영 오픈 전 | 30분 | #1, #2, #4 |
| 6 | Admin Backend/Web 배포 | 🟡 Admin 사용 시 | 40분 | #1 (`CUSTOMER_JWT_ACCESS_SECRET`) |
| 7 | 모바일 EAS Build | 🟡 모바일 출시 시 | 1시간 | 앱 아이콘 준비 |
| 8 | Sentry 토큰 설정 | 🟢 선택 | 15분 | — |
| 9 | SMS Provider 등록 | 🟢 선택 | 30분 | 외부 계약 |

> 시급도: 🔴 운영 오픈 필수 / 🟠 첫 고객 전 / 🟡 기능별 / 🟢 선택

---

## 1. Render 환경변수 추가 🔴

**목표**: 백엔드(`insagwanri-backend.onrender.com`)에 누락된 환경변수 9종 등록.

**경로**: Render Dashboard → `insagwanri-backend` 서비스 → Environment 탭 → "Add Environment Variable".

### 1-1. 보안 키 (필수, 변경 불가)

```bash
# 로컬에서 강력한 임의값 생성:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| 변수 | 값 생성 방법 | 비고 |
|------|--------------|------|
| `ENCRYPTION_KEY` | 위 명령어 1회 실행 | AES-256-GCM 키. **설정 후 변경 시 기존 데이터 복호화 불가** |
| `HMAC_SECRET` | 위 명령어 다시 실행 (`ENCRYPTION_KEY`와 다른 값) | 이메일 해시 검증용. 변경 시 기존 해시 무효 |

### 1-2. Google OAuth (소셜 로그인 활성화 후 #4 완료 후)

| 변수 | 값 |
|------|-----|
| `GOOGLE_CLIENT_ID` | Google Cloud Console에서 발급 받은 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console에서 발급 받은 시크릿 |
| `GOOGLE_CALLBACK_URL` | `render.yaml`에 고정값 — 별도 설정 불필요 |

### 1-3. 운영 한도 / 마케팅 / Admin

| 변수 | 권장값 | 용도 |
|------|--------|------|
| `OPENAI_DAILY_TOKEN_LIMIT` | `1000000` | 글로벌 일일 OpenAI 토큰 상한선 (0 = 무제한) |
| `MARKETING_STUDIO_KEY` | 8자 이상 임의 문자열 | `/marketing-studio` 페이지 접근 비밀키 |
| `CUSTOMER_JWT_ACCESS_SECRET` | Customer 백엔드의 `JWT_ACCESS_SECRET`과 **동일값** | Admin Backend가 Customer 토큰 검증용 |
| `DEV_FEEDBACK_EMAIL` | 개발자 이메일 | 인앱 피드백 수신처 |

### 검증
환경변수 추가 후 Render가 자동 재배포. 1~2분 후:
```bash
curl https://insagwanri-backend.onrender.com/api/v1/health
# 기대: {"status":"ok","database":"up","redis":"up"}
```

---

## 2. DB 마이그레이션 적용 🔴

**목표**: 누적 약 50개 마이그레이션 일괄 적용.

**전제**: #1-1 (`ENCRYPTION_KEY`/`HMAC_SECRET`) 완료 — 일부 마이그레이션이 이를 사용.

### 실행

**옵션 A — 자동 (권장)**: `render.yaml`의 `startCommand`가 이미 `npm run migration:run && node dist/main.js` 식으로 설정됨. Render 재배포 시 자동 적용.

**옵션 B — 수동**: Render Shell에서
```bash
cd /opt/render/project/src/backend
npm run migration:run
```

### 검증

Render Shell에서 psql 또는 외부 클라이언트로:

```sql
-- 1. 마이그레이션 이력
SELECT name, timestamp FROM migrations ORDER BY timestamp DESC LIMIT 10;
-- 기대: 가장 최근 timestamp = 1748300000000-DropLegacyCalendarTables

-- 2. 핵심 테이블 확인
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('schedules', 'schedule_shares', 'schedule_share_requests',
                      'company_modules', 'business_locations', 'shift_swap_requests')
 ORDER BY table_name;
-- 기대: 6개 모두 출력

-- 3. 옛 calendar_* 테이블 제거 확인 (Phase C cleanup)
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name LIKE 'calendar_%';
-- 기대: 행 0 (recurring_calendar_events는 테이블명 다름 — 정상)

-- 4. 최저시급 / 4대보험 컬럼 (확인용 — salary 테이블에 직접 컬럼 없음, 코드에서 계산)
SELECT count(*) FROM salaries;
-- 기대: 0 이상 (테이블 존재)
```

### 실패 시
- 마이그레이션 실패 메시지 확인
- 가장 최근 적용된 마이그레이션 1개 되돌리기:
  ```bash
  npm run migration:revert
  ```
- 데이터 손실 위험이 있는 경우 (`1748300000000-DropLegacyCalendarTables`는 down 차단됨) 백업에서 복원

---

## 3. Render DB 유료 플랜 전환 🟠

**목표**: 무료 PostgreSQL의 90일 만료·백업 부재 위험 해소.

**경로**: Render Dashboard → 데이터베이스 인스턴스 → Settings → Plan → **Starter** ($7/월) 이상으로 업그레이드.

### 무료 플랜 위험
| 위험 | 영향 |
|------|------|
| 90일 후 인스턴스 자동 삭제 | **모든 데이터 영구 손실** |
| 자동 백업 없음 | 사고 시 복원 불가 |
| 1GB 한도 | 직원 100명 도달 시 부족 가능 |

### Starter 플랜 이상의 이점
- 무기한 보존
- 일일 자동 백업 (7일 보관)
- 256MB→1GB 메모리 (성능 향상)

> ⚠️ 첫 유료 고객을 받기 전 반드시 전환. 무료 플랜으로 운영 시 데이터 보장 못 함.

---

## 4. Google OAuth 앱 등록 🟠

**목표**: 구글 소셜 로그인 활성화 (Web/iOS/Android).

### 단계

1. **Google Cloud Console 접속**: https://console.cloud.google.com
2. **프로젝트 생성** (없는 경우): "관리왕 Production" 등
3. **OAuth 동의 화면 구성**:
   - Type: **External**
   - 앱 이름: "관리왕"
   - 사용자 지원 이메일, 개발자 연락처
   - 스코프: `email`, `profile`, `openid`
4. **승인된 도메인 추가**: `insagwanri-nine.vercel.app`, `insagwanri-backend.onrender.com`
5. **Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `https://insagwanri-nine.vercel.app`
     - `https://insagwanri-backend.onrender.com`
   - Authorized redirect URIs:
     - `https://insagwanri-backend.onrender.com/api/v1/auth/google/callback`
6. **Client ID / Secret 복사** → #1-2 Render 환경변수에 입력

### iOS / Android (모바일 EAS Build 시 — #7 단계)
- 별도 OAuth Client ID 추가:
  - Type: **iOS** → Bundle ID 입력 (e.g. `com.insagwanri.app`)
  - Type: **Android** → Package name + SHA-1 (eas credentials에서 확인)

### 검증
1. `https://insagwanri-nine.vercel.app/login` 접속
2. "Google로 계속하기" 클릭
3. Google 동의 화면 → 가입 → 대시보드 진입 확인

### 실패 시
- `redirect_uri_mismatch` → Authorized redirect URIs에 정확한 URL 등록 필요 (trailing slash 주의)
- `invalid_client` → Client Secret 재생성 후 Render 환경변수 갱신
- 동의 화면이 "검증되지 않음" → External + Testing 모드면 정상. Production 모드 신청은 Google 검수 1-3일

---

## 5. E2E 동작 검증 🔴

**목표**: 핵심 회원가입~사용 흐름이 운영 환경에서 정상 동작 확인.

### 시나리오 (각 단계 통과 확인)

```
[ ] 1. https://insagwanri-nine.vercel.app 접속 → 랜딩 페이지 로드
[ ] 2. 회원가입 (이메일+비밀번호 또는 Google)
       └ 가입 직후 결제 페이지 또는 무료 플랜 진입
[ ] 3. 회사 기본 정보 입력 (회사명, 업종)
[ ] 4. 직원 1명 초대 (이메일 또는 링크)
[ ] 5. 출퇴근 (출근 → 5분 후 퇴근)
       └ /attendance 에서 기록 확인
[ ] 6. 캘린더에 일정 1개 등록 (월간 / 주간 뷰 토글 정상)
[ ] 7. 결재 문서 1건 작성 → 본인 승인 → 봉인 PDF 인쇄 미리보기
[ ] 8. 로그아웃 → 다시 로그인
[ ] 9. /billing 접근 → 구독 / AI 크레딧 탭 노출 확인
```

### 자주 발견되는 문제
- **CORS 오류**: `ALLOWED_ORIGINS`에 Vercel URL 누락 → Render 환경변수 확인
- **JWT 파싱 오류**: `JWT_ACCESS_SECRET` 변경됨 → 모든 사용자 강제 로그아웃 필요 (운영 데이터 있는 경우 주의)
- **데이터베이스 연결 실패**: `health` 응답에 `database: down` → DB 인스턴스 시작 확인 (무료 플랜은 90일 만료)
- **OAuth `redirect_uri_mismatch`**: #4 단계의 Authorized redirect URIs 재확인

---

## 6. Admin Backend / Web 배포 🟡

**목표**: 관리자(운영) 콘솔을 별도 서비스로 배포.

### 6-1. Admin Backend (Render 신규 Web Service)

**경로**: Render Dashboard → New → Web Service → GitHub 리포지토리 선택 → Root Directory: `admin-backend`

**설정**:
| 항목 | 값 |
|------|-----|
| Name | `insagwanri-admin-backend` |
| Region | Singapore (Customer 백엔드와 동일) |
| Branch | `master` |
| Root Directory | `admin-backend` |
| Build Command | `npm install && npm run build` |
| Start Command | `node dist/main.js` |
| Plan | Starter ($7/월) |

**환경변수 (필수)**:
```
NODE_ENV=production
PORT=10000
ADMIN_JWT_ACCESS_SECRET=<32바이트 임의값, Customer와 별도>
ADMIN_JWT_REFRESH_SECRET=<32바이트 임의값>
CUSTOMER_DATABASE_URL=<Customer 백엔드와 동일한 DB URL>
ADMIN_DATABASE_URL=<별도 admin DB URL — 또는 Customer와 공유>
CUSTOMER_JWT_ACCESS_SECRET=<Customer JWT_ACCESS_SECRET과 동일값>
ALLOWED_ORIGINS=https://insagwanri-admin.vercel.app
```

> ⚠️ Admin 시스템이 Customer DB를 **읽기 전용**으로 접근. Customer DB의 `DB_USERNAME`은 권한 분리 권장 (별도 read-only 계정).

### 6-2. Admin Web (Vercel 신규 프로젝트)

**경로**: Vercel Dashboard → Add New → Project → 동일 리포 import → Root Directory: `admin-web`

**설정**:
| 항목 | 값 |
|------|-----|
| Project Name | `insagwanri-admin` |
| Framework Preset | Next.js |
| Root Directory | `admin-web` |
| Build Command | (자동) `npm run build` |

**환경변수**:
```
NEXT_PUBLIC_ADMIN_API_URL=https://insagwanri-admin-backend.onrender.com/api/v1
```

**vercel.json rewrites** (이미 admin-web에 포함됨):
```json
{ "rewrites": [
  { "source": "/api/v1/:path*",
    "destination": "https://insagwanri-admin-backend.onrender.com/api/v1/:path*" }
]}
```

### 검증
- `https://insagwanri-admin.vercel.app/login` 접속 → Admin 계정으로 로그인
- 대시보드에서 회사 목록 / 매출 / 운영 지표 노출 확인

---

## 7. 모바일 EAS Build 🟡

**목표**: iOS / Android 앱 빌드 & 스토어 제출 준비.

### 사전 준비

```bash
cd mobile
npm install -g eas-cli
eas login        # Expo 계정 로그인
eas init         # eas.json 생성
eas build:configure
```

### 앱 아이콘 / 스플래시
- `mobile/assets/icon.png` (1024x1024) — 정사각형, 투명도 X
- `mobile/assets/splash.png` (1242x2436) — iPhone 스플래시
- `mobile/assets/adaptive-icon.png` (1024x1024) — Android 적응형 아이콘 전경
- `mobile/app.json`에서 경로 확인

### iOS 빌드 (App Store)

```bash
eas build --platform ios --profile production
```

필요한 것:
- Apple Developer Program 등록 ($99/년)
- App Store Connect에서 앱 생성
- `bundleIdentifier`: `com.insagwanri.app` (app.json)
- Push Notification 인증서 (`expo credentials:manager`로 생성)

### Android 빌드 (Google Play)

```bash
eas build --platform android --profile production
```

필요한 것:
- Google Play Console 등록 ($25 1회)
- `package`: `com.insagwanri.app` (app.json)
- 키스토어 (`eas credentials`로 자동 생성·관리)

### v1.1 추가 패키지 (필요 시)
- `expo-camera` — QR 코드 출퇴근
- `expo-local-authentication` — 생체 인증
```bash
expo install expo-camera expo-local-authentication
```

### 스토어 제출

```bash
eas submit --platform ios     # App Store Connect
eas submit --platform android # Google Play Console
```

---

## 8. Sentry 토큰 설정 🟢 (선택)

**목표**: 운영 오류 자동 수집·알림.

### 단계

1. https://sentry.io 가입 → "관리왕" 조직 + Next.js 프로젝트 생성
2. Vercel Dashboard → 프로젝트 → Settings → Environment Variables 추가:

| 변수 | 값 |
|------|-----|
| `SENTRY_AUTH_TOKEN` | sentry.io → Settings → Auth Tokens → Create Token (`project:write` 스코프) |
| `SENTRY_ORG` | sentry.io 조직 슬러그 (URL의 일부) |
| `SENTRY_PROJECT` | sentry.io 프로젝트 슬러그 |

> 미설정 시 `next.config.mjs`가 조건부로 Sentry 래핑을 건너뜀 (빌드 정상 진행).

3. Vercel 재배포 → 의도적 오류 발생시킨 후 Sentry 대시보드에 수집되는지 확인.

---

## 9. SMS Provider 등록 🟢 (선택)

**목표**: 휴대폰 번호 OTP 인증 활성화.

### 추천: Coolsms (https://coolsms.co.kr)

1. 가입 후 발신번호 등록 (사업자 등록증 필요, 1-2일 검수)
2. API 키 발급 → Render 환경변수 추가:

```
SMS_PROVIDER=coolsms
SMS_API_KEY=<Coolsms API Key>
SMS_API_SECRET=<Coolsms API Secret>
SMS_FROM=<등록된 발신번호, 010-XXXX-XXXX>
```

3. 검증: 회원가입 흐름에서 휴대폰 OTP 발송 확인.

### 대안 Provider
- **NCP SENS** (Naver Cloud) — 발신번호 검수 빠름
- **Toast SMS** (NHN)
- 코드는 `backend/src/common/sms/sms.service.ts`에서 provider 분기 가능

---

## 10. (옵션) 추가 운영 작업

### 10-1. R2 / S3 Lifecycle Policy
- Cloudflare R2 또는 AWS S3 콘솔
- `exports/` 프리픽스: 7일 후 자동 삭제 규칙 설정
- 엑셀 export, PDF 봉인본 등이 누적되지 않도록 함

### 10-2. DB 인덱스 실제 생성 확인
```sql
SELECT indexname, tablename FROM pg_indexes
 WHERE schemaname = 'public'
   AND indexname LIKE 'idx_%'
 ORDER BY tablename, indexname;
```
- 핵심 인덱스 누락 시 성능 저하

### 10-3. 정기 백업 검증
- Render DB Starter 이상은 자동 백업
- 분기별 1회 복원 시뮬레이션 (테스트 DB로)

### 10-4. PIPA / 개인정보처리방침 법무 검토
- `docs/feature-documentation.md`의 PIPA 체크리스트 참고
- 법무 검토 후 `/privacy-policy` 페이지 확정

---

## 부록: 자주 사용되는 명령어

### Render Shell 접속
- Dashboard → 서비스 → Shell 탭

### 로컬에서 운영 DB 접속 (psql)
```bash
psql $DATABASE_URL
# DATABASE_URL은 Render Dashboard의 External Database URL
```

### 강력한 키 생성
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 마이그레이션 실행 / 되돌리기
```bash
cd backend
npm run migration:run     # 미적용 모두 실행
npm run migration:revert  # 가장 최근 1개만 되돌리기
npm run migration:show    # 적용/미적용 목록 출력
```

### TypeORM 마이그레이션 새로 생성
```bash
npm run migration:create -- src/database/migrations/AddNewFeature
```

---

## 진행 상황 트래커

각 항목 완료 시 위 체크박스를 `[x]`로 업데이트하고, 이 섹션에 날짜·담당자 기록.

| 항목 | 완료일 | 담당 | 비고 |
|------|--------|------|------|
| 1. Render 환경변수 | YYYY-MM-DD | | |
| 2. DB 마이그레이션 | YYYY-MM-DD | | |
| 3. Render DB 유료 플랜 | YYYY-MM-DD | | |
| 4. Google OAuth 앱 | YYYY-MM-DD | | |
| 5. E2E 검증 | YYYY-MM-DD | | |
| 6. Admin 배포 | YYYY-MM-DD | | |
| 7. 모바일 EAS Build | YYYY-MM-DD | | |
| 8. Sentry 토큰 | YYYY-MM-DD | | |
| 9. SMS Provider | YYYY-MM-DD | | |
