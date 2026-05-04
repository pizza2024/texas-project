# P2-FAST-FOLD — Fast-Fold（快速弃牌）规格文档

**版本:** 1.0
**创建时间:** 2026-05-04
**状态:** 规格就绪，待入 task-queue
**优先级:** P2

---

## 概述

Fast-Fold（快速弃牌）是一种高人气游戏模式，玩家可以在任何时刻立即弃牌并自动换到下一张牌桌，显著提升游戏节奏和每小时局数（hands per hour）。

竞品验证：888poker（"SNAP Poker"）、CoinPoker（"Quicker Seats"）、GGPoker（"Fast-Fold"）、PartyPoker（"FastForward"）均已实现该功能。

---

## 核心概念

Fast-Fold 允许玩家在不等待当前牌局结束的情况下，立即弃牌并加入另一张牌桌的等待队列。系统自动匹配并重新发牌。

---

## 用户交互流程

### Step 1: 激活 Fast-Fold

玩家在任意阶段（翻牌前/翻牌/转牌/河牌）点击"快速弃牌"按钮：

```
┌──────────────────────────────────┐
│  ⚡ 快速弃牌 (Fast-Fold)         │
│                                  │
│  弃牌后立即加入新牌桌等待队列    │
└──────────────────────────────────┘
```

按钮位置：ActionBar（与 Fold 按钮并排），仅在玩家有手牌且未 all-in 时可见。

### Step 2: 即时弃牌 + 加入队列

玩家点击后：

1. 当前手牌立即标记为 FOLD（弃牌）
2. 玩家从当前牌桌移除
3. 玩家加入 Fast-Fold 匹配队列（Redis sorted set，按 ELO 排序）
4. 系统立即尝试分配到另一张等待中的牌桌
5. 若 30 秒内无匹配，玩家进入"等待"状态（可取消）

### Step 3: 新牌桌发牌

玩家被分配到新牌桌后：
- 直接进入 DEALING 状态
- 收到 hole cards（新的一手牌）
- 显示"换桌了！"提示（toast 通知，2 秒自动消失）

---

## 匹配规则

| 规则 | 说明 |
|------|------|
| ELO 范围 | ±150 ELO 分（可配置） |
| 房间层级 | 同层级（MICRO→PREMIUM） |
| 盲注级别 | 同房间盲注 |
| 人数 | 仅加入等待中的牌桌（players.length < maxPlayers） |

---

## 队列管理

### Redis 数据结构

```
Key: fastfold:queue:{roomTier}
Type: Sorted Set
Score: ELO rating
Member: { userId, joinedAt }
```

### 队列优先级

| 条件 | 优先级调整 |
|------|-----------|
| 等候时间 > 15s | ELO 范围扩大到 ±300 |
| 等候时间 > 30s | ELO 范围扩大到 ±500，跳级匹配 |

### 队列超时

- 玩家在队列中最多等待 **60 秒**
- 超时后返回原牌桌（若牌局仍在进行中）或房间列表

---

## 特殊规则

| 规则 | 说明 |
|------|------|
| 不能 all-in 时使用 | 玩家 all-in 后不能 Fast-Fold |
| 不能 straddle 时使用 | straddle 状态不可 Fast-Fold |
| 仅旁观者可用 | 新加入的玩家需等待当前牌局结束后才能 Fast-Fold |
| 不适用锦标赛 | SNG/MTT 模式下禁用 Fast-Fold |
| 不计入活跃游戏 | Fast-Fold 不视为"逃跑"，不触发 sit-out |

---

## WebSocket 事件

### 客户端 → 服务器

```typescript
// 快速弃牌
{
  type: 'fast_fold'
}

// 取消快速匹配
{
  type: 'cancel_fast_fold'
}
```

### 服务器 → 客户端

```typescript
// 匹配成功
{
  type: 'fast_fold_matched',
  data: {
    tableId: string,
    roomId: string,
    seatIndex: number,
    message: '换桌成功'
  }
}

// 匹配中
{
  type: 'fast_fold_queued',
  data: {
    queuePosition: number,
    estimatedWaitSeconds: number
  }
}

// 匹配超时
{
  type: 'fast_fold_timeout',
  data: {
    returnedToTableId: string | null
  }
}
```

---

## UI 变化

### ActionBar 按钮

```tsx
{/* 现有 Fold 按钮旁添加 */}
<button
  onClick={handleFastFold}
  disabled={isAllIn || isStraddle || !hasHoleCards}
  className="flex items-center gap-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-400 text-black rounded"
>
  <BoltIcon className="w-4 h-4" />
  快速弃牌
</button>
```

### Toast 提示

| 场景 | 文案 | 时长 |
|------|------|------|
| 加入队列 | "快速匹配中..." | 持续 |
| 匹配成功 | "⚡ 换到新牌桌！" | 2s |
| 匹配超时 | "未找到合适牌桌，返回当前桌" | 3s |

---

## 后端改动

### TableEngine 新增方法

```typescript
class TableManager {
  /**
   * 处理快速弃牌
   * 1. 立即标记玩家 FOLD
   * 2. 从牌桌移除玩家
   * 3. 加入 Fast-Fold 队列
   */
  async fastFold(tableId: string, playerId: string): Promise<FastFoldResult>;

  /**
   * 从队列分配玩家到等待牌桌
   */
  async assignFromQueue(tableId: string): Promise<number>; // 返回分配人数
}
```

### MatchmakingService 扩展

```typescript
// 新增 fastFold 相关方法
assignFromFastFoldQueue(roomTier: string, tableId: string): Promise<string[]>;
expandSearchCriteria(userId: string): Promise<void>; // 超时后放宽 ELO 限制
```

---

## 配置项

| 配置 | 键 | 默认值 | 说明 |
|------|-----|--------|------|
| 基础 ELO 匹配范围 | `FASTFOLD_ELO_RANGE` | 150 | ±150 ELO |
| 扩展 ELO 范围（15s+） | `FASTFOLD_ELO_RANGE_EXPANDED` | 300 | 等待 15 秒后 |
| 最大 ELO 范围（30s+） | `FASTFOLD_ELO_RANGE_MAX` | 500 | 等待 30 秒后 |
| 队列超时 | `FASTFOLD_QUEUE_TIMEOUT_MS` | 60000 | 60 秒 |
| 最高同时匹配人数 | `FASTFOLD_BATCH_SIZE` | 6 | 每批次匹配人数 |
| 最低触发人数 | `FASTFOLD_MIN_WAITING` | 2 | 队列中至少 N 人才触发匹配 |

---

## 限制与边界

1. **Blast 模式禁用：** Blast 是独立的快速游戏模式，与 Fast-Fold 不兼容
2. **Solo 模式禁用：** Solo 模式（一个人玩的练习模式）禁用 Fast-Fold
3. **玩家 all-in 中：** 玩家 all-in 后被锁定，不能 Fast-Fold
4. **straddle 状态：** straddle 玩家不能 Fast-Fold
5. **锦标赛禁用：** SNG/MTT 模式禁用
6. **私人房间：** 私人房间默认禁用 Fast-Fold（房主可开启）

---

## 验收标准

- [ ] 玩家点击"快速弃牌"→ 立即弃牌并加入队列
- [ ] 队列中玩家按 ELO 正确匹配到等待牌桌
- [ ] 匹配成功 → 玩家立即进入新牌桌并收到新手牌
- [ ] 30 秒无匹配 → 显示超时提示，返回原牌桌或房间列表
- [ ] all-in / straddle 状态下按钮不可用
- [ ] Blast / MTT 模式下按钮隐藏
- [ ] 单元测试覆盖 FastFoldQueueManager

---

## 竞品参考

| 平台 | 功能名 | ELO 匹配 | 最高 HPH | 特色 |
|------|--------|---------|---------|------|
| 888poker | SNAP Poker | ±200 | ~450 | 牌桌快照系统 |
| CoinPoker | Quicker Seats | ±150 | ~400 | 自动换桌 |
| GGPoker | Fast-Fold | ±200 | ~500 | 无缝衔接 |
| PartyPoker | FastForward | ±300 | ~600 | 多桌并行 |

---

_规格创建: Productor — 2026-05-04_
