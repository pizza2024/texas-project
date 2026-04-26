# Test Latest — 第257轮

**时间:** 2026-04-27 20:15
**HEAD:** `88af108` — fix: P1-CHAT-INJECTION — DB lookup for username in chat handler

## 状态

| 优先级 | 数量 | 变化 |
|--------|------|------|
| P0 | 0 | unchanged |
| P1 | 0 | unchanged |
| P2 | 11 | unchanged |

## 系统健康

| 指标 | 状态 |
|------|------|
| TypeScript 编译 | ✅ 通过 |
| 后端测试 | ✅ 30 suites / 325 tests PASS |
| P0 问题 | ✅ 全部清零 |
| P1 问题 | ✅ 全部清零 |

## 本轮 CodeReview 扫描

**P1-CHAT-INJECTION 修复验证 ✅**
`88af108` — `client.data.user.sub` DB lookup，username 从 DB 而非 JWT payload。

**P2-CHAT-DUP + P2-ROOM-PASSWORD 修复验证 ✅**
`c7c9be8` — 重复 ChatPanel.tsx 已删除，sessionStorage.removeItem 移至 join_room emit 之后。

**deposit.service.ts P2-DEPOSIT-TOCTOU 部分 ✅**
`getOrCreateDepositAddress` 已改为 `$transaction` + `createMany` + `skipDuplicates`。E2E spec 待同步。

## 本轮新发现

### P2 — E2E spec aggregate mock 问题
**文件:** `apps/backend/src/deposit/deposit.e2e.spec.ts`
**描述:** `getOrCreateDepositAddress` 测试中 `aggregate.mockResolvedValueOnce` 被后续测试的 `aggregate` 调用消费，导致测试偶发失败。加 `mockReset()` 可解决。

### P2 — 诊断文件未清理
**文件:** `apps/backend/src/deposit/debug-deposit.spec.ts` (68行) + `apps/backend/src/deposit/diag.spec.ts` (104行)
**描述:** 注释标注 `DIAGNOSTIC ONLY - can be deleted`，应删除以保持测试目录干净。

## P2 遗留问题

| ID | 状态 |
|----|------|
| P2-TOURNAMENT-SPEC | 🔍 待实施 |
| P2-WEB-SPEC | 🔍 待实施 |
| P2-DEPOSIT-TOCTOU (E2E spec) | 🔍 待认领 |
| P2-DEPOSIT-TOCTOU (diagnostic files) | 🔍 待认领 |
| P2-ROOM-PASSWORD | 🔍 待优化 |
| P2-CHAT-FRONTEND-TEST | 🔍 待实施 |
| P2-CHAT-IDEMPOTENCY | 🔍 待认领 |
| P2-WS-RATE-UNIT | 🔍 待认领 |
| P2-CODE-PATTERN | 🔍 待认领 |
| P2-CHAT-STUB | 🔍 待认领 |
| P2-ROUTER-ANY | 🔍 待认领 |

## 任务队列

| 优先级 | ID | 任务 | 状态 |
|--------|----|------|------|
| P2 | P2-DEPOSIT-TOCTOU | 删除诊断文件 | 🔍 待认领 |
| P2 | P2-DEPOSIT-TOCTOU | 修复 E2E aggregate mock | 🔍 待认领 |
| P2 | P2-WEB-SPEC | Web 端测试框架 | 🔍 待实施 |
| P2 | P2-TOURNAMENT-SPEC | Tournament 测试覆盖 | 🔍 待实施 |
| P2 | P2-ROOM-PASSWORD | 密码不存前端 sessionStorage | 🔍 待优化 |

---

*Test 第257轮 — 2026-04-27 20:15 — 0 P0 / 0 P1 / 11 P2*
