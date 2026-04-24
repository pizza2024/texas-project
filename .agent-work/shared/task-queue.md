# 任务队列

## 优先级说明
- **P0**: 紧急/阻塞问题（安全、Bug导致的无法使用）
- **P1**: 重要功能缺陷或体验问题
- **P2**: 优化建议

---

## 当前问题状态（2026-04-24 20:30 — 第64轮）

### P0 — ✅ 已清零

||| ID | 任务 | 状态 | 备注 |
|||----|------|------|------|
||| P0-001 | straddle 缺失 PlayerActionSchema | ✅ 已提交 | commit a6c5c4a — straddle enum + amount cap 1B |

### P1 — ✅ P1-001+P1-002 已修复

||| ID | 任务 | 状态 | 备注 |
|||----|------|------|------|
||| P1-001 | 断线重连清理竞态 | ✅ 已修复并推送 | commit f2b6d57 → 6cd334b 两次修复 |
||| P1-002 | Jest Worker 泄漏 | ✅ 修复中 | commit 6cd334b 修复 client.id 闭包捕获 bug |
||| P1-002b | Jest Worker 泄漏 | 🟡 待调查 | `npm test -- --detectOpenHandles` 定位 |

### P2 — 🟢 计划中

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| P2-002 | Club 数据库迁移 | 🟡 待执行 | 需要 DATABASE_URL |
|| P2-003 | Sit-Out 重构 | Pending | 等待产品确认 |
|| P2-004 | All-in 确认弹窗 | Pending | 等待产品定义 |

---

## P2 — ✅ 近期完成

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| P2-001 | Club 前端页面 | ✅ 完成 | 第65轮 — commit a004993 |
|| P2-UX | Rooms 页面加载骨架屏 | ✅ 完成 | 第30轮 |
| P2-UX | Rooms 卡片 tier 标签 | ✅ 完成 | 第30轮 |
| P2-UX | Rooms 卡片在线人数显示 | ✅ 完成 | 第31轮 |
| P2-UX | Rooms 筹码不足灰色高亮 | ✅ 完成 | 第31轮 |
| P2-UX | Quick Match 匹配动画 | ✅ 完成 | 第31轮 |
| W-004 | WebSocket 真实 Socket.io 集成测试 | ✅ 已实现 | 21 suites / 199 tests |
| W-005 | 游戏完整 E2E 测试 | ⚠️ 待完善 | multi-browser-game.spec.ts 存在，待 CI |
| Club Phase 1 MVP | Club 后端完整实现 | ✅ 完成 | commit acbac2c |

---

## P3 — 规划中

| 任务 | 优先级 | 备注 |
|------|--------|------|
| Club 俱乐部系统 | P3 | ✅ Phase 1 MVP 已实现，待数据库迁移 + 前端开发 |
| Tournament 赛制 | P3 | 调研完成，待开发 |
| Rakeback 体系 | P3 | Productor 已提供技术方案 |
| 表情互动系统 | P3 | MVP 已提供 |
| FastFold Snap Mode | P3 | BetMGM/888poker 参考 |
| Jackpot Sit & Go | P3 | 888poker/CoinPoker 参考 |
| AI 陪练模式 | P3 | WSOP/Pokerrr 竞品趋势 |
| 记牌器/复盘功能 | P3 | BetMGM 参考 |
| 每日登录奖励 | P3 | |
| Web 前端测试覆盖 | P3 | |
| 移动端滑动弃牌 | P3 | 竞品标配 |
| 移动端底部操作区优化 | P3 | 竞品标配（3按钮+滑动手势） |
| 移动端推送通知 | P3 | DAU 提升关键功能 |
| Rake 抽水系统 | P1 | 每局 3-5%，需服务端实现 |
| 首充红利 | P1 | 首次 USDT 充值 50-100% 匹配 |

---

## CodeReview 健康状态（20:15）

| 模块 | 状态 | 备注 |
|------|------|------|
| WebSocket | ✅ 已修复 | P1-001 socketId 闭包捕获两次修复 — commit 6cd334b |
| Timer | 🟡 待调查 | P1-002 Jest worker 泄漏 |
| Auth | ✅ 待审查 | 未发现明显问题 |
| Deposit | ✅ 待审查 | 未发现明显问题 |
| Table | ✅ 已修复 | P0 straddle 已提交 |
| Club | ✅ 审查通过 | Phase 1 MVP 完整 |

---

## 协同注意

- **client.id 闭包 bug 已修复**: commit 6cd334b — socketId 作为参数传入闭包而非引用
- **ahead of origin/develop**: 已推送 6cd334b，P1-001 修复已到远程
- **Club 迁移**: `npx prisma migrate dev --name add_club_tables` 待执行
- **Club 前端**: 需启动 apps/web 中的 Club 页面开发

---

*Last updated: 2026-04-24 20:15 — Coding 第63轮 — P0+P1-001+P1-002 闭包bug已修复，已推送*
