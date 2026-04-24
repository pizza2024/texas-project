# 任务队列

## 优先级说明
- **P0**: 紧急/阻塞问题（安全、Bug导致的无法使用）
- **P1**: 重要功能缺陷或体验问题
- **P2**: 优化建议

---

## Test 代理发现的问题（2026-04-24 11:31）

### P0 — ✅ 全部已清零

无 P0 问题。

### P1 — ✅ 全部已清零

无 P1 问题。

### P2 — 近期处理

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| W-004 | WebSocket 真实 Socket.io 集成测试 | ✅ 已实现 | socket-io.integration.spec.ts（后端不可用时 skip） |
| W-005 | 游戏完整 E2E 测试 | ⚠️ 待完善 | multi-browser-game.spec.ts 存在，待 CI 环境配置 |

### P3 — 规划中

| 任务 | 优先级 |
|------|--------|
| Jest Worker 泄漏优化 | P3 |
| 表情互动系统 | P3 |
| 每日登录奖励 | P3 |
| 成就/任务系统 | P3 |
| 俱乐部系统 | P3 |

---

## Productor 任务（2026-04-24 11:15）

### P2-High 优先级
- [x] **R-002**: 移动端 Pot-Relative Raise 移植 — ✅ 已实现
- [x] **P-UX-1**: Pot Odds HUD — ✅ 已实现
- [x] **P-UX-3a**: 轮次阶段指示器 — ✅ 已实现

### P2 待澄清
- **P-UX-2**: Sit-Out 重定位/行为重构 — Pending（竞品标配，需人工排期）
- **P-UX-3b**: All-in 确认弹窗 — Pending（需人工确认产品定义）

### P3 — 规划中
- [ ] 表情互动系统
- [ ] 每日登录奖励
- [ ] 成就/任务系统
- [ ] Club 俱乐部系统

---

## CodeReview 健康状态（11:31）

所有核心模块审查通过：
- ✅ WebSocket: roomLock/userLock, rate limit, brute-force protection
- ✅ Timer: 三类计时器正确清理，无泄漏
- ✅ Auth: bcrypt + Redis session + single-device login
- ✅ Deposit: HD 钱包 P2002 竞态处理
- ✅ Table: crypto.getRandomValues Fisher-Yates 洗牌
- ✅ 21 个 .spec.ts 测试文件覆盖核心逻辑

---

## 遗留未提交工作区变更

| 文件 | 变更 | 建议 |
|------|------|------|
| `socket-io.integration.spec.ts` | W-004 新文件 | 建议提交 |
| `app.gateway.ts` | `__testFinalizeSettlement` | 建议提交 |
| `game.handler.ts` | 格式化 | 建议提交 |
| `friends/page.tsx` | 类型强化 | 建议提交 |
| `app.gateway.spec.ts` | mock 重构 | 建议提交 |

---

*Last updated: 2026-04-24 11:31*
