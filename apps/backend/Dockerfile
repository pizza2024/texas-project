# Simplified Dockerfile for Railway deployment
# Railway build context is apps/backend, so we can't access parent directories
FROM node:20-alpine AS base

# 安装构建依赖
RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app

# 复制 package files
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制 Prisma schema
COPY prisma ./prisma

# 生成 Prisma Client（必须在构建前）
RUN npx prisma generate

# 复制源码
COPY . ./

# 构建
RUN npm run build

# 生产阶段
FROM node:20-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

# 复制必要文件
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/package*.json ./
COPY --from=base /app/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/main.js"]
