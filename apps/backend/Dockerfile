# Multi-stage build for NestJS backend
FROM node:20-alpine AS base

# 安装构建依赖
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# 复制整个 monorepo 的 package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# 安装所有依赖
RUN npm ci

# 复制源码
COPY apps/backend ./apps/backend
COPY packages ./packages

# 构建
WORKDIR /app/apps/backend
RUN npm run build

# 生产阶段
FROM node:20-alpine AS production

WORKDIR /app

# 只复制必要的文件
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/backend/dist ./dist
COPY --from=base /app/apps/backend/package*.json ./
COPY --from=base /app/apps/backend/node_modules ./node_modules

# Prisma 需要
COPY --from=base /app/apps/backend/prisma ./prisma

# 生成 Prisma Client
RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/main.js"]
