# 好友功能测试用例

## 修订历史

| 版本号 | 日期 | 修订人 | 修订内容 |
|--------|------|--------|----------|
| 1.0.0 | 2026-04-04 | pipi | 初始版本，完整测试用例覆盖 |

## 测试范围概述

本文档涵盖好友系统的所有功能测试，包括：

- **好友请求模块**：发送、接受、拒绝好友请求
- **好友列表模块**：获取好友列表、搜索、在线状态
- **好友关系删除**：双向删除好友关系
- **WebSocket 实时事件**：好友状态变更推送
- **前端页面功能**：UI 交互与状态展示
- **边界与异常场景**：并发、防重、数据一致性

## 测试环境说明

| 环境 | 说明 |
|------|------|
| API 基础路径 | `/api/v1` |
| WebSocket 路径 | `/ws` |
| 认证方式 | JWT Bearer Token（Header `Authorization: Bearer <token>`） |
| 数据库 | MySQL / PostgreSQL（好友关系表 + 用户状态表） |
| 测试工具 | Postman / curl / Jest |

**通用测试账号：**

| 账号 | 用户名 | 邮箱 | 备注 |
|------|--------|------|------|
| Alice | alice | alice@example.com | 正常用户 |
| Bob | bob | bob@example.com | 正常用户 |
| Charlie | charlie | charlie@example.com | 正常用户 |
| DeletedUser | deleted | deleted@example.com | 已删除用户 |

**好友关系状态枚举：**

| 状态 | 说明 |
|------|------|
| PENDING | 待处理 |
| ACCEPTED | 已接受 |
| REJECTED | 已拒绝 |

**用户在线状态枚举：**

| 状态 | 说明 |
|------|------|
| ONLINE | 在线 |
| OFFLINE | 离线 |
| PLAYING | 游戏中 |

---

## API 测试用例

### 1.1 好友请求模块（POST /friends/request）

| 用例编号 | 模块 | 标题 | 前置条件 | 操作步骤 | 预期结果 | 优先级 |
|----------|------|------|----------|----------|----------|--------|
| TC-FR-001 | 好友请求 | 成功发送好友请求（通过用户名） | Alice 已登录 | 1. Alice 调用 `POST /friends/request`<br>2. Body: `{ "username": "bob" }` | 返回 201，响应体包含 `request_id`，Bob 收到 WebSocket 事件 | P0 |
| TC-FR-002 | 好友请求 | 成功发送好友请求（通过邮箱） | Alice 已登录 | 1. Alice 调用 `POST /friends/request`<br>2. Body: `{ "email": "bob@example.com" }` | 返回 201，响应体包含 `request_id`，Bob 收到 WebSocket 事件 | P0 |
| TC-FR-003 | 好友请求 | 发送好友请求给自己 | Alice 已登录 | 1. Alice 调用 `POST /friends/request`<br>2. Body: `{ "username": "alice" }` | 返回 400，错误码 `CANNOT_ADD_SELF`，提示"不能添加自己为好友" | P0 |
| TC-FR-004 | 好友请求 | 发送好友请求给不存在的用户 | Alice 已登录 | 1. Alice 调用 `POST /friends/request`<br>2. Body: `{ "username": "nonexistent" }` | 返回 404，错误码 `USER_NOT_FOUND`，提示"用户不存在" | P0 |
| TC-FR-005 | 好友请求 | 发送好友请求给已有待处理请求的用户 | Alice 已登录；Alice 已向 Bob 发送过待处理请求 | 1. Alice 调用 `POST /friends/request`<br>2. Body: `{ "username": "bob" }` | 返回 409，错误码 `REQUEST_EXISTS`，提示"待处理的好友请求已存在" | P0 |
| TC-FR-006 | 好友请求 | 发送好友请求给已是好友的用户 | Alice 已登录；Alice 与 Bob 已是好友 | 1. Alice 调用 `POST /friends/request`<br>2. Body: `{ "username": "bob" }` | 返回 409，错误码 `ALREADY_FRIENDS`，提示"你们已经是好友了" | P0 |
| TC-FR-007 | 好友请求 | 发送好友请求给已拒绝的用户 | Alice 已登录；Bob 之前拒绝过 Alice 的请求 | 1. Alice 调用 `POST /friends/request`<br>2. Body: `{ "username": "bob" }` | 返回 201（允许重新发送），响应体包含新的 `request_id` | P1 |
| TC-FR-008 | 好友请求 | 未登录用户发送请求 | 未携带有效 Token | 1. 未登录调用 `POST /friends/request`<br>2. Body: `{ "username": "bob" }` | 返回 401，错误码 `UNAUTHORIZED` | P0 |

### 1.2 好友列表模块（GET /friends）

| 用例编号 | 模块 | 标题 | 前置条件 | 操作步骤 | 预期结果 | 优先级 |
|----------|------|------|----------|----------|----------|--------|
| TC-FL-001 | 好友列表 | 成功获取好友列表（包含在线状态） | Alice 已登录；Alice 有 3 个好友（Bob 在线、Charlie 离线、David 游戏中） | 1. Alice 调用 `GET /friends` | 返回 200，响应体包含好友列表，每个好友包含 `id`、`username`、`nickname`、`status`（ONLINE/OFFLINE/PLAYING） | P0 |
| TC-FL-002 | 好友列表 | 好友列表按昵称搜索过滤 | Alice 已登录；好友列表包含多个用户 | 1. Alice 调用 `GET /friends?search=alice`<br>（或 `?nickname=alice`） | 返回 200，仅返回昵称包含搜索关键词的好友 | P1 |
| TC-FL-003 | 好友列表 | 好友列表分页（游标分页） | Alice 已登录；Alice 有超过 20 个好友 | 1. Alice 调用 `GET /friends?limit=20`<br>2. 获取返回的 `next_cursor`<br>3. 调用 `GET /friends?cursor=<next_cursor>&limit=20` | 返回 200，第二页返回后续好友，`next_cursor` 为 null 或新的游标 | P1 |
| TC-FL-004 | 好友列表 | 无好友时返回空列表 | Alice 已登录；Alice 没有任何好友 | 1. Alice 调用 `GET /friends` | 返回 200，响应体 `friends` 为空数组 `[]` | P0 |
| TC-FL-005 | 好友列表 | 未登录用户获取列表 | 未携带有效 Token | 1. 未登录调用 `GET /friends` | 返回 401，错误码 `UNAUTHORIZED` | P0 |
| TC-FL-006 | 好友列表 | 已删除的好友不在列表中 | Alice 已登录；Bob 之前在 Alice 好友列表中，但被删除 | 1. Alice 调用 `GET /friends` | 返回 200，Bob 不在好友列表中 | P0 |

### 1.3 删除好友模块（DELETE /friends/:id）

| 用例编号 | 模块 | 标题 | 前置条件 | 操作步骤 | 预期结果 | 优先级 |
|----------|------|------|----------|----------|----------|--------|
| TC-DF-001 | 删除好友 | 成功删除好友（requester 侧删除） | Alice 已登录；Alice 与 Bob 是好友（Alice 为requester） | 1. Alice 调用 `DELETE /friends/bob_user_id` | 返回 200，Alice 的好友列表中不再有 Bob；Bob 的好友列表中不再有 Alice | P0 |
| TC-DF-002 | 删除好友 | 成功删除好友（addressee 侧删除） | Alice 已登录；Alice 与 Bob 是好友（Bob 为requester） | 1. Bob 调用 `DELETE /friends/alice_user_id` | 返回 200，Alice 的好友列表中不再有 Bob；Bob 的好友列表中不再有 Alice | P0 |
| TC-DF-003 | 删除好友 | 删除不是自己的好友记录 | Alice 已登录；Alice 与 Bob 是好友；Charlie 不是 Alice 的好友 | 1. Alice 调用 `DELETE /friends/charlie_user_id` | 返回 403，错误码 `NOT_FRIEND`，提示"该用户不是您的好友" | P0 |
| TC-DF-004 | 删除好友 | 删除不存在的记录 | Alice 已登录；某 user_id 不存在或从未有过好友关系 | 1. Alice 调用 `DELETE /friends/nonexistent_user_id` | 返回 404，错误码 `FRIEND_NOT_FOUND` | P0 |
| TC-DF-005 | 删除好友 | 删除未建立的好友关系（PENDING/REJECTED） | Alice 已登录；Alice 与 Bob 存在 PENDING 或 REJECTED 请求（非好友关系） | 1. Alice 调用 `DELETE /friends/bob_user_id` | 返回 403，错误码 `NOT_FRIEND`，提示"该用户不是您的好友，无法删除" | P1 |
| TC-DF-006 | 删除好友 | 未登录用户删除 | 未携带有效 Token | 1. 未登录调用 `DELETE /friends/bob_user_id` | 返回 401，错误码 `UNAUTHORIZED` | P0 |

### 1.4 接受好友请求（POST /friends/requests/:id/accept）

| 用例编号 | 模块 | 标题 | 前置条件 | 操作步骤 | 预期结果 | 优先级 |
|----------|------|------|----------|----------|----------|--------|
| TC-AC-001 | 接受好友请求 | 成功接受好友请求 | Alice 已登录；Bob 向 Alice 发送了待处理好友请求 | 1. Alice 调用 `POST /friends/requests/<request_id>/accept` | 返回 200，请求状态变为 ACCEPTED；Alice 与 Bob 互相成为好友；双方收到 WebSocket 事件 | P0 |
| TC-AC-002 | 接受好友请求 | 非接收方接受请求 | Alice 已登录；Bob 向 Charlie 发送了待处理好友请求（非 Alice） | 1. Alice 调用 `POST /friends/requests/<request_id>/accept` | 返回 403，错误码 `FORBIDDEN`，提示"您不是该请求的接收方" | P0 |
| TC-AC-003 | 接受好友请求 | 接受不存在的请求 | Alice 已登录 | 1. Alice 调用 `POST /friends/requests/nonexistent_id/accept` | 返回 404，错误码 `REQUEST_NOT_FOUND` | P0 |
| TC-AC-004 | 接受好友请求 | 接受非 PENDING 状态的请求 | Alice 已登录；Bob 的请求已被 Alice 接受（状态为 ACCEPTED） | 1. Alice 调用 `POST /friends/requests/<request_id>/accept` | 返回 400，错误码 `INVALID_REQUEST_STATUS`，提示"该请求已处理" | P0 |
| TC-AC-005 | 接受好友请求 | 未登录用户接受 | 未携带有效 Token | 1. 未登录调用 `POST /friends/requests/<request_id>/accept` | 返回 401，错误码 `UNAUTHORIZED` | P0 |

### 1.5 拒绝好友请求（POST /friends/requests/:id/reject）

| 用例编号 | 模块 | 标题 | 前置条件 | 操作步骤 | 预期结果 | 优先级 |
|----------|------|------|----------|----------|----------|--------|
| TC-RJ-001 | 拒绝好友请求 | 成功拒绝好友请求 | Alice 已登录；Bob 向 Alice 发送了待处理好友请求 | 1. Alice 调用 `POST /friends/requests/<request_id>/reject` | 返回 200，请求状态变为 REJECTED；Alice 不会出现在 Bob 的好友列表中 | P0 |
| TC-RJ-002 | 拒绝好友请求 | 非接收方拒绝请求 | Alice 已登录；Bob 向 Charlie 发送了待处理好友请求 | 1. Alice 调用 `POST /friends/requests/<request_id>/reject` | 返回 403，错误码 `FORBIDDEN`，提示"您不是该请求的接收方" | P0 |
| TC-RJ-003 | 拒绝好友请求 | 拒绝不存在的请求 | Alice 已登录 | 1. Alice 调用 `POST /friends/requests/nonexistent_id/reject` | 返回 404，错误码 `REQUEST_NOT_FOUND` | P0 |
| TC-RJ-004 | 拒绝好友请求 | 拒绝非 PENDING 状态的请求 | Alice 已登录；Bob 的请求已被接受（状态为 ACCEPTED） | 1. Alice 调用 `POST /friends/requests/<request_id>/reject` | 返回 400，错误码 `INVALID_REQUEST_STATUS`，提示"该请求已处理" | P0 |

### 1.6 好友请求列表（GET /friends/requests）

| 用例编号 | 模块 | 标题 | 前置条件 | 操作步骤 | 预期结果 | 优先级 |
|----------|------|------|----------|----------|----------|--------|
| TC-RL-001 | 好友请求列表 | 成功获取收到的待处理请求列表 | Alice 已登录；Bob 和 Charlie 分别向 Alice 发送了待处理请求 | 1. Alice 调用 `GET /friends/requests?status=PENDING` | 返回 200，响应体包含 2 条待处理请求，每条包含 `requester` 信息（id、username、nickname） | P0 |
| TC-RL-002 | 好友请求列表 | 获取已接受请求列表 | Alice 已登录；Bob 接受过 Alice 的好友请求 | 1. Alice 调用 `GET /friends/requests?status=ACCEPTED` | 返回 200，响应体包含已接受的请求记录 | P1 |
| TC-RL-003 | 好友请求列表 | 获取已拒绝请求列表 | Alice 已登录；Charlie 拒绝过 Alice 的好友请求 | 1. Alice 调用 `GET /friends/requests?status=REJECTED` | 返回 200，响应体包含已拒绝的请求记录 | P1 |
| TC-RL-004 | 好友请求列表 | 无请求时返回空列表 | Alice 已登录；Alice 没有任何好友请求 | 1. Alice 调用 `GET /friends/requests?status=PENDING` | 返回 200，响应体为空数组 `[]` | P0 |
| TC-RL-005 | 好友请求列表 | 未登录用户获取 | 未携带有效 Token | 1. 未登录调用 `GET /friends/requests` | 返回 401，错误码 `UNAUTHORIZED` | P0 |

---

## WebSocket 事件测试用例

| 用例编号 | 模块 | 标题 | 前置条件 | 操作步骤 | 预期结果 | 优先级 |
|----------|------|------|----------|----------|----------|--------|
| TC-WS-001 | WebSocket | 新好友请求到达时收到 `friend_request_received` 事件 | Alice 和 Bob 都已建立 WebSocket 连接 | 1. Bob 向 Alice 发送好友请求 | Alice 的 WebSocket 收到 `friend_request_received` 事件，包含 `request_id`、发送者信息 | P0 |
| TC-WS-002 | WebSocket | 好友上线时收到 `friend_status_update` 事件 | Alice 已登录；Bob 离线且与 Alice 是好友；Alice 已建立 WebSocket 连接 | 1. Bob 上线（登录） | Alice 的 WebSocket 收到 `friend_status_update` 事件，`status` 变为 `ONLINE` | P0 |
| TC-WS-003 | WebSocket | 好友下线时收到 `friend_status_update` 事件 | Alice 已登录；Bob 在线且与 Alice 是好友；Alice 已建立 WebSocket 连接 | 1. Bob 下线（登出或断连） | Alice 的 WebSocket 收到 `friend_status_update` 事件，`status` 变为 `OFFLINE` | P0 |
| TC-WS-004 | WebSocket | 好友开始游戏时状态变为 PLAYING | Alice 已登录；Bob 在线且与 Alice 是好友；Alice 已建立 WebSocket 连接 | 1. Bob 开始一局游戏 | Alice 的 WebSocket 收到 `friend_status_update` 事件，`status` 变为 `PLAYING` | P1 |
| TC-WS-005 | WebSocket | 好友游戏结束后状态恢复 ONLINE | Alice 已登录；Bob 正在游戏中且与 Alice 是好友；Alice 已建立 WebSocket 连接 | 1. Bob 结束游戏 | Alice 的 WebSocket 收到 `friend_status_update` 事件，`status` 变回 `ONLINE` | P1 |

**WebSocket 事件Payload格式：**

```json
// friend_request_received
{
  "event": "friend_request_received",
  "data": {
    "request_id": "uuid",
    "requester": {
      "id": "user_id",
      "username": "bob",
      "nickname": "Bob"
    },
    "created_at": "2026-04-04T10:00:00Z"
  }
}

// friend_status_update
{
  "event": "friend_status_update",
  "data": {
    "friend_id": "user_id",
    "username": "bob",
    "status": "ONLINE" // ONLINE | OFFLINE | PLAYING
  }
}
```

---

## 前端功能测试用例

| 用例编号 | 模块 | 标题 | 前置条件 | 操作步骤 | 预期结果 | 优先级 |
|----------|------|------|----------|----------|----------|--------|
| TC-FE-001 | 前端 | 好友列表页显示正确（包含在线状态标签） | Alice 已登录；Alice 有在线好友 Bob、离线好友 Charlie | 1. Alice 打开好友列表页 | 页面显示 Bob 和 Charlie 的头像、昵称；Bob 显示"在线"绿色标签；Charlie 显示"离线"灰色标签 | P0 |
| TC-FE-002 | 前端 | 请求 Tab 显示收到的待处理请求 | Alice 已登录；Bob 向 Alice 发送了待处理请求 | 1. Alice 打开好友页<br>2. 切换到"请求"Tab | 页面显示 Bob 的头像、昵称和请求时间；显示"接受"和"拒绝"按钮 | P0 |
| TC-FE-003 | 前端 | 添加好友 Modal 输入用户名/邮箱成功发送请求 | Alice 已登录 | 1. Alice 点击"添加好友"按钮<br>2. Modal 出现，输入 `bob`<br>3. 点击"发送" | Modal 关闭；页面提示"好友请求已发送"；请求出现在 Bob 的待处理列表中 | P0 |
| TC-FE-004 | 前端 | 点击接受按钮后好友出现在好友列表 | Alice 已登录；Bob 向 Alice 发送了待处理请求 | 1. Alice 打开请求 Tab<br>2. 点击 Bob 请求的"接受"按钮 | 请求从请求列表消失；好友列表中出现 Bob，显示"在线"或对应状态 | P0 |
| TC-FE-005 | 前端 | 点击拒绝按钮后请求从请求列表消失 | Alice 已登录；Bob 向 Alice 发送了待处理请求 | 1. Alice 打开请求 Tab<br>2. 点击 Bob 请求的"拒绝"按钮 | 请求从请求列表消失；好友列表中不出现 Bob | P0 |
| TC-FE-006 | 前端 | 实时状态下线好友显示离线标签 | Alice 已登录；Bob 在线且是 Alice 的好友；Alice 已打开好友列表页 | 1. Bob 断开连接或登出 | Alice 页面无需刷新；Bob 的状态标签自动变为"离线"（通过 WebSocket 实时更新） | P1 |

---

## 边界与异常测试用例

| 用例编号 | 模块 | 标题 | 前置条件 | 操作步骤 | 预期结果 | 优先级 |
|----------|------|------|----------|----------|----------|--------|
| TC-BD-001 | 边界 | 快速连续点击"发送请求"按钮（防重复提交） | Alice 已登录 | 1. 在添加好友 Modal 中快速连续点击"发送"按钮 3 次 | 仅发送 1 个好友请求；后端正确防重；前端按钮在请求期间显示 loading 状态或被禁用 | P1 |
| TC-BD-002 | 边界 | 同时删除同一个好友（双方都删除） | Alice 和 Bob 是好友；Alice 和 Bob 同时在线 | 1. Alice 点击删除 Bob<br>2. 同时 Bob 点击删除 Alice | 两人的好友列表中对方都被删除；数据库无残留记录；不报 500 错误 | P1 |
| TC-BD-003 | 边界 | 删除后立即重新添加（状态一致性） | Alice 和 Bob 是好友 | 1. Alice 删除 Bob<br>2. 立即在删除完成前 Alice 尝试向 Bob 发送好友请求 | 删除完成后请求发送成功；不会出现数据不一致或 500 错误 | P1 |
| TC-BD-004 | 边界 | 在请求处理期间对方删除了你（并发场景） | Alice 向 Bob 发送了好友请求 | 1. Alice 打开请求处理页面<br>2. 同时 Bob 在另一端删除了 Alice<br>3. Alice 点击"接受" | Alice 点击后收到明确错误提示（403 或 404）；前端状态不崩溃 | P1 |
| TC-BD-005 | 边界 | 好友列表大量数据时分页正常 | Alice 已登录；Alice 有 100+ 好友 | 1. Alice 打开好友列表页（第一页）<br>2. 滚动加载第二页、第三页 | 分页加载流畅；好友数据不重复、不丢失；游标分页切换后状态标签正确 | P2 |

---

## 测试数据准备

### 4.1 基础用户数据

```sql
-- 测试用户（可根据实际项目 ORM 模型调整）
INSERT INTO users (id, username, email, nickname, password_hash, status, created_at) VALUES
('user_alice', 'alice', 'alice@example.com', 'Alice', '$2b$10$...', 'ONLINE', NOW()),
('user_bob', 'bob', 'bob@example.com', 'Bob', '$2b$10$...', 'ONLINE', NOW()),
('user_charlie', 'charlie', 'charlie@example.com', 'Charlie', '$2b$10$...', 'OFFLINE', NOW()),
('user_david', 'david', 'david@example.com', 'David', '$2b$10$...', 'PLAYING', NOW());
```

### 4.2 好友关系数据

```sql
-- 好友关系（ACCEPTED 状态）
INSERT INTO friendships (id, requester_id, addressee_id, status, created_at, updated_at) VALUES
('fs_001', 'user_alice', 'user_bob', 'ACCEPTED', NOW(), NOW()),
('fs_002', 'user_charlie', 'user_alice', 'ACCEPTED', NOW(), NOW());
```

### 4.3 好友请求数据

```sql
-- 待处理好友请求（PENDING 状态）
INSERT INTO friend_requests (id, requester_id, addressee_id, status, created_at, updated_at) VALUES
('fr_001', 'user_bob', 'user_alice', 'PENDING', NOW(), NOW()),
('fr_002', 'user_charlie', 'user_alice', 'PENDING', NOW(), NOW());

-- 已拒绝请求（REJECTED 状态）
INSERT INTO friend_requests (id, requester_id, addressee_id, status, created_at, updated_at) VALUES
('fr_003', 'user_david', 'user_alice', 'REJECTED', NOW(), NOW());
```

### 4.4 JWT Token 获取

```bash
# 获取各测试账号的 JWT Token（假设登录接口）
ALICE_TOKEN=$(curl -s -X POST /api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password"}' | jq -r '.token')

BOB_TOKEN=$(curl -s -X POST /api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","password":"password"}' | jq -r '.token')
```

### 4.5 测试脚本入口（可选）

```bash
#!/bin/bash
# friend-system-tests.sh

BASE_URL="http://localhost:3000/api/v1"
ALICE_TOKEN="..."
BOB_TOKEN="..."

echo "=== TC-FR-001: 成功发送好友请求（通过用户名）==="
curl -X POST "$BASE_URL/friends/request" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"bob"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo "=== TC-FL-001: 成功获取好友列表 ==="
curl -X GET "$BASE_URL/friends" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
```

---

## 附录：错误码参考

| 错误码 | 说明 |
|--------|------|
| `CANNOT_ADD_SELF` | 不能添加自己为好友 |
| `USER_NOT_FOUND` | 用户不存在 |
| `REQUEST_EXISTS` | 待处理的好友请求已存在 |
| `ALREADY_FRIENDS` | 已是好友 |
| `NOT_FRIEND` | 不是好友关系 |
| `FRIEND_NOT_FOUND` | 好友关系不存在 |
| `INVALID_REQUEST_STATUS` | 请求状态无效（如已处理） |
| `REQUEST_NOT_FOUND` | 好友请求不存在 |
| `FORBIDDEN` | 无权操作 |
| `UNAUTHORIZED` | 未授权（未登录或 Token 无效） |
