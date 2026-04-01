# 수동 작업 완전 가이드 (manual-setup)

> 최종 업데이트: 2026-03-28
> 코드 구현 완료 후 프로덕션 오픈을 위한 수동 작업 순서 및 상세 절차

## 우선순위 순서

```
1. Render 환경변수 추가          ← 필수 (보안 기능 미작동)
2. DB 마이그레이션 실행           ← 필수 (신규 기능 DB 없음)
3. Google OAuth 앱 등록          ← 소셜 로그인 활성화
4. Render DB 유료 플랜 전환       ← 유료 고객 받기 전
5. E2E 검증                     ← 오픈 전 필수
6. Admin 배포                    ← 운영 관리용
7. EAS Build (모바일)            ← 앱스토어 배포
```

---

## 1. Render 환경변수 추가

**경로:** `dashboard.render.com` → `insagwanri-backend` → **Environment** 탭

### Step 1 — ENCRYPTION_KEY, HMAC_SECRET 생성

터미널(아무데서나)에서 아래 명령어를 **2번** 각각 실행:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
- 첫 번째 출력 → `ENCRYPTION_KEY`
- 두 번째 출력 → `HMAC_SECRET` (반드시 다른 값으로)

> ⚠️ 이 두 값은 설정 후 절대 변경 불가. 변경 시 기존 암호화 데이터 전부 복호화 불가.
> 안전한 곳(1Password, Notion 등)에 반드시 백업.

### Step 2 — Render에 입력

| 변수명 | 값 | 설명 |
|---|---|---|
| `ENCRYPTION_KEY` | (Step 1에서 생성한 64자 hex) | 개인정보 AES-256 암호화 키 |
| `HMAC_SECRET` | (Step 1에서 생성한 64자 hex, 다른 값) | 이메일 해시 검색용 |
| `GOOGLE_CLIENT_ID` | (3번 OAuth 등록 후 발급) | Google 소셜 로그인 |
| `GOOGLE_CLIENT_SECRET` | (3번 OAuth 등록 후 발급) | Google 소셜 로그인 |
| `OPENAI_DAILY_TOKEN_LIMIT` | `1000000` | AI 일일 토큰 상한 (0이면 무제한) |
| `CUSTOMER_JWT_ACCESS_SECRET` | (기존 `JWT_ACCESS_SECRET`과 동일한 값 복사) | Admin Impersonation용 |

### Step 3 — 저장 후 자동 재배포

"Save Changes" 클릭 → Render가 자동으로 재배포.
배포 완료 후 확인:
```
https://insagwanri-backend.onrender.com/api/v1/health
```
`"status":"ok"` 응답 확인.

---

## 2. DB 마이그레이션 실행

**경로:** `dashboard.render.com` → `insagwanri-backend` → **Shell** 탭

```bash
# 현재 위치 확인 (backend 디렉토리여야 함)
pwd

# 마이그레이션 실행 (미실행 16개 자동 적용)
npm run migration:run
```

실행 결과에서 아래 16개가 순서대로 "migration ... has been executed" 로 나오면 성공:

```
1741910405000-CreateSalaryTable
1741910406000-CreateHrNotesTable
1741910408000-CreateVacationTables
1741910409000-CreateApprovalsTables
1741910410000-CreateContractsTable
1741910411000-CreateCalendarEventsTable
1741910412000-CreateEvaluationTables
1741910413000-CreateUserProfileTables
1741910414000-AddBrandingColumns
1741910415000-CreateTrainingTables
1741910416000-AddOAuthColumns
1741910419000-AddEncryptedColumns
1741910420000-CreateActivityLogsTable
1741910421000-ExtendInviteTokensAndPhoneOtp
1741910422000-AddCompanyTypeAndUserPermissions
```

> 마이그레이션 실행 후 암호화 백필이 자동 시작됩니다 (`CryptoMigrationService`).
> 기존 users 테이블의 email/name이 암호화되고 email_hash가 채워집니다. 완료까지 수 초~수십 초.

---

## 3. Google OAuth 앱 등록

### 3-1. Google Cloud Console 프로젝트 생성

1. `console.cloud.google.com` 접속
2. 상단 프로젝트 선택 → **새 프로젝트**
   - 프로젝트 이름: `insagwanri`
3. 생성 후 해당 프로젝트 선택

### 3-2. OAuth 동의 화면 설정

1. 좌측 메뉴 → **API 및 서비스** → **OAuth 동의 화면**
2. User Type: **외부** → 만들기
3. 앱 정보 입력:
   - 앱 이름: `관리왕`
   - 사용자 지원 이메일: 본인 이메일
   - 개발자 연락처: 본인 이메일
4. **저장 후 계속** → 범위 추가 없이 계속 → 완료

### 3-3. 웹 클라이언트 ID 발급 (백엔드 + 웹 로그인용)

1. 좌측 메뉴 → **사용자 인증 정보** → **+ 사용자 인증 정보 만들기** → **OAuth 2.0 클라이언트 ID**
2. 애플리케이션 유형: **웹 애플리케이션**
3. 이름: `insagwanri-web`
4. **승인된 자바스크립트 원본** 추가:
   ```
   https://insagwanri-nine.vercel.app
   ```
5. **승인된 리디렉션 URI** 추가:
   ```
   https://insagwanri-backend.onrender.com/api/v1/auth/google/callback
   ```
6. **만들기** 클릭
7. 팝업에서 **클라이언트 ID**, **클라이언트 보안 비밀번호** 복사
   → 1번 단계의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 입력

---

## 4. Render DB 유료 플랜 전환

> ⚠️ 무료 PostgreSQL은 **90일 후 자동 삭제**, 자동 백업 없음. 실제 고객 데이터 받기 전 반드시 업그레이드.

1. `dashboard.render.com` → 좌측에서 PostgreSQL 서비스 클릭
2. **Settings** 탭 → **Plan** 섹션 → **Upgrade**
3. **Starter 플랜** 선택 ($7/월): 자동 백업, 90일 만료 없음
4. 결제 정보 입력 후 업그레이드

> 백엔드 웹 서비스도 **Starter 플랜** ($7/월)으로 업그레이드하면 슬립 없이 상시 기동됨.
> 현재 무료 플랜은 15분 미활성 시 슬립 → 첫 요청 30초 지연 발생.

---

## 5. E2E 검증 체크리스트

환경변수 + 마이그레이션 완료 후 브라우저에서 직접 테스트:

**`https://insagwanri-nine.vercel.app`**

```
[ ] 이메일 회원가입 → 이메일 인증 링크 수신 → 인증 완료
[ ] 이메일 로그인 → 대시보드 진입
[ ] Google 소셜 로그인 (신규 계정)
[ ] Google 소셜 로그인 (기존 계정, 동일 이메일)
[ ] 직원 초대 — 이메일 발송 → 링크 클릭 → 가입 완료
[ ] 직원 초대 — 링크 공유 방식
[ ] 출근 버튼 클릭 → 기록 확인
[ ] 퇴근 버튼 클릭 → 근무시간 계산 확인
[ ] 비밀번호 찾기 — 이메일 링크 수신 → 변경 완료
[ ] AI 탭 → 질문 입력 → 응답 수신 (면책 문구 표시 확인)
[ ] 급여 등록 → 최저임금 위반 경고 표시 확인
[ ] 15분 후 토큰 만료 → 자동 갱신 (페이지 유지되는지)
```

---

## 6. Admin 배포

### 6-1. Admin Backend → Render

1. `dashboard.render.com/new/web` 접속
2. GitHub `insagwanri` 레포 연결
3. 설정:

| 항목 | 값 |
|---|---|
| Name | `insagwanri-admin-backend` |
| Region | Singapore |
| Branch | `master` |
| Root Directory | `admin-backend` |
| Runtime | **Node** (docker 절대 선택 금지) |
| Build Command | `npm install --legacy-peer-deps --include=dev && npm run build` |
| Start Command | `node dist/main.js` |
| Plan | Free (초기) |

4. 환경변수 추가:

```
NODE_ENV=production
ADMIN_PORT=4001
ADMIN_JWT_SECRET=<새로 생성: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
ADMIN_JWT_TEMP_SECRET=<새로 생성, 다른 값>
BILLING_KEY_ENCRYPTION_KEY=<새로 생성: randomBytes(32).toString('hex')>
TOSS_PAYMENTS_SECRET_KEY=test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R
ADMIN_FRONTEND_URL=http://localhost:4000
ADMIN_ALLOWED_IPS=
CUSTOMER_JWT_ACCESS_SECRET=<기존 백엔드 JWT_ACCESS_SECRET과 동일>
```

> `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `REDIS_URL` →
> `insagwanri-backend` 서비스 Environment 탭에서 복사해서 그대로 추가

5. **Deploy** 클릭

6. 배포 완료 후 확인:
   ```
   https://insagwanri-admin-backend.onrender.com/admin/v1/health
   ```

7. Render Shell에서 마이그레이션:
   ```bash
   npm run migration:run
   ```
   → `1741910500000-AdminSchema` 마이그레이션 실행 확인

### 6-2. Admin Web → Vercel

1. `vercel.com` → **Add New Project**
2. GitHub `insagwanri` 레포 선택
3. 설정:

| 항목 | 값 |
|---|---|
| Framework | Next.js |
| Root Directory | `admin-web` |
| Build Command | `npm run build` (기본값) |

4. 환경변수:
   ```
   NEXT_PUBLIC_ADMIN_API_URL=/admin/v1
   ```

5. **Deploy** 클릭
6. 배포 완료 후 나온 URL 확인 (예: `insagwanri-admin.vercel.app`)

### 6-3. 순환 의존 해소 (중요)

Admin Web URL 확정 후:

`Render` → `insagwanri-admin-backend` → Environment → `ADMIN_FRONTEND_URL` 수정:
```
ADMIN_FRONTEND_URL=https://insagwanri-admin.vercel.app
```
→ **Save Changes** → 자동 재배포

### 6-4. Admin 최초 로그인 (TOTP MFA 등록)

배포 후 아래 순서로 MFA 등록 (curl 또는 Postman 사용):

```bash
# 1. 로그인 (임시 토큰 발급)
POST https://insagwanri-admin-backend.onrender.com/admin/v1/auth/login
Body: { "email": "admin@gwanriwang.com", "password": "초기비밀번호" }

# 2. MFA 설정 초기화 (QR 코드 발급)
POST /admin/v1/auth/mfa/setup/init
Header: Authorization: Bearer <임시토큰>

# 3. QR 코드를 Google Authenticator 등 OTP 앱으로 스캔

# 4. MFA 등록 확인
POST /admin/v1/auth/mfa/setup/confirm
Body: { "code": "123456" }
```

---

## 7. EAS Build (모바일 앱스토어 배포)

### 7-1. 사전 준비

```bash
# EAS CLI 설치
npm install -g eas-cli

# Expo 계정 로그인 (expo.dev 가입 필요)
eas login

# 프로젝트 초기화
cd mobile
eas init
```

`eas init` 완료 후 `app.json`에서 아래 2곳 교체:
- `extra.eas.projectId`: 발급된 Project ID
- `updates.url`: `https://u.expo.dev/{발급된_PROJECT_ID}`

그리고 `owner` 필드도 Expo 계정 슬러그로 교체.

### 7-2. 앱 에셋 준비

`mobile/assets/` 에 아래 4개 이미지 필요:

| 파일명 | 크기 | 용도 |
|---|---|---|
| `icon.png` | 1024×1024px | 앱 아이콘 |
| `splash.png` | 1284×2778px | 스플래시 화면 |
| `adaptive-icon.png` | 1024×1024px | Android 적응형 아이콘 |
| `favicon.png` | 48×48px | 웹용 파비콘 |

### 7-3. Google OAuth 앱 추가 (모바일용)

Google Cloud Console → 사용자 인증 정보 → **OAuth 2.0 클라이언트 ID** 추가:

**Android용:**
- 유형: Android
- 패키지 이름: `com.insagwanri.app` (app.json의 `android.package` 값)
- SHA-1 인증서 지문: `eas credentials` 명령으로 확인

**iOS용:**
- 유형: iOS
- 번들 ID: `com.insagwanri.app` (app.json의 `ios.bundleIdentifier` 값)

각 클라이언트 ID를 `eas.json`의 env에 추가:
```json
"EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS": "발급된_iOS_클라이언트_ID",
"EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID": "발급된_Android_클라이언트_ID"
```

### 7-4. 빌드

```bash
# Android APK 내부 테스트 (빠름, 무료)
eas build --platform android --profile preview

# 앱스토어 제출용 Production 빌드
eas build --platform android --profile production
eas build --platform ios --profile production
```

### 7-5. 앱스토어 제출

**Android (Google Play):**
1. Google Play Console에서 서비스 계정 키 발급 → `mobile/google-service-account.json` 저장
2. `eas.json` → `submit.production.android.serviceAccountKeyPath` 경로 확인
3. `eas submit --platform android --profile production`

**iOS (App Store):**
1. `eas.json` → `submit.production.ios` 항목 입력:
   - `appleId`: Apple 개발자 계정 이메일
   - `ascAppId`: App Store Connect 앱 ID
   - `appleTeamId`: Apple 팀 ID
2. `eas submit --platform ios --profile production`

### 7-6. OTA 업데이트 (코드 변경 시 재빌드 없이 배포)

```bash
eas update --branch production --message "버그 수정"
```

> JS/TS 코드 변경만 가능. 네이티브 모듈 변경 시 재빌드 필요.

---

## 빠른 참고 — 전체 체크리스트

```
[ ] 1-1. ENCRYPTION_KEY / HMAC_SECRET 생성 & Render 입력
[ ] 1-2. OPENAI_DAILY_TOKEN_LIMIT / CUSTOMER_JWT_ACCESS_SECRET 입력
[ ] 2.   DB 마이그레이션 실행 (Render Shell, 16개)
[ ] 3-1. Google Cloud Console OAuth 동의 화면 설정
[ ] 3-2. 웹 OAuth 클라이언트 ID 발급
[ ] 3-3. GOOGLE_CLIENT_ID / SECRET Render 입력
[ ] 4.   Render DB Starter 플랜 업그레이드 ($7/월)
[ ] 5.   E2E 검증 (회원가입/로그인/출퇴근/AI/급여)
[ ] 6-1. Admin Backend Render 배포 + 마이그레이션
[ ] 6-2. Admin Web Vercel 배포
[ ] 6-3. ADMIN_FRONTEND_URL 순환 의존 해소
[ ] 6-4. Admin TOTP MFA 최초 등록
[ ] 7-1. EAS CLI 설치 & eas init & app.json 수정
[ ] 7-2. 앱 에셋 (아이콘/스플래시 4종) 준비
[ ] 7-3. Google OAuth iOS/Android 클라이언트 ID 발급 & 입력
[ ] 7-4. eas build preview (Android 내부 테스트)
[ ] 7-5. eas build production & eas submit
```
