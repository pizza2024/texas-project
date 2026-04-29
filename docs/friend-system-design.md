# 好友功能系统设计

> 文档版本：v1.0
> 创建时间：2026-04-04
> 状态：初稿

---

## 1. 概述

### 1.1 功能目标

为德州扑克游戏平台实现好友系统，支持玩家之间添加、管理好友，并实时感知好友的在线状态。

### 1.2 用户场景描述

- 玩家可以通过用户名或邮箱搜索并添加其他玩家为好友
- 好友申请发送后，对方可接受或拒绝
- 成为好友后，双方可以查看彼此的在线状态（在线 / 离线 / 游戏中）
- 好友上线或下线时，实时推送通知
- 好友列表支持按昵称搜索

---

## 2. 技术背景

### 2.1 现有架构

| 层级     | 技术选型                                   |
| -------- | ------------------------------------------ |
| 后端框架 | NestJS + Socket.io（`@nestjs/websockets`） |
| 数据库   | PostgreSQL + Prisma ORM                    |
| 实时通信 | Socket.io（房间事件、游戏状态）            |
| 前端     | Next.js（`apps/web`）                      |
| 共享类型 | `packages/shared`（TypeScript 类型）       |
| 会话管理 | Redis（单设备登录 enforcement）            |

**关键现有组件：**

- `AppGateway`（`apps/backend/src/websocket/app.gateway.ts`）：处理 Socket.io 连接、房间事件
- `UserService`（`apps/backend/src/user/user.service.ts`）：用户 CRUD
- `User.status` 字段：`OFFLINE | ONLINE | PLAYING`（DB 持久化）
- `WebSocketManager`（`apps/backend/src/websocket/websocket-manager.ts`）：Server 实例共享

**现有 WebSocket 事件（部分）：**

- `room_created / room_dissolved / room_status_updated`：大厅房间广播
- `room_update`：牌桌状态推送
- `match_found / match_error`：快速匹配
- `deposit_confirmed`：充值通知
- `force_logout`：强制登出

### 2.2 现有用户状态处理

- 用户 `status` 字段在 DB 中维护（`OFFLINE / ONLINE / PLAYING`）
- `handleConnection` 中更新在线状态（仅在 WebSocket 认证时处理，暂无独立的上下线事件广播）
- 暂无独立的"好友上下线"推送机制

---

## 3. 数据模型设计

### 3.1 Prisma Schema

```prisma
model Friend {
  id          String   @id @default(uuid())
  requesterId String   // 发送者用户 ID
  addresseeId String   // 接收者用户 ID
  status      String   @default("PENDING") // PENDING | ACCEPTED | REJECTED
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  requester   User     @relation("FriendRequester", fields: [requesterId], references: [id], onDelete: Cascade)
  addressee   User     @relation("FriendAddressee", fields: [addresseeId], references: [id], onDelete: Cascade)

  // 同一对用户之间只能有一条记录（无论状态）
  @@unique([requesterId, addresseeId])
  // 查询某用户的所有好友（ACCEPTED 状态）
  @@index([addresseeId, status])
  @@index([requesterId, status])

  @@map("friends")
}
```

### 3.2 User 模型扩展关系

在现有 `User` 模型中添加（Prisma schema 中追加）：

```prisma
model User {
  // ... 现有字段 ...
  sentFriends     Friend[] @relation("FriendRequester")
  receivedFriends Friend[] @relation("FriendAddressee")
}
```

### 3.3 字段说明

| 字段          | 类型            | 说明                                                          |
| ------------- | --------------- | ------------------------------------------------------------- |
| `id`          | `String` (UUID) | 主键                                                          |
| `requesterId` | `String`        | 发起好友请求的用户 ID                                         |
| `addresseeId` | `String`        | 接收好友请求的用户 ID                                         |
| `status`      | `String`        | `PENDING`（待接受）/`ACCEPTED`（已添加）/`REJECTED`（已拒绝） |
| `createdAt`   | `DateTime`      | 请求创建时间                                                  |
| `updatedAt`   | `DateTime`      | 最后更新时间                                                  |

### 3.4 索引策略

- `@@unique([requesterId, addresseeId])`：防止重复请求
- `@@index([addresseeId, status])`：快速查询"收到的好友请求列表"
- `@@index([requesterId, status])`：快速查询"发出的好友请求"

---

## 4. API 设计

### 4.1 基础路径

所有接口前缀：`/api/friends`
认证：JWT Bearer Token（复用现有 Auth Guard）

### 4.2 接口列表

#### POST `/friends/request` — 发送好友请求

**请求体：**

```ts
{
  username: string; // 对方用户名（username 或 email 二选一）
  // 或
  email: string;
}
```

**业务逻辑：**

1. 通过 username/email 查找目标用户（不能是自己）
2. 检查是否已有记录（任何状态）：若有不允许重复发送
3. 创建 `Friend` 记录（`status = PENDING`）
4. 通过 WebSocket 向目标用户推送 `friend_request_received` 事件

**响应：**

```ts
// 201 Created
{
  friendId: string;
  addresseeId: string;
}

// 400 BadRequest：不能添加自己
// 404 NotFound：用户不存在
// 409 Conflict：已是好友或已有待处理请求
```

---

#### GET `/friends` — 获取好友列表

**查询参数：**

```ts
{
  search?: string;   // 按昵称模糊过滤（可选）
  cursor?: string;   // 分页游标（上一页最后一条 friendId）
  limit?: number;    // 默认 20，最大 100
}
```

**响应：**

```ts
{
  friends: Array<{
    id: string;
    friendUser: {
      id: string;
      nickname: string;
      avatar: string | null;
      status: "OFFLINE" | "ONLINE" | "PLAYING";
    };
    createdAt: string; // 成为好友的时间
  }>;
  nextCursor: string | null;
}
```

**说明：** 仅返回 `status = ACCEPTED` 的记录，并关联查询对方的 `User` 信息及 `status` 字段。

---

#### DELETE `/friends/:id` — 删除好友

**路径参数：** `id` = `Friend` 记录 ID

**业务逻辑：**

1. 验证当前用户是 `requesterId` 或 `addresseeId` 且 `status = ACCEPTED`
2. 删除该条 `Friend` 记录
3. 双方均不再显示对方在好友列表中

**响应：**

```ts
// 204 NoContent
// 403 Forbidden：不是好友关系
// 404 NotFound：记录不存在
```

---

#### POST `/friends/requests/:id/accept` — 接受好友请求

**路径参数：** `id` = `Friend` 记录 ID

**业务逻辑：**

1. 验证当前用户是 `addresseeId` 且 `status = PENDING`
2. 将 `status` 更新为 `ACCEPTED`
3. 向请求发起方 WebSocket 推送 `friend_status_update`（告知对方已成为好友）

**响应：**

```ts
// 200 OK
{
  friendId: string;
  friendUser: {
    (id, nickname, avatar, status);
  }
}
```

---

#### POST `/friends/requests/:id/reject` — 拒绝好友请求

**路径参数：** `id` = `Friend` 记录 ID

**业务逻辑：**

1. 验证当前用户是 `addresseeId` 且 `status = PENDING`
2. 将 `status` 更新为 `REJECTED`（或直接删除记录均可，此处保留记录便于后续灰名单参考）

**响应：**

```ts
// 200 OK
// 403 Forbidden：不是该请求的接收方
// 400 BadRequest：请求非 PENDING 状态
```

---

#### GET `/friends/requests` — 获取收到的好友请求列表

**查询参数：**

```ts
{
  status?: "PENDING" | "ACCEPTED" | "REJECTED"; // 默认 PENDING
  cursor?: string;
  limit?: number; // 默认 20
}
```

**响应：**

```ts
{
  requests: Array<{
    id: string;
    requester: {
      id: string;
      nickname: string;
      avatar: string | null;
    };
    createdAt: string;
  }>;
  nextCursor: string | null;
}
```

---

## 5. WebSocket 设计

### 5.1 新增事件

在 `packages/shared/src/socket.ts` 中追加：

```ts
// Server → Client
export interface FriendStatusUpdatePayload {
  friendId: string;
  friendUserId: string;
  nickname: string;
  avatar: string | null;
  status: "OFFLINE" | "ONLINE" | "PLAYING";
}

export interface FriendRequestReceivedPayload {
  friendId: string;
  requester: {
    id: string;
    nickname: string;
    avatar: string | null;
  };
}

export interface ServerToClientEvents {
  // ... 现有事件 ...
  friend_status_update: (data: FriendStatusUpdatePayload) => void;
  friend_request_received: (data: FriendRequestReceivedPayload) => void;
}
```

### 5.2 推送时机

| 事件                      | 触发时机                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `friend_request_received` | `POST /friends/request` 成功后，向 `addresseeId` 的 Socket 推送（按 userId 查 socket） |
| `friend_status_update`    | 用户上线 / 下线 / 开始游戏 / 结束游戏时，向所有在线的好友 Socket 推送                  |

### 5.3 推送实现

在 `AppGateway` 中注入 `FriendService`（新建），提供：

```ts
// 向指定用户的所有 socket 推送
async emitToUser(userId: string, event: string, data: any)

// 向所有好友（status=ACCEPTED）推送状态更新
async broadcastFriendStatusUpdate(userId: string, newStatus: string)
```

现有 `AppGateway.handleConnection` 中已处理用户上线流程，在适当位置调用 `broadcastFriendStatusUpdate` 即可。

### 5.4 客户端接收

在 `apps/web/lib/socket.ts` 中导出对应的 Handler 设置函数：

```ts
let friendStatusUpdateHandler: Handler<FriendStatusUpdatePayload> = null;
let friendRequestReceivedHandler: Handler<FriendRequestReceivedPayload> = null;

export function setFriendStatusUpdateHandler(h: ...) { friendStatusUpdateHandler = h; }
export function setFriendRequestReceivedHandler(h: ...) { friendRequestReceivedHandler = h; }
```

---

## 6. 前端页面设计

### 6.1 入口位置

在现有顶部导航栏（`apps/web/app/layout.tsx` 中的 Nav）中增加"好友"入口：

```
[大厅] [牌桌] [好友 ✨] [我的]
```

图标使用 👥，并在新消息时显示红点 badge。

### 6.2 页面路由

建议路由：`/friends`

对应文件：`apps/web/app/friends/page.tsx`

### 6.3 好友列表页（`/friends`）

**Tab 切换：**

- **好友**（默认）：显示 ACCEPTED 好友列表
- **请求**：显示收到的 PENDING 请求列表

**好友 Tab 内容：**

- 搜索框（按昵称过滤）
- 好友列表：头像 + 昵称 + 在线状态标签（🟢 在线 / ⚫ 离线 / 🎮 游戏中）
- 点击好友 → 跳转 `/stats/[userId]`（个人统计页）

**请求 Tab 内容：**

- 收到的请求列表：头像 + 昵称 + 时间 + [接受] [拒绝] 按钮
- 无请求时显示空状态插画

### 6.4 添加好友入口

在好友列表页顶部或导航栏提供 [+ 添加好友] 按钮，点击弹出 Modal：

- 输入框：用户名或邮箱
- [发送请求] 按钮
- 成功后提示"请求已发送"

### 6.5 实时状态展示

- 好友上线 / 下线时，通过 WebSocket 事件更新列表中的状态徽章
- 新好友请求到达时，Tab 切换提示或 badge 更新

---

## 7. 状态机

### 7.1 好友关系状态流转

```
          ┌──────────────────────────────────────────┐
          │                                          │
          ▼                                          │
None ────► PENDING ────► ACCEPTED ◄────► REJECTED   │
                  │                         │         │
                  │                         │         │
                  └───────── (删除) ────────┘         │
                           (双向删除)
```

| 状态       | 说明                     | 允许的操作                            |
| ---------- | ------------------------ | ------------------------------------- |
| `None`     | 无关系                   | 发送请求                              |
| `PENDING`  | 请求已发送，等待对方处理 | 取消请求（可转为删除）、对方接受/拒绝 |
| `ACCEPTED` | 已成为好友               | 删除好友                              |
| `REJECTED` | 对方已拒绝               | 可重新发起新请求（需新建记录）        |

### 7.2 删除后的状态处理

删除好友（DELETE `/friends/:id`）直接删除记录，之后双方均可重新发起请求（None → PENDING）。

### 7.3 双向关系说明

本方案采用**单向存储**（一条 `Friend` 记录），好友关系通过 `requesterId` 和 `addresseeId` 表示，不额外存储反向记录。查询时根据 `requesterId` 和 `addresseeId` 两个字段过滤即可。

---

## 8. 实施步骤

### 8.1 优先级排序

| 优先级 | 模块                                          | 理由         |
| ------ | --------------------------------------------- | ------------ |
| P0     | Prisma Friend 模型 + 基础 CRUD API            | 数据层基础   |
| P0     | FriendService 后端服务                        | 业务逻辑封装 |
| P0     | POST /friends/request + GET /friends          | 核心功能     |
| P1     | 好友请求管理 API（accept/reject/list）        | 配套核心     |
| P1     | WebSocket 事件推送（friend_request_received） | 实时通知     |
| P2     | WebSocket friend_status_update                | 上下线通知   |
| P2     | 前端好友列表页面                              | UI 落地      |
| P3     | 前端请求管理 UI                               | 完善体验     |
| P3     | 添加好友搜索 Modal                            | 完善体验     |

### 8.2 建议开发顺序

```
阶段一：后端基础
1. 迁移 Prisma Friend 模型 → 执行 prisma migrate
2. 创建 FriendModule / FriendService / FriendController
3. 实现 POST /friends/request（包含冲突检测）
4. 实现 GET /friends（分页 + 搜索 + 联表用户状态）
5. 实现 DELETE /friends/:id

阶段二：请求管理
6. 实现 GET /friends/requests
7. 实现 POST /friends/requests/:id/accept
8. 实现 POST /friends/requests/:id/reject

阶段三：WebSocket 集成
9. 在 AppGateway 中注入 FriendService
10. 实现 emitToUser 辅助方法
11. 在 POST /friends/request 后触发 friend_request_received
12. 在 handleConnection / handleDisconnect 后触发 friend_status_update
13. 更新 packages/shared/src/socket.ts 类型定义

阶段四：前端
14. 创建 /friends 页面骨架
15. 实现好友列表 Tab（接入 GET /friends）
16. 实现请求 Tab（接入 GET /friends/requests）
17. 实现添加好友 Modal
18. 实现接受/拒绝按钮
19. 接入 WebSocket Handler（状态实时更新）
```

---

## 9. 待确认事项

1. **删除好友后是否允许立即重新发起？** 当前设计允许（删除记录后视为 None）
2. **被拒绝后是否允许立即重新发起？** 当前设计允许（新建记录）
3. **是否需要"屏蔽"（拉黑）功能？** 当前方案不含黑名单，如需要可扩展 `status = BLOCKED`
4. **是否需要好友推荐（根据 ELO 接近度）？** 当前不含，可在 GET /friends 列表下方增加"你可能认识的人"模块
5. **移动端（apps/mobile）是否同步支持？** 共用同一套 API 和 WebSocket 类型，移动端可复用

---

## 10. 涉及文件清单（预估）

### 新建

- `apps/backend/src/friend/` — 整个 Friend 模块
  - `friend.module.ts`
  - `friend.service.ts`
  - `friend.controller.ts`
  - `dto/` — 请求/响应 DTO
- `apps/web/app/friends/page.tsx` — 好友列表页
- `apps/web/app/friends/components/` — 好友 UI 组件
- `docs/friend-system-design.md` — 本文档

### 修改

- `apps/backend/prisma/schema.prisma` — 添加 Friend 模型 + User 关系
- `apps/backend/src/app.module.ts` — 导入 FriendModule
- `apps/backend/src/websocket/app.gateway.ts` — 注入 FriendService，添加 WebSocket 推送
- `packages/shared/src/socket.ts` — 新增事件类型
- `packages/shared/src/types/game.ts` — 可选：新增 Friend 相关类型
- `apps/web/lib/socket.ts` — 新增 Handler 注册函数
