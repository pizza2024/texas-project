# P1-FIRST-DEPOSIT — 首充奖金规格

**版本:** 1.0
**优先级:** P1
**状态:** 规格草稿
**参考竞品:** GGPoker、WSOP、888poker 首充奖励

---

## 概述

新用户首次充值时，平台赠送首充金额的匹配奖金（100% match），用于提升付费转化率。

---

## 核心规则

### 匹配规则

| 字段 | 值 |
|------|-----|
| 匹配比例 | 100%（首充多少，赠送多少） |
| 最高赠送 | 50 USDT |
| 最低触发 | 10 USDT |
|  wagering requirement | 30x（必须下注 30 倍才能提现赠送部分）|

**示例：**
- 用户充值 10 USDT → 获得 10 USDT 奖金（总计 20 USDT 可用）
- 用户充值 50+ USDT → 获得 50 USDT 奖金（总计 100 USDT 可用）

### 资格判断

- 仅首次充值享受此优惠（`User.isFirstDeposit = false` → `true`）
- 每个用户仅限一次
- 充值后立即发放奖金到钱包（chips）

### Wagering Requirement（打码量要求）

| 字段 | 值 |
|------|-----|
| 赠送金额 | 锁定不可提现 |
| 打码倍数 | 30x（首充金额） |
| 允许游戏 | 所有德州扑克房间 |
| 超时 | 30 天内未完成打码，回收赠送部分 |

**示例：**
- 用户首充 20 USDT，获得 20 USDT 奖金
- 需完成 20 × 30 = 600 USDT 的有效下注
- 有效下注 = FOLD/CALL/RAISE/STRADDLE，不含 BLIND

---

## 用户流程

### 充值页面 UI

1. **首充标识：** 首次充值用户显示「首充 100% 奖金」横幅
2. **金额选择：** 快捷按钮 $10 / $20 / $50 / $100 + 自定义输入
3. **实时计算：** 显示「充值 X USDT → 获得 Y USDT 奖金」
4. **Wagering 提示：** 显示「需完成 30x 打码（约 Z 手牌）」
5. **倒计时：** 显示bonus到期时间（30天）
6. **确认充值：** 确认按钮 → 链上转账 → 奖金自动发放

### 站内信通知

- 充值成功后发送站内信：「恭喜获得首充奖金！」
- 打码量进度（每完成 10% 通知一次）
- 倒计时 7 天 / 3 天 / 1 天提醒

---

## 数据库模型

```prisma
model User {
  id              String   @id @default(uuid())
  isFirstDeposit  Boolean  @default(false)
  firstDepositAt  DateTime?
  createdAt       DateTime @default(now())
}

model DepositBonus {
  id              String   @id @default(uuid())
  userId          String
  depositAmount   Int      // 分
  bonusAmount     Int      // 分
  wageringReq     Int      // 所需打码量（分）
  wageringDone    Int      @default(0)  // 已完成打码量
  expiresAt       DateTime
  completedAt     DateTime?
  status          BonusStatus @default(PENDING)
  createdAt       DateTime @default(now())
}

enum BonusStatus {
  PENDING    // 待激活
  ACTIVE      // 进行中
  COMPLETED   // 已完成（打码量达标）
  EXPIRED     // 已过期
}
```

---

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /deposit/bonus-status | 获取当前用户首充bonus状态 |
| POST | /deposit | 充值（自动判断是否触发首充bonus） |
| GET | /deposit/bonus-progress | 打码量进度 |

### GET /deposit/bonus-status 响应

```json
{
  "eligible": true,
  "depositAmount": 0,
  "maxBonus": 5000,
  "wageringMultiplier": 30,
  "expiresAt": null
}
```

### POST /deposit 响应（含bonus）

```json
{
  "depositId": "uuid",
  "amount": 2000,
  "chips": 4000,
  "bonus": {
    "amount": 2000,
    "wageringReq": 60000,
    "wageringDone": 0,
    "expiresAt": "2026-05-27T00:00:00Z"
  }
}
```

---

## 实施要点

### 事务原子性

- 充值和奖金发放必须在同一事务中完成
- `DepositRecord` 和 `DepositBonus` 同时创建

### 打码量追踪

- 每次玩家 FOLD/CALL/RAISE/STRADDLE 时（非 BLIND）增加 `wageringDone`
- 奖金状态自动从 ACTIVE → COMPLETED
- 每日定时任务检查过期 bonus（30 天），过期则回收赠送金额

### 风险控制

- 大额充值（> 500 USDT）需要额外验证
- 反洗钱合规检查

---

## 成功指标

- 首充转化的付费用户占比 > 25%
- 平均首充金额 > 25 USDT
- 30 天内完成打码量的用户占比 > 40%
