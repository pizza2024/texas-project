# Productor Latest — 第271轮

**时间:** 2026-04-28 00:30
**HEAD:** `770ddcf` — 0 P0 / 0 P1 / ~4 P2 ✅

---

## 系统状态

- **HEAD:** `770ddcf` — P2-CHAT-IDEMPOTENCY 已修复（Redis SET NX EX 60，clientMessageId 去重）
- **测试:** 30 suites / 369 tests ✅
- **P2:** ~4 项（详见 task-queue.md）

---

## 本轮调研 — Tournament UI 竞品分析与改进建议

### TournamentCard 竞品对比

| 字段 | GGPoker | PokerStars | 本项目 | 优先级 |
|------|---------|------------|--------|--------|
| 总奖池 | ✅ GTD 显示 | ✅ 显示 | ❌ 缺失 | **P1** |
| 当前注册人数 | ✅ 实时 | ✅ 实时 | ❌ 缺失 | **P2** |
| 奖励圈人数 | ✅ 显示 | ✅ 显示 | ❌ 缺失 | P2 |
| 升盲时间表 | ✅ 可展开 | ✅ 可展开 | ❌ 缺失 | P3 |

### 手牌复盘 ReplayModal Phase 2 评估

| 组件 | 功能 | 状态 |
|------|------|------|
| EquityCurveChart | equity 曲线 | ✅ |
| PotOddsTooltip | 悬停赔率 | ✅ |
| PlaybackControls | 播放控制 | ✅ |
| SpeedSelector | 速度选择 | ✅ |
| AutoPlayPanel | 自动播放 | ✅ |
| ReplayActionLog | 操作时间线 | ✅ |

**改进建议：**
- P2: 手牌复盘"分享"功能（GGPoker/PokerStars 均有）
- P2: SHOWDOWN 阶段显示胜率百分比

---

## P2 状态

| ID | 描述 | 状态 |
|----|------|------|
| P2-CHAT-IDEMPOTENCY | 聊天幂等键 | ✅ 已修复 (770ddcf) |
| P2-TOURNAMENT-SPEC | Tournament spec | ✅ 已完成 (1ac7258) |
| P2-WALLET-SPEC | Wallet spec | ✅ 已完成 (1ac7258) |
| P2-WEB-SPEC | Web 测试覆盖 | 🟡 部分完成 |
| P2-WS-RATE-UNIT | 时间单位注释混淆 | 🔍 待认领 |
| P2-CODE-PATTERN | Promise.all 优化 | 🔍 待认领 |
| P2-ROOM-RETRY | 重试无指数退避 | 🔍 待认领 |

---

## 下轮调研

1. **P1-PRIZE-DISPLAY** — TournamentCard 奖池金额 + GTD 标签规格
2. **Blast/SPINS** — GGPoker SPINS 3人即开型奖池机制详细规格
3. **CoinPoker 链上验证** — crypto verifiability 差异化

---

## 已完成规格

| 规格 | 状态 |
|------|------|
| SPINS/Blast | 📋 P1-BLAST-001 规格待定义 |
| 每日任务 | ✅ |
| 首充奖励 | ✅ |
| 好友/聊天 | ✅ |
| Tournament SNG Phase 1+2 | ✅ |
| 手牌复盘 Phase 1+2 | ✅ |
| Emoji 互动 | ✅ |
| Rakeback 5层 | ✅ |
| Matchmaking/Wallet spec | ✅ |
| P2-CHAT-IDEMPOTENCY | ✅ |

---

## 新增 P1 建议

### P1-PRIZE-DISPLAY — TournamentCard 奖池显示

**问题:** 玩家只能看到奖励百分比，看不到总奖池金额。

**建议:** `ScheduleEntry` 增加 `prizePool` + `isGuarantee` + `registeredCount` 字段，TournamentCard 显示实际金额和 GTD 标签。

---

*Productor 第271轮 — 2026-04-28 00:30*
