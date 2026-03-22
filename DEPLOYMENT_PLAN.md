# Texas Hold'em 项目 Web 端部署技术方案

**版本**: v1.0  
**日期**: 2026-03-22  
**作者**: AI Assistant

---

## 目录

1. [项目概述](#项目概述)
2. [部署平台评估](#部署平台评估)
3. [推荐方案](#推荐方案)
4. [架构设计](#架构设计)
5. [详细部署步骤](#详细部署步骤)
6. [CI/CD 配置](#cicd-配置)
7. [成本估算](#成本估算)
8. [技术难点与解决方案](#技术难点与解决方案)
9. [安全性考虑](#安全性考虑)
10. [监控与维护](#监控与维护)

---

## 项目概述

### 技术栈

- **Web 端**: Next.js 15 (App Router, React 19)
- **后端**: NestJS (TypeScript)
- **数据库**: PostgreSQL
- **缓存**: Redis
- **实时通信**: Socket.IO (WebSocket)
- **包管理**: Turborepo (Monorepo)

### 关键需求

1. ✅ **WebSocket 长连接支持**（游戏实时通信）
2. ✅ **高可用性**（99.9% uptime）
3. ✅ **低延迟**（< 100ms 响应时间）
4. ✅ **可扩展性**（支持水平扩展）
5. ✅ **成本可控**（初期预算 < $50/月）

---

## 部署平台评估

### 1. Vercel

**优势**:
- ✅ Next.js 原生支持，零配置部署
- ✅ 全球 CDN，边缘函数支持
- ✅ 自动 SSL 证书
- ✅ GitHub 集成（自动部署）
- ✅ 免费额度慷慨（100GB 带宽/月）

**劣势**:
- ❌ **无服务器架构不支持 WebSocket 长连接**
- ❌ 后端需要单独部署
- ❌ 冷启动延迟

**适用场景**: 纯静态站点或 SSR，但**不适合此项目**（需要 WebSocket）

---

### 2. Railway

**优势**:
- ✅ **支持 WebSocket 长连接**
- ✅ PostgreSQL、Redis 一站式托管
- ✅ 自动 Docker 化部署
- ✅ Monorepo 支持良好
- ✅ 简单易用，学习曲线低
- ✅ 每月 $5 免费额度

**劣势**:
- ⚠️ 成本略高（$20-40/月）
- ⚠️ 部分地区延迟较高

**适用场景**: **全栈应用，WebSocket 项目** ✅

---

### 3. Render

**优势**:
- ✅ 支持 WebSocket
- ✅ 免费的 PostgreSQL 数据库
- ✅ 静态站点免费托管
- ✅ Docker 支持

**劣势**:
- ❌ 免费套餐有冷启动（15 分钟无活动后休眠）
- ⚠️ Redis 无免费套餐
- ⚠️ 性能一般

**适用场景**: 开发测试环境，预算有限

---

### 4. Fly.io

**优势**:
- ✅ **全球多区域部署**（低延迟）
- ✅ WebSocket 支持
- ✅ Docker 原生支持
- ✅ 免费额度（3 个共享 CPU VM）

**劣势**:
- ⚠️ 配置复杂度较高
- ⚠️ 数据库需要单独部署
- ⚠️ 文档相对较少

**适用场景**: 有运维经验，需要全球部署

---

### 5. 云服务商（AWS/阿里云/腾讯云）

**优势**:
- ✅ 完全可控
- ✅ 丰富的生态系统
- ✅ 企业级支持

**劣势**:
- ❌ 配置复杂，学习成本高
- ❌ 成本较高（运维成本 + 服务成本）
- ❌ 需要专业运维知识

**适用场景**: 企业级、大规模应用

---

## 推荐方案

### 🏆 最佳方案：Railway（生产环境）

**理由**:
1. **原生支持 WebSocket** - 游戏核心功能必需
2. **一站式托管** - Web + Backend + PostgreSQL + Redis
3. **简单易用** - 无需复杂配置，专注业务开发
4. **成本合理** - 初期 < $30/月，可随业务扩展

### 🎯 备选方案：Render（开发/测试）

**理由**:
1. **免费额度** - 适合前期测试
2. **WebSocket 支持** - 功能验证
3. **轻松迁移** - 与 Railway 配置相似

### 📋 混合方案（最优性价比）

- **Web 前端**: Vercel（免费）
- **后端 + WebSocket**: Railway（$20/月）
- **数据库**: Railway PostgreSQL（$5/月）
- **Redis**: Railway Redis（$5/月）

**总成本**: ~$30/月

---

## 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         用户客户端                            │
│  (Web 浏览器 / iOS App / Android App)                        │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTPS
             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel (CDN + Edge)                       │
│  - Next.js SSR/Static                                        │
│  - 全球 CDN 加速                                              │
│  - 自动 SSL                                                   │
└────────────┬────────────────────────────────────────────────┘
             │
             │ API Requests (HTTP)
             │ WebSocket 连接
             ▼
┌─────────────────────────────────────────────────────────────┐
│              Railway - NestJS Backend                        │
│  - RESTful API (HTTP/HTTPS)                                  │
│  - Socket.IO (WebSocket)                                     │
│  - 游戏逻辑处理                                               │
│  - 认证授权 (JWT)                                             │
└────────┬───────────────┬─────────────────────────────────────┘
         │               │
         │ PostgreSQL    │ Redis
         ▼               ▼
┌─────────────────┐ ┌──────────────────┐
│  Railway DB     │ │  Railway Redis   │
│  - 用户数据      │ │  - Session       │
│  - 游戏记录      │ │  - 房间状态       │
│  - 筹码余额      │ │  - 缓存          │
└─────────────────┘ └──────────────────┘
```

---

## 详细部署步骤

### Phase 1: 准备工作

#### 1.1 环境变量整理

创建 `.env.production` 文件：

```bash
# Backend (.env.production)
NODE_ENV=production
PORT=4000

# Database
DATABASE_URL=postgresql://user:password@host:5432/texas_prod

# Redis
REDIS_URL=redis://default:password@host:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://your-domain.com

# WebSocket
SOCKET_CORS_ORIGIN=https://your-domain.com

# 区块链（可选）
BLOCKCHAIN_RPC_URL=https://...
PRIVATE_KEY=0x...
```

创建 Web 端环境变量 `.env.production`:

```bash
# Web (.env.production)
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_WS_URL=wss://api.your-domain.com
```

#### 1.2 代码优化

**Backend - 生产环境配置** (`apps/backend/src/main.ts`):

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 配置
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // 全局前缀
  app.setGlobalPrefix('api');

  // 健康检查端点
  app.get('/health', (req, res) => res.send('OK'));

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0'); // 监听所有接口
  
  console.log(`🚀 Backend running on port ${port}`);
}
bootstrap();
```

**Web - API 客户端** (`apps/web/lib/api.ts`):

```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  timeout: 10000,
});

// 请求拦截器
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

### Phase 2: Railway 部署

#### 2.1 创建 Railway 项目

```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 初始化项目
railway init
```

#### 2.2 配置服务

在 Railway Dashboard 创建：
1. **PostgreSQL** 数据库
2. **Redis** 实例
3. **Backend** 服务

#### 2.3 Backend 部署配置

创建 `apps/backend/railway.toml`:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm run start:prod"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[env]
NODE_ENV = "production"
```

或使用 `Dockerfile`:

```dockerfile
# apps/backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package.json
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# 安装依赖
RUN npm ci --only=production

# 复制源码
COPY apps/backend ./apps/backend
COPY packages ./packages

# 构建
WORKDIR /app/apps/backend
RUN npm run build

# 生产镜像
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./

EXPOSE 4000

CMD ["node", "dist/main.js"]
```

部署命令：

```bash
# 链接服务
railway link

# 部署
railway up
```

#### 2.4 环境变量配置

在 Railway Dashboard 设置：

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Railway 自动注入
REDIS_URL=${{Redis.REDIS_URL}}            # Railway 自动注入
JWT_SECRET=<生成一个强密码>
CORS_ORIGIN=https://your-app.vercel.app
```

---

### Phase 3: Vercel 部署（Web 前端）

#### 3.1 Vercel 配置文件

创建 `vercel.json`:

```json
{
  "buildCommand": "cd ../.. && npx turbo run build --filter=web",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs",
  "installCommand": "npm install",
  "env": {
    "NEXT_PUBLIC_API_URL": "https://your-backend.railway.app",
    "NEXT_PUBLIC_WS_URL": "wss://your-backend.railway.app"
  }
}
```

#### 3.2 部署

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

或通过 GitHub 集成：
1. 在 Vercel Dashboard 导入 GitHub 仓库
2. 设置 Root Directory: `apps/web`
3. 配置环境变量
4. 自动部署

---

### Phase 4: 数据库迁移

#### 4.1 Prisma 迁移

```bash
# 在本地运行迁移（连接生产数据库）
DATABASE_URL="<Railway PostgreSQL URL>" npx prisma migrate deploy

# 或使用 Railway CLI
railway run npx prisma migrate deploy
```

#### 4.2 初始数据

```sql
-- 创建管理员账号
INSERT INTO users (username, password, role, nickname, "coinBalance")
VALUES ('admin', '<bcrypt hash>', 'ADMIN', '管理员', 1000000);

-- 创建测试玩家
INSERT INTO users (username, password, role, nickname, "coinBalance")
VALUES 
  ('player1', '<hash>', 'PLAYER', '玩家1', 10000),
  ('player2', '<hash>', 'PLAYER', '玩家2', 10000);
```

---

## CI/CD 配置

### GitHub Actions 工作流

创建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test
      
      - name: Lint
        run: npm run lint

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        uses: berviantoleo/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend
      
  deploy-web:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### 环境变量管理

**GitHub Secrets 配置**:

```bash
RAILWAY_TOKEN=<Railway API Token>
VERCEL_TOKEN=<Vercel Token>
VERCEL_ORG_ID=<Org ID>
VERCEL_PROJECT_ID=<Project ID>
```

---

## 成本估算

### 方案 1: Railway 全托管

| 服务 | 配置 | 月费 |
|------|------|------|
| Backend (Web Service) | 512MB RAM, 1 vCPU | $10 |
| PostgreSQL | 1GB 存储 | $5 |
| Redis | 256MB | $5 |
| 带宽 | 100GB | 包含 |
| **总计** | | **$20/月** |

**优势**: 简单，一站式  
**劣势**: 成本略高

---

### 方案 2: Vercel + Railway 混合

| 服务 | 配置 | 月费 |
|------|------|------|
| Vercel (Web) | 免费套餐 | $0 |
| Railway Backend | 512MB RAM | $10 |
| Railway PostgreSQL | 1GB | $5 |
| Railway Redis | 256MB | $5 |
| **总计** | | **$20/月** |

**优势**: 性价比高，Web 端免费  
**劣势**: 两个平台管理

---

### 方案 3: Render 免费方案（开发/测试）

| 服务 | 配置 | 月费 |
|------|------|------|
| Web (Static) | 免费 | $0 |
| Backend | 免费（有冷启动） | $0 |
| PostgreSQL | 90 天免费 | $0 |
| Redis | Upstash 免费套餐 | $0 |
| **总计** | | **$0/月** |

**优势**: 完全免费  
**劣势**: 性能差，不适合生产

---

### 方案 4: 云服务商（AWS/阿里云）

| 服务 | 配置 | 月费 (估算) |
|------|------|-------------|
| EC2 / ECS | t3.small | $15 |
| RDS PostgreSQL | db.t3.micro | $15 |
| ElastiCache Redis | cache.t3.micro | $12 |
| 负载均衡 | ALB | $20 |
| 域名 + SSL | Route 53 + ACM | $1 |
| **总计** | | **$63/月** |

**优势**: 企业级，可扩展  
**劣势**: 成本高，运维复杂

---

### 💰 推荐：方案 2（$20/月）

最佳性价比，适合初创项目。

---

## 技术难点与解决方案

### 1. WebSocket 在无服务器环境的挑战

**问题**: Vercel 等无服务器平台不支持长连接

**解决方案**:
1. ✅ **后端单独部署到支持 WebSocket 的平台**（Railway、Render、Fly.io）
2. ✅ **使用 Socket.IO**，自动降级到轮询
3. ✅ **Sticky Session**（会话保持）

**配置示例** (`apps/backend/src/socket/socket.gateway.ts`):

```typescript
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
  transports: ['websocket', 'polling'], // 支持降级
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class SocketGateway {
  @WebSocketServer()
  server: Server;

  // ... 游戏逻辑
}
```

---

### 2. Monorepo 部署

**问题**: Turborepo 项目结构复杂

**解决方案**:

**方式 1: 独立部署**

```bash
# Backend
cd apps/backend
railway up

# Web
cd apps/web
vercel --prod
```

**方式 2: Docker 多阶段构建**

```dockerfile
# Root Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY . .
RUN npm install

# Backend
FROM base AS backend
RUN npx turbo run build --filter=backend
CMD ["npm", "run", "start:prod", "--workspace=backend"]

# Web
FROM base AS web
RUN npx turbo run build --filter=web
CMD ["npm", "run", "start", "--workspace=web"]
```

---

### 3. 数据库迁移与备份

**自动化迁移** (GitHub Actions):

```yaml
- name: Run Prisma Migrations
  run: |
    DATABASE_URL=${{ secrets.DATABASE_URL }} \
    npx prisma migrate deploy
```

**自动备份** (Railway Cron Job):

```bash
# 每天凌晨 2 点备份
0 2 * * * pg_dump $DATABASE_URL > /backups/backup-$(date +\%Y\%m\%d).sql
```

**手动备份**:

```bash
# 导出
railway run pg_dump > backup.sql

# 导入
railway run psql < backup.sql
```

---

### 4. 环境变量安全

**问题**: 敏感信息泄露

**解决方案**:

1. ✅ **使用平台环境变量**（不提交 `.env`）
2. ✅ **GitHub Secrets** 存储敏感信息
3. ✅ **分离环境**（dev / staging / prod）

**示例**:

```bash
# .env.example (提交到 Git)
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your-secret-here

# .env (不提交)
DATABASE_URL=<真实值>
JWT_SECRET=<真实值>
```

---

## 安全性考虑

### 1. 认证与授权

- ✅ JWT Token（HttpOnly Cookie）
- ✅ 密码 bcrypt 加密
- ✅ Rate Limiting（防暴力破解）

```typescript
// 使用 @nestjs/throttler
@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60,
      limit: 10, // 每分钟最多 10 次请求
    }]),
  ],
})
```

### 2. CORS 配置

```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### 3. HTTPS/WSS

- ✅ Vercel 自动 SSL
- ✅ Railway 自动 SSL
- ✅ 强制 HTTPS 重定向

### 4. 输入验证

```typescript
import { IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}
```

### 5. SQL 注入防护

- ✅ 使用 Prisma ORM（自动参数化查询）
- ✅ 避免原生 SQL

---

## 监控与维护

### 1. 日志管理

**Railway 内置日志**:
```bash
railway logs
```

**使用 Winston 日志**:

```typescript
import { Logger } from '@nestjs/common';

export class AppService {
  private readonly logger = new Logger(AppService.name);

  doSomething() {
    this.logger.log('Doing something...');
    this.logger.error('Error occurred', stack);
  }
}
```

### 2. 性能监控

**推荐工具**:
- [Sentry](https://sentry.io) - 错误追踪
- [LogRocket](https://logrocket.com) - 前端监控
- [Datadog](https://www.datadoghq.com) - APM（高级）

**集成 Sentry**:

```bash
npm install @sentry/node @sentry/nestjs
```

```typescript
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### 3. 健康检查

```typescript
@Get('/health')
health() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'connected',
    redis: 'connected',
  };
}
```

### 4. 告警配置

Railway 支持：
- CPU 使用率 > 80%
- 内存使用率 > 90%
- 服务宕机

---

## 实施清单

### 第 1 周：准备阶段

- [ ] 整理环境变量列表
- [ ] 优化代码（生产环境配置）
- [ ] 编写 Dockerfile（可选）
- [ ] 创建 Railway 账号
- [ ] 创建 Vercel 账号
- [ ] 准备域名（可选）

### 第 2 周：部署后端

- [ ] 创建 Railway PostgreSQL
- [ ] 创建 Railway Redis
- [ ] 部署 Backend 服务
- [ ] 配置环境变量
- [ ] 运行数据库迁移
- [ ] 测试 API 接口
- [ ] 测试 WebSocket 连接

### 第 3 周：部署前端

- [ ] 配置 Vercel 项目
- [ ] 设置环境变量
- [ ] 部署 Web 前端
- [ ] 测试前后端连接
- [ ] 测试 WebSocket 实时通信
- [ ] 性能测试

### 第 4 周：优化与监控

- [ ] 配置 CI/CD（GitHub Actions）
- [ ] 集成 Sentry 错误追踪
- [ ] 设置监控告警
- [ ] 备份策略
- [ ] 文档更新
- [ ] 正式上线

---

## 环境变量列表

### Backend 必需

```bash
# 基础配置
NODE_ENV=production
PORT=4000

# 数据库
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_URL=redis://default:pass@host:6379

# JWT
JWT_SECRET=<随机字符串 32+>
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://your-domain.com

# 可选：区块链
BLOCKCHAIN_RPC_URL=
PRIVATE_KEY=
```

### Web 必需

```bash
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_WS_URL=wss://api.your-domain.com
```

---

## 参考资源

### 官方文档

- [Railway Docs](https://docs.railway.app)
- [Vercel Docs](https://vercel.com/docs)
- [NestJS Deployment](https://docs.nestjs.com/faq/serverless)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Socket.IO Production](https://socket.io/docs/v4/using-multiple-nodes/)

### 社区资源

- [Railway Discord](https://discord.gg/railway)
- [Vercel Community](https://github.com/vercel/vercel/discussions)

---

## 总结

### 🎯 推荐最终方案

| 组件 | 平台 | 成本 |
|------|------|------|
| Web 前端 | **Vercel** | $0 (免费套餐) |
| Backend API | **Railway** | $10 |
| PostgreSQL | **Railway** | $5 |
| Redis | **Railway** | $5 |
| **总计** | | **$20/月** |

### ✅ 优势

1. **简单易用** - 无需复杂配置
2. **WebSocket 支持** - 游戏核心功能
3. **性价比高** - 初期成本低
4. **自动扩展** - 支持业务增长
5. **开发体验好** - 自动部署、日志、监控

### 📈 扩展路径

当用户量增长时：
1. **Railway Pro** ($20 → $50/月，更多资源)
2. **添加 CDN**（Cloudflare）
3. **数据库读写分离**
4. **Redis 集群**
5. **迁移到云服务商**（AWS/阿里云）

---

**部署愉快！** 🚀

如有问题，请查阅官方文档或联系支持团队。
