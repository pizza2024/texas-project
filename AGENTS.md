# AGENTS.md

## 项目概述

**Texas Hold'em Monorepo** — 德州扑克游戏全栈应用，Turborepo + pnpm 管理。

## 技术栈

| 层级      | 技术                                                |
| --------- | --------------------------------------------------- |
| 后端框架  | NestJS 11 + TypeScript                              |
| 数据库    | PostgreSQL 16 + Prisma ORM                          |
| 缓存/队列 | Redis 7 + BullMQ                                    |
| 鉴权      | JWT + bcrypt + Passport                             |
| 实时通信  | WebSocket（Socket.io）                              |
| 游戏引擎  | 自研 `table-engine`（手牌评估、Pot Odds、自动出桌） |
| Web 前端  | Next.js 16 + React 19 + Tailwind CSS 4              |
| 移动端    | React Native 0.83（Expo SDK 55）                    |
| 管理后台  | Next.js 16 + Recharts + SWR                         |
| 文档站    | Next.js + MDX                                       |
| Monorepo  | Turborepo + pnpm 10                                 |
| 测试      | Jest + Playwright                                   |
| 部署      | Docker + Nginx                                      |

## 项目结构

```
apps/
├── backend/      # NestJS 后端（端口 4000，/health 健康检查）
├── web/         # Next.js 玩家端（端口 3001）
├── mobile/      # Expo React Native 移动端
├── admin/       # Next.js 管理后台（端口 3003）
└── docs/        # Next.js MDX 文档站（端口 4002）
packages/
└── shared/      # 共享类型 + API 客户端 + Socket 客户端
```

## 常用命令

```bash
# 全局
npm run dev              # 所有开发服务器（turbo dev）
npm run build            # 全量构建
npm run lint             # 全量 lint
npm run format           # Prettier 格式化

# Docker
npm run docker:local:up     # 本地 Docker（postgres + redis + backend + web + nginx）
npm run docker:local:down
npm run docker:staging:up    # Staging/Lightsail 环境
npm run docker:staging:down
npm run docker:staging:env   # 生成 .env.staging

# 后端（apps/backend）
npm run dev               # ts-node 开发模式
npm run start:dev        # nest --watch 模式
npm run start:prod       # 构建后生产模式
npm run test             # Jest 单元测试
npm run test:e2e         # E2E 测试
npm run test:playwright  # Playwright E2E
npm run db:migrate:dev   # 开发迁移
npm run db:reset:dev     # 重置开发数据库
npm run db:seed          # 种子数据
npm run db:studio        # Prisma Studio

# Web（apps/web）
npm run dev              # 端口 3001

# Admin（apps/admin）
npm run dev              # 端口 3003
```

## 数据库模型（Prisma）

| Model             | 说明                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `User`            | 用户：username/nickname 唯一，role (PLAYER/ADMIN/SUPER_ADMIN)，status (OFFLINE/ONLINE/PLAYING)，elo 评分，邮箱验证 |
| `Wallet`          | 钱包：balance (真实货币)，chips (游戏筹码)，frozenChips (锁住)                                                     |
| `Room`            | 房间：盲注、准入、最大人数、密码、状态、tier (MICRO~PREMIUM)、isMatchmaking                                        |
| `Table`           | 牌桌：关联 Room，state (WAITING/DEALING/PREFLOP/FLOP/TURN/RIVER/SHOWDOWN)，状态快照                                |
| `Hand`            | 单局：potSize，winnerId，创建时间索引                                                                              |
| `HandAction`      | 操作：FOLD/CHECK/CALL/RAISE/ALLIN/STRADDLE/SIT-OUT                                                                 |
| `Settlement`      | 结算：handId + userId + amount                                                                                     |
| `Transaction`     | 资金流水：DEPOSIT/WITHDRAW/GAME_WIN/GAME_LOSS                                                                      |
| `Friend`          | 好友关系：PENDING/ACCEPTED/REJECTED/BLOCKED                                                                        |
| `DepositAddress`  | 用户专属 ETH 充值地址（HD 钱包派生）                                                                               |
| `DepositRecord`   | USDT 充值记录：txHash, amount, chips, status                                                                       |
| `WithdrawRequest` | 提现请求：PENDING/PROCESSING/CONFIRMED/FAILED，含链上 txHash                                                       |
| `ScanCursor`      | 区块扫描游标：避免事件遗漏                                                                                         |
| `AdminLog`        | 管理员操作审计日志                                                                                                 |
| `ScanCursor`      | 区块同步游标                                                                                                       |

## 后端模块（apps/backend/src）

| 模块            | 说明                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/`         | JWT 鉴权、注册（username+password、邮箱验证码）、登录限流 Guard                                                                                 |
| `user/`         | 用户管理、头像上传/删除                                                                                                                         |
| `room/`         | 房间 CRUD                                                                                                                                       |
| `table-engine/` | **游戏核心引擎**：手牌评估 (hand-evaluator.ts)、Pot Odds、Straddle、自动出桌 (sit-out-detector)、all-in 保护、TableManager、牌局状态机          |
| `websocket/`    | Socket.io 网关 + 各 Handler：game.handler（游戏操作）、room-events（房间事件）、system.handler（系统广播）、admin.handler、validate（参数校验） |
| `matchmaking/`  | ELO 匹配服务                                                                                                                                    |
| `wallet/`       | 筹码管理                                                                                                                                        |
| `deposit/`      | USDT 充值：地址生成、轮询扫块、兑换筹码                                                                                                         |
| `withdraw/`     | 提现请求处理                                                                                                                                    |
| `notification/` | 邮件/推送通知（Resend）                                                                                                                         |
| `admin/`        | 管理后台 API：用户管理、房间管理、财务管理、数据统计、系统状态、广播                                                                            |
| `friend/`       | 好友系统：申请/接受/拒绝                                                                                                                        |
| `bot/`          | AI 机器人                                                                                                                                       |
| `health/`       | 健康检查端点                                                                                                                                    |
| `config/`       | JWT 配置                                                                                                                                        |
| `prisma/`       | Prisma Service                                                                                                                                  |
| `redis/`        | Redis Service + BullMQ                                                                                                                          |

## WebSocket 事件（客户端）

**客户端 → 服务器**

| Event           | 说明                                               |
| --------------- | -------------------------------------------------- |
| `join-room`     | 加入房间                                           |
| `leave-room`    | 离开房间                                           |
| `player-action` | 玩家操作（fold/call/raise/allin/straddle/sit-out） |
| `ready-to-play` | 准备开始                                           |
| `chat-message`  | 聊天消息                                           |

**服务器 → 客户端**

| Event                  | 说明                         |
| ---------------------- | ---------------------------- |
| `game-state`           | 牌桌完整状态                 |
| `player-action-result` | 操作结果                     |
| `hand-result`          | 单局结果                     |
| `room-update`          | 房间状态更新                 |
| `system-message`       | 系统消息（被踢、房间关闭等） |
| `seat-countdown`       | solo 玩家倒计时              |

**WebSocket 常量**（避免客户端和服务端 drift）

```
SOLO_READY_COUNTDOWN_MS = 10000
RATE_LIMIT_WINDOW_MS = 1000
RATE_LIMIT_MAX_ACTIONS = 10
MAX_CHIP_AMOUNT = 1_000_000_000
VALID_ACTIONS: fold, check, call, raise, allin, straddle, sit-out
```

## packages/shared 导出

```ts
import { api } from "@texas/shared/api"; // axios 封装
import { socket } from "@texas/shared/socket"; // Socket.io 客户端
import { auth } from "@texas/shared/auth"; // Token 管理
import type { GameState } from "@texas/shared/types";
```

## 前端页面（apps/web/app）

| 路径                | 说明                 |
| ------------------- | -------------------- |
| `/`                 | 首页                 |
| `/login`            | 登录                 |
| `/register`         | 注册                 |
| `/rooms`            | 房间列表             |
| `/room/[id]`        | 游戏桌页面（PC）     |
| `/room-mobile/[id]` | 游戏桌页面（Mobile） |
| `/hands`            | 历史牌局             |
| `/friends`          | 好友列表             |
| `/stats`            | 玩家统计             |
| `/settings`         | 设置                 |
| `/deposit`          | 充值                 |
| `/withdraw`         | 提现                 |

## 管理后台页面（apps/admin/app）

| 路径         | 说明            |
| ------------ | --------------- |
| `/login`     | 管理员登录      |
| `/dashboard` | 数据总览        |
| `/users`     | 用户列表 + 详情 |
| `/rooms`     | 房间管理        |
| `/finance`   | 财务流水        |
| `/analytics` | 数据统计图表    |
| `/system`    | 系统状态 + 广播 |
| `/withdraw`  | 提现审核        |

## Docker 基础设施

| 容器     | IP          | 说明                     |
| -------- | ----------- | ------------------------ |
| nginx    | 172.28.0.2  | 反向代理（80/443）       |
| web      | 172.28.0.10 | Next.js 生产构建         |
| backend  | 172.28.0.11 | NestJS + Prisma + BullMQ |
| admin    | 172.28.0.12 | Next.js 管理后台         |
| postgres | 172.28.0.13 | PostgreSQL 16            |
| redis    | 172.28.0.14 | Redis 7                  |

Compose 文件分层：

- `docker-compose.yml` — 主文件（所有服务）
- `docker-compose.local.yml` — 本地开发覆盖
- `docker-compose.remote.yml` — 远程生产镜像覆盖

## 开发注意事项

1. **后端要求** Node >= 20.0.0，npm >= 10.0.0
2. **WebSocket** 路径 `/ws`，CORS 在 Gateway 层配置
3. **管理接口** 前缀 `/admin/*`，由 `AdminGuard` 双重校验 JWT + DB role
4. **充值扫块** 后台定时任务扫描 ETH 区块，依赖 `ScanCursor` 避免遗漏
5. **游戏状态** 存放在 Table.stateSnapshot（JSON），HandAction 是操作流水
6. **ELO 匹配** 由 `matchmaking.service.ts` 处理，快速房间 `Room.isMatchmaking=true`
7. **测试** jest 在 `apps/backend/src` root 运行，Playwright E2E 在 `apps/backend`
8. **Prisma** 生产迁移：`npm run db:migrate:prod`（Docker 启动时自动执行）
