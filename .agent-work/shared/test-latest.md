# Test 代理报告

> **时间**: 2026-04-24 05:45
> **类型**: 轮询报告（第10轮）
> **项目**: Texas Hold'em Monorepo

---

## 状态总览

| 状态 | 数量 | 详情 |
|------|------|------|
| 🔴 P0 | 1项 | app.gateway.spec.ts 仍有4个测试失败（mock 架构问题） |
| ✅ P1 | 全部清零 | 无新增 P1 问题 |
| ⚠️ P2 | 2项待处理 | W-004（WebSocket集成测试）、W-005（游戏E2E测试） |
| ⚠️ P2-Low | 1项新增 | Web 前端 console.log（2处） |

---

## P0 — app.gateway.spec.ts 4个测试失败

**文件**: `apps/backend/src/websocket/app.gateway.spec.ts`
**现状**: 7 passed, 4 failed / 11 total

**根因**: TimerService mock 架构问题 — `finalizeSettlement`/`finalizeActionTimeout` 等 mock 只调用 `table.begin*Countdown` 设置时间戳，但不推进游戏状态。`jest.advanceTimersByTimeAsync()` 触发时游戏状态未实际推进。

**4个失败用例**:
1. `runs settlement countdown, enters ready countdown, and then auto-starts` — `resetToWaiting` 未调用
2. `rebuilds an in-progress settlement timer from restored state` — 同上
3. `auto-checks on timeout when checking is allowed` — `getTimeoutAction` 未调用
4. `auto-folds on timeout when checking is not allowed` — `processAction` 未调用，且 `scheduleActionTimeout` 已移至 TimerService

**修复方案**: TimerService mock 需在调用 `begin*Countdown` 后同步触发状态推进回调（直接调用 `table.resetToWaiting()` 等），模拟真实 timer 触发行为。

**W-012 P2-Low**: `apps/web/app/room/[id]/page.tsx` 第 324、330 行有 `console.log` 残留。

---

## 测试运行结果

```
Tests: 4 failed, 192 passed, 196 total
  └─ table-engine:  133 passed (100%)
  └─ app.gateway:   7 passed, 4 failed
```

---

## 任务队列

### P0 — 阻塞问题
- [ ] **T-009**: 修复 app.gateway.spec.ts — TimerService mock 架构问题（4个测试失败）

### P2 — 近期处理
- [ ] W-004: WebSocket 真实 Socket.io 集成测试
- [ ] W-005: 游戏完整 E2E 测试
- [ ] W-012: 移除 Web 前端 console.log（2处）

---

*Test — 2026-04-24 05:45*
