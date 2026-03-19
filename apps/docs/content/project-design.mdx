# Texas Hold'em 后台管理系统设计文档

> 版本：v1.0 · 作者：Copilot · 日期：2026-03-14

---

## 一、现状梳理

### 1.1 当前技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | NestJS 11 + TypeScript |
| 数据库 | SQLite + Prisma ORM |
| 鉴权 | JWT + bcrypt + Passport |
| 实时通信 | WebSocket（Socket.io） |
| 前端框架 | Next.js 16 + React 19 + TypeScript |
| 样式 | Tailwind CSS 4 |
| Monorepo | Turborepo |
| 测试 | Jest |
| API 文档 | Swagger/OpenAPI |

### 1.2 现有数据模型

| 实体 | 用途 | 关键字段 |
|------|------|---------|
| User | 玩家账号 | id, username, nickname, avatar, status, coinBalance, createdAt, lastLoginAt |
| Wallet | 余额追踪 | id, userId, balance, frozenBalance |
| Room | 游戏房间 | id, name, blindSmall, blindBig, maxPlayers, minBuyIn, password, status |
| Table | 牌桌实例 | id, roomId, state, stateSnapshot, snapshotUpdatedAt |
| Hand | 单局牌局 | id, tableId, winnerId, potSize, createdAt |
| HandAction | 玩家操作 | id, handId, userId, action, amount, createdAt |
| Settlement | 结算记录 | id, handId, userId, amount, createdAt |
| Transaction | 资金流水 | id, userId, amount, type, createdAt |

### 1.3 现有 REST 接口（面向玩家）

```
POST /auth/login          用户登录
POST /auth/register       用户注册
GET  /auth/profile        获取个人信息

POST /rooms               创建房间（JWT）
GET  /rooms               房间列表
GET  /rooms/:id           房间详情

GET  /tables/me/current-room     当前所在房间
POST /tables/me/leave-room       离开房间
GET  /tables/rooms/:id/status    房间实时状态

POST /user/avatar         上传头像（JWT）
DELETE /user/avatar       删除头像（JWT）
```

---

## 二、架构选型决策

### 2.1 方案对比

#### 方案 A：完全独立的后端 + 独立管理前端

```
apps/
  backend/        (现有，面向玩家)
  admin-backend/  (新增，仅管理)
  web/            (现有，玩家端)
  admin/          (新增，管理台)
```

**优点：**
- 彻底隔离，安全边界最清晰
- 可以独立部署到内网，不对外暴露
- 独立的数据库连接池，不影响游戏服务性能

**缺点：**
- 重复维护两套 Prisma schema，数据同步复杂
- 重复实现 UserService、WalletService 等业务逻辑
- 冷启动维护成本高，改动 schema 需要同时更新两个后端

---

#### 方案 B：共享后端 + 独立管理前端（✅ 推荐）

```
apps/
  backend/   (现有后端，新增 admin 模块)
  web/       (现有玩家端)
  admin/     (新增管理台，独立 Next.js 应用)
```

**优点：**
- 共享同一套数据库/Prisma/业务服务，无数据同步问题
- 管理接口统一加 `/admin` 前缀 + `AdminGuard` 隔离权限
- 独立管理前端可部署到不同域名/端口，天然隔离
- Turborepo 现有结构天然支持，新增 `apps/admin` 即可
- 避免重复代码，维护成本低

**缺点：**
- 管理模块和游戏模块共享同一个 Node 进程（可通过 Docker 多实例解决）
- 需要严格的 Guard 确保管理接口不被玩家访问

**结论：选择方案 B。** 共享后端，新建独立管理前端 `apps/admin`。这是 Turborepo 单仓最佳实践，也符合项目当前体量。

---

## 三、后端改造方案

### 3.1 新增 Admin 模块

在现有后端新增 `src/admin/` 模块：

```
apps/backend/src/
├── admin/
│   ├── guards/
│   │   └── admin.guard.ts          # 管理员权限 Guard
│   ├── dto/
│   │   ├── adjust-balance.dto.ts
│   │   ├── update-user.dto.ts
│   │   └── paginate.dto.ts
│   ├── admin-user.controller.ts    # 用户管理接口
│   ├── admin-room.controller.ts    # 房间管理接口
│   ├── admin-finance.controller.ts # 财务管理接口
│   ├── admin-analytics.controller.ts # 数据统计接口
│   ├── admin.service.ts
│   └── admin.module.ts
```

### 3.2 管理员身份方案

在 `User` 模型新增 `role` 字段：

```prisma
model User {
  // ...现有字段...
  role  String  @default("PLAYER")  // PLAYER | ADMIN | SUPER_ADMIN
}
```

`AdminGuard` 校验逻辑：
1. 验证 JWT 合法性（复用现有 JwtStrategy）
2. 从 token payload 中取 `sub`（userId）
3. 查数据库确认 `user.role` 为 `ADMIN` 或 `SUPER_ADMIN`
4. 不满足则返回 403

### 3.3 管理接口清单

#### 用户管理 `/admin/users`

```
GET    /admin/users                    用户列表（分页、搜索、状态筛选）
GET    /admin/users/:id                用户详情
PATCH  /admin/users/:id                编辑用户信息（nickname/status/role）
POST   /admin/users/:id/ban            封禁用户
POST   /admin/users/:id/unban          解封用户
POST   /admin/users/:id/balance        手动调整余额（增减）
GET    /admin/users/:id/transactions   用户资金流水
GET    /admin/users/:id/hands          用户牌局历史
```

#### 房间管理 `/admin/rooms`

```
GET    /admin/rooms                    房间列表（含实时在线人数）
POST   /admin/rooms                    创建房间
PATCH  /admin/rooms/:id                编辑房间配置
DELETE /admin/rooms/:id                删除房间
POST   /admin/rooms/:id/maintenance    切换维护状态
GET    /admin/rooms/:id/tables         房间内牌桌状态
POST   /admin/rooms/:id/kick/:userId   将玩家踢出房间
```

#### 财务管理 `/admin/finance`

```
GET    /admin/finance/transactions     全部资金流水（分页、筛选）
POST   /admin/finance/deposit          手动充值（给指定用户）
POST   /admin/finance/withdraw         手动扣款
GET    /admin/finance/summary          财务汇总（总资产、日/周/月流水）
```

#### 数据统计 `/admin/analytics`

```
GET    /admin/analytics/overview       总览（在线人数、活跃房间、今日流水）
GET    /admin/analytics/users          用户增长趋势
GET    /admin/analytics/revenue        收益趋势（可按日/周/月）
GET    /admin/analytics/rooms          房间热度排行
GET    /admin/analytics/hands          牌局统计（总局数、平均底池）
```

#### 系统管理 `/admin/system`

```
GET    /admin/system/status            系统状态（在线连接数、内存、运行时间）
POST   /admin/system/broadcast         向所有在线用户广播系统消息
POST   /admin/system/maintenance       全局维护模式开关
```

---

## 四、管理前端方案

### 4.1 新建 `apps/admin`

基于 Next.js 的独立管理台应用，共享 Turborepo 构建链。

```
apps/admin/
├── app/
│   ├── layout.tsx              全局布局（侧边栏 + 顶栏）
│   ├── page.tsx                首页跳转 /dashboard
│   ├── login/
│   │   └── page.tsx            管理员登录页
│   ├── dashboard/
│   │   └── page.tsx            数据总览
│   ├── users/
│   │   ├── page.tsx            用户列表
│   │   └── [id]/page.tsx       用户详情
│   ├── rooms/
│   │   ├── page.tsx            房间管理
│   │   └── [id]/page.tsx       房间详情 + 实时牌桌
│   ├── finance/
│   │   └── page.tsx            财务流水
│   └── analytics/
│       └── page.tsx            数据统计图表
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx         侧边导航
│   │   └── topbar.tsx          顶部栏
│   ├── ui/                     共享 UI 组件（表格、Modal、Badge 等）
│   └── charts/                 图表组件（基于 recharts 或 chart.js）
├── lib/
│   ├── api.ts                  axios 封装（指向后端 /admin/* 接口）
│   └── auth.ts                 管理员 token 管理
└── package.json
```

### 4.2 技术选型

| 需求 | 选型 | 理由 |
|------|------|------|
| 框架 | Next.js 16（App Router） | 与 `apps/web` 保持一致 |
| 样式 | Tailwind CSS 4 | 一致性，快速开发 |
| 图表 | Recharts | React 原生，轻量 |
| 表格 | TanStack Table | 功能完整，分页/排序/筛选 |
| 状态 | React 内置 hooks + SWR | 简单轻量，适合管理台 |
| 图标 | Lucide React | 已在 root 依赖中 |

### 4.3 管理台 UI 设计风格

- 整体深色主题，与玩家端 poker 氛围一致但更偏「商务深灰」
- 侧边栏导航（宽 240px），主内容区自适应
- 顶栏显示当前管理员信息 + 快捷操作
- 数据卡片 + 数据表格为核心展示形态
- 危险操作（封禁、删除、余额调整）需要二次确认弹窗

---

## 五、权限与安全设计

### 5.1 角色体系

| 角色 | 说明 | 权限范围 |
|------|------|---------|
| PLAYER | 普通玩家 | 玩家端所有功能 |
| ADMIN | 运营管理员 | 查看数据、管理用户/房间、查看财务 |
| SUPER_ADMIN | 超级管理员 | 所有权限 + 系统设置 + 创建管理员 |

### 5.2 安全措施

1. **接口层**：所有 `/admin/*` 接口强制 `AdminGuard`，双重校验（JWT + DB role）
2. **部署层**：管理台建议部署在内网或通过 IP 白名单限制访问
3. **操作审计**：高危操作（余额调整、封禁、删除房间）记录操作日志到 `AdminLog` 表
4. **Token 独立**：管理员登录使用更短的 token 有效期（如 30 分钟）并支持强制失效
5. **CORS 隔离**：管理台域名单独加入后端 CORS 白名单

### 5.3 新增 AdminLog 模型

```prisma
model AdminLog {
  id          String   @id @default(uuid())
  adminId     String
  action      String   // BAN_USER / ADJUST_BALANCE / DELETE_ROOM 等
  targetType  String   // USER / ROOM / SYSTEM
  targetId    String?
  detail      String?  // JSON 格式的操作详情
  createdAt   DateTime @default(now())
}
```

---

## 六、开发阶段规划

### Phase 1：基础框架（优先级：高）
- [ ] `User` 模型添加 `role` 字段并迁移数据库
- [ ] 实现 `AdminGuard` 和管理员鉴权逻辑
- [ ] 实现用户管理接口（列表、详情、封禁、余额调整）
- [ ] 创建 `apps/admin` 项目骨架（登录页 + 侧边栏布局）
- [ ] 管理台登录 + 用户列表页

### Phase 2：核心功能（优先级：高）
- [ ] 房间管理接口 + 页面
- [ ] 财务流水接口 + 页面
- [ ] 用户详情页（包含操作历史）
- [ ] `AdminLog` 审计日志

### Phase 3：数据统计（优先级：中）
- [ ] 数据统计接口（概览、趋势、排行）
- [ ] Dashboard 图表页面

### Phase 4：系统功能（优先级：低）
- [ ] 系统广播消息
- [ ] 全局维护模式
- [ ] 系统状态监控

---

## 七、文件变更影响评估

| 文件/模块 | 变更类型 | 影响 |
|-----------|---------|------|
| `prisma/schema.prisma` | 新增 `role` 字段 + `AdminLog` 模型 | 需要迁移，不破坏现有数据 |
| `src/auth/auth.service.ts` | JWT payload 新增 `role` 字段 | 兼容现有 token（旧 token 无 role 字段时 Guard fallback 为 PLAYER） |
| `src/admin/` | 全新模块，不修改现有代码 | 零影响 |
| `apps/admin/` | 全新应用 | 零影响 |
| `turbo.json` | 无需修改，`apps/*` 自动包含 | 零影响 |
