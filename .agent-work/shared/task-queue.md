# 任务队列

## 优先级说明
- **P0**: 紧急/阻塞问题（安全、Bug导致的无法使用）
- **P1**: 重要功能缺陷或体验问题
- **P2**: 优化建议

---

## Test 代理发现的问题（2026-04-24 02:00）

### P0 — ✅ 全部已清零

- [x] **[T-001]** bullmq 模块缺失 — ✅ 已修复
- [x] **[W-001]** Withdraw 分布式 cooldown 绕过 — ✅ 已修复
- [x] **[W-002]** JWT Redis 降级安全日志 — ✅ 已修复
- [x] **[W-003]** 房间密码暴力破解防护 — ✅ 已修复
- [x] **[T-002]** game.handler.ts client.handshake.address 可选链 — ✅ 已修复
- [x] **[T-003]** 洗牌 Math.random() — ✅ 已修复（crypto.getRandomValues）
- [x] **[W-007]** handleShowCards 静默返回 — ✅ 已修复

### P1 — ✅ 全部已清零

- [x] **房间列表页组件拆分** — ✅ 1553行 → 1091行
- [x] **游戏桌页面组件拆分** — ✅ 1796行 → 5个组件
- [x] **新手引导 Tour** — ✅ react-joyride，4步引导
- [x] **实时在线人数 API** — ✅ GET /user/stats/online（本轮工作区已实现）

### P2 — 近期处理

| ID | 任务 | 优先级 | 状态 |
|----|------|--------|------|
| R-001 | 房间列表搜索/筛选/排序 | P2 | ✅ 已实现（commit 7c18c06） |
| W-004 | WebSocket 真实集成测试（真实 Socket.io 连接） | P2 | ❌ 待实现 |
| W-005 | 游戏完整 E2E 测试（加入房间→游戏→结算） | P2 | ❌ 待实现 |
| W-006 | `app.gateway.ts` (956行) 大文件拆分 | P2-Low | ❌ 待实现 |
| W-007 | `clearTableState` 内层 `.catch` 加日志 | P2-Low | ✅ 已修复（commit 42f35fa） |
| W-008 | `hand-history` JSON.parse 失败标记 `cardsRevealed: false` | P2-Low | ✅ 已修复（commit 42f35fa） |
| W-009 | `wallet.getBalance` dual-source 确认 | P2-Low | ✅ 已修复（添加注释，commit 42f35fa） |

### P3 — 规划中

| 任务 | 优先级 |
|------|--------|
| 表情互动系统 | P3 |
| 每日登录奖励 | P3 |
| 成就/任务系统 | P3 |
| 移动端手势操控 | P3 |

---

## Productor 任务（2026-04-24 01:45）

### P2 — 近期处理
- [ ] **移动端适配验证** — `room-mobile/[id]` 实际触控体验
- [ ] **无表情/互动功能** — 竞品全部具备，影响社交体验
- [x] **Pot-Relative 加注按钮行** — Min / ½ Pot / ¾ Pot / All-in ✅ 已实现（ActionBar.tsx）

### P3 — 规划中
- [ ] **表情互动系统** — P3 第一个社交功能
- [ ] **每日登录奖励** — 留存关键
- [ ] **成就/任务系统** — 参考 WSOP
- [ ] **移动端加注 UX** — 1/2 pot, All-in 快捷按钮（本轮已部分实现首页预览，游戏桌内尚未集成）

---

## 本轮工作区变更（2026-04-24 02:15）

以下功能已在本轮工作区实现（待 commit）：

|| 功能 | 文件 | 状态 |
|------|------|------|
| Pot-Relative Raise 按钮行 | `ActionBar.tsx` (+88行) | ✅ 已实现（工作区） |
| Min / ½ Pot / ¾ Pot / All-in 快捷按钮 | `ActionBar.tsx` | ✅ 已实现（工作区） |
| Raise Input 上限保护 | `ActionBar.tsx` | ✅ 已实现（工作区） |
| `room.min` i18n 键 | 6个 locale 文件 | ✅ 已添加 |
| `myPlayerStack` 传递给 ActionBar | `page.tsx` | ✅ 已实现（工作区） |

---

## 任务来源
- Test 代码审查报告 (2026-04-24 02:00)
- Productor 产品体验报告 (2026-04-24 01:45)

---

*最后更新: 2026-04-24 02:18*
