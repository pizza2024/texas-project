# 牌桌属性说明

本文档梳理了 Texas Hold'em 系统中所有牌桌/房间相关属性，并注明其来源、默认值、可配置范围及后续规划。

---

## 一、房间级属性（持久化到数据库 `rooms` 表）

| 属性 | 类型 | 默认值 | 可配范围 | 说明 |
|---|---|---|---|---|
| `name` | `string` | `Table <random>` | 1–30 字符 | 房间显示名称 |
| `blindSmall` | `number` | `10` | `1 ~ 9999` | 小盲注金额 |
| `blindBig` | `number` | `20` | `≥ 2 × blindSmall` | 大盲注金额（通常为小盲 2 倍） |
| `maxPlayers` | `number` | `9` | `2 ~ 9` | 最大座位数 |
| `minBuyIn` | `number` | `= blindBig` | `≥ blindBig` | 入房最低余额门槛（0 表示退回默认值 = bigBlind） |

### 入房资金门槛（`minBuyIn`）

- 玩家加入房间前，余额必须 **≥ `room.minBuyIn`**（创建时可自定义，默认等于大盲注）。
- 余额不足时前端阻止入房，后端二次校验并发 `insufficient_balance` 事件。

---

## 二、服务端全局计时常量（当前版本硬编码）

> 位于 `apps/backend/src/websocket/app.gateway.ts`

| 常量 | 当前值 | 说明 |
|---|---|---|
| `ACTION_DURATION_MS` | `20000` ms（20 s） | 玩家行动超时时间；超时后优先自动过牌，否则弃牌 |
| `SETTLEMENT_DURATION_MS` | `5000` ms（5 s） | 结算界面停留时长 |
| `READY_COUNTDOWN_MS` | `5000` ms（5 s） | 全员准备后的自动开局倒计时 |

**后续规划**：将上述计时常量迁移到房间配置中，支持逐房间自定义。

---

## 三、运行时牌桌状态（内存维护，不可用户配置）

> 位于 `apps/backend/src/table-engine/table.ts` `Table` 类

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 牌桌唯一 ID（与数据库 `tables.id` 对应） |
| `roomId` | `string` | 所属房间 ID |
| `currentStage` | `GameStage` | 当前牌局阶段（WAITING / PREFLOP / FLOP / TURN / RIVER / SHOWDOWN / SETTLEMENT） |
| `pot` | `number` | 当前局底池总额 |
| `currentBet` | `number` | 本轮最高下注额 |
| `minBet` | `number` | 本轮最小加注增量（初始 = `bigBlind`） |
| `communityCards` | `string[]` | 公共牌（最多 5 张） |
| `deck` | `string[]` | 剩余牌堆（洗牌后内存保存） |
| `dealerIndex` | `number` | 庄家按钮位座位索引 |
| `activePlayerIndex` | `number` | 当前行动玩家座位索引 |
| `lastHandResult` | `object[] \| null` | 上一局结果（获胜信息、手牌名称等） |
| `actionEndsAt` | `Date \| null` | 当前行动玩家的行动截止时间 |
| `settlementEndsAt` | `Date \| null` | 结算阶段结束时间 |
| `readyCountdownEndsAt` | `Date \| null` | 自动开局倒计时截止时间 |

---

## 四、玩家座位状态（运行时，不可用户配置）

> 位于 `apps/backend/src/table-engine/player.ts`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 用户 ID |
| `nickname` | `string` | 显示名称 |
| `avatar` | `string \| null` | 头像 URL |
| `stack` | `number` | 桌面筹码（入座时从钱包读取，离座时回写） |
| `bet` | `number` | 本轮已下注额 |
| `totalBet` | `number` | 本局累计已投入额 |
| `cards` | `string[]` | 手牌（2 张，非 SHOWDOWN/SETTLEMENT 阶段对其他玩家隐藏） |
| `status` | `PlayerStatus` | 玩家状态（ACTIVE / FOLD / ALLIN / SITOUT） |
| `ready` | `boolean` | 是否已准备好开新局 |
| `hasActed` | `boolean` | 本轮是否已行动（用于判断投注轮结束） |
| `isButton` | `boolean` | 是否为庄家按钮位 |
| `isSmallBlind` | `boolean` | 是否为小盲位 |
| `isBigBlind` | `boolean` | 是否为大盲位 |

---

## 五、快照持久化（`tables.stateSnapshot`）

牌桌内存状态定期序列化为 JSON 存入 `tables.stateSnapshot`，服务重启后可从快照恢复进行中的牌局并补建定时器。

---

## 六、后续规划的可配属性

| 属性 | 规划说明 |
|---|---|
| `actionTimeoutMs` | 每位玩家的行动超时时长（目前全局硬编码 20s） |
| `minPlayers` | 开局所需最少玩家数（目前硬编码为 2） |
| `startingStack` | 入座初始筹码量（目前直接读玩家钱包余额） |
| `anteAmount` | 底注金额（目前暂未实现） |
| `allowRebuy` | 是否允许重新买入 |
| `maxBuyIn` | 最大买入金额上限 |
