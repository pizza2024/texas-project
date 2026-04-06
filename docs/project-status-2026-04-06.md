# Texas Hold'em 项目状态报告

> 生成时间：2026-04-06  
> 分支：`develop`（本地领先 origin/develop 1 个 commit）  
> 最新 commit：`fd8b305` — feat(friends): add friends UI page with real-time WebSocket updates

---

## 一、技术栈总览

| 层级 | 技术 |
|------|------|
| 后端 | NestJS 11 + TypeScript |
| 前端（玩家） | Next.js 16（App Router）+ Tailwind CSS 4 |
| 前端（管理台） | Next.js 16（App Router）+ Tailwind CSS 4 |
| 移动端 | React Native（Expo） |
| 数据库 | PostgreSQL + Prisma ORM |
| 缓存/会话 | Redis |
| 实时通信 | Socket.io |
| 认证 | JWT + bcrypt + 单设备登录（Redis session enforcement） |
| 部署 | Docker Compose（Nginx 反向代理） |
| CI/CD | GitHub Actions → AWS Lightsail |
| 区块链 | Hardhat + ETH Sepolia（USDT 充值/提现测试） |
| 国际化 | react-i18next（6 种语言） |
| Monorepo | Turborepo |

---

## 二、代码结构

```
texas-project/
├── apps/
│   ├── backend/        # NestJS 后端（面向玩家 + 管理 API）
│   │   ├── src/
│   │   │   ├── auth/          # 登录/注册/JWT/单设备登录
│   │   │   ├── user/          # 用户信息/头像/统计
│   │   │   ├── room/          # 房间 CRUD
│   │   │   ├── wallet/        # 余额/筹码管理
│   │   │   ├── deposit/       # USDT 充值（链上轮询）
│   │   │   ├── withdraw/      # USDT 提现（待处理队列）
│   │   │   ├── friend/         # 好友系统
│   │   │   ├── table-engine/   # 德州扑克核心逻辑
│   │   │   ├── websocket/      # Socket.io 网关
│   │   │   ├── admin/          # 管理后台 API（Guard 隔离）
│   │   │   ├── matchmaking/    # 快速匹配
│   │   │   ├── notification/  # 通知服务
│   │   │   └── ...
│   │   └── prisma/
│   │       └── schema.prisma   # 数据模型
│   │
│   ├── web/           # Next.js 玩家端（Port 3001）
│   │   └── app/
│   │       ├── login/register/deposit/withdraw/
│   │       ├── rooms/room/[id]/room-mobile/[id]/
│   │       ├── hands/stats/settings/
│   │       └── PWA 支持（manifest + service worker）
│   │
│   ├── admin/         # Next.js 管理后台（Port 3002）
│   │   └── app/
│   │       ├── login/dashboard/
│   │       ├── users/[id]/
│   │       ├── rooms/[id]/
│   │       ├── finance/withdraw/
│   │       ├── analytics/
│   │       └── system/
│   │
│   ├── mobile/        # React Native（Expo）移动端
│   │   └── app/
│   │       ├── login/register/
│   │       ├── rooms/room/[id]/
│   │       ├── deposit/withdraw/
│   │       ├── hands/stats/settings/
│   │       └── i18n（中/英）
│   │
│   └── docs/          # Nextra 文档站
│
├── packages/
│   └── shared/        # 共享 TypeScript 类型
│
├── docker/            # Dockerfile + Nginx 配置
├── local-chain/        # Hardhat 测试链（USDT 部署）
└── docs/              # 项目文档（状态/进度/设计）
```

---

## 三、功能完成情况

### ✅ 已完成

#### 认证 & 用户
- [x] 用户注册/登录（JWT）
- [x] 单设备登录（Redis sessionId 校验 + 旧设备 force_logout）
- [x] 用户头像上传/删除
- [x] 用户名/昵称/状态/ELO 管理
- [x] 邮件验证（验证码）

#### 游戏核心（Table Engine）
- [x] 德州扑克完整流程：PREFLOP → FLOP → TURN → RIVER → SHOWDOWN
- [x] 玩家动作：FOLD / CHECK / CALL / RAISE / ALL-IN
- [x] 手牌评估（5 张公共牌最优组合）
- [x] 底池分配（side pot 支持）
- [x] Straddle 盲注机制
- [x] 自动让牌/自动弃牌（sit-out 检测）
- [x] All-in 保险保护（all-in-call-protection）
- [x] 牌桌状态快照（断线重连恢复）
- [x] 手牌历史记录（HandHistory）

#### 房间 & 匹配
- [x] 房间 CRUD（盲注/最小买入/密码保护）
- [x] 快速匹配（matchmaking）— 根据 ELO 评分匹配
- [x] 房间在线人数
- [x] 玩家加入/离开牌桌

#### 财务系统
- [x] 筹码（chips）余额管理
- [x] 冻结筹码（frozen chips — 在牌桌上时）
- [x] USDT 充值（ETH Sepolia 水龙头 → 自动兑换筹码）
- [x] USDT 提现申请（WithdrawRequest 队列，后端处理）
- [x] 充值/提现记录（DepositRecord / WithdrawRequest）
- [x] 交易流水（Transaction）

#### 实时通信
- [x] Socket.io 双向通信
- [x] 房间事件（player_joined / player_left / game_state）
- [x] 断线重连 + rejoin_available
- [x] 系统广播消息

#### 管理后台
- [x] 管理员角色体系（ADMIN / SUPER_ADMIN）
- [x] AdminGuard 接口隔离
- [x] 用户管理（列表/详情/封禁/解封/余额调整）
- [x] 房间管理（创建/编辑/删除/维护状态/踢人）
- [x] 财务流水查看
- [x] 数据统计（概览/收益趋势/房间热度/牌局统计）
- [x] 提现请求管理
- [x] 系统状态监控
- [x] 系统广播
- [x] AdminLog 审计日志

#### 前端
- [x] Web 端：登录/注册/房间列表/牌桌/充值/提现/战绩/统计/设置
- [x] Admin 端：完整管理功能
- [x] Mobile 端：核心功能（登录/注册/房间/牌桌/充值/提现/统计/设置）
- [x] i18n 国际化（6 种语言）
- [x] PWA 支持（Web 端可安装）

### ⏳ 开发中 / 部分完成

#### 好友系统
- [x] Prisma Friend 模型
- [x] 后端 FriendService / FriendController
- [x] 好友申请/接受/拒绝/拉黑
- [x] 好友状态同步（WebSocket）
- [ ] Web 端好友 UI（尚未集成到房间）
- [ ] 移动端好友 UI

#### 提现（Withdraw）
- [x] 提现申请创建（前端 + 后端）
- [x] 提现队列（WithdrawQueue）
- [ ] 后端自动执行 USDT 转账（pending — 依赖 owner 钱包配置）

### ❌ 未开始

- Telegram Mini App 集成
- 比赛系统（Tournament — MTT/SNG）
- 复盘功能（Hand History Replay）
- 表情/聊天互动
- 定时赛（Scheduled Tournament）
- 好友观战系统

---

## 四、数据模型（Prisma Schema）

| Model | 说明 |
|-------|------|
| `User` | 玩家账号（role/ELO/emailVerified） |
| `Wallet` | 余额/筹码/冻结筹码 |
| `Room` | 房间配置 |
| `Table` | 牌桌（stateSnapshot 支持重连） |
| `Hand` | 单局记录 |
| `HandAction` | 玩家操作历史 |
| `Settlement` | 结算记录 |
| `Transaction` | 资金流水 |
| `DepositAddress` | 用户 HD 钱包地址 |
| `DepositRecord` | 链上充值记录 |
| `WithdrawRequest` | USDT 提现申请 |
| `Friend` | 好友关系 |
| `AdminLog` | 管理员操作日志 |
| `ScanCursor` | 链上存款扫描游标 |

---

## 五、部署状态

| 环境 | 地址 | 状态 |
|------|------|------|
| 本地 Docker | localhost:3000/3001/4000 | ✅ 可用 |
| Staging（AWS Lightsail） | `api.not-replaced-yet.com` | ⚠️ 域名未更新 |
| GitHub Actions CI | `pizza2024/texas-project` | ✅ 正常 |

**Git Flow：** `develop` 分支 → 构建 → Deploy to Lightsail

---

## 六、待办事项（按优先级）

### P0 — 必须
1. 🔴 **修复 staging 域名**（`not-replaced-yet.com` → 真实域名）
2. 🔴 **完成 USDT 提现自动执行**（WithdrawQueue → 链上转账）
3. ✅ ~~**好友系统 UI**（Web/Mobile 集成）~~ → 已完成 `fd8b305`

### P1 — 重要
4. 🟡 Telegram Mini App 集成
5. 🟡 快速匹配 UI 完善（当前部分实现）
6. 🟡 移动端创建房间 UI
7. 🟡 移动端好友 UI（当前仅 Web）

### P2 — 增强
7. 🔵 手牌复盘 Replay
8. 🔵 比赛系统（Tournament）
9. 🔵 表情/聊天互动
10. 🔵 好友观战系统

---

_本文档由 pipi 整理于 2026-04-06_

---

## 更新记录（2026-04-06 18:05）

### ✅ 好友系统 UI 完成

**前端页面：** `apps/web/app/friends/page.tsx`

- `GET /friends` — 好友列表（支持搜索）
- `POST /friends/request` — 发送好友请求
- `DELETE /friends/:id` — 删除好友
- `GET /friends/requests` — 收到的好友请求列表
- `POST /friends/requests/:id/accept` — 接受请求
- `POST /friends/requests/:id/reject` — 拒绝请求

**WebSocket 实时事件：**
- `friend_status_update` — 好友上下线状态实时更新
- `friend_request_received` — 新好友请求实时推送

**UI 功能：**
- Friends Tab：好友列表 + 在线状态标签 + 搜索过滤 + 删除
- Requests Tab：待处理请求 + 接受/拒绝按钮 + 未读红点计数
- 添加好友 Modal：用户名/邮箱输入
- Toast 通知：新请求到达时自动提示

**导航入口：**
- 桌面端：Rooms 页面顶部 `👥 好友` 按钮
- 移动端：头像下拉菜单

**i18n：** 英文 + 中文 keys 已添加

**涉及文件：**
- `apps/web/app/friends/page.tsx`（新建）
- `apps/web/app/rooms/page.tsx`（修改：添加好友按钮）
- `apps/web/lib/socket.ts`（修改：导出 friend handler）
- `packages/shared/src/socket.ts`（修改：friend WebSocket handlers）
- `apps/web/locales/en.json`（修改：新增 keys）
- `apps/web/locales/zh-CN.json`（修改：新增 keys）

**Commit：** `fd8b305` — feat(friends): add friends UI page with real-time WebSocket updates
