# 任务队列

## 优先级说明
- **P0**: 紧急/阻塞问题（安全、Bug导致的无法使用）
- **P1**: 重要功能缺陷或体验问题
- **P2**: 优化建议

---

## Test 代理发现的问题（2026-04-24 15:30）

### P0 — ✅ 全部已清零

无 P0 问题。

### P1 — ✅ 全部已清零

无 P1 问题。（P-ONBOARD 新手引导已由 Productor 排期）

### P2 — 近期处理

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P2-UX | Rooms 页面加载骨架屏 | ✅ 完成 | 第30轮，替代闪痛 spinner |
| P2-UX | Rooms 卡片 tier 标签 | ✅ 完成 | 第30轮，彩色 pill badge |
| P2-UX | Rooms 卡片在线人数显示 | ✅ 完成 | 第31轮，👥 X/Y 格式 |
| P2-UX | Rooms 筹码不足灰色高亮 | ✅ 完成 | 第31轮，灰色背景 + 🔒标签 |
| P2-UX | Quick Match 匹配动画 | ✅ 完成 | 第31轮，雷达脉冲动画 |
| W-004 | WebSocket 真实 Socket.io 集成测试 | ✅ 已实现 | 21 suites / 199 tests 全部通过 |
| W-005 | 游戏完整 E2E 测试 | ⚠️ 待完善 | multi-browser-game.spec.ts 存在，待 CI 环境配置 |
| P-UX-2 | Sit-Out 重构 | Pending | 待 Productor 确认 |
| P-UX-3b | All-in 确认弹窗 | Pending | 待产品定义确认 |

### P3 — 规划中

| 任务 | 优先级 | 备注 |
|------|--------|------|
| Club 俱乐部系统 | P3 | ✅ Phase 1 MVP 已实现（commit acbac2c） |
| Tournament 赛制 | P3 | Productor 调研完成，Phase 1 MVP 待开发 |
| Rakeback 体系 | P3 | Productor 已提供技术方案 |
| 表情互动系统 | P3 | MVP 已提供 |
| FastFold Snap Mode | P3 | BetMGM/888poker 参考 |
| Jackpot Sit & Go | P3 | 888poker/CoinPoker 参考 |
| AI 陪练模式 | P3 | WSOP/Pokerrr 竞品趋势 |
| 记牌器/复盘功能 | P3 | BetMGM 参考 |
| 每日登录奖励 | P3 | |
| Web 前端测试覆盖 | P3 | |
| Jest Worker 泄漏优化 | P3 | `--detectOpenHandles` 定位 |

---

## Productor 任务（2026-04-24 11:15）

### P2-High 优先级
- [x] **R-002**: 移动端 Pot-Relative Raise 移植 — ✅ 已实现
- [x] **P-UX-1**: Pot Odds HUD — ✅ 已实现
- [x] **P-UX-3a**: 轮次阶段指示器 — ✅ 已实现
- [x] **P2-UX**: Rooms 页面加载骨架屏 — ✅ 第30轮实现
- [x] **P2-UX**: Rooms 卡片 tier 标签 — ✅ 第30轮实现

### P2 待澄清
- **P-UX-2**: Sit-Out 重定位/行为重构 — Pending（竞品标配，需人工排期）
- **P-UX-3b**: All-in 确认弹窗 — Pending（需人工确认产品定义）

### P3 — 规划中
- [ ] 表情互动系统
- [ ] 每日登录奖励
- [ ] 成就/任务系统
- [ ] Club 俱乐部系统
- [ ] Tournament 赛制（Productor 调研完成，Phase 1 MVP 待开发）

---

## CodeReview 健康状态（14:00）

所有核心模块审查通过：
- ✅ WebSocket: roomLock/userLock, rate limit, brute-force protection
- ✅ Timer: 三类计时器正确清理，无泄漏
- ✅ Auth: bcrypt + Redis session + single-device login
- ✅ Deposit: HD 钱包 P2002 竞态处理
- ✅ Table: crypto.getRandomValues Fisher-Yates 洗牌
- ✅ 21 个 .spec.ts 测试文件覆盖核心逻辑
- ✅ 遗留未提交工作区变更已全部提交

---

## 遗留未提交工作区变更

无未提交变更（全部已提交至 ea07c43）。

*Last updated: 2026-04-24 19:01 — Test 第58轮，P0/P1 清零，199 tests 全部通过，代码库稳定 2.5h+，P3 Club 建议优先启动*
