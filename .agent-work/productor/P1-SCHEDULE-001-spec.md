# P1-SCHEDULE-001: Tournament Schedule — Beat the Clock / 赛事日历规格

## 概述

赛事日历（Schedule）提供即将开始赛事的倒计时视图，帮助玩家发现并报名 Sit & Go / MTT 赛事，在赛事开始前收到提醒通知。对标 **888poker Beat the Clock**（倒计时 Sit & Go）和 **GGPoker 赛事日历**。

## 赛事类型

|| 类型 | 英文 | 说明 | Buy-in Range |
||------|------|------|-------------|
|| Sit & Go | SNG | 固定参赛费，满员即开 | 500–5000 chips |
|| Beat the Clock | BTC | 倒计时 SNG，时间到即开（3/5/10分钟） | 500–2500 chips |
|| Satellite | SAT | 晋级赛，赢取大比赛门票 | 100–1000 chips |
|| Freeroll | FR | 免费参赛，奖励 chips | 0 |
|| Guaranteed | GTD | 保证金奖池，不受参赛人数影响 | 1000–10000 chips |
|| Knockout | KO | 每淘汰一人获 bounty 奖励 | 1000–5000 chips |

## 数据库模型

```prisma
model TournamentSchedule {
  id            String    @id @default(cuid())
  roomId        String    @unique  // 关联 Room
  type          TournamentType
  buyin         Int       // chips
  prizePool     Int?      // 总奖池（GTD 模式）
  startsAt      DateTime  // 计划开始时间
  registrationDeadline DateTime // 报名截止
  minPlayers    Int       @default(2)
  maxPlayers    Int       @default(9)
  bounty        Int?      // KO 模式每淘汰奖励
  status        ScheduleStatus @default(SCHEDULED)
  createdAt     DateTime  @default(now())
}

enum TournamentType {
  SNG       // 常规 SNG
  BTC       // Beat the Clock（倒计时）
  SAT       // Satellite
  FREEROLL  // 免费赛
  Gtd       // 保证金赛
  KO        // Knockout
}

enum ScheduleStatus {
  SCHEDULED  // 待开始
  OPEN       // 报名中
  CLOSED     // 报名截止
  STARTED    //已开始
  FINISHED   //已结束
  CANCELLED  //已取消
}
```

## API 端点

### 获取赛事日历

```
GET /schedule
Query: ?status=OPEN&type=BTC
Response: TournamentSchedule[]
```

### 获取单个赛事详情

```
GET /schedule/:id
Response: TournamentSchedule + RoomInfo
```

### 玩家报名

```
POST /schedule/:id/register
Body: { chipsToPay: number }
Response: { success: boolean; chipsRemaining: number }
```

### 取消报名

```
DELETE /schedule/:id/register
Response: { success: boolean; chipsRefunded: number }
```

### 赛事开始提醒（WebSocket）

```
服务器 → 客户端: tournament-starting
{
  scheduleId: string
  type: "BTC" | "SNG" | "SAT"
  startsInSeconds: number  // 30 / 60 / 300
  prizePool: number
  playersRegistered: number
  maxPlayers: number
}
```

## 前端页面

### /schedule — 赛事日历页

**布局**（Tab 切换）：

```
[全部] [BTC] [SNG] [Satellite] [Freeroll] [GTD] [KO]
```

**赛事卡片**：

```
┌─────────────────────────────────────┐
│ 🏆 Beat the Clock #42               │
│ 类型: BTC · 5分钟开赛               │
│ 报名费: 500 🪙                      │
│ 奖池: 5000 🪙 保证                 │
│ ─────────────────────────────────── │
│ 👥 3/9 已报名                       │
│ ⏰ 04:32 后开始                     │
│ [报名]                              │
└─────────────────────────────────────┘
```

**倒计时**：

- `> 5 分钟`：灰色，显示"X 分钟"
- `1-5 分钟`：橙色，显示"X:XX"
- `< 1 分钟`：红色 + 脉冲动画
- `30 秒`：弹窗提醒 + WebSocket push

**我的报名**（侧边栏）：

```
我的报名
├── BTC #42 — 04:32 后 — ✅ 已报名
└── SNG #7  — 12:00 — ✅ 已报名
```

### /schedule/:id — 赛事详情页

- 完整规则说明
- 奖励结构（各名次百分比）
- 当前报名人数
- 玩家列表预览
- 倒计时 + 报名按钮

## 后端逻辑

### 倒计时开赛（BTC 模式）

1. 调度器每分钟扫描 `TournamentSchedule` 中 `startsAt <= now + 5min && status = OPEN`
2. BTC 类型：`startsAt` 每 5 分钟生成一个 Slot
3. `registrationDeadline = startsAt`，截止后 `status → CLOSED`
4. 满员或倒计时归零 → 创建真实 Room，`status → STARTED`

### 赛事提醒推送

- `startsAt - 5 min`：WebSocket `tournament-starting`（5分钟提醒）
- `startsAt - 1 min`：邮件/推送（可选）
- `startsAt - 30 sec`：WebSocket 弹窗 + 客户端 toast

### SNG 自动创建

1. 玩家手动"创建 SNG 房间"（Phase 1 P1-TOURNAMENT-001）
2. Schedule 是**自动调度**，Room 是实际游戏桌

## 验收标准

1. 赛事日历展示所有类型（BTC/SNG/SAT/FR/GTD/KO）
2. BTC 类型：5分钟倒计时，时间到自动开赛
3. 玩家可报名 / 取消报名
4. 赛事开始前 5 分钟推送 WebSocket 提醒
5. 270 tests 继续通过
6. 与 P1-TOURNAMENT-001 SNG Phase 1 兼容

## 后续 Phase

- Phase 2：MTT 多桌赛程支持
- Phase 3：真实货币（GGS / USDT）赛事

## 优先级：P1
