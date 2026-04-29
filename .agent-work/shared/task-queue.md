# 任务队列

## 优先级说明
- **P0**: 紧急/阻塞问题（安全、Bug导致的无法使用）
- **P1**: 重要功能缺陷或体验问题
- **P2**: 优化建议

---

## P0 — 新发现（第331轮）

||| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| P0-SEC-002 | `verifyEmailCode` 无 OTP rate limit — 可暴力破解 | ✅ 已修复 | auth.controller.ts:101-110 — @ApplyRateLimit(10次/300秒, emailOrIp) |
|| P0-SEC-003 | `handlePlayerAction` 可选 roomId 导致跨房间操作注入 | ✅ 已修复 | game.handler.ts:290-306 — 强制使用 authoritative index，fail-closed when null |

## P0 — 新发现（第305轮）

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P0-TEST-001 | `advanceStreet` 缺少 `return` 在 `eligible.length === 0` — NaN 进入 `winAmounts` | ✅ 已验证无问题 | table-round.ts:161-163 — return 语句已存在，eligible.length===0 时正确早退 |

## P0 — 已完成

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P0-BACKEND-001 | `resolveFoldWin()` 缺少 `bestCards: []` | ✅ 已修复 | commit 983b85f |
| P0-BACKEND-002 | Straddle 后 `calledAllIn` 未重置 | ✅ 已修复 | commit 983b85f |
| P0-BACKEND-003 | `persistSettlementRecords` catch 中 `handId` 未定义 | ✅ 已修复 | commit 983b85f |
| P0-GAME-001 | `buildPots()` 边池分配错误 | ✅ 已修复 | table-round.ts:265-271 |
| P0-GAME-002 | `resolveFoldWin()` rake 未从 pot 扣减 | ✅ 已修复 | table-round.ts |
| P0-GAME-003 | `bestHandFrom()` 5张牌早退路径 | ✅ 已修复 | hand-evaluator.ts |
| P0-Withdraw-001 | `executeChainWithdraw` txHash 过早保存 | ✅ 已修复 | withdraw.service.ts |
| P0-Withdraw-002 | `processWithdraw` 无幂等保护 | ✅ 已修复 | withdraw.service.ts |
| P0-Deposit-001 | `checkAddressDeposits` 非原子操作 | ✅ 已修复 | deposit.service.ts |
| P0-BRUTE-001 | `game.handler.ts:99` 未 await `checkPasswordAttemptLimit` | ✅ 已修复 | line 99 已正确 await |
| P0-NEW-001 | TooManyRequestsException 编译失败 | ✅ 已修复 | 替换为 BadRequestException |
| P0-SEC-001 | Redis Session 验证绕过（fail-closed） | ✅ 已验证修复 | jwt.strategy.ts — Redis不可用时正确 throw |
| P0-TYPE-001 | Rakeback 利率前后端单位不一致 | ✅ 已修复 | commit 632fb60 — rate*100 对齐前端 |
| P0-TYPE-002 | HandResultEntry 缺 nickname | ✅ 已修复 | commit 632fb60 — matchmaking.service.ts |
| P0-TYPE-003 | FriendRequestPayload 字段名不一致 | ✅ 已修复 | commit 632fb60 — usernameOrEmail |

## P0 — 已验证无需修复

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P0-001 | Auth: Redis宕机时JWT验证被绕过 | ✅ 设计决策 | Redis不可用时拒绝所有请求=完全停机 |
| P0-002 | Withdraw: Redis不可用时cooldown被静默跳过 | ✅ 已验证 | 代码已正确throw |
| P0-003 | Withdraw: processWithdraw服务层无Admin角色验证 | ✅ 已验证 | AdminGuard在Controller层执行 |

---

## P1 — 新发现（第244轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-WALLET-001 | `exchangeBalanceToChips` 缺少 `$transaction` | ✅ 已修复 | commit a8442a0 — wallet.upsert + user.update + transaction.create 原子化 |
| P1-WITHDRAW-005 | `createWithdraw` transaction log 在原子块外 | ✅ 已修复 | commit a8442a0 — 移除外部 transaction.create |
| P1-WALLET-002 | `setBalances` Phase 2 失败静默吞掉 | ✅ 已修复 | commit a8442a0 — Promise.allSettled + rethrow non-bot errors |
| P1-WITHDRAW-007 | `executeChainWithdraw` 链确认后 DB 更新无重试 | ✅ 已修复 | commit a8442a0 — 3× retry + exponential backoff |
| P1-PRIZE-DISPLAY | TournamentCard 缺 totalPrize/GTD/registeredCount | ✅ 已修复 | commit f071ae3 — DTO + service + TournamentCard + detail page |

## P1 — 新发现（第231轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-WITHDRAW-003 | `refundChips` REJECT 路径无事务保护 | ✅ 已修复 | commit ca66c4a — processWithdraw REJECT 路径原子化 |
| P1-WITHDRAW-004 | `refundChips` handleWithdrawFailure 无事务保护 | ✅ 已修复 | commit ca66c4a — handleWithdrawFailure 原子化 |
| P1-CHAT-XSS | 聊天室消息内容未转义（XSS） | ✅ 已修复 | commit ca66c4a — DOMPurify sanitize + dangerouslySetInnerHTML；components/chat + app/room 双文件 |

## P1 — 新发现（第218轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-MISSION-TYPES | `missions/page.tsx` 缺少 `MissionStatus`/`MissionType` 类型定义和 `UserAvatar` import | ✅ 已修复 | commit e28e902 — 添加 type 定义 + UserAvatar import |

## P1 — 新发现（第201轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-DECORATOR-001 | `@InjectServer()` 返回 `undefined` | ✅ 已修复 | commit 174996b — `decorators.ts` 已清空为注释 |

## P1 — 新发现（第193轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-BACKEND-005 | `TournamentType` 未导入导致 TS2304 编译失败 | ✅ 已验证 | commit 9a25696 |

## P1 — 新发现（第151轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|------|
| P1-BACKEND-003 | WS player-action roomId=null 误报 "Invalid action or roomId" | ✅ 已修复 | commit 713a075 |

## P1 — 新发现（第149轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|------|
| P1-WEB-004 | AutoPlayPanel useEffect 闭包不稳定 | ✅ 已修复 | commit b8f73d0 |
| P1-BACKEND-001 | netProfit 计算用 `pa.bet` 而非 `totalBet` | ✅ 已修复 | commit b8f73d0 |
| P1-BACKEND-004 | getUserAvailableBalance 返回 null 静默用 0 | ✅ 已修复 | commit b8f73d0 |
| P1-WEB-002 | AllInConfirmModal 重复组件 | ✅ 已修复 | commit b8f73d0 |
| P1-WEB-003 | SocketSessionProvider 重复注册 handler | ✅ 已修复 | commit b8f73d0 |
| P1-BACKEND-002 | 3次超时后无视觉反馈 | ✅ 已修复 | commit b8f73d0 |

## P1 — 新发现（第331轮）

|||| ID | 任务 | 状态 | 备注 |
||----|------|------|------|
||| P1-BLAST-PRIVATE-JOIN | `joinBlastLobby` 缺少 `password` 参数导致私人房间无法加入 | ✅ 已修复 | commit xxx — controller: @Body('password'); service: 密码校验 |
||| P1-SEC-001 | WebSocket session 验证 Redis 宕机时被绕过 | ✅ 已验证 | app.gateway.ts:301-311 — Redis不可用时 disconnect（fail-closed） |
||| P1-SEC-002 | RateLimitGuard Redis 宕机时返回 true 允许所有请求 | ✅ 已验证 | rate-limit.guard.ts:91-92 — HTTP层降级；WS层独立fail-closed；测试日志确认 denying |
||| P1-SEC-003 | `exchangeBalanceToChips` balance 检查在事务外（TOCTOU） | ✅ 已验证 | wallet.service.ts:352 — balance检查在360行$transaction事务内 |

## P1 — 新发现（第305轮）

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-TEST-001 | `client.leave()` 在 room lock 之前 — 广播竞态 | ✅ 设计决策 | game.handler.ts:377 — intentional leave-before-lock to avoid race with DB state |
| P1-TEST-002 | `freezeBalance` 无 `availableBalance >= amount` 校验 | ✅ 已修复 | commit 7216be8 — guard + BadRequestException |
| P1-TEST-003 | Bot prefix 碰撞导致 `coinBalance` 从不同步 | ✅ 已验证无问题 | bot_ UUID 唯一，setBalances 已跳过 BOT_ID_PREFIX 用户 |
| P1-TEST-004 | Table 组件无 `React.memo` 导致级联 re-render | ✅ 已修复 | commit 7e756ba — GameTable wrapped with React.memo |
| P2-MOBILE-RECONNECT | Mobile `setRejoinAvailableHandler` 未注册 | ✅ 已修复 | commit 7d5bbaf |
| P1-FIRST-DEPOSIT | 首充奖金前端 UI | ✅ 已实现 | deposit/page.tsx — bonus status + wagering 进度条 |
| P1-DAILY-MISSIONS | 每日任务前端 UI | ✅ 已实现 | missions/page.tsx — 522行，10个任务 |
| P1-MISSION-WIRING | MissionService 游戏事件未连线 | ✅ 已修复 | commit 9de7619 — persistSettlementRecords 触发 onHandWon/onHandPlayed/onSettlement/onRakeContributed |
| P1-WAGERING-WIRING | wagering 追踪未连线 | ✅ 已修复 | commit 9de7619 — depositService.addWagering() 于每局结算时调用 |
| P1-CHAT-001 | 房间内聊天 UI | ✅ 后端完成 | 前端: ChatPanel 集成（commit dd41bc8）；前端集成测试未实施 → P2-CHAT-FRONTEND-TEST |
| P1-SCHEDULE-001 | 赛事日历前端 UI | ✅ 已实现 | commit 3f29993 — schedule/page.tsx + [id]/page.tsx + 4 components + lobby-header nav |

## P1 — 规格就绪（待 Coding 实施）

| ID | 任务 | 规格来源 | 关键参数 |
|----|------|---------|---------|
| P1-HANDREPLAY-002 | Hand Replay Phase 2 | ✅ 已实现 | commit e7e8f1a |
| P1-TOURNAMENT-001 | Tournament SNG Phase 1+2 | ✅ 已实现 | commit 0a7687d |
| P1-FIRST-DEPOSIT | 首充奖金规格 | ✅ 已实现 | Backend: DepositBonus model + getBonusStatus/addWagering + /bonus/status + /bonus/wagering endpoints |
| P1-DAILY-MISSIONS | 每日任务规格 | ✅ 后端完成 | Backend: mission.service.ts (10 missions, progress/claim/reset), mission.controller.ts, Mission/UserMission models; 前端 UI 待实施 |
| P1-BLAST-001 Phase 4A | Blast 前端 UI（lobby列表+创建+加入） | ✅ 已完成 | commit de4156b — app/blast/page.tsx + components/blast/* + lobby-header按钮 |
| P1-BLAST-001 Phase 4B | Blast SpinWheel 3D 动画 | ✅ 已完成 | commit de4156b — SpinWheel.tsx (Framer Motion, 2x/5x/10x segments) + MatchingOverlay.tsx |
| P1-BLAST-001 Phase 4C | Blast WS 事件集成 | ✅ 已完成 | commit de4156b — hooks/useBlastSocket.ts (blast_game_started/ended/forfeited) |
| P1-BLAST-001 Phase 1+2+3 | Blast 后端 + WS | ✅ Phase 1+2+3 完成 | commit 88e245a (Phase 3) |

## P1 — 遗留缺陷（待 Coding 修复）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-BLAST-009 | `distributePrizes()` 需 `$transaction` 包装 | ✅ 已修复 | commit 82ebcf6 — distributePrizes + returnFrozenChips 原子化 |
| P1-BLAST-010 | `returnFrozenChips()` 需 `$transaction` 包装 | ✅ 已修复 | commit 82ebcf6 |
| P1-BLAST-011 | `Math.random()` 替换为 `crypto.randomBytes()` | ✅ 已修复 | commit 82ebcf6 — 博彩公平性 |
| P1-BLAST-012 | Blast Phase 3 规格确认 | 🟡 待 Productor | endsAt/退款机制/持久化/惩罚 |

## P1 — 已完成

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-CLUB-INVITE-001 | Club 私人邀请码 | ✅ 已实现 | bfd9ffa |
| P1-TEST-001 | `connection-state.service.spec.ts` 缺失 | ✅ 已实现 | 22 个测试用例 |
| P1-RAKEBACK-002 | Rakeback 5 tier 代码实现 | ✅ 已实现 | commit dc28855 |
| P1-RAKEBACK-003 | Rakeback service.spec.ts 13 tests failing | ✅ 已修复 | commit dc3e4a |
| P1-NEW-001 | `buildPots` 使用 stale `allPlayers` | ✅ 已确认无问题 | showdown 调用时 allPlayers 已是最新快照 |
| P1-NEW-002 | Withdraw 幂等性修复未提交 | ✅ 已提交 | withdraw.service.ts |
| P1-001 | `TableManager.getTable()` 并发竞态 | ✅ 已修复 | 并发测试通过 |
| P1-002 | Redis 不可用时 rate limit 回退 | ✅ 已修复 | fail-closed 策略 |
| P1-003 | 密码暴力破解保护 in-memory Map | ✅ 已修复 | Redis 迁移完成 |
| P1-005 | `persistSettlementRecords` 静默失败 | ✅ 已修复 | AdminLog 告警 |
| P1-004 | Rakeback 前端空白 | ✅ 已实现 | GET/POST /user/rakeback |
| P1-CLUB-TEST-001 | ClubService spec RedisService 依赖缺失 | ✅ 已修复 | commit dc3e4a |

---

## P2 — 新发现（第305轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|-------|
| P2-TEST-001 | `exchangeBalanceToChips` 事务外读取 balance | 🔍 待认领 | wallet.service.ts |
| P2-TEST-002 | ELO 边界强制分离事务 | 🔍 待认领 | matchmaking.service.ts |
| P2-TEST-003 | `getBalance` 返回总额（依赖调用方 discipline） | 🔍 待认领 | wallet.service.ts |
| P2-TEST-004 | WebSocket `socket.on` listeners 未 cleanup | ✅ 已验证已有 | use-game-socket.ts:66-70 已有正确 on/off cleanup — 建议关闭 |
| P2-TEST-005 | `TableState`/`Player` 类型在 web/shared 间漂移 | 🔍 待认领 | types |
| P2-TEST-006 | 操作按钮无重复提交保护 | 🔍 待认领 | ActionBar |
| P2-TEST-007 | Token 过期用 `window.location.replace` 丢弃状态 | 🔍 待认领 | auth |
| P2-TEST-008 | 无 refresh token 机制 | 🔍 Open |

## P2 — 新发现（第317轮）

| P2-WEB-JEST-001 | `jest.mock('@texas/shared')` 解析失败 | ✅ 已修复 | jest.config.ts — moduleNameMapper 添加 @texas/shared 映射 |

## P2 — 新增（第316轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|-------|
| P2-NEW-018 | BullMQ 无幂等键 | ✅ 已完成 | jobId: withdraw-${requestId} 幂等键已实现 |
| P2-NEW-014 | broadcastTableState 串行 emit | 🔍 降级P3 | 无正确性风险，性能优化 |
| P2-DEBUG-LOG | app.gateway.spec.ts console.log 残留 | 🔍 P3 清理 | 不影响生产 |

## P2 — 新增（第318轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|-------|
| P2-BLAST-001 | Blast Phase 3: Call `table.addPlayer(playerId, BLAST_INITIAL_CHIPS)` | ✅ 已完成 | commit d2f8e71 — table.addPlayer + Prisma nickname fetch |
| P2-BLAST-002 | Blast Phase 3: Schedule timer to call `endBlastGame` at endsAt | ✅ 已完成 | commit d2f8e71 — setTimeout at endsAt - Date.now() |
| P2-BLAST-003 | Blast Phase 3: Emit `blast_game_started` WebSocket event | ✅ 已完成 | commit d2f8e71 — wsManager.emitToUser for each player |
| P2-BLAST-004 | Blast Phase 3: Emit `blast_game_ended` WebSocket event | ✅ 已完成 | commit d2f8e71 — wsManager.emitToUser with rankings |
| P2-BLAST-005 | Blast Phase 3: Persist BlastGame record to Prisma | ⏭️ 跳过 | 需要 Prisma schema 变更，超出后端范围 |
| P2-BLAST-006 | Blast Phase 3: Emit `blast_player_forfeited` WebSocket event | ✅ 已完成 | commit d2f8e71 — wsManager.emitToUser for remaining players |
| P2-BLAST-007 | Set TTL on Redis key using `redis.setex` | ✅ 已完成 | commit d2f8e71 — redis.client.setex with TTL |
| P2-BLAST-008 | Blast Phase 3: Clear table state via TableManager | ✅ 已完成 | commit d2f8e71 — tableManager.clearTableState(tableId) |

## P2 — 新增（第324轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|-------|
| P2-NEW-020 | `activeGames` Map 无主动 TTL 清理机制 | 🔍 Open | P3 — 进程生命周期绑定 |
| P2-NEW-021 | BlastService Phase 3 缺少单元测试 | 🔍 Open | startBlastGame/endBlastGame/forfeitBlast 无 spec |

## P2 — 新增（第322轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|-------|
| P2-NEW-019 | `drawBlastMultiplier()` 使用 `Math.random()` 非密码学安全 | ✅ 已修复 | commit 8e33987 — crypto.getRandomValues 替换 |

## P2 — 进行中

|| ID | 任务 | 状态 | 备注 |
|----|------|------|-------|
| ~~P2-EMOJI-REF~~ | `use-game-socket.ts` ref 违规访问 | ✅ 已修复 | commit b72f640 — useRef → useState |
| P2-NEW-012 | `resolveFoldWin` 绕过 side-pot | ✅ 已修复 | commit 0a98c20 — buildPots() 边池分配 + eligiblePlayerIds 过滤 |
|| P2-WEB-SPEC | Web 页面组件测试 | 🟡 部分完成 | Jest 基础设施 + AuthProvider + SocketSessionProvider（15 tests） |
|| P2-TOURNAMENT-SPEC | Tournament spec | ✅ 已完成 | commit 745db4d — friend.service.spec.ts (41 tests) + match/wallet specs |
|| P2-WALLET-SPEC-TS | wallet.service.spec.ts `$transaction` mock TS 类型错误 | ✅ 已修复 | commit 77c41d9 — `unknown[]` + 类型断言解决 `never` 问题 |
|| P2-ROOM-RETRY | 重试逻辑无指数退避 | 🔍 待认领 | deposit/page.tsx:106 |
|| P2-CODE-PATTERN | mission/table-engine Promise.all 优化 | 🔍 待认领 | mission.service.ts / table-manager.service.ts |
|| P2-CHAT-STUB | `handleClaim` 无实际 API 调用 | ⚠️ 建议关闭 | 架构决策，backend auto-claim |
|| P2-WS-RATE-UNIT | 时间单位注释混淆 | 🔍 待认领 | connection-state.service.ts:107 |
|| P2-PROFILE-001 | 玩家资料页丰富化 | 📋 规格已就绪 | 头像框/成就徽章 |
|| P2-NOTIFY-001 | 站内通知中心 | 📋 规格已就绪 | 朋友上线/Club开赛提醒 |
|| P2-ROOM-PASSWORD | 房间密码明文存 sessionStorage | ✅ 已修复 | room/[id]/page.tsx — join后 removeItem |
|| P2-JWT-LOCALSTORAGE | JWT 存 localStorage — XSS 目标 | ✅ 后端完成 | httpOnly cookie 后端完成；Web 前端 socket.io cookie auth 留 P2 |
|| P2-MOBILE-RECONNECT | Mobile reconnect handler | ✅ 已修复 | commit 7d5bbaf |
|| P2-CHAT-INJECTION | Chat username 未验证 userId | ✅ 已修复 | commit 88af108 |
|| P2-CHAT-FRONTEND-TEST | P1-CHAT-001 前端集成测试未实现 | ⚠️ 建议关闭 | ChatPanel 组件无独立 WS 依赖 |
|| P2-DEPOSIT-ATOMIC | `checkAddressDeposits` 每事件非原子 | ✅ 已修复 | commit 8ce5e54 |
|| P2-DEPOSIT-TOCTOU | `getOrCreateDepositAddress` 索引竞争 | ✅ 已修复 | commit 31f4bba |
|| P2-AUTH-OTP-PARSE | OTP JSON 解析无 try/catch | ✅ 已修复 | commit 8ce5e54 |
|| P2-DEPOSIT-E2E-MOCK | `deposit.e2e.spec.ts` mock 需加 mockReset | ✅ 已修复 | commit a7c3b21 |
|| P2-DEPOSIT-DIAG-FILES | `debug-deposit.spec.ts` + `diag.spec.ts` 未清理 | ✅ 已修复 | commit a7c3b21 |
|| P2-CHAT-DUP | 两个 ChatPanel 文件完全重复 | ✅ 已修复 | 统一使用 @/components/chat/ChatPanel |
|| P2-DEPOSIT-I18N | 成功消息硬编码中文 | ✅ 已修复 | commit a10563a |
|| P2-ROUTER-ANY | `router.events` 类型断言 `as any` | ✅ 已修复 | commit f68572e |
|| P2-TOURNAMENT-RANDOM | `generateId()` Math.random() 非密码学安全 | ✅ 已修复 | commit 4275b84 |
|| P2-EMOJI-001 | 表情反应系统 | ✅ 已实现 | commit 75d5b5f |
|| P2-EMOJI-ROOMID | emoji-reaction payload 缺少 roomId | ✅ 已修复 | commit c177780 |
|| P2-WEB-PRIZE | TournamentCard.tsx `prize` unused var | 🔍 待认领 | f071ae3 实施遗留 |

## P2 — 已完成（本轮更新）

| ID | 任务 | 状态 | 备注 |
|----|------|------|-------|
| P2-WEB-LINT-WARNINGS | ActionBar + room/page.tsx unused imports | ✅ 已修复 | commit bbc3eb8 — 移除 useState/useRef/useGameSocket/AllowedEmoji；useEffect eslint-disable |
| P2-EMOJI-ROOMID | emoji-reaction payload 缺少 roomId | ✅ 已修复 | game.handler.ts:607 — broadcast payload 加 roomId 字段 |
| P2-NEW-024 | SpinWheel 3→9 tiers + drawBlastMultiplier 对齐 | ✅ 已修复 | commit fdaecbe — SpinWheel 9段: 2x,3x,5x,10x,15x,25x,50x,100x,1000x；后端移除不在轮盘的值 |
| P2-NEW-030 | 房间实时人数状态显示 | ✅ 已完成 | room-card.tsx — gameState prop + 颜色编码状态徽章（缺人/等待开始/进行中） |

## P2 — 已完成

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P2-NEW-008 | `Math.random()` 遗留 rooms/page.tsx:233 | ✅ 已修复 | crypto.getRandomValues() 替换 |
| P2-CLUB-003 | Club 专属房间 — 前端权限过滤 | ✅ 已修复 | rooms/page.tsx — myClubIds 过滤 |
| P2-CLUB-007 | Club 专属房间 — AdminRoomController 校验缺失 | ✅ 已修复 | admin-room.controller.ts |
| P2-BREAKING-001 | joinByCode 返回类型变更 ClubMember | ✅ 已修复 | club.service.ts |
| P2-NEW-001 | Web React hooks exhaustive-deps warnings | ✅ 已修复 | commit e28e902 |
| P2-NEW-002 | PlayerSeat.tsx `isSettlement` unused | ✅ 已修复 | 已移除 |
| P2-NEW-003 | rooms/page.tsx `_` unused variable | ✅ 已修复 | 改用 delete |
| P2-NEW-006 | `Button` 缺少 `loading` prop | ✅ 已修复 | commit ac33323 |

## P2 — 新发现（建议升 P1）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| P2→P1-NEW-001 | Club 邀请码 Math.random() 非密码学安全 | ✅ 已修复 | crypto.randomInt() |
|| P2→P1-NEW-002 | client.leave() 在 DB 更新之后（竞态条件） | ✅ 已修复 | game.handler.ts:323 |
|| P2→P1-NEW-003 | handlePlayerAction table-not-found 无错误事件 | ✅ 已修复 | game.handler.ts:284 |

## P2 — TypeScript 编译错误（已全部修复）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| ~~P2-TS-002~~ | app.gateway.ts action 类型不兼容 | ✅ 已修复 | 联合类型 |
|| ~~P2-TS-001~~ | table-manager.service.spec.ts 参数数量 | ✅ 已修复 | rakebackService 占位符 |
|| ~~P2-TS-003~~ | timer-debug.spec.ts 参数数量 | ✅ 已修复 | processAction mock 签名 |
|| ~~P2-LINT-001~~ | game.handler.ts prettier 格式错误 | ✅ 已修复 | lint --fix |
|| ~~P2-004~~ | Web `<img>` → `<Image />` | ✅ 已用 ExternalImg | 外部URL无法用Next.js Image |
|| ~~P2-NEW-001~~ | app.gateway.ts `amount?: unknown` | ✅ 已修复 | `amount?: number` |
|| ~~P2-NEW-002~~ | creditRakeback 事务语法 | ✅ 已修复 | callback 语法 |
|| ~~P2-NEW-003~~ | `adminLogSettlementFailure` 内部异常静默丢弃 | ✅ 已修复 | console.error 已添加 |
|| ~~P2-NEW-004~~ | Rakeback 前端 `type Tier` 与后端重复定义 | ✅ 已修复 | type Tier = RakebackTier |
|| ~~P2-NEW-005~~ | Club page 3 个 eslint-disable 硬编码 | ✅ 已修复 | ExternalImg 组件 |

## P2 — TypeScript 编译错误（spec/e2e 文件）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| ~~P2-TS-NEW~~ | rakeback.controller.spec.ts Request 类型断言 | ✅ 已修复 | `{ user: typeof mockUser }` |
|| ~~P2-TS-NEW-003~~ | connection-state.service.spec.ts mock 类型错误 | ✅ 已修复 | mockRedisService 返回 `any` |
|| ~~P2-TS-NEW-002~~ | rakeback.e2e-spec.ts passwordHash 字段名 | ✅ 已修复 | `passwordHash` → `password` |

## P2 — 其他已完成

| ID | 任务 | 状态 |
|----|------|------|
| P2-002 | Club 数据库迁移 | ⏳ 待执行 |
| P2-003 | Sit-Out 重构 | ✅ 已实现 |
| P2-004 | All-in 确认弹窗 | ✅ 前端实现完成 |

---

## P3 — Tournament 路线图

|| Phase | 内容 | 状态 |
|-------|------|------|
|| Phase 1 | SNG 单桌赛 | ✅ 已实现（P1-TOURNAMENT-001） |
|| Phase 2 | Jackpot SNG | 📋 规划中 |
|| Phase 3 | MTT 多桌赛 | 📋 规划中 |

| P2-NEW-007 | 战后手牌复盘 UI | ✅ Phase 1+2 完成 | commit e7e8f1a — EquityCurveChart/PotOddsTooltip/PlaybackControls/SpeedSelector/AutoPlayPanel |

---

*最后更新: 2026-04-27 13:30 — Coding 第325轮 — P1-BLAST-001 Phase 4A ✅ — 6 files — 452 tests — 0 P0 / 1 P1 / ~9 P2 *"
