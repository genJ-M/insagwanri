# ────────────────────────────────────────────
# Stage 1: 의존성 설치 (캐시 최적화)
# ────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# 패키지 파일만 먼저 복사 (레이어 캐시 활용)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && \
    # 개발 의존성도 빌드에 필요하므로 별도 복사
    cp -r node_modules /tmp/prod_modules && \
    npm ci --legacy-peer-deps

# ────────────────────────────────────────────
# Stage 2: 빌드
# ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ────────────────────────────────────────────
# Stage 3: 프로덕션 이미지 (최소 크기)
# ────────────────────────────────────────────
FROM node:20-alpine AS runner

# 보안: root가 아닌 전용 사용자로 실행
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nestjs

WORKDIR /app

# 프로덕션 의존성만 복사
COPY --from=deps    /tmp/prod_modules     ./node_modules
COPY --from=builder /app/dist             ./dist
COPY --from=builder /app/package.json     ./package.json

# 소유자 변경
RUN chown -R nestjs:nodejs /app

USER nestjs

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# 헬스체크: 30초 간격, 3회 실패 시 unhealthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["sh", "-c", "node node_modules/typeorm/cli.js migration:run -d dist/data-source.prod.js && node dist/main"]
