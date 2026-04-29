# Backend Code Review: `apps/backend/src`

**Scope:** table-engine game logic, WebSocket handlers, auth/security, database operations  
**Reviewer:** Hermes Agent  
**Date:** 2026-04-27

---

## Summary

The codebase is generally well-structured with good patterns: atomic Prisma transactions for financial ops, per-room and per-user locks for concurrency, Redis-backed rate limiting with fail-closed security posture, and a careful multi-layer state recovery system. However, several genuine bugs and security weaknesses were identified, two of which are **critical**.

---

## 🛑 CRITICAL

### 1. Fold-win `winAmount` uses `this.table.pot` AFTER rake deduction — but `pot` is zeroed before `lastHandResult` is built

**File:** `table-engine/table-round.ts`, `resolveFoldWin()` (lines 295–324)

```typescript
const rake = Math.min(Math.floor(this.table.pot * tierConfig.rate), tierConfig.cap);
this.table.pot -= rake;          // pot is now (original - rake)
const winAmount = this.table.pot; // ← winAmount = (original - rake)
winner.stack += winAmount;
this.table.pot = 0;              // ← pot is zeroed BEFORE lastHandResult references it

this.table.lastHandResult = this.table.players
  .filter((p) => p !== null)
  .map((p) => ({
    ...
    winAmount: p.id === winner.id ? winAmount : 0,  // ← uses same `winAmount` variable
    ...
  }));
```

The `winAmount` **local variable** is correct (it's captured before `pot = 0`). However, for **consistency with `performShowdown`**, the result object should reflect the actual amount credited — which it does. This is not the bug.

**The actual bug:** After `resolveFoldWin`, the `winner.stack` is credited correctly, but `lastHandResult[winner].winAmount` is a _local variable_ that happens to equal the correct amount. This is internally consistent. **Not a bug after all.** Re-reading carefully — `winAmount` is a local const captured before `pot = 0`, so `winner.stack` and `lastHandResult[winner].winAmount` are both `originalPot - rake`. This is correct.

**Cross-checking with `performShowdown`**: `winAmounts` is a Map populated from pot distribution, and `lastHandResult[i].winAmount` reads from `winAmounts.get(p.id)`. This is correct.

**Verdict:** No bug here. Moving on.

---

### 2. `advanceStreet` crash when all players folded before showdown — `NaN` introduced into `winAmounts`

**File:** `table-engine/table-round.ts`, `performShowdown()` (lines 155–244)

```typescript
const eligible = allPlayers.filter((p) => p.status !== PlayerStatus.FOLD);
// ...
if (eligible.length === 0) {
  this.table.currentStage = GameStage.SETTLEMENT;
  return; // ← MISSING! Falls through to pot-building with eligible=[]!
}

// Below is still reachable when eligible.length === 0:
const pots = this.buildPots(allPlayers); // eligible=[] causes issues
// ...
const share = Math.floor(pot.amount / potWinners.length); // ← NaN when potWinners=[]

potWinners.forEach((w, idx) => {
  const current = winAmounts.get(w.playerId) ?? 0;
  winAmounts.set(w.playerId, current + share + (idx === 0 ? remainder : 0));
  // ↑ share = NaN, remainder = NaN, corrupts winAmounts Map
});
```

When `eligible.length === 0` (all players folded before showdown — e.g., if a race condition or bug causes `advanceStreet` to be called when it shouldn't be), execution enters the early-return block but **lacks a `return` statement**. It falls through and builds pots with an empty eligible set, causing `potWinners = []`, leading to `NaN` in `winAmounts`.

**Impact:** The `lastHandResult` would have `winAmount: NaN` for all players, corrupting the settlement data sent to clients and persisted to the DB.

**Fix:** Add `return` after `this.table.currentStage = GameStage.SETTLEMENT;` in the `eligible.length === 0` branch.

---

### 3. `getMaskedView` never populates `bestCards` for fold-win winners

**File:** `table-engine/table-round.ts`, `resolveFoldWin()` (lines 311–320)

```typescript
this.table.lastHandResult = this.table.players
  .filter((p) => p !== null)
  .map((p) => ({
    playerId: p.id,
    nickname: p.nickname,
    handName: p.id === winner.id ? "其他玩家弃牌" : "弃牌",
    bestCards: [], // ← ALWAYS empty, even for the winner
    winAmount: p.id === winner.id ? winAmount : 0,
    totalBet: p.totalBet,
  }));
```

When a player wins by fold, `bestCards` is hardcoded to `[]` for all players, including the winner. This means `foldWinnerRevealed` controls whether the hole cards are shown in the UI (via `getMaskedView`), but `lastHandResult.bestCards` — which is what the client uses to display hand strength at settlement — **never** contains the winner's actual cards, even after they choose to reveal.

**Impact:** Fold-win winners cannot see their own hand displayed in the settlement UI.

**Fix:** The winner's actual hole cards (`winner.cards`) should be stored in `bestCards` when `resolveFoldWin` is called, independent of the `foldWinnerRevealed` flag (which only controls opponent visibility).

---

## 🔴 HIGH

### 4. `handleLeaveRoom`: `client.leave(roomId)` called BEFORE acquiring room lock

**File:** `websocket/game.handler.ts`, `handleLeaveRoom()` (lines 365–411)

```typescript
return gateway.withUserLock(userId, async () => {
  const roomId = ...;
  return gateway.withRoomLock(roomId, async () => {
    client.leave(roomId);  // ← Leaves Socket.io room FIRST

    const result = await gateway.tableManager.leaveCurrentRoom(userId);  // ← DB update after
    ...
  });
});
```

`client.leave()` removes the socket from the Socket.io room _before_ the room lock is acquired and before the server-side room state is updated. Between `client.leave()` and `leaveCurrentRoom()` completing, a `game-state` broadcast could be sent to the empty room (since the socket has already left), and concurrent handlers could observe an inconsistent state.

**Impact:** Race condition — stale game-state broadcasts to a room the player has already left visually.

**Fix:** Move `client.leave(roomId)` to **after** `leaveCurrentRoom()` resolves, or at minimum after the room lock is held.

---

### 5. No re-validation of player balance after joining; double-spend window via concurrent actions

**File:** `websocket/game.handler.ts`, `handleJoinRoom()` (lines 170–192)

```typescript
const balance = isAlreadySeated
  ? null
  : await gateway.tableManager.getUserAvailableBalance(userId);
// ...balance check...
await gateway.tableManager.freezePlayerBalance(userId, balance); // freezes ALL of balance
// ...player is seated...
```

A player's balance is captured at join time and **never re-validated** while they remain seated. If the player's balance changes (e.g., another table closes and credits their wallet, or an admin adjusts balances), the seated player's frozen amount becomes stale.

More critically: the **freeze** operation (`freezePlayerBalance`) does not check `availableBalance` inside a transaction. While `freezeBalance` uses a `$transaction`, the check-then-freeze is not atomic from the caller's perspective:

```typescript
// wallet.service.ts freezeBalance()
async freezeBalance(userId: string, amount: number): Promise<void> {
  const normalized = Math.max(0, amount);
  await this.prisma.$transaction([
    this.prisma.wallet.upsert({ ... }),     // sets frozenChips = normalized
    this.prisma.user.update({              // decrements coinBalance
      data: { coinBalance: { decrement: normalized } },
    }),
  ]);
}
```

There's no `availableBalance >= amount` check — if `amount > chips`, `coinBalance` goes negative.

**Impact:** A player's chip balance could theoretically go negative if the join-time balance check becomes stale and the player spends chips elsewhere (e.g., via admin adjustment or a future direct chip-spending endpoint).

**Fix:** Re-freeze (re-check and adjust) on each action, or freeze incrementally rather than freezing the entire balance upfront.

---

### 6. Bot detection by `userId.startsWith(BOT_ID_PREFIX)` — prefix collision

**File:** `wallet/wallet.service.ts`, `setBalances()` (lines 75–104)

```typescript
if (userId.startsWith(BOT_ID_PREFIX)) {
  return [walletOp]; // Skips coinBalance sync for "bots"
}
const userOp = this.prisma.user.update({
  where: { id: userId },
  data: { coinBalance: normalized },
});
```

Real users whose `userId` happens to start with `BOT_ID_PREFIX` (e.g., a username like `"bot_player123"`) will have their `User.coinBalance` **never synced**. On every `setBalances` call (after each hand), their `wallet.chips` updates but `user.coinBalance` diverges. Since `getAvailableBalance` falls back to `user.coinBalance`, this causes the user's available balance to become stale and incorrect.

**Impact:** Users with IDs starting with the bot prefix get incorrect balance calculations permanently.

**Fix:** Use a dedicated `isBot` flag on the User model, or check the `User.role` field instead of string prefix matching.

---

## 🟡 MEDIUM

### 7. `exchangeBalanceToChips`: `getRealBalance` read OUTSIDE the transaction

**File:** `wallet/wallet.service.ts`, `exchangeBalanceToChips()` (lines 329–379)

```typescript
async exchangeBalanceToChips(userId: string, usdtAmount: number) {
  const realBalance = await this.getRealBalance(userId);  // ← Outside transaction
  if (usdtAmount > realBalance) {
    throw new BadRequestException('Insufficient USDT balance');
  }
  // ...
  await this.prisma.$transaction(async (tx) => {
    // ...
    await tx.wallet.upsert({
      update: { balance: { decrement: usdtAmount }, ... },
    });
  });
}
```

The balance check occurs **outside** the transaction. Two concurrent requests could both read the same `realBalance` before either decrement, and both pass the check — potentially over-drafting the USDT balance. (Contrast with `exchangeChipsToBalance` which correctly reads inside the transaction at line 262.)

**Impact:** Double-spend on USDT balance via concurrent `exchangeBalanceToChips` calls.

**Fix:** Move the `getRealBalance` check inside the `$transaction`.

---

### 8. ELO bounds enforcement is a separate transaction from the ELO update — brief out-of-bounds window

**File:** `matchmaking/matchmaking.service.ts`, `updateElo()` (lines 220–243)

```typescript
await this.prisma.$transaction(
  updates.map(({ userId, delta }) =>
    this.prisma.user.update({ data: { elo: { increment: delta } } }),
  ),
);
// Separate transaction:
await this.prisma.$transaction([
  this.prisma.user.updateMany({
    where: { elo: { lt: ELO_MIN } },
    data: { elo: ELO_MIN },
  }),
  this.prisma.user.updateMany({
    where: { elo: { gt: ELO_MAX } },
    data: { elo: ELO_MAX },
  }),
]);
```

If the server crashes between the two transactions, some players could have ELO values outside the [ELO_MIN, ELO_MAX] bounds. Combined with `getPlayerElo` returning a default of 1000 for missing users, this could allow a user to have an ELO of 50 (below floor) or 5000 (above ceiling) temporarily.

**Impact:** ELO briefly out of bounds; could affect matchmaking pairings until the next hand or server restart triggers the floor/ceiling enforcement.

**Fix:** Combine both operations into a single `$transaction`.

---

### 9. `getBalance` has no `frozenChips`-aware check inside the method — relies entirely on caller

**File:** `wallet/wallet.service.ts`, `getBalance()` (lines 19–40)

```typescript
async getBalance(userId: string): Promise<number> {
  const wallet = await this.prisma.wallet.findUnique({ where: { userId }, select: { chips: true } });
  if (wallet) return wallet.chips;  // Returns total chips, NOT available
  // ...
}
```

`getBalance` returns `wallet.chips` (total), not `chips - frozenChips` (available). Callers that need available balance must use `getAvailableBalance`. There is no enforcement inside `getBalance` to prevent returning a balance that is fully frozen. If a caller accidentally uses `getBalance` instead of `getAvailableBalance` for a financial decision, it could lead to under-spending (not a security issue, but a correctness issue).

**Note:** All critical financial paths (`freezeBalance`, `exchangeChipsToBalance`, `joinRoom`) correctly use `getAvailableBalance`. This is noted as a defensive depth item.

---

### 10. `chat_idem` uses Redis `SET NX EX` but the `isMessageProcessed` result is not checked before processing

**File:** `websocket/game.handler.ts`, `handleChatMessage()` (implied by connection-state.service.ts)

The `isMessageProcessed` idempotency guard is defined in `connection-state.service.ts` but the chat handler (`handleChatMessage`) is truncated in the provided code. If `isMessageProcessed` returns `false` (message already processed or Redis fail-closed), the handler should **not** process the message. Verify that `handleChatMessage` actually gates on this check.

---

## 🟢 LOW / NOTES

### 11. `tableManager.getUserCurrentRoom` — stale in-memory index for cross-instance deployments

**File:** `table-engine/table-manager.service.ts`, `getUserCurrentRoom()` (lines 483–540)

```typescript
const roomId = this.userRooms.get(userId); // O(1) in-memory index
if (roomId) {
  const table = this.tables.get(roomId);
  if (table) {
    /* return immediately */
  }
  // Indexed but table not in memory → clean up stale entry
  this.userRooms.delete(userId);
}
```

The `userRooms` Map is an in-memory index that is instance-local. In a multi-instance Socket.io deployment, each NestJS instance has its own `userRooms` Map. If a player connects to instance A, their `userRooms` entry exists only on A. The recovery fallback (scanning all in-memory tables, then all persisted tables) makes this work correctly, but there is a window during reconnect where the stale index entry on a different instance could cause a brief inconsistency.

**Impact:** Minor. Recovery fallbacks make this eventually consistent. Affects reconnect timing.

---

### 12. `matchmakingService.roomIps` in-memory Map is instance-local — IP anti-collusion is per-instance only

**File:** `matchmaking/matchmaking.service.ts`, `roomIps` (line 78)

```typescript
private readonly roomIps = new Map<string, Set<string>>();
```

`roomIps` tracks IP hashes per room in-memory. In a multi-instance deployment, players on different instances won't see each other's IPs in the anti-collusion map. The comment says "Redis-backed (multi-instance safe)" for password brute-force protection, but `roomIps` is in-memory with no Redis equivalent.

**Impact:** IP-based collusion detection only works within a single instance. Across instances, colluding players could bypass the check.

---

### 13. `scheduleDisconnectCleanup` uses `setTimeout` — not persisted; lost on server restart

**File:** `websocket/connection-state.service.ts`, `scheduleDisconnectCleanup()` (lines 230–292)

The disconnect grace period timer (`DISCONNECT_GRACE_PERIOD_MS = 15000`) is held in a `Map<string, NodeJS.Timeout>`. If the server restarts during the grace period, the timer is lost. The `cleanupOfflineResidueOnStartup` in `TableManagerService` only handles WAITING tables. If a player was mid-hand when the server died, their seat is recovered via `ensureRecoveredRoundFlow`, but the **grace period timer itself** is not restored — meaning if the player's socket reconnects quickly, the old cleanup wouldn't fire anyway (the reconnect clears `pendingDisconnects`).

**Impact:** Low. On restart, the reconnect path clears pending disconnects and the player can rejoin. The grace period timer is per-instance-memory and non-critical.

---

### 14. OTP rate limiting has no fallback — Redis down causes `requestEmailCode` to throw

**File:** `auth/auth.service.ts`, `requestEmailCode()` (lines 142–184)

```typescript
const existingCode = await this.redisService.get(rateLimitKey); // Redis unavailable → null
if (existingCode) {
  // null → false → rate limit pass-through
  throw new BadRequestException("Please wait 60 seconds...");
}
```

When Redis is unavailable, `get` returns `null`, so the rate limit check passes. However, the OTP _storage_ (`redisService.set`) would also silently fail (non-fatal in the implementation), meaning the OTP would never actually be stored. The user receives no code and the endpoint returns success — they don't know it failed.

**Impact:** User-facing silent failure during Redis outage; no error is surfaced.

---

### 15. Hand evaluator: two-pair `kicker` could be `undefined` if ranks array is malformed

**File:** `table-engine/hand-evaluator.ts`, `evaluate5()` (lines 132–142)

```typescript
const kicker = ranks.filter(r => r !== groupRanks[0] && r !== groupRanks[1])[0];
return { rank: 3, values: [groupRanks[0], groupRanks[1], kicker], ... };
```

If `ranks` has fewer than 3 distinct values (which shouldn't happen for a valid 5-card two-pair), `kicker` is `undefined`. The `values` array would contain `undefined`, causing `compareScores` to treat it as `0` via `a.values[i] ?? 0`. This could produce incorrect hand comparisons between two different two-pair hands.

**Impact:** Very low. Requires a malformed hand to reach this code path.

---

### 16. `emailVerified` flag set without transactional guarantee on email verification

**File:** `auth/auth.service.ts`, `verifyEmailCode()` (lines 186–260)

The email code verification invalidates the code, clears attempts, and issues an `emailVerifyToken` stored in Redis with a 15-minute TTL. The `registerWithEmail` method then uses this token to create the account with `emailVerified: true`. However, there is no transaction between the Redis token issuance and the eventual `registerWithEmail` call — if the user loses the token (closes browser), they must start over. This is by design (short-lived token), not a bug.

**Note:** The token itself is a random UUID with no predictable value, so it's not a security issue.

---

## ✅ GOOD PATTERNS OBSERVED

These are correctly implemented and worth highlighting:

| Pattern                                   | Location                                        | Notes                                                             |
| ----------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| **Atomic settlement writes**              | `persistSettlementRecords()`                    | Hand row created first as sentinel; settlement+transaction atomic |
| **TOCTOU prevention**                     | `exchangeChipsToBalance()`                      | Balance check inside `$transaction`                               |
| **Double-spend protection**               | `rejectWithdrawRequest()`                       | Re-checks status inside transaction                               |
| **Rate limit fail-closed**                | `connection-state.service.ts`                   | Denies requests when Redis unavailable                            |
| **Per-room/user locks**                   | `app.gateway.ts` `withRoomLock`/`withUserLock`  | Correctly chains promises, absorbs rejections                     |
| **Multi-instance brute-force protection** | `checkPasswordAttemptLimit()`                   | Redis-backed                                                      |
| **Straddle/All-in guards**                | `table-player-ops.ts`                           | `calledAllIn` properly prevents re-opening action                 |
| **Side pot algorithm**                    | `table-round.ts` `buildPots()`                  | Correctly handles multi-level all-in scenarios                    |
| **ELO floor/ceiling**                     | `matchmaking.service.ts`                        | Post-update enforcement exists                                    |
| **Startup cleanup**                       | `cleanupOfflineResidueOnStartup()`              | Clears ghost seats from crashed servers                           |
| **Recovery flow**                         | `timer.service.ts` `ensureRecoveredRoundFlow()` | Restores timers on restart                                        |
| **Deck shuffle**                          | `table-game-logic.ts` `shuffle()`               | Uses `crypto.getRandomValues` (CSPRNG)                            |
| **Session invalidation on reconnect**     | `handleConnection()`                            | Single-device enforcement                                         |
| **Club membership check**                 | `handleJoinRoom()`                              | Club-only rooms verified server-side                              |

---

## PRIORITY SUMMARY

| #   | Severity    | Issue                                                                              | File                                   |
| --- | ----------- | ---------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | 🛑 Critical | `advanceStreet` lacks `return` after `eligible.length === 0` — NaN in `winAmounts` | `table-round.ts`                       |
| 2   | 🛑 Critical | `bestCards: []` for fold-win winner in `lastHandResult`                            | `table-round.ts`                       |
| 3   | 🔴 High     | `client.leave()` before room lock — broadcast race                                 | `game.handler.ts`                      |
| 4   | 🔴 High     | No re-validation of frozen balance while seated                                    | `game.handler.ts`, `wallet.service.ts` |
| 5   | 🔴 High     | Bot prefix collision breaks `coinBalance` sync                                     | `wallet.service.ts`                    |
| 6   | 🟡 Medium   | `getRealBalance` read outside transaction                                          | `wallet.service.ts`                    |
| 7   | 🟡 Medium   | ELO bounds enforcement as separate transaction                                     | `matchmaking.service.ts`               |
| 8   | 🟡 Medium   | `getBalance` returns total, not available — caller discipline required             | `wallet.service.ts`                    |
| 9   | 🟢 Low      | In-memory IP map is instance-local                                                 | `matchmaking.service.ts`               |
| 10  | 🟢 Low      | Redis unavailable: OTP storage silently fails                                      | `auth.service.ts`                      |
