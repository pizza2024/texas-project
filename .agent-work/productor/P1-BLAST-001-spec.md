# P1-BLAST-001 — Blast 即时赛事规格

**版本:** 1.0
**优先级:** P1
**状态:** 规格草稿
**参考竞品:** GGPoker Spin & Gold

---

## 概述

Blast 是极速即时赛事，3 名玩家即时匹配，随机奖池倍数（最高 50,000X），约 3 分钟完成一场。

---

## 核心机制

### 参赛

| 字段 | 值 |
|------|-----|
| 参赛人数 | 3 人（满 3 人即开赛） |
| 最长等待 | 30 秒（超时取消报名并退款） |
| 报名费 | $1, $3, $7, $20, $50, $100 |
| 初始筹码 | 500 大盲 |

### 奖池轮盘

报名完成后、比赛开始前，显示轮盘旋转动画，最终停在一个倍数：

| 倍数区间 | $1 场 | $3 场 | $7 场 | $20 场 | $50 场 | $100 场 |
|----------|-------|-------|-------|--------|--------|---------|
| 1-2X | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3-5X | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 10X | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 25X | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 100X | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 1,000X | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5,000X | — | — | ✅ | ✅ | ✅ | ✅ |
| 10,000X | — | — | — | ✅ | ✅ | ✅ |
| 50,000X | — | — | — | — | ✅ | ✅ |

**示例：** $50 报名 × 50,000X = $1,000,000 奖池

### 赛制

- **时长上限：** 3 分钟（超时自动 all-in 决胜）
- **盲注结构：** 2 分钟加速（每 30 秒涨盲）
- **重买：** 不允许
- **延迟注册：** 不允许

### 胜负规则

1. 最后存活玩家获胜，获得全部奖池
2. 如超时，剩余玩家 all-in，手牌大者获胜

---

## UI/UX 要求

### 轮盘动画

- 3D 轮盘旋转 3-5 秒
- 倍数从高到低递减速动
- 最高倍数时增加特效（光效 + 粒子）
- 显示最终倍数数字放大动画

### 匹配等待

- 倒计时显示（30 秒超时）
- 显示当前已报名人数（X/3）
- 超时可取消报名并自动退款

### 赛事大厅

- Tab: 全部 / $1 / $3 / $7 / $20 / $50 / $100
- 每个级别显示：当前等待人数、平均等待时间
- 显示当前可参与的赛事数量

### 赛事详情弹窗

- 奖池倍数分布表
- 历史大奖案例（近期大奖池截图）
- 规则说明

---

## 数据库模型扩展

```prisma
enum TournamentType {
  SNG        // 单桌赛
  MTT        // 多桌赛
  BLAST      // 即时赛事
}

model Tournament {
  id          String   @id @default(uuid())
  type        TournamentType @default(SNG)
  buyin       Int      // 报名费（分）
  prizePool   Int?     // 固定奖池（分），BLAST 为 null
  maxPlayers  Int      @default(3)
  state       TournamentState
  multiplier  Int?     // BLAST 随机倍数
  startTime   DateTime?
  endTime     DateTime?
  createdAt   DateTime @default(now())
}

model BlastSpin {
  id            String   @id @default(uuid())
  tournamentId  String
  playerId      String
  multiplier    Int      // 随机到的倍数
  timestamp     DateTime @default(now())
}
```

---

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /tournaments/blast | 创建 BLAST 赛事 |
| GET | /tournaments/blast/lobbies | 各级别等待人数 |
| POST | /tournaments/blast/:id/join | 加入 BLAST 赛事 |
| GET | /tournaments/blast/:id | 赛事详情（含倍数） |

---

## WebSocket 事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `blast-spin-result` | Server→Client | 轮盘结果（倍数） |
| `blast-match-found` | Server→Client | 匹配成功，开赛通知 |

---

## 实施优先级

1. **Phase 1（当前）：** 数据库模型 + 基础 API（参考 P1-TOURNAMENT-001）
2. **Phase 2：** 轮盘 UI + 动画
3. **Phase 3：** 3 人即时匹配逻辑
4. **Phase 4：** 赛事大厅 + 等待 UX

---

## 成功指标

- BLAST 赛事参与率 > 30%（对比常规 SNG）
- 平均赛事时长 < 3.5 分钟
- 轮盘动画完播率 > 90%
