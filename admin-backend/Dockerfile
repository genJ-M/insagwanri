# ────────────────────────────────────────────
# Stage 1: 의존성 설치
# ────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    cp -r node_modules /tmp/prod_modules && \
    npm ci

# ────────────────────────────────────────────
# Stage 2: 빌드
# ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ────────────────────────────────────────────
# Stage 3: 프로덕션 이미지
# ────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nestjs

WORKDIR /app

COPY --from=deps    /tmp/prod_modules     ./node_modules
COPY --from=builder /app/dist             ./dist
COPY --from=builder /app/package.json     ./package.json

RUN chown -R nestjs:nodejs /app

USER nestjs

ENV NODE_ENV=production
ENV ADMIN_PORT=4001

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4001/admin/v1/health || exit 1

CMD ["node", "dist/main"]
