# P2-INSURANCE-001 — All-In Insurance 规格文档

**版本:** 1.0
**创建时间:** 2026-05-04
**状态:** 规格就绪，待入 task-queue
**优先级:** P2

---

## 概述

All-In Insurance 是一种可选的博彩保护产品：当玩家在河牌全压（all-in）时，可选择购买"保险"来对冲被爆冷的风险。如果玩家最终输掉该局，保险将按约定比例赔付。

竞品验证：GGPoker（"All-In Insurance"）、888poker（"All-In Cash"）、WSOP（"Insurance"）、CoinPoker 均已实现该功能。本项目为全网第二款实现该功能的产品。

---

## 触发条件

1. 当前阶段 = RIVER（河牌）
2. 玩家执行 ALLIN 操作
3. 底池（pot）≥ 配置阈值（默认：房间盲注的 10 倍，即 $10 / $0.5 = $5）
4. 玩家持有手牌（非空气牌）

---

## 赔付计算

### 关键参数

| 参数 | 值 | 说明 |
|------|-----|------|
| `insuranceRate` | 50% 或 100%（玩家选择） | 保险覆盖比例 |
| `playerEquity` | 由 table-engine 计算 | 玩家手牌 equity（胜率） |
| `netLoss` | `playerBet - settlement` | 玩家净损失（不含已到底池部分） |
| `insurancePayout` | `netLoss × insuranceRate` | 保险赔付额（若爆冷） |

### 公式

```
# 爆冷（玩家输掉牌局）
if (result === 'lose') {
  insurancePayout = netLoss × insuranceRate
  chips += insurancePayout
}

# 赢家（玩家获胜）- 保险费不退还
# 保险费 = netLoss × insuranceRate × (1 - playerEquity) [归入牌桌 rake]
```

### 保险费归属

- 保险费减去赔付后的净额 = 庄家收入（rake）
- 所有保险交易记录写入 `InsuranceTransaction` 表

---

## 用户交互流程

### Step 1: All-In 确认弹窗（河牌阶段）

当玩家点击 ALLIN 时，弹出确认框（现有 AllInConfirmModal）：

```
┌─────────────────────────────────────┐
│  你确定要 ALL-IN 吗？               │
│                                     │
│  当前底池: $127.50                  │
│  你的投入: $85.00                   │
│                                     │
│         [取消]  [确认 ALL-IN]       │
└─────────────────────────────────────┘
```

### Step 2: All-In 确认后 → 保险购买窗口

在玩家确认 ALLIN 之后、广播操作之前，弹出保险窗口（5 秒超时，自动跳过）：

```
┌─────────────────────────────────────────────────┐
│            🛡️ ALL-IN 保险（可选）               │
│                                                 │
│  你的手牌: A♠ K♠                                 │
│  你的胜率: 28.5%                                │
│                                                 │
│  底池: $127.50  你投入: $85.00                  │
│                                                 │
│  ┌─────────────┐    ┌─────────────┐             │
│  │  50% 保险   │    │  100% 保险  │             │
│  │  费用: $12.10│   │  费用: $24.21│             │
│  │  赔付: $31.68│   │  赔付: $63.37│             │
│  └─────────────┘    └─────────────┘             │
│                                                 │
│        [跳过，不购买保险] (5s)                 │
└─────────────────────────────────────────────────┘
```

**超时行为：** 5 秒后自动关闭，玩家不购买保险，游戏继续。

### Step 3: 牌局结算

- 如果玩家输掉牌局：`chips += insurancePayout`，同时生成 `InsuranceTransaction`（type = WIN）
- 如果玩家赢/平牌局：保险费没收，生成 `InsuranceTransaction`（type = LOSE/REFUND）

---

## 牌桌 UI 变化

| 位置 | 变化 |
|------|------|
| 河牌阶段 ALLIN 操作后 | 显示保险购买浮层（5 秒倒计时） |
| 结算时（输牌且购买了保险） | 庄家赔付金额飞入玩家筹码区，绿色 "+$X" 动画 |
| 结算时（赢/平） | 保险费扣除提示（小额扣减，不遮挡结算主界面） |

---

## 后端数据模型

### Prisma 新增 Model

```prisma
model InsuranceTransaction {
  id          String   @id @default(uuid())
  handId      String
  userId      String
  roomId      String
  tableId     String
  rate        Int      // 50 或 100
  fee         BigInt   // 保险费（chips）
  payout      BigInt   // 赔付额（chips，0 if win）
  playerEquity Float   // 购买时计算的 equity
  result      String   // 'WIN' | 'LOSE' | 'REFUND'
  createdAt   DateTime @default(now())

  @@index([handId])
  @@index([userId])
}
```

### 新增字段（TablePlayer）

```prisma
// TablePlayer 上新增可选字段
hasPurchasedInsurance Boolean @default(false)
insuranceRate         Int?
insuranceFee          BigInt?
```

---

## WebSocket 事件

### 服务器 → 客户端（购买窗口）

```ts
// 触发时机：玩家 ALLIN 确认后，河牌最终发牌前
{
  type: 'insurance_offer',
  data: {
    handId: string,
    pot: number,
    playerBet: number,
    playerEquity: number,      // 0.0 - 1.0
    fee50: number,             // 50% 保险费
    payout50: number,          // 50% 赔付额
    fee100: number,            // 100% 保险费
    payout100: number,         // 100% 赔付额
    timeoutMs: number,         // 5000
    holeCards: string[]        // 玩家手牌（用于显示）
  }
}
```

### 客户端 → 服务器

```ts
// 玩家选择购买
{
  type: 'buy_insurance',
  data: {
    handId: string,
    rate: 50 | 100
  }
}

// 玩家跳过
{
  type: 'skip_insurance'
}
```

---

## 后端 API（Admin 报表用）

```
GET /admin/insurance?page=1&limit=20
  → { transactions: InsuranceTransaction[], total }
  → 按时间倒序，支持 handId / userId 筛选

GET /admin/insurance/stats
  → { totalFees, totalPayouts, netRevenue, period }
```

---

## 核心算法（table-engine）

### InsuranceCalculator

```typescript
class InsuranceCalculator {
  /**
   * 计算保险费
   * @param netLoss - 玩家净损失（all-in 投入 - 已赢回的部分）
   * @param equity  - 玩家 equity（0.0 - 1.0）
   * @param rate    - 保险比例（50 或 100）
   */
  static calculateFee(netLoss: number, equity: number, rate: number): BigInt {
    const grossLoss = netLoss * (1 - equity); // 爆冷概率 × 投入
    return Math.floor(grossLoss * (rate / 100));
  }

  /**
   * 计算赔付额
   */
  static calculatePayout(netLoss: number, rate: number): BigInt {
    return Math.floor(netLoss * (rate / 100));
  }
}
```

### 流程集成

```
handlePlayerAction (ALLIN)
  → TableManager.recordInsuranceEligible()
  → [河牌发出后] → InsuranceOfferEmitter
  → [玩家选择/超时] → InsuranceRecorder
  → [showdown] → SettlementRunner 读取 InsuranceTransaction
  → 按 netLoss 计算赔付
```

---

## 配置项

| 配置 | 键 | 默认值 | 说明 |
|------|-----|--------|------|
| 最低触发底池 | `INSURANCE_MIN_POT_MULTIPLIER` | 10× 大盲 | $0.5/$1 → $10 |
| 窗口超时 | `INSURANCE_OFFER_TIMEOUT_MS` | 5000 | 5 秒 |
| 最大保险比例 | `INSURANCE_MAX_RATE` | 100 | % |
| 保险 Rake | `INSURANCE_RAKE_PERCENT` | 5 | 保险费净额抽 5% |

---

## 限制与边界

1. **每人每局仅一次：** 同一局不能重复购买
2. **仅限主池：** Side pot 不参与保险
3. **straddle 不参与保险：** straddle 视为正常投入，纳入 netLoss
4. **All-In vs All-In：** 双方都有 insurance 时，各自独立计算
5. **提前亮牌：** 若所有玩家在河牌前 all-in，保险窗口跳过，直接进入 showdown

---

## 验收标准

- [ ] 河牌阶段玩家 ALLIN → 弹出保险窗口，5 秒超时自动跳过
- [ ] 50% / 100% 两档正确计算 fee 和 payout
- [ ] 玩家爆冷输牌 → 保险赔付正确到账
- [ ] 玩家赢/平牌局 → 保险费正确没收
- [ ] Admin 报表可查询所有 InsuranceTransaction
- [ ] 保险不影响正常 showdown 流程
- [ ] 单元测试覆盖 InsuranceCalculator

---

## 竞品参考

| 平台 | 功能名 | 最大保险比例 | 赔付速度 |
|------|--------|-------------|---------|
| GGPoker | All-In Insurance | 100% | 即时 |
| 888poker | All-In Cash | 50% | 即时 |
| WSOP | Insurance | 100% | 即时 |
| CoinPoker | All-In Protection | 50% | 牌局结束后 |

---

_规格创建: Productor — 2026-05-04_
