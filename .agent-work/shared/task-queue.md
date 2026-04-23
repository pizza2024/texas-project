# 任务队列

## 优先级说明
- **P0**: 紧急/阻塞问题（安全、Bug导致的无法使用）
- **P1**: 重要功能缺陷或体验问题
- **P2**: 优化建议

---

## Test 代理发现的问题（2026-04-24 00:17）

### P0 — ⚠️ 待修复

- [ ] **[T-001]** bullmq 模块缺失 — `npm install` 失败导致 `withdraw.service.spec.ts` 无法运行

### P0 — ✅ 已全部修复并提交

- [x] **[T-001]** bullmq 模块缺失 — ✅ 已修复（commit 562ff32，Redis mock setNX/TTL 恢复）
- [x] **[W-001]** Withdraw 分布式 cooldown 绕过 — ✅ 已提交（commit 118fe3c）
- [x] **[W-002]** JWT Redis 降级安全日志 — ✅ 已提交（commit 118fe3c）
- [x] **[W-003]** 房间密码暴力破解防护 — ✅ 已提交（commit 8b51c77）
- [x] **[T-002]** game.handler.ts client.handshake.address 可选链 — ✅ 已提交（commit a54e714）

### P1 — 本周内处理

- [x] **房间列表页组件拆分** — `apps/web/app/rooms/page.tsx` 1553行 → 1091行 ✅ 组件已集成

### P2 — 近期处理

- [x] **[W-006]** WebSocket rate-limit 降级优化 — ✅ 已确认（架构限制，需 Redis HA 方案）
- [ ] **[W-004]** WebSocket 真实集成测试 — 现有测试仅 Jest mock
- [ ] **[W-005]** 游戏完整流程 E2E 测试 — 缺失 "加入房间→游戏→结算" 端到端测试
- [ ] **[T-003]** 洗牌使用 Math.random() — `table-game-logic.ts` Fisher-Yates 应改用 `crypto.getRandomValues()`
- [ ] **移动端适配验证** — `room-mobile/[id]` 实际运行效果待测试
- [ ] **游戏桌页面组件拆分** — `room/[id]/page.tsx` 1796行，应拆分
- [ ] **无表情/互动功能** — 竞品全部具备，影响社交体验

### P3 — 规划中

- [x] **[W-007]** handleShowCards 静默返回优化 — ✅ 已修复（commit 641a658，`show_cards_result` 事件 + `not_winner` reason）
- [ ] **新手引导 Tour** — 用户进来不知道如何开始玩
- [ ] **成就/任务系统** — 参考 WSOP 手镯模式，提升留存
- [ ] **首页无产品截图** — 流失率可能较高
- [ ] **Bot 孤独桌体验验证**
- [ ] **拆分 room-mobile/[id]/page.tsx** (758行)

---

## Productor 发现的问题（2026-04-23 22:45）

### P1 - 立即处理
- [ ] **无新手引导/教程** — 用户进来不知道如何开始玩，应新增引导页或 Tooltip
- [ ] **房间列表页组件过大** — `rooms/page.tsx` 1553行，应拆分为多个组件

### P2 - 近期处理
- [ ] **移动端适配验证** — `room-mobile/[id]` 实际运行效果待测试
- [ ] **无表情/互动功能** — 竞品全部具备，影响社交体验
- [ ] **游戏桌页面组件过大** — `room/[id]/page.tsx` 1796行，应拆分

### P3 - 规划中
- [ ] **成就/任务系统** — 参考 WSOP 手镯模式，提升留存
- [ ] **首页无产品截图** — 流失率可能较高
- [ ] **Bot 对战模式优化** — 孤独桌体验

---

## 竞品功能缺失

| 功能 | 竞品状态 | CHIPS 状态 |
|------|----------|------------|
| 表情互动 | WSOP✅ 888✅ CoinPoker✅ | ❌ 缺失 |
| 成就系统 | WSOP✅ 888✅ | ❌ 缺失 |
| 新手引导 | WSOP✅ 888基础 CoinPoker基础 | ❌ 缺失 |
| 匿名无KYC | CoinPoker✅ | ⚠️ 部分（USDT充值） |

---

## 任务来源
- Test 代码审查报告 (2026-04-24 00:04)
- Productor 产品体验报告 (2026-04-23 22:45)

---
*最后更新: 2026-04-24 00:17*
