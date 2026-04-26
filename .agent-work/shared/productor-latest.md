# Productor Latest — 第295轮

**时间:** 2026-04-27 06:00
**HEAD:** `c5da1b7` — 0 P0 / 1 P1 / 13 P2
**系统:** 修复冲刺期

---

## 系统状态

- **HEAD:** `c5da1b7` — P1-NEW-011 测试mock修复 已合并
- **测试:** 410 tests ✅，0 P0 / 2 P1 / 11 P2 遗留
- **阶段:** 修复冲刺期 — P0已清零，1个P1财务原子性遗留待处理

## 本轮调研：GGPoker SPINS 即时赛事

| 特性 | GGPoker SPINS | ACR Blast | 本项目 |
|------|--------------|-----------|--------|
| 人数 | 3人 | 4人 | SNG 9人 |
| 奖池范围 | x2-x10000 | x10-x10000 | 待定 |
| 时长 | 3-5分钟 | 3分钟 | N/A |
| 抽水 | ~7% | ~5% | N/A |
| 随机机制 | 链下伪随机 | 链上VRF | 待定 |

## 竞品动态

| 平台 | 关键功能 | 差异点 |
|------|---------|--------|
| GGPoker | SNAP + SPINS + Club | 社交+快速游戏主导 |
| PokerStars | Zoom + Power Up | 变体创新（已停） |
| CoinPoker | USDT出入金+链上VRF | crypto原生 |
| 888poker | SNAP + Chest宝箱 | 亚洲本地化 |

## 遗留 P1/P2（待认领）

| ID | 任务 | 状态 |
|----|------|------|
| P1-NEW-003 | `setBalances` Phase 2 非原子 | pending |
| P1-NEW-004 | `exchangeChipsToBalance` TOCTOU | pending |
| P1-NEW-006 | `handleWithdrawFailure` 事务外 | pending |
| P1-NEW-010 | `checkStaleProcessing` 无幂等保护 | pending |
| P0-E2E-002 | `jest-e2e.json` moduleNameMapper 路径错误 | pending |
| P2-NEW-009~021 | 游戏逻辑/WS时序/P2项 | pending |

## 下一轮优先级

1. P1-BLAST-001 规格定义 — GGPoker SPINS 格式，4人，3分钟，x10-x10000随机奖池
2. P1-FIRST-DEPOSIT 实施 — 首充奖金对新用户转化至关重要
3. P1-NEW-003/004/006 — 财务原子性遗留3项
4. P1-SCHEDULE-001 前端 — 赛事日历UI页面

## 已完成功能

| ID | 功能 | 状态 |
|----|------|------|
| P1-CHAT-001 | 房间内聊天 UI | ✅ 完成 |
| P1-SCHEDULE-001 | 赛事日历后端 | ✅ 完成（未commit） |
| P1-TOURNAMENT-001 | SNG Phase 1+2 | ✅ 完成 |
| P1-BTC-001 | BTC 赛事类型 | ✅ 接口就绪 |
| P1-PRIZE-DISPLAY | 赛事奖金展示 | ✅ 完成 |

*Productor 第295轮 — 2026-04-27 06:00*
