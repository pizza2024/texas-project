# 德州扑克测试机器人 - 扩展测试用例

本文档记录了测试机器人的完整测试用例设计。

---

## 测试用例清单

### 固定用例（原cron任务中的基础测试）

| 用例ID  | 类别      | 测试项         | 测试方式                                  | 预期结果                              |
| ------- | --------- | -------------- | ----------------------------------------- | ------------------------------------- |
| BASE_01 | 认证      | 登录成功       | `POST /auth/login` with test1/test123     | HTTP 200, token获取, 余额10000        |
| BASE_02 | 房间      | 房间列表       | `GET /rooms`                              | HTTP 200, 返回房间数组                |
| BASE_03 | 房间      | 创建房间       | `POST /rooms` with blindSmall/blindBig    | HTTP 201, blindSmall/blindBig字段正确 |
| BASE_04 | WebSocket | Socket.io握手  | `GET /socket.io/?EIO=4&transport=polling` | HTTP 200, 握手包                      |
| BASE_05 | Git       | GitHub Actions | `gh run list --limit 3`                   | 列出最近runs                          |

---

### 扩展用例（新增）

#### 第一部分：认证类 (TC*AUTH*\*)

| 用例ID     | 测试项                    | 测试方式                                 | 预期结果                                       |
| ---------- | ------------------------- | ---------------------------------------- | ---------------------------------------------- |
| TC_AUTH_01 | 登录成功                  | `POST /auth/login` - test1/test123       | HTTP 200, 返回 access_token，coinBalance=10000 |
| TC_AUTH_02 | 登录失败（错误密码）      | `POST /auth/login` - test1/wrongpassword | HTTP 401 Unauthorized                          |
| TC_AUTH_03 | 登录失败（不存在的用户）  | `POST /auth/login` - nonexistent/test123 | HTTP 401 Unauthorized                          |
| TC_AUTH_04 | 获取用户资料（有效token） | `GET /auth/profile` with Bearer token    | HTTP 200, 返回用户详细信息                     |

#### 第二部分：房间类 (TC*ROOM*\*)

| 用例ID     | 测试项                   | 测试方式                                  | 预期结果                                    |
| ---------- | ------------------------ | ----------------------------------------- | ------------------------------------------- |
| TC_ROOM_01 | 获取房间列表（分页）     | `GET /rooms?page=1&limit=10`              | HTTP 200, 返回data数组+total字段            |
| TC_ROOM_02 | 创建公开房间             | `POST /rooms` (无password字段)            | HTTP 201, isPrivate=false                   |
| TC_ROOM_03 | 创建密码房间             | `POST /rooms` (带password字段)            | HTTP 201, isPrivate=true, API不返回password |
| TC_ROOM_04 | 进入密码房间（正确密码） | `POST /rooms/:id/verify-password` correct | HTTP 200, {valid: true}                     |
| TC_ROOM_05 | 进入密码房间（错误密码） | `POST /rooms/:id/verify-password` wrong   | HTTP 200, {valid: false}                    |
| TC_ROOM_06 | 获取单个房间详情         | `GET /rooms/:id`                          | HTTP 200, 返回该房间完整信息                |

#### 第三部分：边界条件 (TC*BOUND*\*)

| 用例ID      | 测试项                     | 测试方式                               | 预期结果                                |
| ----------- | -------------------------- | -------------------------------------- | --------------------------------------- |
| TC_BOUND_01 | 最小盲注创建房间           | blindSmall=1, blindBig=2, maxPlayers=2 | HTTP 201（系统接受最小盲注）            |
| TC_BOUND_02 | 超长房间名（31字符）       | name="AAAA...A"(31个A)                 | HTTP 201或400（前端maxLength=30会拦截） |
| TC_BOUND_03 | 无效座位数（maxPlayers=0） | maxPlayers=0                           | HTTP 201或400（有效范围2-9）            |
| TC_BOUND_04 | minBuyIn小于bigBlind       | minBuyIn=10, blindBig=20               | HTTP 201（系统可能自动修正）            |
| TC_BOUND_05 | 无token创建房间            | 不带Authorization header               | HTTP 401 Unauthorized                   |

#### 第四部分：WebSocket (TC*WS*\*)

| 用例ID   | 测试项              | 测试方式                                  | 预期结果                      |
| -------- | ------------------- | ----------------------------------------- | ----------------------------- |
| TC_WS_01 | Socket.io HTTPS握手 | `GET /socket.io/?EIO=4&transport=polling` | HTTP 200, 返回socket.io握手包 |

#### 第五部分：Git (TC*GIT*\*)

| 用例ID    | 测试项             | 测试方式                | 预期结果                 |
| --------- | ------------------ | ----------------------- | ------------------------ |
| TC_GIT_01 | GitHub Actions状态 | `gh run list --limit 3` | 列出最近3个workflow runs |

---

## API 端点参考

### 认证相关

- `POST /auth/login` - 用户登录
  - Body: `{"username": "string", "password": "string"}`
  - 响应: `{"access_token": "string", "user": {...}}`
- `GET /auth/profile` - 获取当前用户资料（需token）
  - Header: `Authorization: Bearer <token>`

### 房间相关

- `GET /rooms` - 房间列表
  - Query: `?page=1&limit=50`
  - 响应: `{data: Room[], total: number}`
- `POST /rooms` - 创建房间（需token）
  - Body: `{name, blindSmall, blindBig, maxPlayers, minBuyIn, password?}`
- `GET /rooms/:id` - 获取房间详情
  - 响应: `{...room, isPrivate: boolean}`
- `POST /rooms/:id/verify-password` - 验证密码（公开房间恒返回valid:true）
  - Body: `{"password": "string"}`

### WebSocket

- Socket.io endpoint: `https://api.pizza2024.com/socket.io/?EIO=4&transport=polling`

---

## 测试执行顺序

**重要：测试必须按顺序执行，token依赖关系如下：**

1. `TC_AUTH_01` → 获取 access_token
2. 用 `TC_AUTH_01` 的 token 执行 `TC_AUTH_04`, `TC_ROOM_02`, `TC_ROOM_03`, `TC_BOUND_01~05`
3. 用 `TC_ROOM_03` 的 room_id 执行 `TC_ROOM_04`, `TC_ROOM_05`
4. 用 `TC_ROOM_02` 的 room_id 执行 `TC_ROOM_06`

---

## 快速匹配（Quick Match）说明

快速匹配功能通过 WebSocket 实现，不是 REST API：

- 用户选择盲注级别（MICRO/LOW/MEDIUM/HIGH/PREMIUM）
- 系统自动分配或创建匹配房间
- 相关端在 `POST /socket.io/...` (WebSocket协议)

| 级别    | 盲注    | 最小买入 | 最大座位 |
| ------- | ------- | -------- | -------- |
| MICRO   | 5/10    | 100      | 6        |
| LOW     | 10/20   | 200      | 6        |
| MEDIUM  | 25/50   | 500      | 9        |
| HIGH    | 50/100  | 1000     | 9        |
| PREMIUM | 100/200 | 2000     | 6        |

---

## 报告格式

每次cron执行后生成如下格式报告：

```
[测试机器人报告 - YYYY-MM-DD HH:MM]

## 测试结果汇总

| 用例ID | 类别 | 测试项 | 状态 | 备注 |
|--------|------|--------|------|------|
| TC_AUTH_01 | 认证 | 登录成功 | ✅/❌ | 详情... |
...

## 详细结果
[每个用例的请求/响应详情]

## 总结
- 通过: X/Y
- 失败: Y
- 耗时: ~Xs
```

---

## 注意事项

1. **API URL**: 生产环境使用 `https://api.pizza2024.com`，本地测试用 `http://localhost:4000`
2. **blindSmall/blindBig 字段名**: 确认使用 `blindSmall` 和 `blindBig`，不是 `smallBlind`/`bigBlind`
3. **token 提取**: 用 `grep -o '"access_token":"[^"]*"'` 或 `jq -r '.access_token'`
4. **room_id 提取**: 用 `grep -o '"id":"[^"]*"'`
5. **服务器错误不阻塞**: 遇到 HTTP 500/502 等，记录但继续执行后续测试
6. **密码房间**: API 响应中不会返回 password 字段，只能通过 verify-password 验证
