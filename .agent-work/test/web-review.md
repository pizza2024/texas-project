# Web Frontend Review — `apps/web`

**Reviewed areas:** game logic integration, WebSocket client, auth token management, state management, test coverage, and documentation.

---

## 1. Game Logic Integration

### Strengths

- **Equity calculation** (`packages/shared/src/equity.ts`): Monte Carlo simulation is implemented as a pure function with no backend dependencies. Card validation, hand evaluation (5-card combinations), and straight detection (including A-2-3-4-5 low straight) are all present. Default 2000 simulations is reasonable for client-side use.
- **Game state types** are well-structured (`packages/shared/src/types/game.ts`): `TableState`, `Player`, `HandResultEntry`, `StraddleInfo` cover the full poker state model.
- **`calculateEquity`** is called in the room page for all-in confirmation modals (line 701–703 of `room/[id]/page.tsx`), correctly passing hole cards, community cards, and opponent count.
- **Pot Odds** display in `ActionBar.tsx` (lines 77–80): correctly computed as `callAmount / (pot + callAmount) * 100`.
- **Pot-relative raise presets** (½ Pot, ¾ Pot, min-raise) are computed client-side in `ActionBar` and respect the player's stack.
- **Stage-aware UI**: `currentStage` drives distinct UI states — `WAITING` (ready button), `SETTLEMENT` (show/muck choice), active betting stages (action bar with fold/call/raise).

### Issues

1. **`TableState` type drift between `packages/shared` and `apps/web`**:  
   The shared package defines `TableState` (`packages/shared/src/types/game.ts`), but `apps/web/app/room/[id]/components/types.ts` redeclares a near-identical `TableState`. The local version is missing `sittingOutTimeout` (present in shared). This duplication risks the two types drifting apart. The room page imports `TableState` from the local `components/types.ts` (line 22 of `page.tsx`), not from `@texas/shared`. This should be unified — the web app should import `TableState` from `@texas/shared`.

2. **No client-side validation of game actions**:  
   `handleAction` in `page.tsx` (line 608) emits to the server without validating whether the action is legal given the current `table` state (e.g., checking if it's the player's turn, if the raise amount is within valid bounds, if the action is allowed at the current stage). If the server is the authoritative source, this is acceptable, but there is no optimistic rejection — the server `error` event handler (line 423–431) handles errors reactively rather than proactively preventing invalid actions.

3. **`consecutiveTimeouts` on `Player` is typed as optional but not defined in shared types**:  
   `apps/web/app/room/[id]/components/types.ts` line 16 defines `consecutiveTimeouts?: number` on `Player`, but this field does not appear in the `Player` interface in `packages/shared/src/types/game.ts`. This is another type drift issue.

4. **No protection against double-submitting actions**:  
   `handleAction` (line 608) and `handleReady` (line 614) do not debounce or disable buttons while a response is pending. Rapid double-clicks will emit multiple `player_action` events.

---

## 2. WebSocket Client

### Strengths

- **`socket.ts` in `packages/shared`** is well-architected (149 lines):
  - Singleton socket with token-aware recreation (`socketToken !== token` check, line 96–98).
  - Explicit `reconnect` settings: `reconnectionDelay: 500`, `reconnectionDelayMax: 5000`, `reconnectionAttempts: 10`.
  - **Visibility change handling** (lines 124–133): mobile browsers freeze WS when backgrounded — the code registers a `visibilitychange` listener to force reconnect when the page returns to foreground. This is a thoughtful mobile-first touch.
  - Proper disconnect cleanup (`disconnectSocket`, lines 139–148) removes event listeners.
  - Global handler registration pattern (`setForceLogoutHandler`, `setRejoinAvailableHandler`, etc.) decouples socket setup from UI components.

- **`apps/web/lib/use-game-socket.ts`** (85 lines): Clean React hook wrapping emoji reactions. Properly removes the socket listener on cleanup (line 67–69). Emoji validation against `ALLOWED_EMOJIS` prevents injection.

- **Room page socket setup** (`page.tsx` lines 318–445): Comprehensive event handlers for all server → client events: `connect`, `room_update`, `emoji-reaction`, `already_in_room`, `disconnect`, `room_full`, `insufficient_balance`, `wrong_password`, `error`, `rejoin_available`. Clean separation of concerns.

- **Rejoin logic** (line 433–438): When a `rejoin_available` event fires, if the socket is disconnected it triggers a reconnect — good for handling brief network interruptions.

- **`leaveRoomViaSocket`** (lines 266–286): Properly waits for the `left_room` acknowledgment with a 1200ms timeout before falling back to HTTP `POST /tables/me/leave-room`.

### Issues

1. **`myUserId` in `page.tsx` is captured once at render time**:  
   Line 62: `const [myUserId] = useState<string>(() => getMyUserId())`. Because it's computed from `getStoredToken()` at mount, if the token is refreshed mid-session (e.g., via token refresh mechanism), `myUserId` will still reflect the old token's `sub` claim. However, the project does not currently implement token refresh — it uses a redirect-to-login pattern for expiry. This is a latent risk.

2. **Global handlers accumulate on socket recreation**:  
   In `socket.ts`, the global handlers (`forceLogoutHandler`, `rejoinAvailableHandler`, etc.) are module-level variables. When `getSocket` is called with a new token (triggering recreation, line 96–97), the old handlers remain assigned. The new socket object re-registers the same handler references, which is fine, but the pattern relies on the single-use registration in `getSocket` — no `off()` is called before `on()`. This works because socket.io permits duplicate `on()` calls (it adds a new listener each time), but it means the old handler reference is never explicitly removed. Over many reconnects this could cause subtle leaks or duplicate invocations if the handler closure captures mutable state.

3. **Socket event handlers in `page.tsx` are not always cleaned up**:  
   The `socket.on('emoji-reaction', ...)` handler (line 343) and `socket.on('already_in_room', ...)` (line 356) are registered in the main `useEffect` but the cleanup function (line 440) only removes `rejoin_available`. All other listeners registered in that effect (`room_update`, `emoji-reaction`, `already_in_room`, `disconnect`, `room_full`, `insufficient_balance`, `wrong_password`, `error`) are NOT removed on cleanup. This means on hot-reload or re-mount of the component, duplicate listeners will accumulate.

4. **No WebSocket reconnect UI feedback**:  
   When the socket is disconnected, the game page does not show any "reconnecting..." indicator. The `disconnect` handler (lines 388–397) only redirects to login if the token is missing or expired — otherwise it silently waits for socket.io's built-in reconnection. A player could be in a "frozen" game state without knowing the connection is lost.

5. **`rejoin_available` handler reference not stored for cleanup**:  
   The handler is defined inline (line 433) and registered on the socket (line 438), but only `socket.off('rejoin_available', rejoinAvailableHandler)` is called on cleanup (line 441). The reference `rejoinAvailableHandler` is stable across renders because it's defined inside the effect, so this is correct — but it's a pattern that relies on closure stability.

---

## 3. Auth Token Management

### Strengths

- **`packages/shared/src/auth.ts`**: Clean `StorageAdapter` interface allows web (localStorage) and mobile (SecureStore) to share auth logic. Token expiry checking (`isTokenExpired`, `getTokenExpiryTime`) is correctly implemented using JWT `exp` claim. Base64url decoding is properly handled.
- **`apps/web/lib/auth.ts`**: Web layer implements `getStoredToken`, `clearStoredToken`, `rememberPostLoginRedirect`, `consumePostLoginRedirect`, and `handleExpiredSession`. The `AUTH_EXPIRED_LOCK_KEY` sessionStorage flag prevents `handleExpiredSession` from running multiple times in the same session (lines 57–61).
- **API interceptor** (`apps/web/lib/api.ts`): Attaches `Authorization: Bearer <token>` header on every request. On 401 responses, calls `handleExpiredSession` with context-aware messages (distinguishes `SESSION_REPLACED` from normal expiry, and preserves `/room/` redirect path).
- **Socket token in query param** (`socket.ts` line 100): `query: { token }` passes the JWT as a Socket.io handshake query parameter — appropriate for WebSocket auth.

### Issues

1. **Hardcoded `token` key vs `\***`constant mismatch**:  
In`packages/shared/src/auth.ts`line 12:`const TOKEN_KEY='**_';`(masked value). In`apps/web/lib/auth.ts`line 7:`const TOKEN_STORAGE_KEY='_**';`(also masked). These should be the same constant — but since both are masked, we cannot verify they are actually the same string. The`api.ts`line 13 and`auth-context.tsx`line 35 also read`localStorage.getItem('token')`(the literal string`"token"`). There is inconsistency: `auth.ts`uses a constant`TOKEN_STORAGE_KEY`but`api.ts`and`auth-context.tsx`use the hardcoded string`'token'`. This needs to be consolidated to a single constant.

2. **`handleExpiredSession` uses `window.location.replace`** (line 79 of `auth.ts`): This is a hard redirect that discards the navigation history. For a game page (`/room/[id]`), this is intentional to prevent back-button return to a stale game state, but it means if the user clicks "back" they leave the app entirely. For non-game pages this may be jarring.

3. **No token refresh mechanism**:  
   The system only handles token _expiry_ (redirect to login). There is no silent token refresh. When a token expires during an active game session, the user is kicked to login and loses their game state. The `AUTH_EXPIRED_LOCK_KEY` prevents repeated redirects but doesn't solve the underlying problem. A refresh-token rotation pattern would be more robust.

4. **`getAuthorizedSocket` recomputes on every call**:  
   `getAuthorizedSocket` (lines 116–127 of `page.tsx`) reads from localStorage and checks expiry every time it's called. This is a function call (not a hook), so it will re-run on every render of the room page or every action. It should be cheap (localStorage read + JWT decode), but the pattern is fragile — it's easy to accidentally call it inside a render and cause issues.

5. **Auth context uses a different `User` type than the rest of the app**:  
   `AuthProvider` in `auth-context.tsx` defines `User` as `{ id, nickname, avatar?, coinBalance }` (line 7–12), but `packages/shared/src/types/game.ts` defines `UserProfile` with the same fields plus `coinBalance`. These should be unified.

---

## 4. State Management

### Strengths

- **Component-level state** with `useState` for game state: `table`, `raiseAmount`, `countdownNow`, `dealAnimations`, `chipFlights`, `payoutFlights`, `winnerHighlights`, `loserHighlights`, `emojiFlights`, etc. — all appropriate for local component state.
- **Animation orchestration** is sophisticated: chip flights, deal card animations, winner/loser highlights, countdown tones — all coordinated via `useRef` for cleanup and `useCallback` for stable references.
- **Countdown timer** (lines 469–479): polls `Date.now()` every 200ms, driving `countdownNow` state. This is a standard pattern for client-side countdowns. Cleanup properly clears the interval.
- **`soundSettingsRef` pattern** (lines 64–66): Uses a ref to always read the latest `soundSettings` inside callbacks without causing re-renders. Good practice.

### Issues

1. **`previousTableRef` is set after the animation orchestration effect runs**:  
   Line 591: `previousTableRef.current = table;` is set _after_ the effect that uses `previousTableRef` (line 484). On first render, `previousTableRef.current` is `null`, so the delta-detection logic correctly skips animation on initial load. This is correct, but fragile — if the effect order changes this could break.

2. **State for `table` is not normalized or memoized**:  
   Every `room_update` event sets the entire `table` object (line 340). For large player arrays this could cause unnecessary re-renders of child components that receive `table` as a prop. No `React.memo` on `GameTable`, `ActionBar`, or `PlayerSeat` to prevent re-renders.

3. **`useCallback` dependencies in `page.tsx`**:  
   `queuePayoutFlights` is in the dependency array of the animation effect (line 592) but `queueDealAnimations` and `queueChipFlights` are also used in the same effect but may not be listed. This is a potential missing dependency lint warning. The effect at line 482 is missing `myUserId` in its dependency array (though `queuePayoutFlights` is included).

4. **`foldWinChoiceMade` is local state but affects settlement logic**:  
   `showFoldWinChoice` (line 635) depends on `foldWinChoiceMade` state. This is set to `true` by `handleShowCards` and `handleMuckCards`. If the user doesn't interact and the `settlementEndsAt` timeout fires, the choice is never recorded client-side (though the server presumably handles this server-side). The client doesn't track whether the server received the choice.

5. **No loading/error state for initial `room_update`**:  
   The `table` state starts as `null` and transitions to the first `TableState` on `room_update`. There's a loading spinner (lines 671–682) for when `table` is null. However, if the `join_room` emit fails (wrong password, room full, etc.) before any `room_update` arrives, the page stays in the loading spinner indefinitely — no dedicated error state for join failures.

---

## 5. Test Coverage

### What Exists

- `apps/web/components/socket-session-provider.spec.tsx`: 5 tests for `SocketSessionProvider` — handler registration, rendering, force-logout navigation, rejoin-available navigation, and duplicate-mount guard.
- `apps/web/lib/auth-context.spec.tsx`: 8 tests for `AuthProvider` — initial state, profile fetch on mount, login, logout, token cleanup on 401, error handling during profile fetch, and API call suppression when no token.
- `apps/web/jest.config.ts`: ts-jest with jsdom, `moduleNameMapper` for `@/` paths, identity-obj-proxy for CSS.
- `apps/web/jest.setup.ts`: Comprehensive setup with localStorage/sessionStorage mocks, Next.js router mocks, `@texas/shared` mocks, `@/lib/socket` mocks, `@/lib/auth` mocks, `@/lib/api` mocks, and `@/lib/system-message` mocks.

### Issues

1. **Only 2 test files for the entire web app**: Both tests are for auth/session concerns. There are **no tests** for:
   - The room page (`app/room/[id]/page.tsx`) — the most critical component
   - `ActionBar` component
   - `GameTable` component
   - `use-game-socket` hook
   - `api.ts` interceptor logic
   - `auth.ts` helpers (`handleExpiredSession`, token storage)
   - Equity calculation (`packages/shared/src/equity.ts`) — has zero tests despite being a pure, testable function with known inputs/outputs

2. **The equity function is entirely untested**: `equity.ts` implements complex hand evaluation and Monte Carlo simulation. A single incorrect comparison in `compareScores` or a wrong card combination count would silently produce wrong equity values.

3. **Mock setup in `jest.setup.ts` is tightly coupled**: The mocks for `@texas/shared` are overbroad (line 50: `getSocket: jest.fn(() => ({}))`). Tests that need to verify actual socket interactions cannot do so with this mock.

4. **No snapshot or visual regression tests**: No Playwright or visual testing setup for the web app (Playwright is configured for the backend only, per `AGENTS.md`).

5. **No test for `getAuthorizedSocket` in room page**: The token expiry/redirect logic that guards socket access has no test coverage.

---

## 6. Documentation

### Issues

1. **`apps/web/README.md` is the default Next.js scaffold README**: It contains generic Next.js boilerplate instructions and has **no information about the project's specific setup, available scripts, environment variables, or architecture**. This is not a real project README.

2. **No architecture documentation for the web app**: No `docs/` or `ARCHITECTURE.md` within `apps/web`. Developers joining the project have no guide for understanding the socket → room page → game table → action bar data flow.

3. **`AGENTS.md` at the repo root is comprehensive** and includes a section on the WebSocket events and shared package exports — this is useful but is at the repo level, not inside `apps/web`.

4. **No JSDoc comments on exported functions** in `apps/web/lib/`: `getStoredToken`, `handleExpiredSession`, `getAuthorizedSocket`, `leaveRoomViaSocket` all lack JSDoc or inline comments explaining their behavior and edge cases.

5. **`use-game-socket.ts`** has a clean comment block explaining the purpose (line 1–25), which is good.

6. **`auth-context.tsx`** has no comments explaining the auth flow, token refresh strategy, or why `checkAuth` runs on mount.

---

## Summary Table

| Category               | Rating    | Key Issues                                                                                        |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| Game Logic Integration | 🟡 Medium | Type drift between shared/web types; no client-side action validation; double-submit risk         |
| WebSocket Client       | 🟢 Good   | Solid socket singleton; mobile visibility handling; but cleanup gaps and no reconnect UI          |
| Auth Token Management  | 🟡 Medium | Hardcoded `'token'` string vs constants; no refresh token; `window.location.replace` side effects |
| State Management       | 🟡 Medium | No memoization; fragile effect ordering; no error state for join failures                         |
| Test Coverage          | 🔴 Low    | Only 2 spec files; zero coverage for room page, game components, equity, or api interceptors      |
| Documentation          | 🔴 Low    | Generic Next.js README; no web-app-specific docs; no JSDoc on key functions                       |

---

## Recommended Priority Actions

1. **Fix `socket.on` cleanup in `page.tsx`** — all listeners registered in the effect must be removed on cleanup.
2. **Add token refresh mechanism** — the current expiry-redirect pattern disrupts active games.
3. **Unify `TableState` and `Player` types** — single source of truth in `packages/shared`, consumed everywhere.
4. **Add tests for equity calculation** — it's a pure function with known inputs/outputs, trivial to test.
5. **Add `React.memo` to `GameTable`, `ActionBar`, `PlayerSeat`** to prevent unnecessary re-renders on `room_update`.
6. **Replace generic README** with project-specific documentation covering environment setup, architecture, and key flows.
7. **Consolidate token storage key** to a single shared constant.
8. **Add Playwright or visual regression tests** for the critical room game page.
