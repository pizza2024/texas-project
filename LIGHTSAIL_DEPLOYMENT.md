# AWS Lightsail Docker 部署清单

日期：2026-03-23  
环境：Texas Hold'em Staging (not-replaced-yet.com)

---

## 环境要求检查

- [ ] Lightsail 实例已创建（推荐 Ubuntu 22.04 LTS, 2GB+ RAM）
- [ ] 实例可通过 SSH 访问
- [ ] 防火墙规则：仅放行 SSH(22), HTTP(80), HTTPS(443)
- [ ] Static IP 已绑定到实例

---

## 第 1 步：服务器初始化（Lightsail 实例上执行）

```bash
# SSH 连接到 Lightsail 实例
ssh -i /path/to/lightsail.pem ubuntu@<实例公网IP>

# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker compose --version

# 配置时区
sudo timedatectl set-timezone Asia/Shanghai

# 启用自动安全更新
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

- [ ] Docker 和 Docker Compose 安装成功

---

## 第 2 步：上传项目代码到 Lightsail

```bash
# 在本地机器执行（或通过 GitHub 克隆）

# 方式 1：通过 SCP 上传（假设已在项目根目录）
scp -i /path/to/lightsail.pem -r . ubuntu@<实例IP>:/home/ubuntu/texas-project

# 方式 2：通过 Git 克隆（需要 GitHub Deploy Key）
ssh -i /path/to/lightsail.pem ubuntu@<实例IP>
cd /home/ubuntu
git clone git@github.com:pizza2024/texas-project.git
cd texas-project
```

- [ ] 项目代码已上传到 Lightsail 实例 `/home/ubuntu/texas-project`

---

## 第 3 步：配置 DNS 解析

在你的 DNS 提供商（如 Cloudflare、Route53）添加以下 A 记录：

```
web.not-replaced-yet.com          A  <Lightsail 实例公网 IP>
admin.not-replaced-yet.com        A  <Lightsail 实例公网 IP>
api.not-replaced-yet.com          A  <Lightsail 实例公网 IP>
```

验证 DNS 解析：
```bash
nslookup web.not-replaced-yet.com
nslookup admin.not-replaced-yet.com
nslookup api.not-replaced-yet.com
```

- [ ] DNS 已配置，nslookup 可正常解析

---

## 第 4 步：生成自签证书

在 Lightsail 实例上执行：

```bash
cd /home/ubuntu/texas-project

# 运行证书生成脚本
bash docker/nginx/generate-cert.sh not-replaced-yet.com

# 验证证书生成
ls -la docker/nginx/certs/
```

- [ ] 证书已生成在 `docker/nginx/certs/not-replaced-yet.com.crt` 和 `.key`

---

## 第 5 步：配置环境变量

```bash
cd /home/ubuntu/texas-project

# 按 DOMAIN 一键生成环境变量文件
bash docker/generate-staging-env.sh not-replaced-yet.com

# 如需覆盖已存在文件
# FORCE=1 bash docker/generate-staging-env.sh not-replaced-yet.com

# 二次检查关键项
grep -E '^(DOMAIN|CORS_ORIGIN|SOCKET_CORS_ORIGIN|NEXT_PUBLIC_API_URL|EXPO_PUBLIC_API_URL|JWT_SECRET)=' docker/.env.staging
```

如果需要手工微调，可继续编辑：

```bash
# 1. DOMAIN
DOMAIN=not-replaced-yet.com

# 2. CORS 和 API 域名
CORS_ORIGIN=https://web.not-replaced-yet.com,https://admin.not-replaced-yet.com
SOCKET_CORS_ORIGIN=https://web.not-replaced-yet.com,https://admin.not-replaced-yet.com
NEXT_PUBLIC_API_URL=https://api.not-replaced-yet.com
EXPO_PUBLIC_API_URL=https://api.not-replaced-yet.com

# 3. JWT_SECRET：改为强随机值（脚本会自动填充一次）
JWT_SECRET=<执行: openssl rand -base64 32>
```

- [ ] `docker/.env.staging` 已创建并正确配置

---

## 第 6 步：拉取镜像并启动容器

```bash
cd /home/ubuntu/texas-project

# 拉取最新镜像（如果有镜像仓库）
# docker compose pull

# 构建并启动所有容器
npm run docker:staging:up

# 停止容器（需要时）
# npm run docker:staging:down

# 查看启动状态
docker compose ps

# 查看后端日志（等待 Prisma 迁移完成）
docker compose logs -f backend
```

预期输出：
```
texas-backend   | 📦 Running Prisma migrations...
texas-backend   | ✅ Starting application...
```

- [ ] 所有容器已启动（docker compose ps 显示所有服务 Up）
- [ ] Prisma 迁移成功

---

## 第 7 步：健康检查

```bash
# 检查后端 API 健康状态
curl -k https://api.not-replaced-yet.com/health

# 预期响应：
# {"status":"ok","timestamp":"2026-03-23T...","uptime":123.45,"environment":"production"}

# 检查 Web 前台
curl -k https://web.not-replaced-yet.com
# 应返回 HTML 内容

# 检查 Admin 面板
curl -k https://admin.not-replaced-yet.com
# 应返回 HTML 内容
```

- [ ] `/health` 返回 `status=ok`
- [ ] Web/Admin 返回 HTTP 200
- [ ] 所有容器日志无错误

---

## 第 8 步：测试基础功能

1. **浏览器测试**（忽略自签证书警告）
   - 访问 https://web.not-replaced-yet.com
   - 登录（用已有测试账号）
   - 验证建房、入房功能
   
2. **WebSocket 测试**
   - 打开浏览器开发者工具 → Network → WS
   - 在游戏中进行操作（如建房）
   - 验证 WebSocket 连接建立
   
3. **API 测试**
   ```bash
   curl -k -X POST https://api.not-replaced-yet.com/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test123"}'
   ```

- [ ] 能正常登录、建房
- [ ] WebSocket 连接正常
- [ ] API 返回合理的响应

---

## 第 9 步：配置监控和自动重启

```bash
# 查看容器是否自动重启（设了 restart: unless-stopped）
docker ps -a

# 查看容器日志
docker compose logs backend
docker compose logs nginx

# 如果需要查看系统日志
sudo journalctl -u docker -f
```

- [ ] 容器配置了自动重启策略

---

## 第 10 步：备份与还原

```bash
# 创建 Lightsail 快照（在 AWS 控制台）
# 每次重要发布前做一次快照

# 本地备份数据卷（可选）
docker compose exec postgres pg_dump -U texas texas_staging > backup.sql

# 本地备份上传文件
docker cp texas-backend:/repo/apps/backend/uploads ./uploads-backup
```

- [ ] 首次快照已创建

---

## 第 11 步：GitHub Actions 自动构建与部署（推荐）

仓库中已提供工作流文件：

` .github/workflows/deploy-lightsail.yml `

### 11.1 配置 GitHub Secrets

在 GitHub 仓库 Settings -> Secrets and variables -> Actions 中添加：

- `LIGHTSAIL_HOST`: 服务器公网 IP 或域名
- `LIGHTSAIL_USER`: SSH 用户（例如 `ec2-user`）
- `LIGHTSAIL_SSH_KEY`: 私钥内容（PEM 文本）
- `LIGHTSAIL_APP_DIR`: 项目路径（例如 `/home/ec2-user/workspace/texas-project`）
- `GHCR_USERNAME`: GHCR 用户名（通常与 GitHub 用户名一致）
- `GHCR_TOKEN`: 具有 `read:packages` 权限的 PAT

### 11.2 触发方式

- 推送 `develop` 分支会自动触发
- 也可以在 Actions 页面手动触发 `Build And Deploy Lightsail`

### 11.3 部署机制

1. Actions 构建并推送 `backend/web/admin` 三个镜像到 GHCR
2. 通过 SSH 登录 Lightsail
3. 使用 `docker-compose.remote.yml` 执行 `pull + up -d`

---

## 故障排除

### 容器无法启动

```bash
# 查看详细日志
docker compose logs backend

# 常见原因：
# 1. 数据库连接失败 -> 检查 DATABASE_URL
# 2. 端口被占用 -> 检查防火墙或其他服务
# 3. Prisma 迁移失败 -> 检查数据库初始化脚本
```

### 证书问题

```bash
# 验证证书有效期
openssl x509 -in docker/nginx/certs/not-replaced-yet.com.crt -text -noout | grep -A 2 "Validity"

# 如果证书过期，重新生成
bash docker/nginx/generate-cert.sh not-replaced-yet.com
docker compose restart nginx
```

### 内存不足

```bash
# 查看 Docker 内存使用
docker stats

# 增加 swap（Lightsail 小实例建议）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 发布更新流程

```bash
cd /home/ubuntu/texas-project

# 1. 拉取最新代码
git pull origin develop

# 2. 重新构建并启动
npm run docker:staging:up

# 3. 查看日志
docker compose logs -f backend

# 4. 验证健康检查
curl -k https://api.not-replaced-yet.com/health

# 5. 冒烟测试（登录、建房等）
```

---

## 完成检查表

- [ ] 所有 DNS 记录配置正确
- [ ] SSL 证书已生成
- [ ] 环境变量已配置（JWT_SECRET 已改强密钥）
- [ ] 容器全部启动成功
- [ ] /health 端点返回 ok
- [ ] Web/Admin/API 可通过 HTTPS 访问
- [ ] 登录、建房、WebSocket 基本功能正常
- [ ] 快照已创建
- [ ] 团队已知道 https://web.not-replaced-yet.com 可以测试

---

## 注意事项

1. **自签证书仅用于测试**：浏览器会显示安全警告，但可继续访问。
2. **Mobile 端可能拒绝自签证书**：需要将证书添加到 Mobile 应用的信任存储，或切换到正式证书。
3. **Lightsail 小实例可能内存紧张**：监控内存使用，必要时升级实例或添加 Swap。
4. **定期备份**：数据库和上传文件都没有自动备份，生产前必须配置备份策略。

---

有任何问题，查看以下文件：
- 部署文档：[DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md)
- Docker 编排：[docker-compose.yml](docker-compose.yml)
- Nginx 配置：[docker/nginx/conf.d/staging.conf](docker/nginx/conf.d/staging.conf)
