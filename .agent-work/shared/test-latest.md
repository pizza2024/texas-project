# Test Latest — 第251轮

**时间:** 2026-04-26 19:15
**HEAD:** `9ccf7f1` — fix: P2-LINT-002 no-unsafe-function-type in withdraw.service.spec.ts

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
| 后端测试 | ✅ 28 suites / 323 tests PASS |
| P0 问题 | ✅ 全部清零 |
| P1 资金安全 | ✅ 已全部修复 |

## 本轮 CodeReview 发现

### 🔴 P1 建议 — Chat Username 身份冒充

**文件:** `apps/backend/src/websocket/game.handler.ts` 行 557-558

`username` 直接取自 JWT payload 而非 DB 查询，攻击者可冒充他人身份。

**建议:** 升为 P1，修复方案为 DB lookup 基于 userId 查询真实 username。

### 🟡 P2 — JWT httpOnly Cookie 前端未迁移

Web 前端仍读 `localStorage.getItem("token")`（`rooms/page.tsx` 行 766），Socket.io 握手仍依赖 `handshake.query.token`。

### 🟡 P2 — 房间密码明文存 sessionStorage

`sessionStorage.setItem('room-password:...', pwd)` 仍未修复。

### 🟡 P2 — 测试覆盖 Web/Mobile/Tournament 均为 0

## 任务队列

| 优先级 | ID | 任务 |
|--------|----|------|
| P1 建议 | P1-CHAT-INJECTION | Chat 需 DB 查询 username 而非信任 JWT payload |
| P2 | P2-JWT-LOCALSTORAGE-FRONTEND | Web 前端迁移到 httpOnly cookie |
| P2 | P2-ROOM-PASSWORD | 房间密码明文存 sessionStorage |
| P2 | P2-WEB-SPEC | Web 端测试覆盖 |
| P2 | P2-MOBILE-SPEC | Mobile 端测试覆盖 |
| P2 | P2-TOURNAMENT-SPEC | Tournament 测试覆盖 |
| P2 | P2-CHAT-FRONTEND-TEST | ChatPanel WS 组件测试 |
| P2 | P2-DEPOSIT-TOCTOU | HD wallet index 索引竞争 |
| P2 | P2-CHAT-IDEMPOTENCY | 聊天消息缺少幂等键 |
| P2 | P2-WS-RATE-UNIT | WebSocket 限速单位混淆 |
| P2 | P2-ROOM-RETRY | 重试无指数退避 |

---

*Test 第251轮 — 2026-04-26 19:15 — 0 P0 / 0 P1 / 11 P2*
