# P2-BADBEAT-001 — Bad Beat Jackpot 规格文档

**版本:** 1.0
**创建时间:** 2026-05-04
**状态:** 规格就绪，待入 task-queue
**优先级:** P2

---

## 概述

Bad Beat Jackpot（爆冷 jackpot）是一种牌桌共享的奖金池。当满足特定条件的"爆冷"牌局结束时（强力手牌被更强手牌击败），牌桌上的所有玩家按比例分享 jackpot 奖金。

**爆冷定义：** 在 showdown 中，手牌满足"资格牌型"的玩家（输家）输给满足"获奖牌型"的玩家（赢家）。

竞品验证：BetOnline Poker（Bad Beat Jackpot）、CoinPoker（Bad Beat Jackpot）均已实现。本项目为业界领先实现。

---

## 触发条件

### 牌型资格

| 条件 | 值 | 说明 |
|------|-----|------|
| 输家手牌 | 四条（Quads）或更大 | 必须四条或更高 |
| 赢家手牌 | 四条（Quads）或更大 | 必须四条或更高，且比输家更大 |
| 底池大小 | ≥ $100 | 必须超过最低底池门槛 |

**组合可能性（Texas Hold'em 5 张牌型）：**

- 输家四条（Quads）→ 赢家四条更大 / 葫芦 / 同花顺 / 同花大顺
- 输家葫芦（Full House）→ 赢家葫芦更大 / 四条 / 同花顺 / 同花大顺
- 输家同花（Flush）→ 赢家同花更大 / 同花顺 / 同花大顺
- 输家顺子（Straight）→ 赢家顺子更大 / 同花顺 / 同花大顺

### 牌局条件

1. 至少一名玩家在翻牌前或翻牌阶段 all-in
2. 底池 ≥ $100
3. 必须 showdown（所有玩家亮牌），不能是 fold 获胜
4. 输家和赢家都必须使用各自的 hole cards（不能只用公共牌）

---

## 奖金分配

### 分配比例

| 接收方 | 比例 | 说明 |
|--------|------|------|
| 输家（Bad Beat） | **50%** | 爆冷的受害者 |
| 赢家（Winner） | **25%** | 制造爆冷的幸运儿 |
| 牌桌其他玩家 | **25%** | 当时在桌上的所有玩家（无论是否参与该局） |

### 最低触发金额

| 奖项 | 最低分配 | 说明 |
|------|----------|------|
| 输家 | $50 | 50% × $100 minimum |
| 赢家 | $25 | 25% × $100 minimum |
| 牌桌其他 | 合计 $25 | 25% ÷ 其他玩家数 |

### 示例

假设 Bad Beat Jackpot = $50,000，10 人桌（8 名旁观者）：

```
Jackpot = $50,000
- 底池 = $340（正常结算）

分配：
输家 = $25,000
赢家 = $12,500
牌桌其他 8 人 = $12,500（每人 $1,562.50）
```

---

## 用户交互流程

### Step 1: 触发检测（showdown 后）

在 showdown 流程中，table-engine 检测是否满足 Bad Beat 条件：

```typescript
// showdown.ts
if (isBadBeat(handResult)) {
  await recordBadBeatJackpot(handResult);
}
```

### Step 2: 广播通知（所有在场玩家）

所有在场玩家（包括旁观者）看到特殊动画：

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│           🎰 BAD BEAT JACKPOT 🎰                          │
│                                                          │
│    "A♠ A♥ A♣ 7♠ 7♦" 被 "A♠ A♥ A♣ A♦ 2♠" 爆冷！        │
│                                                          │
│    底池: $340   Jackpot: $50,000                        │
│                                                          │
│    🏆 输家 @player_alice:  +$25,000                     │
│    🌟 赢家 @player_bob:     +$12,500                     │
│    👥 其他玩家:            +$1,562.50/人                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

动画：3-5 秒全屏金色光效 + 筹码雨特效，类似于 Blast SpinWheel 结算。

### Step 3: 筹码入账

Jackpot 分配通过 `Settlement` + `Transaction` 写入 DB，与正常结算并行执行。

---

## 后端数据模型

### Prisma 新增 Model

```prisma
model BadBeatJackpot {
  id          String   @id @default(uuid())
  handId      String   @unique
  tableId     String
  roomId      String
  jackpotAmount BigInt  // 当前 jackpot 总池
  loserId     String   // 爆冷输家
  loserHand   String   // 输家手牌描述
  winnerId    String   // 爆冷赢家
  winnerHand  String   // 赢家手牌描述
  netLoss     BigInt   // 输家净损失（用于计算分配）
  createdAt   DateTime @default(now())

  @@index([handId])
  @@index([tableId])
}

model BadBeatPayout {
  id          String   @id @default(uuid())
  jackpotId   String
  userId      String
  type        String   // 'LOSER' | 'WINNER' | 'TABLE_PLAYER'
  amount      BigInt   // 分配金额
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([jackpotId])
}
```

### 新增字段（Room）

```prisma
// Room 上新增可选字段
badBeatJackpotEnabled  Boolean @default(true)
currentJackpotAmount   BigInt  @default(0)  // 累积的 jackpot
```

---

## Jackpot 累积规则

### 累积来源

每次 showdown 结算时，从底池抽取一小部分（rake）注入 Jackpot：

| 来源 | 比例 | 说明 |
|------|------|------|
| 底池 rake | 每次 showdown 抽取 1% | 最高 $1/局 |
| 专用费 | 每个买入房间每局额外 $0.10 | Jackpot 维护费 |

### 累积公式

```
Jackpot += min(pot × 0.01, $1) + $0.10
```

### 重置（Recycle）

Jackpot 触发后，池子重置为初始金额：

| 房间层级 | 初始重置金额 |
|----------|-------------|
| MICRO | $500 |
| LOW | $1,000 |
| MEDIUM | $2,500 |
| HIGH | $5,000 |
| PREMIUM | $10,000 |

---

## WebSocket 事件

### 服务器 → 所有在场玩家（包括观战者）

```typescript
// 触发时机：showdown 结算完成后
{
  type: 'bad_beat_jackpot',
  data: {
    handId: string,
    jackpotAmount: number,
    pot: number,
    loser: {
      userId: string,
      nickname: string,
      hand: string,       // 如 "A♠ A♥ A♣ A♦ 7♦"
      netLoss: number,
      payout: number,
    },
    winner: {
      userId: string,
      nickname: string,
      hand: string,
      payout: number,
    },
    tablePlayers: Array<{
      userId: string,
      nickname: string,
      payout: number,    // 旁观者分配
    }>,
    animationDurationMs: number,  // 5000
  }
}
```

---

## 后端 API（Admin 报表用）

```
GET /admin/badbeat?page=1&limit=20
  → { jackpots: BadBeatJackpot[], total }
  → 按时间倒序，支持 handId / userId 筛选

GET /admin/badbeat/stats
  → { totalJackpots, totalPayouts, averageJackpot, lastTriggered }

GET /admin/badbeat/current
  → { [roomId]: { enabled, currentAmount, lastHit } }
```

---

## 核心算法（table-engine）

### BadBeatDetector

```typescript
interface BadBeatResult {
  triggered: boolean;
  loserHandType: HandType;  // 'QUADS' | 'FULL_HOUSE' | 'FLUSH' | 'STRAIGHT'
  winnerHandType: HandType;
  eligible: {
    loserId: string;
    loserHand: string[];
    winnerId: string;
    winnerHand: string[];
    netLoss: number;
  } | null;
}

const BAD_BEAT_MIN_HAND = 'QUADS';  // 四条起
const BAD_BEAT_MIN_POT = 100;       // $100

function isBadBeat(
  showdownResult: ShowdownResult,
  handRanker: HandEvaluator
): BadBeatResult {
  // 1. 找到 showdown 中最大赢家和最大输家（按 hand rank）
  // 2. 赢家必须 >= QUADS
  // 3. 输家必须 >= QUADS 且输家手牌 < 赢家手牌
  // 4. 底池 >= BAD_BEAT_MIN_POT
  // 5. 双方都使用 hole cards（不是纯公共牌获胜）
  // 6. 至少一方翻牌前/翻牌 all-in
}
```

### JackpotDistributor

```typescript
async function distributeJackpot(
  jackpot: BadBeatJackpot,
  allocations: { loser: number; winner: number; tablePlayers: number[] }
): Promise<void> {
  await prisma.$transaction([
    // 1. 创建 BadBeatJackpot 记录
    prisma.badBeatJackpot.create({ ... }),
    // 2. 创建 3 类 BadBeatPayout 记录
    prisma.badBeatPayout.createMany({ data: [...] }),
    // 3. 写入 Settlement + Transaction（与正常结算并行，不阻塞）
    prisma.settlement.createMany({ data: [...] }),
    // 4. 重置 Room.currentJackpotAmount
    prisma.room.update({ where: { id: roomId }, data: { currentJackpotAmount: resetAmount } }),
  ]);
}
```

---

## UI 设计规范

### 触发特效（全桌广播）

| 元素 | 规范 |
|------|------|
| 背景 | 全屏半透明黑色遮罩 + 金色粒子雨 |
| 主文案 | 居中大字 "BAD BEAT JACKPOT"，字体：粗体 + 金色 (#FFD700) |
| 动画时长 | 3-5 秒，自动淡出 |
| 音效 | 建议：Coins falling sound（参考 Blast SpinWheel 音效） |
| 关闭 | 点击任意位置或超时自动关闭 |

### 旁观者视角

旁观者看到相同动画，但没有"输家/赢家"高亮，只显示"恭喜桌上所有玩家获得 Bad Beat 分红"。

---

## 配置项

| 配置 | 键 | 默认值 | 说明 |
|------|-----|--------|------|
| 最低触发底池 | `BADBEAT_MIN_POT` | $100 | 底池小于此值不触发 |
| 最低触发手牌 | `BADBEAT_MIN_HAND` | QUADS | 四条或更大 |
| 输家分配 | `BADBEAT_LOSER_PERCENT` | 50 | % |
| 赢家分配 | `BADBEAT_WINNER_PERCENT` | 25 | % |
| 桌其他玩家 | `BADBEAT_TABLE_PERCENT` | 25 | % |
| 底池抽取比例 | `BADBEAT_RAKE_PERCENT` | 1 | % |
| 最高抽取金额 | `BADBEAT_RAKE_MAX` | 100 | cents/局 |
| Jackpot 重置基数 | `BADBEAT_RESET_BASE` | 1000 | 按房间层级分级 |

---

## 限制与边界

1. **仅限 Hold'em：** 不支持 Omaha/Short Deck
2. **必须 showdown：** Fold 获胜不触发
3. **仅公共牌获胜：** 若赢家只用 5 张公共牌组成最大牌型，不触发（需要至少一张 hole card）
4. **straddle 不影响触发判断**
5. **多轮 all-in：** 只要有一轮满足 all-in 条件即可
6. **Jackpot 不影响正常结算：** Jackpot 分配与 pot 结算并行

---

## 验收标准

- [ ] 满足条件时 showdown 触发 Bad Beat 广播（所有在场玩家可见）
- [ ] 输家/赢家/旁观者分配比例正确
- [ ] Jackpot 正确累积（每次 showdown 1% rake，最高 $1）
- [ ] 触发后 Jackpot 重置到初始金额
- [ ] Admin 报表可查询所有 BadBeatJackpot 和 BadBeatPayout
- [ ] Bad Beat 动画 3-5 秒内正确展示
- [ ] 旁观者（spectators）收到同等动画但无输家/赢家标识
- [ ] 单元测试覆盖 BadBeatDetector

---

## 竞品参考

| 平台 | 功能名 | 触发手牌 | 分配比例 | 最低底池 |
|------|--------|---------|---------|---------|
| BetOnline Poker | Bad Beat Jackpot | 两个三条起 | 输家 50% / 赢家 25% / 桌 25% | $20 |
| CoinPoker | Bad Beat Jackpot | 四条起 | 输家 50% / 赢家 25% / 桌 25% | $50 |
| 888poker | Jackpot SNAP | 无特定手牌 | 按 ticket 抽奖 | - |

---

_规格创建: Productor — 2026-05-04_
