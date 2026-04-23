# 任务队列

## 优先级说明
- **P0**: 紧急/阻塞问题（安全、Bug导致的无法使用）
- **P1**: 重要功能缺陷或体验问题
- **P2**: 优化建议

---

## Test 代理发现的问题（2026-04-24 07:40）

### P0 — ✅ 全部已清零

- [x] **[T-009]** app.gateway.spec.ts — `ensureRecoveredRoundFlow` mock 空函数 → ✅ 已修复
  - **根因**: mock `timerService.ensureRecoveredRoundFlow` 是空函数，SETTLEMENT 阶段恢复时未触发 `schedulePostHandFlow`
  - **修复**: 添加 mock 实现，当 `currentStage === SETTLEMENT && settlementEndsAt` 时调用 `schedulePostHandFlow`
  - **改动**: `apps/backend/src/websocket/app.gateway.spec.ts`（ensureRecoveredRoundFlow mock 实现）
  - **同时清理**: `app.gateway.ts:229` 的 DEBUG console.log

### P1 — ✅ 全部已清零

- [x] T-001, T-002, T-003, T-008 — 已修复
- [x] W-001, W-002, W-003, W-007, W-010 — 已修复

### P2 — 近期处理

| ID | 任务 | 状态 |
|----|------|------|
| W-004 | WebSocket 真实 Socket.io 集成测试 | ❌ 待实现 |
| W-005 | 游戏完整 E2E 测试 | ❌ 待实现 |

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
- [ ] W-004: WebSocket 真实集成测试
- [ ] W-005: 游戏完整 E2E 测试

### P3 — 规划中
- [ ] 表情互动系统
- [ ] 每日登录奖励
- [ ] 成就/任务系统
- [ ] Club 俱乐部系统

---

*Last updated: 2026-04-24 07:40*
