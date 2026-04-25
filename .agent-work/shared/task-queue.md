# 任务队列

## 优先级说明
- **P0**: 紧急/阻塞问题（安全、Bug导致的无法使用）
- **P1**: 重要功能缺陷或体验问题
- **P2**: 优化建议

---

## P0 — 已完成

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P0-GAME-001 | `buildPots()` 边池分配错误 | ✅ 已修复 | table-round.ts:265-271 |
| P0-GAME-002 | `resolveFoldWin()` rake 未从 pot 扣减 | ✅ 已修复 | table-round.ts |
| P0-GAME-003 | `bestHandFrom()` 5张牌早退路径 | ✅ 已修复 | hand-evaluator.ts |
| P0-Withdraw-001 | `executeChainWithdraw` txHash 过早保存 | ✅ 已修复 | withdraw.service.ts |
| P0-Withdraw-002 | `processWithdraw` 无幂等保护 | ✅ 已修复 | withdraw.service.ts |
| P0-Deposit-001 | `checkAddressDeposits` 非原子操作 | ✅ 已修复 | deposit.service.ts |
| P0-BRUTE-001 | `game.handler.ts:99` 未 await `checkPasswordAttemptLimit` | ✅ 已修复 | line 99 已正确 await |
| P0-NEW-001 | TooManyRequestsException 编译失败 | ✅ 已修复 | 替换为 BadRequestException |

## P0 — 已验证无需修复

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P0-001 | Auth: Redis宕机时JWT验证被绕过 | ✅ 设计决策 | Redis不可用时拒绝所有请求=完全停机 |
| P0-002 | Withdraw: Redis不可用时cooldown被静默跳过 | ✅ 已验证 | 代码已正确throw |
| P0-003 | Withdraw: processWithdraw服务层无Admin角色验证 | ✅ 已验证 | AdminGuard在Controller层执行 |

---

## P1 — 进行中

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-004 | Jest Worker 泄漏 | 🟡 监控中 | `--detectOpenHandles` 已启用 |

## P1 — 已完成

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| P1-RAKEBACK-001 | Rakeback E2E 测试验证 | 🟡 待验证 | rakeback.e2e-spec.ts 存在 `passwordHash` 字段错误（→ P2-TS-NEW-002），需先修复 |
|| P1-TEST-001 | `connection-state.service.spec.ts` 缺失 | ✅ 已实现 | 22 个测试用例覆盖全部方法 |
| P1-NEW-001 | `buildPots` 使用 stale `allPlayers`，all-in 边池可能计算错误 | ✅ 已确认无问题 | table-round.ts — showdown 调用时 allPlayers 已是最新快照 |
| P1-NEW-002 | Withdraw 幂等性修复未提交 | ✅ 已提交 | withdraw.service.ts — txHash 确认后保存 + $transaction 幂等检查 |
| P1-001 | `TableManager.getTable()` 并发竞态 | ✅ 已修复 | 并发测试通过 |
| P1-002 | Redis 不可用时 rate limit 回退 | ✅ 已修复 | fail-closed 策略 |
| P1-003 | 密码暴力破解保护 in-memory Map | ✅ 已修复 | Redis 迁移完成 |
| P1-005 | `persistSettlementRecords` 静默失败 | ✅ 已修复 | AdminLog 告警 |
| P1-004 | Rakeback 前端空白 | ✅ 已实现 | GET/POST /user/rakeback |

---

## P2 — Club 功能

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P2-CLUB-001 | 私人邀请码 | 📋 待设计 | Club 页面（已提升为 P1） |
| P2-CLUB-002 | 俱乐部排行榜 | 📋 待实现 | |
| P2-CLUB-003 | 俱乐部专属房间 | 📋 待实现 | |
| P2-CLUB-004 | 俱乐部战绩统计 | 📋 待实现 | |

## P2 — TypeScript 编译错误（已全部修复）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| ~~P2-TS-002~~ | app.gateway.ts action 类型不兼容 | ✅ 已修复 | 联合类型 |
| ~~P2-TS-001~~ | table-manager.service.spec.ts 参数数量 | ✅ 已修复 | rakebackService 占位符 |
| ~~P2-TS-003~~ | timer-debug.spec.ts 参数数量 | ✅ 已修复 | processAction mock 签名 |
| ~~P2-LINT-001~~ | game.handler.ts prettier 格式错误 | ✅ 已修复 | lint --fix |
| ~~P2-004~~ | Web `<img>` → `<Image />` | ✅ 已用 ExternalImg | 外部URL无法用Next.js Image，已抽象为 ExternalImg 组件 |
| ~~P2-NEW-001~~ | app.gateway.ts `amount?: unknown` | ✅ 已修复 | `amount?: number` 已修复 |
| ~~P2-NEW-002~~ | creditRakeback 事务语法（数组 → callback） | ✅ 已修复 | rakeback.service.ts:160 callback 语法 |
| ~~P2-NEW-003~~ | `adminLogSettlementFailure` 内部异常静默丢弃 | ✅ 已修复 | console.error 记录已添加 |
| ~~P2-NEW-004~~ | Rakeback 前端 `type Tier` 与后端重复定义 | ✅ 已修复 | type Tier = RakebackTier |
| ~~P2-NEW-005~~ | Club page 3 个 eslint-disable 硬编码 | ✅ 已修复 | ExternalImg 组件已创建 |

## P2 — TypeScript 编译错误（spec/e2e 文件，不影响运行时）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| ~~P2-TS-NEW~~ | rakeback.controller.spec.ts Request 类型断言 | ✅ 已修复 | 改用 `{ user: typeof mockUser }` 替代 Request 类型 |
| ~~P2-TS-NEW-003~~ | connection-state.service.spec.ts mock 类型错误 | ✅ 已修复 | mockRedisService 返回 `any` 类型，消除所有 TS2345 错误 |
| ~~P2-TS-NEW-002~~ | rakeback.e2e-spec.ts passwordHash 字段名 | ✅ 已修复 | `passwordHash` → `password`（2处），不再阻塞 P1-RAKEBACK-001 |

## P2 — 其他已完成

| ID | 任务 | 状态 |
|----|------|------|
| P2-002 | Club 数据库迁移 | ⏳ 待执行 |
| P2-003 | Sit-Out 重构 | ✅ 已实现 |
| P2-004 | All-in 确认弹窗 | ✅ 前端实现完成 |

---

## P3 — Tournament 路线图

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | SNG 单桌赛 | 📋 规划中 |
| Phase 2 | Jackpot SNG | 📋 规划中 |
| Phase 3 | MTT 多桌赛 | 📋 规划中 |

---

*最后更新: 2026-04-25 08:19 — Coding 第111轮 — P2-TS-NEW-002 ✅（passwordHash→password）+ P2-TS-NEW-003 ✅（mock类型修复），P2 TypeScript 编译错误（spec/e2e）全部清零，267 tests pass，rakeback e2e 不再阻塞 P1-RAKEBACK-001*
