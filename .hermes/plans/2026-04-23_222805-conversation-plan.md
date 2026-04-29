# 德州扑克项目开发计划

## 当前上下文

刚刚为 `/Users/pizza/workspace/texas-project` 生成了 `AGENTS.md`，对项目有了完整认知。

### 项目现状

- **Monorepo**：Turborepo + pnpm，5 个 app（backend/web/mobile/admin/docs）
- **后端**：NestJS + PostgreSQL + Prisma + Redis + BullMQ，WebSocket (Socket.io)，自研游戏引擎
- **前端**：Next.js 16 + React 19 + Tailwind CSS 4（Web + Admin）
- **移动端**：React Native (Expo SDK 55)
- **已实现**：用户注册登录、房间系统、游戏引擎、WebSocket 实时对战、好友系统、充值提现（USDT）、Admin 后台
- **技术文档**：存量较少，AGENTS.md 刚生成

### 已知的开发中的功能

根据 ProjectDesign.md 中的 Phase 规划：

- Phase 1（基础框架）：✅ 大部分已完成（role 字段、AdminGuard、用户管理接口、admin 项目骨架）
- Phase 2（核心功能）：部分完成（房间管理、AdminLog）
- Phase 3（数据统计）：✅ analytics 接口 + 页面已完成
- Phase 4（系统功能）：部分完成（系统状态、广播）

---

## 建议的下一步开发方向

### Option A：功能完善（优先级高）

补全缺失的管理功能和优化体验：

1. **用户详情页补全**（`/users/[id]`）：操作历史（AdminLog）、牌局历史
2. **房间详情页补全**（`/rooms/[id]`）：实时牌桌列表、踢人功能
3. **提现审核功能**（`/withdraw`）：管理员确认/拒绝提现请求（现有页面但可能未对接 API）
4. **系统设置**：`/admin/system` 完善维护模式

### Option B：游戏体验优化

1. **Bot 对战系统**：完善 `apps/backend/src/bot/`（目前存在但状态未知）
2. **观战功能**：WebSocket 支持观战者模式
3. **牌局回放**：基于 HandAction 历史重放

### Option C：基础设施

1. **E2E 测试覆盖**：Playwright 已配置但测试用例可能不足
2. **CI/CD 完善**：GitHub Actions 部署流程优化
3. **监控告警**：Sentry / OpenTelemetry 集成

---

## 推荐行动计划（Option A 优先）

### Step 1：审计 Admin 页面完成度

- 对比 `apps/admin/app/` 各页面与 `apps/backend/src/admin/` 后端接口
- 检查 `withdraw/page.tsx` 是否调用了正确的后端 API
- 检查 `rooms/[id]/page.tsx` 是否有实时刷新

**涉及文件**：

- `apps/admin/app/withdraw/page.tsx`
- `apps/admin/app/rooms/[id]/page.tsx`
- `apps/backend/src/admin/admin-room.controller.ts`
- `apps/backend/src/admin/admin-finance.controller.ts`

### Step 2：用户详情页补全

- 增加 `admin-user.controller.ts` 新增 `GET /admin/users/:id/hands` 和 `GET /admin/users/:id/logs`
- 在 `apps/admin/app/users/[id]/page.tsx` 中增加 Tab：基本信息 / 资金流水 / 操作日志 / 牌局历史

**涉及文件**：

- `apps/backend/src/admin/admin-user.controller.ts`
- `apps/admin/app/users/[id]/page.tsx`

### Step 3：房间详情页补全

- `admin-room.controller.ts` 增加 `GET /admin/rooms/:id/tables` 接口
- `rooms/[id]/page.tsx` 增加实时 Table 状态卡片

**涉及文件**：

- `apps/backend/src/admin/admin-room.controller.ts`
- `apps/backend/src/admin/admin.service.ts`
- `apps/admin/app/rooms/[id]/page.tsx`

### Step 4：提现审核功能

- 确认 `admin-finance.controller.ts` 有 `PATCH /admin/finance/withdraw/:id` 接口
- `withdraw/page.tsx` 支持"确认/拒绝"操作

**涉及文件**：

- `apps/backend/src/admin/admin-finance.controller.ts`
- `apps/admin/app/withdraw/page.tsx`

### Step 5：测试验证

- 手动测试关键路径（登录 → 用户列表 → 房间管理 → 提现审核）
- 验证 WebSocket 连接稳定性

---

## 风险与开放问题

1. **Bot 系统**：当前 `bot/` 模块状态未知，可能需要单独评估
2. **移动端**：apps/mobile 目前状态未知（app 结构已存在）
3. **充值逻辑**：USDT 充值依赖 ETH 节点扫描，测试需要本地或测试网环境
4. **WebSocket 重连**：客户端断线重连机制需要确认

---

## 验证步骤

```bash
cd /Users/pizza/workspace/texas-project
npm run docker:local:up
# 验证 http://localhost:3003 访问 admin
# 验证 http://localhost:3001 访问 web
# 验证 http://localhost:4000/health
npm run docker:local:down
```
