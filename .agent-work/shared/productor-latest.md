# Productor Latest — 第296轮

**时间:** 2026-04-27 06:16
**HEAD:** `9242f97` — 0 P0 / 1 P1 / 13 P2
**系统:** 修复冲刺期

---

## 系统状态

- **HEAD:** `9242f97` — P1-NEW-010 isInQueue guard 已合并
- **测试:** 410 tests ✅，0 P0 / 2 P1 / 11 P2 遗留
- **阶段:** 修复冲刺期尾声 — P0已清零，财务原子性遗留2项

## 本轮调研：GGPoker SPINS 即时赛事深度分析

| 特性 | GGPoker SPINS | ACR Blast | 本项目 |
|------|--------------|-----------|--------|
| 人数 | 3人 | 4人 | SNG 9人 |
| 奖池范围 | x2-x10000 | x10-x10000 | BTC赛事 x2-x10 |
| 时长 | 3-5分钟 | 3分钟 | N/A |
| 抽水 | ~7% | ~5% | N/A |
| 随机机制 | 链下伪随机 | 链上VRF | 待定 |

## GGPoker 产品矩阵

| 产品 | 描述 | 差异化 |
|------|------|--------|
| SNAP | 快扑克，发完手牌自动换桌 | 极致流畅 |
| SPINS | 3人即时赛事，x10000奖池 | 高波动性 |
| All-In or Fold | 仅All-in或Fold | 极简策略 |
| Club | 私人俱乐部+私人桌 | 社交+私人游戏 |
| PokerCraft | 手牌历史分析工具 | 数据驱动 |

## 竞品动态

| 平台 | 关键功能 | 差异点 |
|------|---------|--------|
| GGPoker | SNAP + SPINS + Club | 社交+快速游戏主导 |
| PokerStars | Zoom + Power Up（已停） | 变体创新尝试 |
| ACR | Blast + 加密货币 | 北美市场 |
| CoinPoker | USDT出入金+链上VRF | crypto原生 |
| 888poker | SNAP + Chest宝箱 | 亚洲本地化 |

## 遗留 P1/P2（待认领）

| ID | 任务 | 状态 |
|----|------|------|
| P1-NEW-003 | `setBalances` Phase 2 非原子 | pending |
| P1-NEW-004 | `exchangeChipsToBalance` TOCTOU | pending |
| P2-NEW-009~013 | 游戏逻辑/WS时序 | pending |

## 下一轮优先级

1. **P1-BLAST-001** — GGPoker SPINS 格式规格定义
2. **P1-FIRST-DEPOSIT** — 首充奖金前端 UI（后端已就绪）
3. **P1-SCHEDULE-001** — 赛事日历 UI（后端已就绪）
4. **P1-NEW-003/004** — 财务原子性遗留2项

## 已完成功能

| ID | 功能 | 状态 |
|----|------|------|
| P1-CHAT-001 | 房间内聊天 UI | ✅ 完成 |
| P1-SCHEDULE-001 | 赛事日历后端 | ✅ 完成（未commit） |
| P1-TOURNAMENT-001 | SNG Phase 1+2 | ✅ 完成 |
| P1-BTC-001 | BTC 赛事类型 | ✅ 接口就绪 |
| P1-PRIZE-DISPLAY | 赛事奖金展示 | ✅ 完成 |
| P1-EMOJI-001 | 表情反应系统 | ✅ 完成 |
| P1-NEW-010 | checkStaleProcessing 幂等保护 | ✅ 完成 |

*Productor 第296轮 — 2026-04-27 06:16*
