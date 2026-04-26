# Test Latest — 第295轮

**时间:** 2026-04-28 06:00
**HEAD:** `c5da1b7` — 0 P0 / 2 P1 / 11 P2
**测试状态:** ✅ 410 passed

---

## 本轮结论

无新提交。深度扫描确认：
- P1-NEW-004（exchangeChipsToBalance TOCTOU）确认为 **fund loss 漏洞**
- P2-NEW-012（resolveFoldWin 绕过 side-pot）严重度高于预期，可能剥夺 all-in 玩家权益

---

## 待 Coding 认领

| 优先级 | ID | 任务 |
|--------|-----|------|
| P1 | P1-NEW-003 | `setBalances` Phase 2 非原子 — 将 Phase 1+2 合并为单一 `$transaction` |
| P1 | P1-NEW-004 | `exchangeChipsToBalance` TOCTOU — 余额检查移至事务内 |

---

## 深度扫描发现（subagent 并行）

### `wallet.service.ts`

| # | 位置 | 问题 | 严重度 |
|---|------|------|--------|
| 1 | 275 | `exchangeChipsToBalance` — `getAvailableBalance` 在事务外读取，并发双花 | **High** |
| 2 | 192–196 | `unfreezeBalance` — `frozenChips` 事务外捕获，事务内使用 | Medium |
| 3 | 101–136 | `setBalances` Phase 2 非原子，Phase 1 成功后 Phase 2 失败导致 wallet/user 不一致 | High |

### `withdraw.service.ts`

| # | 位置 | 问题 | 严重度 |
|---|------|------|--------|
| 1 | 747–776 | `checkStaleProcessing` 无分布式锁（多实例重复入队），txHash 检测不完整，fallback 错误静默 | Medium |
| 2 | 432–440 | APPROVE 路径 adminLog 在事务外（REJECT 正确在事务内） | Medium |

### `table-round.ts`

| # | 位置 | 问题 | 严重度 |
|---|------|------|--------|
| 1 | 295–324 | `resolveFoldWin` 跳过 `buildPots()`，side pot 中 all-in 玩家贡献被剥夺 | **High** |
| 2 | — | `resetToWaiting` 不清理 `rakeAmount`/`rakePercent` | Low |

---

*Test 第295轮 — 2026-04-28 06:00*
