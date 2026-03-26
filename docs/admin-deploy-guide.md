# Admin 시스템 배포 가이드

> 작성일: 2026-03-25
> 상태: 코드 준비 완료, 배포 대기

---

## 1. admin-backend → Render 배포

브라우저에서 아래 URL로 바로 진입:
```
https://dashboard.render.com/new/web
```

### 설정값
| 항목 | 값 |
|------|----|
| Name | `insagwanri-admin-backend` |
| Region | Singapore |
| Branch | `master` |
| Root Directory | `admin-backend` |
| Runtime | Node |
| Build Command | `npm install --legacy-peer-deps --include=dev && npm run build` |
| Start Command | `node dist/main.js` |
| Plan | Free |

### 환경변수 (복붙용)
```
NODE_ENV=production
ADMIN_PORT=4001
ADMIN_JWT_SECRET=ec3c2816f7b95e79803890274665dc7c6bb944f0576e511ff30f2b462ee2523959eab3d79155b576647b2e825e9d63fd
ADMIN_JWT_TEMP_SECRET=8cd2df900f2fb9ea7d80f4d2f27dc99308aa37e695ed4252d25e0193f27af0cffee664c1d51076fd9a86414f54db3981
BILLING_KEY_ENCRYPTION_KEY=1ccfd9ece49654ef4d073ede50d5b3cb986eaf816af78e173935048e3eead850
TOSS_PAYMENTS_SECRET_KEY=test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R
ADMIN_FRONTEND_URL=http://localhost:4000
ADMIN_ALLOWED_IPS=
```

> DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD / DB_NAME / REDIS_URL 은
> 기존 `insagwanri-backend` 서비스 → Environment 탭에서 복사해서 그대로 붙여넣기

### 배포 후 확인
```
https://insagwanri-admin-backend.onrender.com/admin/v1/health
```
`{ "status": "ok", "database": "up" }` 응답 확인

---

## 2. admin-web → Vercel 배포

1. https://vercel.com → Add New Project
2. GitHub `insagwanri` 레포 선택
3. 설정:

| 항목 | 값 |
|------|----|
| Framework | Next.js |
| Root Directory | `admin-web` |
| Build Command | `npm run build` |

4. 환경변수:
```
NEXT_PUBLIC_ADMIN_API_URL=/admin/v1
```

5. Deploy

---

## 3. 마지막 — 순환 의존 해소 (중요)

admin-web 배포 완료 후 Vercel에서 나온 URL을 확인해서:

Render → `insagwanri-admin-backend` → Environment → `ADMIN_FRONTEND_URL` 값 수정
```
ADMIN_FRONTEND_URL=https://insagwanri-admin.vercel.app  ← 실제 URL로
```
→ Manual Deploy (재배포)

---

## 4. DB 마이그레이션

admin-backend 배포 완료 후 Render Shell에서:
```bash
npm run migration:run
```
마이그레이션: `1741910500000-AdminSchema`

---

## 참고 — admin-web URL 접속 후 최초 로그인

TOTP MFA 설정이 필요합니다:
1. `POST /admin/v1/auth/login` — 비밀번호 입력
2. `POST /admin/v1/auth/mfa/setup/init` — QR 코드 발급
3. Google Authenticator 등록
4. `POST /admin/v1/auth/mfa/setup/confirm` — 활성화

> 초기 SUPER_ADMIN 계정은 DB 시드 또는 직접 INSERT로 생성 필요
