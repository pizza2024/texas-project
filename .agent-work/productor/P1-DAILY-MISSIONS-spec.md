# P1-DAILY-MISSIONS — 每日任务规格

**版本:** 1.0
**优先级:** P1
**状态:** 规格草稿
**参考竞品:** WSOP 每日任务、GGPoker 任务系统

---

## 概述

每日任务系统为用户提供每日目标，完成后获得chips奖励，用于提升 DAU（日活跃用户）留存率。

---

## 任务类型

### 核心任务（每日重置）

| 任务ID | 名称 | 目标 | 奖励 |
|--------|------|------|------|
| DAILY_LOGIN | 每日登录 | 登录游戏 | 100 chips |
| DAILY_HANDS_5 | 小试牛刀 | 完成 5 手牌 | 200 chips |
| DAILY_HANDS_20 | 牌桌常客 | 完成 20 手牌 | 500 chips |
| DAILY_WIN_POT | 首胜 | 赢得任意底池 | 300 chips |
| DAILY_ALLIN | 孤注一掷 | 完成一次 All-in | 400 chips |
| DAILY_FRIEND_INVITE | 呼朋唤友 | 邀请 1 位好友注册 | 1000 chips |

### 周任务（每周重置）

| 任务ID | 名称 | 目标 | 奖励 |
|--------|------|------|------|
| WEEKLY_HANDS_100 | 周挑战 I | 完成 100 手牌 | 2000 chips |
| WEEKLY_WIN_10 | 周挑战 II | 赢得 10 个底池 | 3000 chips |

---

## 任务进度

- 每日 UTC 00:00 重置所有每日任务
- 每周 UTC Monday 00:00 重置周任务
- 任务进度实时更新（每手牌完成后）
- 已完成的任务状态变为 `COMPLETED`，不可重复完成

---

## 用户界面

### 任务面板（/missions）

```
┌─────────────────────────────────────┐
│ 每日任务          重置倒计时: 14:32  │
├─────────────────────────────────────┤
│ ✅ 每日登录                    100   │
│    [████████████] 5/5 完成！       │
│                                     │
│ 🔄 小试牛刀              200 chips  │
│    [███████░░░] 3/5               │
│                                     │
│ 🔄 牌桌常客              500 chips  │
│    [██░░░░░░░░] 4/20              │
│                                     │
│ 🔄 首胜                    300 chips│
│    [░░░░░░░░░░] 0/1                │
└─────────────────────────────────────┘
```

### 奖励领取

- 任务完成后显示「领取」按钮
- 点击后 chips 直接入账，显示 +X chips 动画
- 推送通知：任务完成可领取

### 推送通知

| 触发条件 | 通知内容 |
|----------|----------|
| 每日登录 | "每日登录奖励待领取！" |
| 任务完成 | "小试牛刀已完成！领取 200 chips" |
| 任务即将过期 | "今日任务还剩 2 小时，快来领取！" |

---

## 数据库模型

```prisma
model Mission {
  id          String   @id @default(uuid())
  code        String   @unique  // DAILY_LOGIN, DAILY_HANDS_5, etc.
  type        MissionType // DAILY, WEEKLY
  title       String
  description String
  target      Int      // 目标数量
  reward      Int      // 奖励 chips
  resetCycle  String   // "daily", "weekly"
}

model UserMission {
  id          String   @id @default(uuid())
  userId      String
  missionId   String
  progress    Int      @default(0)
  status      MissionStatus @default(ACTIVE)
  claimedAt   DateTime?
  cycleStart  DateTime // 当前周期开始时间
  createdAt   DateTime @default(now())

  @@unique([userId, missionId, cycleStart])
}

enum MissionType {
  DAILY
  WEEKLY
}

enum MissionStatus {
  ACTIVE    // 进行中
  COMPLETED // 已完成（待领取）
  CLAIMED   // 已领取
}
```

---

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /missions | 获取当前周期所有任务及进度 |
| POST | /missions/:id/claim | 领取任务奖励 |

### GET /missions 响应

```json
{
  "resetAt": "2026-04-28T00:00:00Z",
  "daily": [
    {
      "id": "uuid",
      "code": "DAILY_LOGIN",
      "title": "每日登录",
      "description": "登录游戏",
      "target": 1,
      "progress": 1,
      "reward": 100,
      "status": "COMPLETED"
    },
    {
      "id": "uuid",
      "code": "DAILY_HANDS_5",
      "title": "小试牛刀",
      "description": "完成 5 手牌",
      "target": 5,
      "progress": 3,
      "reward": 200,
      "status": "ACTIVE"
    }
  ],
  "weekly": [...]
}
```

---

## 任务进度更新

任务进度在以下事件时更新：

| 事件 | 触发更新 |
|------|----------|
| 用户登录 | DAILY_LOGIN +1 |
| 完成任意手牌 | DAILY_HANDS_5, DAILY_HANDS_20, WEEKLY_HANDS_100 +1 |
| 赢得底池 | DAILY_WIN_POT, WEEKLY_WIN_10 +1 |
| All-in 决策 | DAILY_ALLIN +1 |
| 好友注册成功 | DAILY_FRIEND_INVITE +1 |

---

## 实施要点

1. **定时任务：** 每日 UTC 00:00 重置每日任务
2. **实时更新：** 游戏手牌完成时通过 WebSocket 更新任务进度
3. **通知推送：** 使用现有 `notification/` 模块
4. **数据一致性：** 用户完成最后一手牌时原子更新进度

---

## 成功指标

- DAU 提升 > 15%（对比无任务系统）
- 任务完成率 > 60%
- 平均每日完成 3+ 任务用户占比 > 40%
