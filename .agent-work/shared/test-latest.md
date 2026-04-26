# Test Latest — 第241轮

**时间:** 2026-04-27 17:00
**HEAD:** `8ce5e54` — 1 P0 / 3 P1 / 12 P2

## 状态

| 优先级 | 数量 | 新增 |
|--------|------|------|
| P0 | 1 | +1 |
| P1 | 3 | +3 |
| P2 | 12 | +12 |

## HEAD Commit

`8ce5e54` — fix: P2-NEW-001 deposit atomic balance + P2-NEW-002 OTP JSON.parse safety

> 无新提交。本轮为深度专项扫描。

## 新发现 P0

| ID | 问题 |
|----|------|
| P0-TYPE-001 | Rakeback 利率前后端单位不一致（金融显示错误） |
| P0-TYPE-002 | HandResultEntry 缺少 nickname（matchmaking.service） |
| P0-TYPE-003 | FriendRequestPayload 字段名不一致 |

## 新发现 P1

| ID | 问题 |
|----|------|
| P1-WALLET-001 | `exchangeBalanceToChips` 无原子事务 |
| P1-WITHDRAW-005 | `createWithdraw` transaction log 在原子块外 |
| P1-WALLET-002 | `setBalances` Phase 2 非bot失败静默吞掉 |
| P1-WITHDRAW-006 | `rejectWithdrawRequest` transaction log 原子性 |
| P1-WITHDRAW-007 | `executeChainWithdraw` 链上确认后DB更新不原子 |
| P1-WS-001 | `handleConnection` Redis会话检查时序问题 |

## 遗留任务

| 优先级 | ID | 任务 |
|--------|-----|------|
| P0 | P0-TYPE-001 | Rakeback 利率单位统一 |
| P0 | P0-TYPE-002 | HandResultEntry nickname 补全 |
| P0 | P0-TYPE-003 | FriendRequestPayload 字段名统一 |
| P1 | P1-BLAST-001 | Blast 即时赛事 |
| P1 | P1-WALLET-001 | exchangeBalanceToChips 原子化 |
| P1 | P1-WITHDRAW-005 | createWithdraw 事务修复 |
| P1 | P1-WALLET-002 | setBalances 失败重抛 |
| P1 | P1-WITHDRAW-006 | rejectWithdrawRequest 原子化 |
| P1 | P1-WITHDRAW-007 | executeChainWithdraw DB原子化 |
| P1 | P1-WS-001 | handleConnection 会话检查时序 |
| P2 | P2-TOURNAMENT-SPEC | Tournament 测试覆盖 |
| P2 | P2-CHAT-FRONTEND-TEST | ChatPanel WS 测试 |
| P2 | P2-WEB-SPEC | Web 端测试覆盖 |
| P2 | P2-DEPOSIT-TOCTOU | getOrCreateDepositAddress 索引竞争 |
| P2 | P2-JWT-LOCALSTORAGE | JWT 迁移 httpOnly Cookie |

---

*Test 第241轮 — 2026-04-27 17:00 — 1 P0 / 3 P1 / 12 P2*
