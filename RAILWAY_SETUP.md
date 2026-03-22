# Railway 部署配置指南

## 🚀 快速开始

### 1. 在 Railway Dashboard 创建新项目

访问：https://railway.app/new

### 2. 创建服务

#### 2.1 创建 PostgreSQL 数据库

1. 点击 "+ New" → "Database" → "PostgreSQL"
2. 等待数据库启动
3. 记录自动生成的环境变量：`${{Postgres.DATABASE_URL}}`

#### 2.2 创建 Redis 实例

1. 点击 "+ New" → "Database" → "Redis"
2. 等待 Redis 启动
3. 记录环境变量：`${{Redis.REDIS_URL}}`

#### 2.3 部署 Backend 服务

**方式 1: GitHub 连接（推荐）**

1. 点击 "+ New" → "GitHub Repo"
2. 选择仓库：`pizza2024/texas-project`
3. 配置：
   - Root Directory: `apps/backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
4. 点击 "Deploy"

**方式 2: Railway CLI**

```bash
# 在项目根目录
cd apps/backend
railway init
railway up
```

### 3. 配置环境变量

在 Backend 服务的 "Variables" 标签页添加：

```bash
# 基础配置
NODE_ENV=production
PORT=4000

# 数据库（使用 Railway 引用）
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis（使用 Railway 引用）
REDIS_URL=${{Redis.REDIS_URL}}

# JWT 密钥（生成新的强密钥）
JWT_SECRET=<使用 `openssl rand -base64 32` 生成>
JWT_EXPIRES_IN=7d

# CORS（部署后更新为实际域名）
CORS_ORIGIN=*
SOCKET_CORS_ORIGIN=*

# 日志级别
LOG_LEVEL=info
```

### 4. 运行数据库迁移

在 Backend 服务的 "Settings" → "Service" 中添加部署钩子：

或在本地执行：

```bash
# 方式 1: 使用 Railway CLI
railway run npx prisma migrate deploy

# 方式 2: 直接连接数据库
DATABASE_URL="<Railway PostgreSQL URL>" npx prisma migrate deploy
```

### 5. 获取服务 URL

部署成功后，Railway 会自动分配一个 URL，格式：
```
https://your-service.up.railway.app
```

测试：
```bash
curl https://your-service.up.railway.app/health
```

应返回：
```json
{
  "status": "ok",
  "timestamp": "2026-03-22T11:00:00.000Z",
  "uptime": 123.456,
  "environment": "production"
}
```

---

## 🔧 故障排除

### 问题 1: 部署失败

**检查构建日志**:
1. 进入 Backend 服务
2. 点击 "Deployments" 标签
3. 查看失败的部署日志

**常见原因**:
- Node 版本不匹配（在 `package.json` 中指定）
- 依赖安装失败
- 环境变量缺失

**解决方案**:
```json
// package.json
{
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 问题 2: 数据库连接失败

**检查**:
1. DATABASE_URL 是否正确引用：`${{Postgres.DATABASE_URL}}`
2. PostgreSQL 服务是否启动
3. 防火墙规则

**测试连接**:
```bash
railway run npx prisma db pull
```

### 问题 3: Redis 连接失败

**检查**:
1. REDIS_URL 格式：`redis://default:password@host:6379`
2. Redis 服务状态

**测试**:
```bash
railway run npm run test:redis
```

### 问题 4: WebSocket 连接失败

**检查**:
1. CORS_ORIGIN 配置
2. Socket.IO 配置（transports）
3. 客户端连接 URL（使用 `wss://`）

**调试**:
```bash
# 查看 WebSocket 日志
railway logs --filter websocket
```

---

## 📊 监控与日志

### 实时日志

```bash
# 查看最近日志
railway logs

# 实时跟踪
railway logs --follow

# 过滤错误
railway logs --filter error
```

### 性能指标

在 Railway Dashboard 的 "Metrics" 标签查看：
- CPU 使用率
- 内存使用率
- 网络流量
- 请求数

### 告警配置

在 "Settings" → "Notifications" 配置：
- 部署失败通知
- 服务宕机通知
- 资源告警

---

## 🔐 安全性

### 1. 生成强 JWT 密钥

```bash
openssl rand -base64 32
```

### 2. 限制 CORS

部署后更新：
```bash
CORS_ORIGIN=https://your-actual-domain.vercel.app
```

### 3. 环境变量加密

Railway 自动加密所有环境变量

### 4. 数据库备份

Railway PostgreSQL 自动每日备份，可在 Dashboard 恢复

---

## 💰 成本估算

基于当前配置：

| 服务 | 资源 | 月费 |
|------|------|------|
| Backend (512MB) | 1 vCPU, 512MB RAM | ~$10 |
| PostgreSQL | 1GB 存储 | ~$5 |
| Redis | 256MB | ~$5 |
| **总计** | | **~$20/月** |

**免费额度**: Railway 提供 $5/月 免费额度

**优化建议**:
- 初期可使用共享 CPU（更便宜）
- 监控资源使用，按需调整

---

## 📝 下一步

1. ✅ **部署 Web 前端到 Vercel**
   - 参考：`DEPLOYMENT_PLAN.md` Phase 3

2. ✅ **配置域名**
   - 在 Railway 中添加自定义域名
   - 配置 DNS CNAME

3. ✅ **设置 CI/CD**
   - 参考：`.github/workflows/deploy.yml`

4. ✅ **性能优化**
   - 启用 CDN
   - 数据库索引优化
   - Redis 缓存策略

---

## 🆘 获取帮助

- [Railway 文档](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- [项目 Issues](https://github.com/pizza2024/texas-project/issues)

---

**部署成功后记得更新 `DEVELOPMENT_SETUP.md` 中的生产环境信息！** 🎉
