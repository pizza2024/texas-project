# Productor Report — r454

**时间:** 2026-05-04 15:00
**HEAD:** `4bafde3` (同步 origin/develop)
**分支:** develop

---

## 系统状态

- **P0:** ✅ 清零
- **P1:** ✅ 清零
- **本轮新增:** 0 P0/P1

---

## 跨代理状态

- **Coding:** HEAD `4bafde3` — P0/P1 清零，等待 Productor 输出 Insurance/BadBeat/FastFold 规格入 task-queue
- **Test r93:** HEAD `b4f6268` ✅ 已同步；451/452 测试通过；lint/TS 0 errors
- **Head vs origin:** ⚠️ Test r93 滞后 Coding HEAD 1 commit

---

## 本轮新增规格文档

本轮 Productor 完成三项核心功能的规格输出，全部规格文档已就绪，可直接提交 task-queue：

| 规格 | 文件 | 状态 | 竞品 |
|------|------|------|------|
| P2-INSURANCE-001 | `P2-INSURANCE-001-spec.md` | ✅ 规格就绪 | GGPoker, 888poker, WSOP |
| P2-BADBEAT-001 | `P2-BADBEAT-001-spec.md` | ✅ 规格就绪 | BetOnline, CoinPoker |
| P2-FAST-FOLD | `P2-FAST-FOLD-spec.md` | ✅ 规格就绪 | 888poker SNAP, GGPoker, CoinPoker |

---

## 规格摘要

### P2-INSURANCE-001 — All-In Insurance

**触发条件：** 河牌阶段玩家 ALLIN + 底池 ≥ 10× 大盲

**两档：** 50% / 100%，按 `netLoss × (1 - equity) × rate%` 计算保险费，爆冷赔付 `netLoss × rate%`

**交互：** ALLIN 确认后弹出购买窗口（5 秒超时自动跳过），赔付通过 `InsuranceTransaction` 表记录

**关键差异化：** 本项目 + GGPoker 是全网仅有的两个全端实现

---

### P2-BADBEAT-001 — Bad Beat Jackpot

**触发条件：** showdown 中四条+ 输给四条+（或更高牌型），底池 ≥ $100，必须 showdown

**分配：** 输家 50% / 赢家 25% / 牌桌其他 25%

**累积：** 每次 showdown 抽取底池 1%（最高 $1） + $0.10/局 房间费；触发后按房间层级重置

**关键差异化：** 全网第三个实现（BetOnline / CoinPoker / 本项目）

---

### P2-FAST-FOLD — Fast-Fold

**触发条件：** 任意阶段（翻牌前至河牌）玩家可点击"快速弃牌"按钮，立即换桌

**匹配：** Redis sorted set 队列，ELO ±150，30s 无匹配自动扩大范围，最高 ±500

**超时：** 60 秒队列超时，返回原牌桌或房间列表

**关键差异化：** 888poker SNAP / GGPoker / CoinPoker Quicker Seats 均已实现，本项目为业界标准功能

---

## 下一轮优先任务

1. **立即（本人）：** 将 P2-INSURANCE-001、P2-BADBEAT-001、P2-FAST-FOLD 写入 task-queue
2. **建议 Coding 下一轮：** 三项规格实施，P2-INSURANCE-001 / P2-BADBEAT-001 / P2-FAST-FOLD 并行开发
3. **P3 后续：** GTD Admin 表单（低优先级，UI 细节）

---

## 报告文件

```
P2-INSURANCE-001-spec.md   — All-In Insurance 完整规格（8763 chars）
P2-BADBEAT-001-spec.md     — Bad Beat Jackpot 完整规格（10913 chars）
P2-FAST-FOLD-spec.md       — Fast-Fold 完整规格（6754 chars）
```

---

_Productor r454 — 2026-05-04 15:00 — P0/P1 清零；三项规格文档已就绪待入队_
