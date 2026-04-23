# 任务队列

## 优先级说明
- **P0**: 紧急/阻塞问题（安全、Bug导致的无法使用）
- **P1**: 重要功能缺陷或体验问题
- **P2**: 优化建议

---

## Test 代理发现的问题（2026-04-24 05:15）

### P0 — 🔴 阻塞

- [ ] **[T-009]** app.gateway.spec.ts — TimerService 拆分后 mock 架构不兼容（5/11测试失败）— 🔧 根因已修复（方法签名不一致），commit 3f95fb0

**当前进度**: 7/11 通过（新增 `syncs room state on disconnect`），4个 timer 测试仍失败：
1. `runs settlement countdown, enters ready countdown, and then auto-starts`
2. `rebuilds an in-progress settlement timer from restored state`
3. `auto-checks on timeout when checking is allowed`
4. `auto-folds on timeout when checking is not allowed`

**根因**: `finalizeActionTimeout` mock 需要显式触发 `table.getTimeoutAction()` / `table.processAction()` 调用链。
  - 根因: `finalizeSettlement`/`finalizeActionTimeout` mock 只调用 `begin*Countdown` 设置时间戳，但不推进游戏状态
  - 修复: TimerService mock 需在 `begin*Countdown` 后同步触发状态推进回调

### P1 — ✅ 全部已清零

- [x] **[T-001]** bullmq 模块缺失 — ✅ 已修复
- [x] **[W-001]** Withdraw 分布式 cooldown 绕过 — ✅ 已修复
- [x] **[W-002]** JWT Redis 降级安全日志 — ✅ 已修复
- [x] **[W-003]** 房间密码暴力破解防护 — ✅ 已修复
- [x] **[T-002]** game.handler.ts client.handshake.address 可选链 — ✅ 已修复
- [x] **[T-003]** 洗牌 Math.random() — ✅ 已修复（crypto.getRandomValues）
- [x] **[W-007]** handleShowCards 静默返回 — ✅ 已修复
- [x] **[T-008]** websocket.module.ts 缺少 ConnectionStateService provider — ✅ 已修复
- [x] **[W-010]** Bot AI Math.random() — ✅ 已修复（crypto.randomInt）

### P2 — 近期处理

| ID | 任务 | 优先级 | 状态 |
|----|------|--------|------|
| W-004 | WebSocket 真实 Socket.io 集成测试 | P2 | ❌ 待实现 |
| W-005 | 游戏完整 E2E 测试（加入房间→游戏→结算） | P2 | ❌ 待实现 |
| W-006 | WebSocket 重构 app.gateway.ts 拆分（ConnectionStateService + BroadcastService + TimerService） | P2-Low | ✅ 已提交（commit f3d1b27） |

### P3 — 规划中

| 任务 | 优先级 |
|------|--------|
| 表情互动系统 | P3 |
| 每日登录奖励 | P3 |
| 成就/任务系统 | P3 |
| 俱乐部系统 | P3 |
| 移动端手势操控 | P3 |

---

## Productor 任务（2026-04-24 04:00）

### P2-High 优先级
- [x] **R-002**: 移动端 Pot-Relative Raise 移植 — ✅ 已实现

### P2 — 近期处理
- [ ] **W-004**: WebSocket 真实集成测试
- [ ] **W-005**: 游戏完整 E2E 测试

### P3 — 规划中
- [ ] **表情互动系统**
- [ ] **每日登录奖励**
- [ ] **成就/任务系统**
- [ ] **Club 俱乐部系统**

---

*Last updated: 2026-04-24 04:46*
