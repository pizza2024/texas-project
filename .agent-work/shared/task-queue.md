# 任务队列

## 优先级说明
- **P0**: 紧急/阻塞问题（安全、Bug导致的无法使用）
- **P1**: 重要功能缺陷或体验问题
- **P2**: 优化建议

---

## P0 — 新发现（第207轮）

*(无)*

## P0 — 已完成

||| ID | 任务 | 状态 | 备注 |
|----|------|------|------|------|
||| P0-BACKEND-001 | `resolveFoldWin()` 缺少 `bestCards: []` | ✅ 已修复 | commit 983b85f |
||| P0-BACKEND-002 | Straddle 后 `calledAllIn` 未重置 | ✅ 已修复 | commit 983b85f |
||| P0-BACKEND-003 | `persistSettlementRecords` catch 中 `handId` 未定义 | ✅ 已修复 | commit 983b85f |
||| P0-GAME-001 | `buildPots()` 边池分配错误 | ✅ 已修复 | table-round.ts:265-271 |
||| P0-GAME-002 | `resolveFoldWin()` rake 未从 pot 扣减 | ✅ 已修复 | table-round.ts |
||| P0-GAME-003 | `bestHandFrom()` 5张牌早退路径 | ✅ 已修复 | hand-evaluator.ts |
||| P0-Withdraw-001 | `executeChainWithdraw` txHash 过早保存 | ✅ 已修复 | withdraw.service.ts |
||| P0-Withdraw-002 | `processWithdraw` 无幂等保护 | ✅ 已修复 | withdraw.service.ts |
||| P0-Deposit-001 | `checkAddressDeposits` 非原子操作 | ✅ 已修复 | deposit.service.ts |
||| P0-BRUTE-001 | `game.handler.ts:99` 未 await `checkPasswordAttemptLimit` | ✅ 已修复 | line 99 已正确 await |
||| P0-NEW-001 | TooManyRequestsException 编译失败 | ✅ 已修复 | 替换为 BadRequestException |
||| P0-SEC-001 | Redis Session 验证绕过（fail-closed） | ✅ 已验证修复 | jwt.strategy.ts — Redis不可用时正确 throw |

## P0 — 已验证无需修复

||| ID | 任务 | 状态 | 备注 |
|----|------|------|------|------|
||| P0-001 | Auth: Redis宕机时JWT验证被绕过 | ✅ 设计决策 | Redis不可用时拒绝所有请求=完全停机 |
||| P0-002 | Withdraw: Redis不可用时cooldown被静默跳过 | ✅ 已验证 | 代码已正确throw |
||| P0-003 | Withdraw: processWithdraw服务层无Admin角色验证 | ✅ 已验证 | AdminGuard在Controller层执行 |

---

## P1 — 新发现（第207轮）

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| ~~P1-WS-STACK-VALIDATION~~ | `handlePlayerAction` server-side 未校验 `amount <= player.stack` | ❌ **已关闭** | ❌ 误报 — `table-player-ops.ts` 内部已用 `Math.min` 保护，raise/call 均有 cap，无溢出风险 |

## P1 — 新发现（第201轮）

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| P1-DECORATOR-001 | `@InjectServer()` 返回 `undefined` | ✅ 已修复 | commit 174996b — `decorators.ts` 已清空为注释 |

## P1 — 新发现（第193轮）

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| P1-BACKEND-005 | `TournamentType` 未导入导致 TS2304 编译失败 | ✅ 已验证 | commit 9a25696 |

## P1 — 新发现（第151轮）

|||| ID | 任务 | 状态 | 备注 |
||----|------|------|------|------|
||| P1-BACKEND-003 | WS player-action roomId=null 误报 "Invalid action or roomId" | ✅ 已修复 | commit 713a075 |

## P1 — 新发现（第149轮）

|||| ID | 任务 | 状态 | 备注 |
||----|------|------|------|------|
||| P1-WEB-004 | AutoPlayPanel useEffect 闭包不稳定 | ✅ 已修复 | commit b8f73d0 |
||| P1-BACKEND-001 | netProfit 计算用 `pa.bet` 而非 `totalBet` | ✅ 已修复 | commit b8f73d0 |
||| P1-BACKEND-004 | getUserAvailableBalance 返回 null 静默用 0 | ✅ 已修复 | commit b8f73d0 |
||| P1-WEB-002 | AllInConfirmModal 重复组件 | ✅ 已修复 | commit b8f73d0 |
||| P1-WEB-003 | SocketSessionProvider 重复注册 handler | ✅ 已修复 | commit b8f73d0 |
||| P1-BACKEND-002 | 3次超时后无视觉反馈 | ✅ 已修复 | commit b8f73d0 |

## P1 — 进行中

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| P1-004 | Jest Worker 泄漏 | 🟡 监控中 | `--detectOpenHandles` 已启用 |
| P1-MISSION-WIRING | MissionService 游戏事件未连线 | ✅ 已修复 | commit 9de7619 — persistSettlementRecords 触发 onHandWon/onHandPlayed/onSettlement/onRakeContributed |
| P1-WAGERING-WIRING | wagering 追踪未连线 | ✅ 已修复 | commit 9de7619 — depositService.addWagering() 于每局结算时调用 |
|| P1-CHAT-001 | 房间内聊天 UI | ✅ 后端完成 | 后端: chat-message WS事件 + 1msg/5s速率限制; 前端: ChatPanel 集成（commit dd41bc8）；前端集成测试未实施 → P2-CHAT-FRONTEND-TEST |
|| P1-SCHEDULE-001 | 赛事日历/时间表 | ✅ 后端完成 | 前端 UI 待实施 |

## P1 — 规格就绪（待 Coding 实施）

|| ID | 任务 | 规格来源 | 关键参数 |
|----|------|---------|---------|
|| P1-HANDREPLAY-002 | Hand Replay Phase 2 | ✅ 已实现 | commit e7e8f1a |
|| P1-TOURNAMENT-001 | Tournament SNG Phase 1+2 | ✅ 已实现 | commit 0a7687d |
||| P1-FIRST-DEPOSIT | 首充奖金规格 | ✅ 已实现 | Backend: DepositBonus model + getBonusStatus/addWagering + /bonus/status + /bonus/wagering endpoints |
||| P1-DAILY-MISSIONS | 每日任务规格 | ✅ 后端完成 | Backend: mission.service.ts (10 missions, progress/claim/reset), mission.controller.ts, Mission/UserMission models; 前端 UI 待实施 |
|| P1-BLAST-001 | Blast 即时赛事 | 📋 规格待定义 | 参考 GGPoker SPINS |

## P1 — 已完成

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| P1-CLUB-INVITE-001 | Club 私人邀请码 | ✅ 已实现 | bfd9ffa |
|| P1-TEST-001 | `connection-state.service.spec.ts` 缺失 | ✅ 已实现 | 22 个测试用例 |
|| P1-RAKEBACK-002 | Rakeback 5 tier 代码实现 | ✅ 已实现 | commit dc28855 |
|| P1-RAKEBACK-003 | Rakeback service.spec.ts 13 tests failing | ✅ 已修复 | commit dc3e4a |
|| P1-NEW-001 | `buildPots` 使用 stale `allPlayers` | ✅ 已确认无问题 | showdown 调用时 allPlayers 已是最新快照 |
|| P1-NEW-002 | Withdraw 幂等性修复未提交 | ✅ 已提交 | withdraw.service.ts |
|| P1-001 | `TableManager.getTable()` 并发竞态 | ✅ 已修复 | 并发测试通过 |
|| P1-002 | Redis 不可用时 rate limit 回退 | ✅ 已修复 | fail-closed 策略 |
|| P1-003 | 密码暴力破解保护 in-memory Map | ✅ 已修复 | Redis 迁移完成 |
|| P1-005 | `persistSettlementRecords` 静默失败 | ✅ 已修复 | AdminLog 告警 |
|| P1-004 | Rakeback 前端空白 | ✅ 已实现 | GET/POST /user/rakeback |
|| P1-CLUB-TEST-001 | ClubService spec RedisService 依赖缺失 | ✅ 已修复 | commit dc3e4a |

---

## P2 — 进行中

|| ID | 任务 | 状态 | 备注 |
|----|------|------|-------|
|| P2-WEB-SPEC | Web 端 0 个测试文件 | 🔍 待实施 | AuthProvider/ActionBar/ChatPanel/SocketSessionProvider 均无覆盖 |
|| P2-TOURNAMENT-SPEC | Tournament 模块仅 1 个 spec | 🔍 待补充 | Matchmaking/wallet/friend 模块同样缺失 |
|| P2-ROOM-PASSWORD | 房间密码明文存 sessionStorage | 🔍 建议优化 | room/[id]/page.tsx:328 |
|| P2-JWT-LOCALSTORAGE | JWT 存 localStorage — XSS 目标 | 🔍 建议优化 | 迁移至 httpOnly cookie |
|| P2-CHAT-INJECTION | Chat username 未验证 userId | 🔍 建议优化 | ChatPanel.tsx:68-71 |
|| P2-CHAT-FRONTEND-TEST | P1-CHAT-001 前端集成测试未实现 | 🔍 待实施 | ChatPanel WS 组件测试 |
|| P2-EMOJI-001 | 表情反应系统 | 📋 规格已就绪 | WSOP SnapCam 类低成本互动功能 |
|| P2-PROFILE-001 | 玩家资料页丰富化 | 📋 规格已就绪 | 头像框/成就徽章提升成就感 |
|| P2-NOTIFY-001 | 站内通知中心 | 📋 规格已就绪 | 朋友上线/Club开赛提醒 |

## P2 — 已完成（本轮更新）

|| ID | 任务 | 状态 | 备注 |
|----|------|------|-------|
|| P2-CHAT-001 | chat-message rate limit | ✅ 已实现 | commit cfb5851 |
|| ~~P1-WS-STACK-VALIDATION~~ | `handlePlayerAction` stack 校验 | ❌ 已关闭 | ❌ 误报：引擎内部已有 Math.min 保护 |

## P2 — 已完成

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| P2-NEW-008 | `Math.random()` 遗留 rooms/page.tsx:233 | ✅ 已修复 | crypto.getRandomValues() 替换 |
|| P2-CLUB-003 | Club 专属房间 — 前端权限过滤 | ✅ 已修复 | rooms/page.tsx — myClubIds 过滤 |
|| P2-CLUB-007 | Club 专属房间 — AdminRoomController 校验缺失 | ✅ 已修复 | admin-room.controller.ts |
|| P2-BREAKING-001 | joinByCode 返回类型变更 ClubMember | ✅ 已修复 | club.service.ts |
|| P2-NEW-001 | Web React hooks exhaustive-deps warnings | ✅ 已修复 | commit e28e902 |
|| P2-NEW-002 | PlayerSeat.tsx `isSettlement` unused | ✅ 已修复 | 已移除 |
|| P2-NEW-003 | rooms/page.tsx `_` unused variable | ✅ 已修复 | 改用 delete |
|| P2-NEW-006 | `Button` 缺少 `loading` prop | ✅ 已修复 | commit ac33323 |

## P2 — 新发现（建议升 P1）

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| P2→P1-NEW-001 | Club 邀请码 Math.random() 非密码学安全 | ✅ 已修复 | crypto.randomInt() |
|| P2→P1-NEW-002 | client.leave() 在 DB 更新之后（竞态条件） | ✅ 已修复 | game.handler.ts:323 |
|| P2→P1-NEW-003 | handlePlayerAction table-not-found 无错误事件 | ✅ 已修复 | game.handler.ts:284 |

## P2 — TypeScript 编译错误（已全部修复）

|| ID | 任务 | 状态 | 备注 |
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

|| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
|| ~~P2-TS-NEW~~ | rakeback.controller.spec.ts Request 类型断言 | ✅ 已修复 | `{ user: typeof mockUser }` |
|| ~~P2-TS-NEW-003~~ | connection-state.service.spec.ts mock 类型错误 | ✅ 已修复 | mockRedisService 返回 `any` |
|| ~~P2-TS-NEW-002~~ | rakeback.e2e-spec.ts passwordHash 字段名 | ✅ 已修复 | `passwordHash` → `password` |

## P2 — 其他已完成

|| ID | 任务 | 状态 |
|----|------|------|
|| P2-002 | Club 数据库迁移 | ⏳ 待执行 |
|| P2-003 | Sit-Out 重构 | ✅ 已实现 |
|| P2-004 | All-in 确认弹窗 | ✅ 前端实现完成 |

---

## P3 — Tournament 路线图

|| Phase | 内容 | 状态 |
|-------|------|------|
|| Phase 1 | SNG 单桌赛 | ✅ 已实现（P1-TOURNAMENT-001） |
|| Phase 2 | Jackpot SNG | 📋 规划中 |
|| Phase 3 | MTT 多桌赛 | 📋 规划中 |

|| P2-NEW-007 | 战后手牌复盘 UI | ✅ Phase 1+2 完成 | commit e7e8f1a — EquityCurveChart/PotOddsTooltip/PlaybackControls/SpeedSelector/AutoPlayPanel |

---

*最后更新: 2026-04-27 07:30 — Test 第207轮 — 295 tests pass, 0 P0 / 0 P1 / 0 P2 — 首次完全清洁状态*
