# 任务队列

## 优先级说明
- **P0**: 紧急/阻塞问题（安全、Bug导致的无法使用）
- **P1**: 重要功能缺陷或体验问题
- **P2**: 优化建议

---

## P0 — 新发现（第292轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P0-E2E-001 | E2E 测试套件无法启动 — `Cannot find module '@texas/shared/types/tournament'` | ✅ 已修复 | test/jest-e2e.json 添加 moduleNameMapper；packages/shared exports 加 ./types/tournament |
| P0-E2E-002 | `jest-e2e.json` moduleNameMapper 路径错误 — `<rootDir>/../../` 解析为 `apps/packages/` 而非项目根 | ✅ 已修复 | commit 本地 — 3层 `../` |

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

## P1 — 新发现（第291轮）

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| P1-NEW-003 | `setBalances` Phase 2 非原子 — wallet.chips 和 user.coinBalance 可能不一致 | 🟡 待认领 | wallet.service.ts:64-136 |
|| P1-NEW-004 | `exchangeChipsToBalance` 余额检查在事务外 — TOCTOU | 🟡 待认领 | wallet.service.ts:275 |
|| P1-NEW-005 | `createWithdraw` 余额检查 TOCTOU — 并发创建可超额提现 | ✅ 已修复 | commit 9c48a17 — 余额检查移至事务内 |
|| P1-NEW-006 | `handleWithdrawFailure` 状态检查在事务外 — 并发双重退款 | ✅ 已修复 | commit 9c48a17 — 整体已原子化（状态更新+退款在同一tx） |
|| P1-NEW-007 | `register` 用户创建和钱包创建非原子 | ✅ 已修复 | commit 9c48a17 — user+wallet 同事务创建 |
|| P1-NEW-008 | `registerWithEmail` 同上 | ✅ 已修复 | commit 9c48a17 — user+wallet 同事务创建 |
|| P1-NEW-009 | `rejectWithdrawRequest` 状态检查在事务外 — 并发双重退款 | ✅ 已修复 | commit 9c48a17 — 整体流程原子化 |
|| P1-NEW-010 | `checkStaleProcessing` 无幂等保护 — 可能重复入队 | ✅ 已修复 | commit 45e0053 — isInQueue 幂等检查 |
|| P1-NEW-011 | `createWithdraw` 测试回归 — "balance insufficient" 测试失败 | ✅ 已修复 | commit c5da1b7 — mock tx.wallet.findUnique 代替 walletService.getAvailableBalance |

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

## P1 — 进行中

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-004 | Jest Worker 泄漏 | 🟡 监控中 | `--detectOpenHandles` 已启用 |
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
| P1-BLAST-001 | Blast 即时赛事 | 📋 规格待定义 | 参考 GGPoker SPINS |

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

## P2 — 新发现（第290轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|-------|
| P2-NEW-009 | 手牌评估 if→else-if 链（代码脆弱） | 🟡 待认领 | hand-evaluator.ts:88-103 |
| P2-NEW-010 | `best!` 非空断言不sound | 🟡 待认领 | hand-evaluator.ts:189-195 |
| P2-NEW-011 | 小盲 all-in 时 `currentBet` 设为 bbAmount 而非实际投入 | 🟡 待认领 | table-game-logic.ts:133-148 |
| P2-NEW-012 | `resolveFoldWin` 绕过 side-pot 逻辑 | 🟡 待认领 | table-round.ts:295-324 |
| P2-NEW-013 | `Math.floor` pot 切分零头总给第一赢家，多次分配可能积累误差 | 🟡 待认领 | table-round.ts:207-214 |
| P2-NEW-014 | `broadcastTableState` 在 lock 释放后异步广播 | 🟡 待认领 | game.handler.ts |
| P2-NEW-015 | `client.leave` 先于 DB 更新，快速重连可读旧状态 | 🟡 待认领 | game.handler.ts:375-377 |
| P2-NEW-016 | `unfreezeBalance` findUnique 在事务外 TOCTOU | 🟡 待认领 | wallet.service.ts:191-207 |
| P2-NEW-017 | `processWithdraw` APPROVE 路径 adminLog 在事务外 | 🟡 待认领 | withdraw.service.ts:429-437 |
| P2-NEW-018 | BullMQ 队列无请求级幂等键 | 🟡 待认领 | withdraw.service.ts |
| P2-NEW-019 | JWT 无 jti 无法吊销；无 refreshToken；改密不使活会话失效 | 🟡 待认领 | auth.service.ts |
| P2-NEW-020 | `logout` 中 tableManager.leaveCurrentRoom 错误被静默吞掉 | 🟡 待认领 | auth.service.ts:312 |
| P2-NEW-021 | `resetToWaiting` 不清理 rakeAmount/rakePercent | 🟡 待认领 | table-game-logic.ts:161-194 |

## P2 — 进行中

| ID | 任务 | 状态 | 备注 |
|----|------|------|-------|
| ~~P2-EMOJI-REF~~ | `use-game-socket.ts` ref 违规访问 | ✅ 已修复 | commit b72f640 — useRef → useState |
| P2-WEB-SPEC | Web 页面组件测试 | 🟡 部分完成 | Jest 基础设施 + AuthProvider + SocketSessionProvider（15 tests） |
| P2-TOURNAMENT-SPEC | Tournament spec | ✅ 已完成 | commit 745db4d — friend.service.spec.ts (41 tests) + match/wallet specs |
| P2-WALLET-SPEC-TS | wallet.service.spec.ts `$transaction` mock TS 类型错误 | ✅ 已修复 | commit 77c41d9 — `unknown[]` + 类型断言解决 `never` 问题 |
| ~~P2-ROOM-RETRY~~ | 重试逻辑无指数退避 | ✅ 已修复 | eb4230e — deposit/page.tsx 指数退避 800ms→10s 上限 |
| ~~P2-CODE-PATTERN~~ | mission/table-engine Promise.all 优化 | ✅ 已修复 | eb4230e — mission.service.ts Promise.allSettled + 失败日志 |
| ~~P2-WS-RATE-UNIT~~ | 时间单位注释混淆 | ✅ 已修复 | eb4230e — connection-state.service.ts TTL 注释澄清 |
| P2-PROFILE-001 | 玩家资料页丰富化 | 📋 规格已就绪 | 头像框/成就徽章 |
| P2-NOTIFY-001 | 站内通知中心 | 📋 规格已就绪 | 朋友上线/Club开赛提醒 |
| P2-ROOM-PASSWORD | 房间密码明文存 sessionStorage | ✅ 已修复 | room/[id]/page.tsx — join后 removeItem |
| P2-JWT-LOCALSTORAGE | JWT 存 localStorage — XSS 目标 | ✅ 后端完成 | httpOnly cookie 后端完成；Web 前端 socket.io cookie auth 留 P2 |
| P2-MOBILE-RECONNECT | Mobile reconnect handler | ✅ 已修复 | commit 7d5bbaf |
| P2-CHAT-INJECTION | Chat username 未验证 userId | ✅ 已修复 | commit 88af108 |
| P2-CHAT-FRONTEND-TEST | P1-CHAT-001 前端集成测试未实现 | ⚠️ 建议关闭 | ChatPanel 组件无独立 WS 依赖 |
| P2-DEPOSIT-ATOMIC | `checkAddressDeposits` 每事件非原子 | ✅ 已修复 | commit 8ce5e54 |
| P2-DEPOSIT-TOCTOU | `getOrCreateDepositAddress` 索引竞争 | ✅ 已修复 | commit 31f4bba |
| P2-AUTH-OTP-PARSE | OTP JSON 解析无 try/catch | ✅ 已修复 | commit 8ce5e54 |
| P2-DEPOSIT-E2E-MOCK | `deposit.e2e.spec.ts` mock 需加 mockReset | ✅ 已修复 | commit a7c3b21 |
| P2-DEPOSIT-DIAG-FILES | `debug-deposit.spec.ts` + `diag.spec.ts` 未清理 | ✅ 已修复 | commit a7c3b21 |
| P2-CHAT-DUP | 两个 ChatPanel 文件完全重复 | ✅ 已修复 | 统一使用 @/components/chat/ChatPanel |
| P2-DEPOSIT-I18N | 成功消息硬编码中文 | ✅ 已修复 | commit a10563a |
| P2-ROUTER-ANY | `router.events` 类型断言 `as any` | ✅ 已修复 | commit f68572e |
| P2-TOURNAMENT-RANDOM | `generateId()` Math.random() 非密码学安全 | ✅ 已修复 | commit 4275b84 |
| P2-EMOJI-001 | 表情反应系统 | ✅ 已实现 | commit 75d5b5f |
| P2-EMOJI-ROOMID | emoji-reaction payload 缺少 roomId | ✅ 已修复 | commit c177780 |
| P2-WEB-PRIZE | TournamentCard.tsx `prize` unused var | 🔍 待认领 | f071ae3 实施遗留 |

## P2 — 已完成（本轮更新）

| ID | 任务 | 状态 | 备注 |
|----|------|------|-------|
| P2-ADM-001 | rooms/page.tsx:264 `data.data.length` possibly undefined | ✅ 已修复 | commit caf2e35 |
| P2-ADM-002 | system/page.tsx:104 `number | undefined` not assignable to `number` | ✅ 已修复 | commit caf2e35 |
| P2-ADM-003 | users/[id]/page.tsx:143,146 `.items` → `.data` on PaginatedResponse | ✅ 已修复 | commit caf2e35 |
| P2-ADM-004 | users/[id]/page.tsx:146 `tx` implicit `any` | ✅ 已修复 | commit caf2e35 — `tx: Transaction` |
| P2-ADM-005 | withdraw/page.tsx:296 string not assignable to status literal | ✅ 已修复 | commit caf2e35 — `as const` |
| P2-WEB-LINT-WARNINGS | ActionBar + room/page.tsx unused imports | ✅ 已修复 | commit bbc3eb8 — 移除 useState/useRef/useGameSocket/AllowedEmoji；useEffect eslint-disable |
| P2-EMOJI-ROOMID | emoji-reaction payload 缺少 roomId | ✅ 已修复 | game.handler.ts:607 — broadcast payload 加 roomId 字段 |

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
| P2→P1-NEW-001 | Club 邀请码 Math.random() 非密码学安全 | ✅ 已修复 | crypto.randomInt() |
| P2→P1-NEW-002 | client.leave() 在 DB 更新之后（竞态条件） | ✅ 已修复 | game.handler.ts:323 |
| P2→P1-NEW-003 | handlePlayerAction table-not-found 无错误事件 | ✅ 已修复 | game.handler.ts:284 |

## P2 — TypeScript 编译错误（已全部修复）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| ~~P2-TS-002~~ | app.gateway.ts action 类型不兼容 | ✅ 已修复 | 联合类型 |
| ~~P2-TS-001~~ | table-manager.service.spec.ts 参数数量 | ✅ 已修复 | rakebackService 占位符 |
| ~~P2-TS-003~~ | timer-debug.spec.ts 参数数量 | ✅ 已修复 | processAction mock 签名 |
| ~~P2-LINT-001~~ | game.handler.ts prettier 格式错误 | ✅ 已修复 | lint --fix |
| ~~P2-004~~ | Web `<img>` → `<Image />` | ✅ 已用 ExternalImg | 外部URL无法用Next.js Image |
| ~~P2-NEW-001~~ | app.gateway.ts `amount?: unknown` | ✅ 已修复 | `amount?: number` |
| ~~P2-NEW-002~~ | creditRakeback 事务语法 | ✅ 已修复 | callback 语法 |
| ~~P2-NEW-003~~ | `adminLogSettlementFailure` 内部异常静默丢弃 | ✅ 已修复 | console.error 已添加 |
| ~~P2-NEW-004~~ | Rakeback 前端 `type Tier` 与后端重复定义 | ✅ 已修复 | type Tier = RakebackTier |
| ~~P2-NEW-005~~ | Club page 3 个 eslint-disable 硬编码 | ✅ 已修复 | ExternalImg 组件 |

## P2 — TypeScript 编译错误（spec/e2e 文件）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| ~~P2-TS-NEW~~ | rakeback.controller.spec.ts Request 类型断言 | ✅ 已修复 | `{ user: typeof mockUser }` |
| ~~P2-TS-NEW-003~~ | connection-state.service.spec.ts mock 类型错误 | ✅ 已修复 | mockRedisService 返回 `any` |
| ~~P2-TS-NEW-002~~ | rakeback.e2e-spec.ts passwordHash 字段名 | ✅ 已修复 | `passwordHash` → `password` |

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
| Phase 1 | SNG 单桌赛 | ✅ 已实现（P1-TOURNAMENT-001） |
| Phase 2 | Jackpot SNG | 📋 规划中 |
| Phase 3 | MTT 多桌赛 | 📋 规划中 |

| P2-NEW-007 | 战后手牌复盘 UI | ✅ Phase 1+2 完成 | commit e7e8f1a — EquityCurveChart/PotOddsTooltip/PlaybackControls/SpeedSelector/AutoPlayPanel |

---

*最后更新: 2026-04-27 05:45 — Coding 第294轮 — P0-E2E-002 已修复 — 410 tests ✅ *
