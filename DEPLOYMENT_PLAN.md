# Texas Hold'em Docker 部署方案（测试环境）

版本: v2.0  
日期: 2026-03-23

本文件已替换旧的 Railway/Vercel 方案，当前测试环境统一使用 Docker Compose 部署 backend、admin、web、PostgreSQL、Redis。

---

## 1. 目标

- 使用一套可重复的容器编排部署完整测试环境。
- 保证多端联调一致（Web/Admin/Mobile 全部连接同一后端）。
- 支持自动发布、健康检查、快速回滚。

---

## 2. 部署架构

- 网关: Nginx 或云负载均衡（建议放在宿主机或独立容器）
- 应用容器:
  - backend (NestJS, 4000)
  - web (Next.js, 3000)
  - admin (Next.js, 3001)
- 数据容器:
  - postgres (5432)
  - redis (6379)

说明:
- backend 负责 HTTP + WebSocket。
- web/admin 通过环境变量指向对外 API 域名。
- 数据卷保证 Postgres/Redis 和上传文件在容器重建后不丢失。

---

## 3. 服务器建议（测试环境）

- 规格建议: 4 vCPU / 8 GB RAM / 100 GB SSD
- 系统建议: Ubuntu 22.04 LTS
- Docker: 26+
- Docker Compose: v2

资源预算（起步）:
- backend: 1 vCPU / 1 GB
- web: 0.5 vCPU / 512 MB
- admin: 0.5 vCPU / 512 MB
- postgres: 1 vCPU / 2 GB
- redis: 0.5 vCPU / 512 MB

---

## 4. 三方服务建议

必选:
- 镜像仓库: GitHub Container Registry 或 Docker Hub
- 代码仓库: GitHub

推荐:
- 反向代理和证书: Nginx + Certbot（或 Cloudflare）
- 可用性巡检: UptimeRobot/Better Stack
- 错误监控: Sentry（backend/web/admin）

可选:
- 对象存储: S3/R2（替代本地 uploads）
- 日志平台: Loki + Grafana 或 ELK

---

## 5. 环境变量规范

backend 核心变量:
- NODE_ENV=production
- PORT=4000
- DATABASE_URL=postgresql://texas:***@postgres:5432/texas_staging?schema=public
- REDIS_URL=redis://redis:6379
- JWT_SECRET=<强随机>
- JWT_EXPIRES_IN=7d
- CORS_ORIGIN=https://web-staging.example.com
- SOCKET_CORS_ORIGIN=https://web-staging.example.com

web/admin 核心变量:
- NEXT_PUBLIC_API_URL=https://api-staging.example.com

mobile 核心变量:
- EXPO_PUBLIC_API_URL=https://api-staging.example.com

---

## 6. 发布流程（Docker）

1. 开发合并到 develop。
2. CI 执行 lint/test/build。
3. 构建镜像并推送仓库。
4. 服务器拉取最新镜像。
5. 执行 compose 滚动重建。
6. backend 启动前执行 Prisma migrate deploy。
7. 健康检查通过后通知发布成功。

推荐命令:

```bash
docker compose pull
docker compose up -d --remove-orphans
docker compose ps
docker compose logs -f backend
```

---

## 7. 回滚流程

1. 在镜像仓库找到上一个稳定 tag（如 2026.03.23-1）。
2. 修改 compose 使用旧 tag。
3. 执行 docker compose up -d。
4. 验证 /health 与核心登录流程。

---

## 8. 上线 Gate

- /health 返回 status=ok
- 登录、建房、入房、WebSocket 事件正常
- Prisma migration 全部执行成功
- admin 面板可正常访问
- web 前台可正常访问
- 告警通道可收到通知

---

## 9. 文档与编排文件

- 主方案: DEPLOYMENT_PLAN.md（本文件）
- 编排文件: docker-compose.yml
- 通用镜像构建文件: docker/Dockerfile.app
- 环境变量模板: docker/.env.staging.example

---

## 10. 说明

以下旧文档已废弃，不再作为测试环境上线依据:
- RAILWAY_SETUP.md
- RAILWAY_CHECKLIST.md
- TEST_ENV_RELEASE_PLAN.md

如需恢复云托管方案，应单独新建文档，不应覆盖本 Docker 基线。

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
