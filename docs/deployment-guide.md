# 배포 가이드 — Vercel (Frontend) + Render (Backend)

---

## ⚠️ AI AGENT 필독 — 작업 시작 전 반드시 준수

> **이 섹션은 이 문서를 읽는 모든 AI Agent에게 강제되는 규칙입니다.**
> 배포 관련 작업을 시작하기 전에 아래 체크리스트를 반드시 확인하고, 각 항목을 지키지 않으면 작업을 시작하지 마세요.

### 작업 시작 전 필수 확인 체크리스트

- [ ] `git remote -v` 로 현재 remote URL이 `https://github.com/genJ-M/insagwanri.git` 인지 확인
- [ ] `render.yaml`의 `buildCommand`에 `--legacy-peer-deps --include=dev` 포함 여부 확인
- [ ] `render.yaml`의 Redis에 `ipAllowList: []` 존재 여부 확인
- [ ] `render.yaml`의 DB `plan`이 `free` (starter 아님) 확인
- [ ] `render.yaml`의 백엔드 `runtime`이 `node` (docker 아님) 확인
- [ ] `backend/data-source.prod.ts` 파일 존재 여부 확인
- [ ] `web/vercel.json`의 모든 URL이 `insagwanri-backend.onrender.com` 인지 확인

### AI Agent가 절대 하면 안 되는 것

1. **`runtime: docker` 사용 금지** — NestJS 배포 시 `dist/main` 못 찾는 오류 발생
2. **`startCommand`를 docker runtime에 추가 금지** — Render Blueprint 파싱 오류
3. **DB plan을 `starter`로 설정 금지** — deprecated, Blueprint 오류
4. **Redis에 `ipAllowList` 없이 설정 금지** — Blueprint 오류
5. **`npm install` 단독 사용 금지** — 반드시 `--legacy-peer-deps --include=dev` 포함
6. **push 전 remote URL 확인 없이 진행 금지** — 잘못된 레포에 push 위험
7. **vercel.json 수정 시 CSP의 `wss://` URL 누락 금지** — WebSocket 연결 차단
8. **`tsconfig.build.json` 없이 NestJS 배포 금지** — 루트에 ts 파일 있으면 `dist/src/main.js`로 컴파일됨 (`dist/main.js` 아님)
9. **`data-source.prod.ts`를 루트에 두면 안 됨** — 반드시 `src/` 안에 위치해야 정상 컴파일

### 이 문서가 업데이트되어야 하는 시점

새로운 배포 오류가 발생하고 해결됐을 때, 반드시:
1. 이 문서의 트러블슈팅 섹션에 오류 추가
2. 위 체크리스트에 해당 항목 추가
3. `memory/render-deployment-lessons.md` 업데이트
4. `memory/MEMORY.md` 인덱스 업데이트

---

> 이 문서는 실제 배포 과정에서 겪은 오류와 해결책을 포함한 실전 가이드입니다.

---

## 아키텍처 요약

```
사용자
 ├── Vercel (Next.js 프론트엔드)
 │     └── API 요청 → Render 백엔드
 └── Render (NestJS 백엔드)
       ├── PostgreSQL (Render 내부 DB)
       └── Redis (Render 내부 캐시)
```

---

## 1. 사전 준비

### 필수 환경변수 목록

| 변수 | 설명 | 생성 방법 |
|------|------|-----------|
| `JWT_ACCESS_SECRET` | JWT 액세스 토큰 시크릿 | `node -e "require('crypto').randomBytes(48).toString('hex')"` |
| `JWT_REFRESH_SECRET` | JWT 리프레시 토큰 시크릿 | 위와 동일, 다른 값으로 |
| `OPENAI_API_KEY` | AI 기능용 | platform.openai.com |
| `RESEND_API_KEY` | 이메일 발송 | resend.com (없으면 이메일 기능만 비활성) |
| `AWS_ACCESS_KEY_ID` | 파일 업로드 | AWS IAM (없으면 파일 업로드만 비활성) |

### 필수 파일 체크리스트

- [ ] `render.yaml` — 루트 디렉토리에 존재
- [ ] `backend/tsconfig.build.json` — rootDir: "src" 설정 (없으면 dist/main.js 경로 틀어짐)
- [ ] `backend/src/data-source.prod.ts` — 프로덕션 TypeORM DataSource (src/ 안에 있어야 함)
- [ ] `web/vercel.json` — Vercel 설정 (API URL, CSP, rewrites)

---

## 2. render.yaml 작성 규칙 (오류 방지)

### ✅ 최종 작동하는 구조

```yaml
services:
  - type: web
    name: {프로젝트}-backend
    runtime: node              # 반드시 node (docker 사용 시 dist 문제 발생)
    rootDir: backend           # 모노레포 구조 시 필수
    buildCommand: npm install --legacy-peer-deps && npm run build
    startCommand: node node_modules/typeorm/cli.js migration:run -d dist/data-source.prod.js && node dist/main
    plan: free
    region: singapore          # 한국 서비스는 singapore 가장 가까움
    healthCheckPath: /api/v1/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
      - key: DB_HOST
        fromDatabase:
          name: {프로젝트}-db
          property: host
      - key: DB_PORT
        fromDatabase:
          name: {프로젝트}-db
          property: port
      - key: DB_USERNAME
        fromDatabase:
          name: {프로젝트}-db
          property: user
      - key: DB_PASSWORD
        fromDatabase:
          name: {프로젝트}-db
          property: password
      - key: DB_NAME
        fromDatabase:
          name: {프로젝트}-db
          property: database
      - key: REDIS_URL
        fromService:
          name: {프로젝트}-redis
          type: redis
          property: connectionString
      - key: JWT_ACCESS_SECRET
        sync: false            # 대시보드에서 직접 입력
      - key: JWT_REFRESH_SECRET
        sync: false

  - type: redis
    name: {프로젝트}-redis
    plan: free
    region: singapore
    maxmemoryPolicy: allkeys-lru
    ipAllowList: []            # 필수 — 없으면 Blueprint 오류

databases:
  - name: {프로젝트}-db
    plan: free                 # starter는 deprecated — free만 사용
    region: singapore
    databaseName: {db_name}
    user: {db_user}
```

### ❌ 하면 안 되는 것들

| 잘못된 설정 | 오류 | 올바른 설정 |
|-------------|------|-------------|
| `runtime: docker` + `startCommand` | `docker runtime must not have startCommand` | `runtime: node` 사용 |
| `runtime: docker` (NestJS) | `Cannot find module dist/main` | `runtime: node` 사용 |
| Redis에 `ipAllowList` 누락 | `must specify IP allow list` | `ipAllowList: []` 추가 |
| DB `plan: starter` | `Legacy Postgres plans not supported` | `plan: free` 사용 |
| `npm install` (NestJS 혼합 버전) | `ERESOLVE peer dep conflict` | `npm install --legacy-peer-deps` |

---

## 3. TypeORM 프로덕션 마이그레이션

### 문제
`data-source.ts`는 TypeScript 경로(`src/**/*.entity.ts`)를 사용 → 프로덕션 dist에서 작동 안 함.
Render free 플랜은 Shell 탭이 없어서 수동 마이그레이션 불가.

### 해결: data-source.prod.ts 별도 생성

```typescript
// backend/data-source.prod.ts
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  synchronize: false,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
  migrationsTableName: 'migrations',
});
```

이 파일은 `npm run build` 시 `dist/data-source.prod.js`로 컴파일됨.
startCommand에서 자동 실행: 서버 시작 전 마이그레이션 → 서버 구동.

---

## 4. Vercel 설정

### vercel.json 핵심 설정

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "regions": ["icn1"],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://{프로젝트}-backend.onrender.com/api/v1"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; connect-src 'self' https://{프로젝트}-backend.onrender.com wss://{프로젝트}-backend.onrender.com; ..."
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://{프로젝트}-backend.onrender.com/api/:path*"
    }
  ]
}
```

**주의:** CSP의 `connect-src`에 백엔드 URL과 WebSocket URL(`wss://`) 모두 포함해야 함.

---

## 5. Render 배포 순서

1. **render.com → New → Blueprint**
   - GitHub 레포 연결
   - `render.yaml` 자동 감지

2. **환경변수 입력** (Render 대시보드 → 백엔드 서비스 → Environment)
   - `sync: false`로 표시된 값들 직접 입력
   - JWT 시크릿은 `node -e "require('crypto').randomBytes(48).toString('hex')"` 로 생성

3. **배포 완료 확인**
   - Logs에서 마이그레이션 성공 메시지 확인
   - `healthCheckPath` 응답 확인

4. **Vercel 재배포**
   - vercel.json에 백엔드 URL이 이미 설정되어 있으면 자동 반영

---

## 6. Render Free 플랜 제약 및 대응

| 제약 | 영향 | 대응 |
|------|------|------|
| 15분 비활동 시 슬립 | 첫 요청 ~30초 지연 | 유료 전환 전까지 허용, ping 서비스로 방지 가능 |
| PostgreSQL 90일 자동 삭제 | 데이터 소실 | 실서비스 전 `starter`($7/월) 이상으로 업그레이드 |
| Redis 25MB | 대용량 캐시 불가 | 세션/소켓용으로는 충분 |
| Shell 탭 없음 | 수동 DB 작업 불가 | startCommand에 마이그레이션 포함으로 해결 |

---

## 7. 트러블슈팅 체크리스트

배포 실패 시 다음 순서로 확인:

1. **Blueprint 파싱 오류** → render.yaml 문법 확인 (ipAllowList, plan 이름)
2. **Build failed** → `npm install --legacy-peer-deps` 사용 여부 확인
3. **Cannot find module dist/main** → `runtime: docker` → `runtime: node` 전환
4. **Migration failed** → `data-source.prod.ts` 존재 여부, SSL 설정 확인
5. **API 연결 안됨** → vercel.json의 백엔드 URL, CORS `FRONTEND_URL` 확인
6. **WebSocket 안됨** → CSP `connect-src`에 `wss://` URL 포함 여부 확인
