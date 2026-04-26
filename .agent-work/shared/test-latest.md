# Test Latest — 第244轮

**时间:** 2026-04-27 17:30
**HEAD:** `632fb60` — 无新提交

## 状态

| 优先级 | 数量 | 变化 |
|--------|------|------|
| P0 | 0 | unchanged |
| P1 | 3 | unchanged |
| P2 | 12 | unchanged |

## HEAD Commit

`632fb60` — 无新提交

## P0 — 已完成（全部清零 ✅）

| ID | 任务 | 状态 |
|----|------|------|
| P0-TYPE-001 | Rakeback 利率单位统一 | ✅ 已修复 |
| P0-TYPE-002 | HandResultEntry nickname 补全 | ✅ 已修复 |
| P0-TYPE-003 | FriendRequestPayload 字段名统一 | ✅ 已修复 |

## P1 — 专项深度验证（本轮）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-WALLET-001 | `exchangeBalanceToChips` 无 `$transaction` | ❌ 未修复 | 3 次 DB 调用分离，wallet/user 可能不同步 |
| P1-WITHDRAW-005 | `createWithdraw` transaction log 在原子块外 | ❌ 未修复 | 审计日志可丢失 |
| P1-WITHDRAW-006 | `rejectWithdrawRequest` 原子化 | ✅ 已修复 | 所有操作在 $transaction 内 |
| P1-WITHDRAW-007 | `executeChainWithdraw` DB+链上非原子 | ❌ 未修复 | PROCESSING 崩溃后无法恢复 |
| P1-WS-001 | `handleConnection` 会话检查时序 | ❌ 未修复 | client.data.user 先于 Redis 检查设置 |

## P2 — 待处理（12项）

| ID | 任务 | 状态 |
|----|------|------|
| P2-WEB-001 | handleCreateRoom 错误消息提取 |
| P2-WEB-002 | register/page 重复条件 |
| P2-ENGINE-001 | cleanupOfflineResidueOnStartup await |
| P2-ENGINE-002 | evaluate5 排序拷贝 |
| P2-ENGINE-003 | beginReadyCountdown 不覆盖 ready=false |
| P2-ENGINE-004 | leaveCurrentRoom persistTableState |
| P2-WEB-003 | handleLogin 错误消息提取 |
| P2-WEB-004 | deposit setInterval 清理 |
| P2-WEB-005 | withdraw balance API 响应 |
| P2-TYPE-001 | player_action 联合类型 |
| P2-TYPE-002 | JoinRoomSchema buyIn 验证 |
| P2-TYPE-003 | Player consecutiveTimeouts |
| P2-WEB-006 | roomStatusMap 合并顺序 |
| P2-JWT-LOCALSTORAGE | JWT → httpOnly Cookie |
| P2-DEPOSIT-TOCTOU | getOrCreateDepositAddress 竞态 |
| P2-CHAT-FRONTEND-TEST | ChatPanel WS 测试 |
| P2-TOURNAMENT-SPEC | Tournament 测试覆盖 |

---

*Test 第244轮 — 2026-04-27 17:30 — 0 P0 / 3 P1 / 12 P2*
