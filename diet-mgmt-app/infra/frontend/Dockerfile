# frontend/Dockerfile
FROM node:18-alpine AS base

# 1. 빌드 환경 설정
FROM base AS builder
WORKDIR /app

# 의존성 설치
COPY package.json package-lock.json* ./
RUN npm ci

# 소스 복사 및 빌드
COPY . .
RUN npm run build

# 2. 프로덕션 환경 설정
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Next.js는 non-root 유저로 실행하는 것을 권장합니다
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 빌드 결과물 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]

# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# 의존성 설치
COPY package.json package-lock.json* ./
RUN npm ci --production

# 소스 복사
COPY . .

EXPOSE 5000

CMD ["node", "src/index.js"]
