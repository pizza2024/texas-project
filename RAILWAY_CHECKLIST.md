# Railway 配置清单

## ✅ 你需要在 Railway Dashboard 完成以下配置

访问：https://railway.app/dashboard

---

## 第 1 步：创建项目

1. 点击 "New Project"
2. 命名：`texas-holdem-prod`（或其他名字）

---

## 第 2 步：添加数据库

### PostgreSQL

1. 在项目中点击 "+ New" → "Database" → "Add PostgreSQL"
2. 等待启动完成（约 30 秒）
3. ✅ 完成后会显示绿色状态

### Redis

1. 点击 "+ New" → "Database" → "Add Redis"
2. 等待启动完成
3. ✅ 完成后会显示绿色状态

---

## 第 3 步：部署 Backend

### 连接 GitHub 仓库

1. 点击 "+ New" → "GitHub Repo"
2. 授权 Railway 访问 GitHub（如果首次）
3. 选择仓库：`pizza2024/texas-project`
4. 点击 "Deploy Now"

### 配置服务

在部署的服务中：

#### Settings 配置

1. **Root Directory**: `apps/backend`
2. **Build Command**: `npm install && npm run build`  
3. **Start Command**: `npm run start:prod`
4. **Healthcheck Path**: `/health`

#### Environment Variables（环境变量）

点击 "Variables" 标签，添加以下变量：

```
NODE_ENV = production
PORT = 4000
DATABASE_URL = ${{Postgres.DATABASE_URL}}
REDIS_URL = ${{Redis.REDIS_URL}}
JWT_SECRET = oJvbAx8itPUj1dM+p2O0s+TTKyA0cueAZDrXoItuHK8=
JWT_EXPIRES_IN = 7d
CORS_ORIGIN = *
SOCKET_CORS_ORIGIN = *
LOG_LEVEL = info
```

**重要提示**：
- `${{Postgres.DATABASE_URL}}` 是 Railway 的特殊语法，会自动引用 PostgreSQL 的连接字符串
- `${{Redis.REDIS_URL}}` 同理，引用 Redis 连接字符串
- 输入时保持 `${{...}}` 格式不变

---

## 第 4 步：运行数据库迁移

### 方式 1: Railway CLI（推荐）

在本地终端执行：

```bash
# 登录 Railway（会打开浏览器）
railway login

# 链接到项目
cd /Users/pizza/.openclaw/workspace/texas-project/apps/backend
railway link

# 运行迁移
railway run npx prisma migrate deploy

# 生成 Prisma Client
railway run npx prisma generate
```

### 方式 2: 本地连接生产数据库

```bash
# 从 Railway Dashboard 复制 PostgreSQL 的 DATABASE_URL
# 格式：postgresql://user:pass@host:5432/railway

DATABASE_URL="<粘贴实际URL>" npx prisma migrate deploy
```

---

## 第 5 步：创建初始管理员账号

在 Railway Dashboard 的 Backend 服务中：

1. 点击 "Terminal" 标签（或使用 Railway CLI）
2. 执行：

```bash
# 方式 1: 通过 Railway CLI
railway run node scripts/create-admin.js

# 方式 2: 直接 SQL（在 PostgreSQL 的 Data 标签）
INSERT INTO users (username, password, role, nickname, "coinBalance")
VALUES (
  'admin',
  '$2a$10$example_bcrypt_hash_here',  -- 需要先 bcrypt 加密
  'ADMIN',
  '管理员',
  1000000
);
```

**生成 bcrypt 密码**：

```bash
# 在本地生成
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-password', 10, (e,h) => console.log(h));"
```

---

## 第 6 步：测试部署

### 获取服务 URL

部署成功后，Railway 会分配一个 URL：
```
https://texas-backend-production-xxxx.up.railway.app
```

### 测试健康检查

```bash
curl https://<你的URL>/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2026-03-22T11:00:00.000Z",
  "uptime": 123.45,
  "environment": "production"
}
```

### 测试登录 API

```bash
curl -X POST https://<你的URL>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

---

## 第 7 步：配置自定义域名（可选）

1. 在 Backend 服务的 "Settings" → "Domains"
2. 点击 "Generate Domain" 或添加自定义域名
3. 配置 DNS CNAME 记录（如果使用自定义域名）

---

## ✅ 完成检查清单

- [ ] PostgreSQL 数据库已创建并运行
- [ ] Redis 实例已创建并运行
- [ ] Backend 服务已部署并运行
- [ ] 所有环境变量已配置
- [ ] 数据库迁移已执行
- [ ] 健康检查端点返回正常
- [ ] 获取了服务 URL
- [ ] （可选）创建了管理员账号

---

## 📊 当前成本

免费额度抵扣后：
- 首月：$5 免费额度
- 之后：约 $15-20/月

---

## 🆘 遇到问题？

### 常见问题

**Q1: 部署失败怎么办？**  
A: 查看 Deployments 标签的日志，检查错误信息。常见原因：
- 环境变量缺失
- 数据库连接失败
- 构建命令错误

**Q2: 如何查看日志？**  
A: 
1. 在服务页面点击 "Logs" 标签
2. 或使用 CLI：`railway logs`

**Q3: WebSocket 连接失败？**  
A: 检查 CORS_ORIGIN 配置，确保客户端使用 `wss://` 协议

---

## 📞 联系支持

- Railway 文档：https://docs.railway.app
- Railway Discord：https://discord.gg/railway
- 项目 Issues：https://github.com/pizza2024/texas-project/issues

---

**配置完成后，进行下一步：部署 Web 前端到 Vercel！** 🚀
