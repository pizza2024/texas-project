# Texas Hold'em Docker 部署方案（测试环境）

版本: v2.1  
日期: 2026-03-23

本文件是当前唯一有效的测试环境部署基线。测试环境统一使用 Docker Compose 部署 backend、admin、web、PostgreSQL、Redis、Nginx。

---

## 1. 目标

- 使用一套可重复的容器编排部署完整测试环境。
- 保证多端联调一致（Web/Admin/Mobile 全部连接同一后端）。
- 支持自动发布、健康检查、快速回滚。
- 明确区分本地和线上命令，避免配置误用。

---

## 2. 架构

- 入口层:
  - nginx（80/443）
- 应用层:
  - backend（4000，HTTP + WebSocket）
  - web（3000）
  - admin（3001）
- 数据层（仅容器内网访问）:
  - postgres（5432）
  - redis（6379）

说明:
- 数据服务不对公网暴露。
- web/admin 通过环境变量访问 api 域名。
- 使用 volume 持久化 postgres、redis、backend uploads。

---

## 3. 文件基线

- 主编排: docker-compose.yml
- 本地显式叠加层: docker-compose.local.yml
- 自动 override 哨兵（禁止写本地配置）: docker-compose.override.yml
- 构建文件: docker/Dockerfile.app
- 环境模板: docker/.env.staging.example
- Lightsail 落地清单: LIGHTSAIL_DEPLOYMENT.md

---

## 4. 命令基线

## 4.1 Staging / Lightsail

```bash
npm run docker:staging:up
npm run docker:staging:down
docker compose ps
docker compose logs -f backend
```

## 4.2 Local（显式叠加）

```bash
npm run docker:local:up
npm run docker:local:down
```

说明:
- 本地命令通过 docker-compose.local.yml 显式叠加端口和本地 CORS。
- 线上命令只使用 docker-compose.yml + docker/.env.staging。

---

## 5. 环境变量规范

backend:
- NODE_ENV=production
- PORT=4000
- DATABASE_URL=postgresql://texas:***@postgres:5432/texas_staging?schema=public
- REDIS_URL=redis://redis:6379
- JWT_SECRET=<强随机>
- JWT_EXPIRES_IN=7d
- CORS_ORIGIN=https://web.not-replaced-yet.com,https://admin.not-replaced-yet.com
- SOCKET_CORS_ORIGIN=https://web.not-replaced-yet.com,https://admin.not-replaced-yet.com

web/admin:
- NEXT_PUBLIC_API_URL=https://api.not-replaced-yet.com

mobile:
- EXPO_PUBLIC_API_URL=https://api.not-replaced-yet.com

---

## 6. 发布流程（Docker）

1. 合并代码到 develop。
2. CI 执行 lint/test/build。
3. 登录目标机并拉取最新代码。
4. 执行 npm run docker:staging:up。
5. 检查 docker compose ps。
6. 检查 docker compose logs -f backend（确认迁移和启动正常）。
7. 执行健康检查与冒烟测试。

---

## 7. 回滚流程

1. 切回上一个稳定版本（tag/commit）。
2. 执行 npm run docker:staging:up。
3. 验证 /health、登录、建房、WebSocket 关键路径。

---

## 8. 上线 Gate

- /health 返回 status=ok
- 登录、建房、入房流程正常
- WebSocket 关键事件正常
- Prisma migration 全部执行成功
- web/admin 可访问
- 监控告警可达

---

## 9. 旧文档状态

以下文件仅保留历史参考，不作为当前执行依据:
- RAILWAY_SETUP.md
- RAILWAY_CHECKLIST.md
- TEST_ENV_RELEASE_PLAN.md

---

## 10. 备注

- 如果需要恢复云托管（非 Docker）方案，请新建独立文档，不得混写到本基线。
- 所有部署命令优先使用 package.json 中的 docker:* 脚本，避免团队成员自行拼接命令导致不一致。
