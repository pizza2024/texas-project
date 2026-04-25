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
| P0-SEC-001 | Redis Session 验证绕过（fail-closed） | ✅ 已验证修复 | jwt.strategy.ts — Redis不可用时正确 throw |

## P0 — 已验证无需修复

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P0-001 | Auth: Redis宕机时JWT验证被绕过 | ✅ 设计决策 | Redis不可用时拒绝所有请求=完全停机 |
| P0-002 | Withdraw: Redis不可用时cooldown被静默跳过 | ✅ 已验证 | 代码已正确throw |
| P0-003 | Withdraw: processWithdraw服务层无Admin角色验证 | ✅ 已验证 | AdminGuard在Controller层执行 |

---

## P1 — 进行中

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-RAKEBACK-001 | E2E `passwordHash` → `password` TSC 编译错误 | ✅ 已修复 | commit 6ec6c3a 已修复 |
| P1-004 | Jest Worker 泄漏 | 🟡 监控中 | `--detectOpenHandles` 已启用 |

## P1 — 已完成

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-CLUB-INVITE-001 | Club 私人邀请码 | ✅ 已实现 | bfd9ffa — ClubInviteCode model + 5 API + 前端落地页 + 邀请标签 |
| P1-TEST-001 | `connection-state.service.spec.ts` 缺失 | ✅ 已实现 | 22 个测试用例覆盖全部方法 |
| P1-RAKEBACK-002 | Rakeback 5 tier 代码实现 | ✅ 已实现 | commit dc28855 — PLATINUM 40%/DIAMOND 50% at $10K/$50K |
| P1-RAKEBACK-003 | Rakeback service.spec.ts 13 tests failing | ✅ 已修复 | 断言更新为 5-tier，20 tests pass |
| P1-NEW-001 | `buildPots` 使用 stale `allPlayers`，all-in 边池可能计算错误 | ✅ 已确认无问题 | table-round.ts — showdown 调用时 allPlayers 已是最新快照 |
| P1-NEW-002 | Withdraw 幂等性修复未提交 | ✅ 已提交 | withdraw.service.ts — txHash 确认后保存 + $transaction 幂等检查 |
| P1-001 | `TableManager.getTable()` 并发竞态 | ✅ 已修复 | 并发测试通过 |
| P1-002 | Redis 不可用时 rate limit 回退 | ✅ 已修复 | fail-closed 策略 |
| P1-003 | 密码暴力破解保护 in-memory Map | ✅ 已修复 | Redis 迁移完成 |
| P1-005 | `persistSettlementRecords` 静默失败 | ✅ 已修复 | AdminLog 告警 |
| P1-004 | Rakeback 前端空白 | ✅ 已实现 | GET/POST /user/rakeback |
| P1-CLUB-TEST-001 | ClubService spec RedisService 依赖缺失，16 tests fail | ✅ 已修复 | commit dc3e4a — 添加 RedisService mock，16 tests pass |

---

## P2 — 进行中

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P2-NEW-007 | 战后手牌复盘 UI | ✅ Phase 1 完成 | ReplayModal + 5 sub-components 已实现 |
| P2-NEW-009 | Hand Replay getActivePlayers() 来源需确认 | 📋 待确认 | table-manager 可能在 hand 结束后仍保留历史玩家 |

## P2 — 已完成

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P2-NEW-008 | `Math.random()` 遗留 rooms/page.tsx:233 | ✅ 已修复 | crypto.getRandomValues() 替换 |
| P2-CLUB-003 | Club 专属房间 — 前端权限过滤 | ✅ 已修复 | rooms/page.tsx — myClubIds 过滤 + RoomCard 🏠 徽章 |
| P2-CLUB-007 | Club 专属房间 — AdminRoomController 校验缺失 | ✅ 已修复 | commit 3e8163a — admin-room.controller.ts:49-51 |
| P2-BREAKING-001 | joinByCode 返回类型变更 ClubMember | ✅ 已修复 | club.service.ts joinByCode 已返回 SharedClubMember |
| P2-NEW-001 | Web React hooks exhaustive-deps warnings | ✅ 已修复 | commit e28e902 |
| P2-NEW-002 | PlayerSeat.tsx `isSettlement` unused | ✅ 已修复 | 已移除 |
| P2-NEW-003 | rooms/page.tsx `_` unused variable | ✅ 已修复 | 改用 delete |
| P2-NEW-006 | `Button` 缺少 `loading` prop | ✅ 已修复 | commit ac33323 |

## P2 — 新发现（建议升 P1）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P2→P1-NEW-001 | Club 邀请码 Math.random() 非密码学安全 | ✅ 已修复 | club.service.ts:76 — crypto.randomInt() |
| P2→P1-NEW-002 | client.leave() 在 DB 更新之后（竞态条件） | ✅ 已修复 | game.handler.ts:323 — leave 先于 DB |
| P2→P1-NEW-003 | handlePlayerAction table-not-found 无错误事件 | ✅ 已修复 | game.handler.ts:284 — emit error 事件 |

## P2 — Club 功能

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P2-CLUB-001 | 私人邀请码 | ✅ 已实现 | 已提升为 P1-CLUB-INVITE-001 |
| P2-CLUB-002 | 俱乐部排行榜 | ✅ 已实现 | GET /clubs/:id/leaderboard + GET /clubs/:id/stats |
| P2-CLUB-003 | Club 专属房间 — 前端权限过滤缺失 | ✅ 已修复 | rooms/page.tsx — myClubIds 过滤 + RoomCard 🏠 徽章 |
| P2-CLUB-004 | Club 专属房间 — WebSocket handleJoinRoom 权限校验 | ✅ 已修复 | game.handler.ts — ClubService.isClubMember() 校验 |

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

| P2-NEW-007 | 战后手牌复盘 UI | ✅ Phase 1 后端完成 | `GET /hands/:id/replay` 实现，270 tests pass |

*最后更新: 2026-04-25 15:47 — Coding 第142轮 — commit 85963fe，270 tests pass，Hand Replay Phase 1 完成*
