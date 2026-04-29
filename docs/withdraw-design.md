# Withdraw Feature - Technical Design

## Overview

Symmetric to the deposit flow (USDT → Chips via faucet), the withdraw feature enables users to convert Chips back to USDT by requesting a withdrawal. The system owner wallet sends USDT on-chain to the user's withdrawal address, and the corresponding chips are deducted from the user's balance.

---

## 1. Database Schema (Prisma)

### New Model: `WithdrawRequest`

```prisma
model WithdrawRequest {
  id            String    @id @default(uuid())
  userId        String
  amountChips   Float
  amountUsdt    Float
  toAddress     String    // User's ETH address to receive USDT
  fromAddress   String?   // System owner wallet address used (set on process)
  status        String    @default("PENDING") // PENDING | PROCESSING | CONFIRMED | FAILED
  txHash        String?
  failureReason String?
  processedAt   DateTime?
  createdAt     DateTime  @default(now())

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("withdraw_requests")
}
```

### Enum-like Status Values

| Status       | Description                                 |
| ------------ | ------------------------------------------- |
| `PENDING`    | Created, awaiting admin/system processing   |
| `PROCESSING` | Chain transaction submitted                 |
| `CONFIRMED`  | Chain transaction confirmed (1 block)       |
| `FAILED`     | Chain tx failed or rejected; chips returned |

### Indexes

```prisma
@@index([userId, status])
@@index([status, createdAt])
```

---

## 2. Business Constants

| Constant               | Value                                    |
| ---------------------- | ---------------------------------------- |
| `USDT_TO_CHIPS_RATE`   | `100` (1 USDT = 100 chips)               |
| `CHIPS_TO_USDT_RATE`   | `0.01` (1 chip = 0.01 USDT)              |
| `MIN_WITHDRAW_CHIPS`   | `1000` (minimum = 10 USDT)               |
| `MIN_WITHDRAW_USDT`    | `10`                                     |
| `WITHDRAW_COOLDOWN_MS` | `60_000` (60 seconds)                    |
| `CONFIRMATION_BLOCKS`  | `1` (wait for 1 block)                   |
| `POLL_INTERVAL_MS`     | `5_000` (poll every 5s for confirmation) |

---

## 3. API Design

### User Endpoints

#### `POST /withdraw/create`

Create a new withdraw request.

**Request Body:**

```json
{
  "toAddress": "0x...", // Valid ETH address
  "amountChips": 5000 // Number of chips to withdraw
}
```

**Response (201):**

```json
{
  "id": "uuid",
  "amountChips": 5000,
  "amountUsdt": 50,
  "toAddress": "0x...",
  "status": "PENDING",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**Error Cases:**

- `400` - Invalid ETH address format
- `400` - Amount below minimum (1000 chips)
- `400` - Insufficient available balance
- `429` - Cooldown not elapsed (60s)

---

#### `GET /withdraw/status/:id`

Query withdraw status by ID.

**Response (200):**

```json
{
  "id": "uuid",
  "amountChips": 5000,
  "amountUsdt": 50,
  "toAddress": "0x...",
  "status": "CONFIRMED",
  "txHash": "0x...",
  "processedAt": "2024-01-01T00:01:00Z",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

#### `GET /withdraw/history`

Get current user's withdraw history (paginated).

**Query Params:** `page=1&limit=20`

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "amountChips": 5000,
      "amountUsdt": 50,
      "toAddress": "0x...",
      "status": "CONFIRMED",
      "txHash": "0x...",
      "processedAt": "2024-01-01T00:01:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

#### `GET /withdraw/balance`

Get current user's available chip balance (for withdraw).

**Response (200):**

```json
{
  "availableChips": 15000,
  "minWithdrawChips": 1000,
  "minWithdrawUsdt": 10,
  "rate": 100
}
```

---

#### `GET /withdraw/cooldown`

Get remaining cooldown time.

**Response (200):**

```json
{
  "remainingMs": 30000,
  "canWithdraw": false
}
```

---

### Admin Endpoints

#### `GET /admin/withdraw/requests`

List all withdraw requests (paginated, filterable).

**Query Params:** `page=1&limit=20&status=PENDING&userId=uuid`

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "username": "player1",
      "nickname": "PlayerOne",
      "amountChips": 5000,
      "amountUsdt": 50,
      "toAddress": "0x...",
      "status": "PENDING",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

#### `GET /admin/withdraw/:id`

Get withdraw request details.

**Response (200):** Full withdraw request with user info.

---

#### `PATCH /admin/withdraw/:id/process`

Process (execute) a pending withdraw request.

**Request Body:**

```json
{
  "action": "APPROVE" | "REJECT",
  "reason": "optional rejection reason"
}
```

**Response (200):**

```json
{
  "id": "uuid",
  "status": "PROCESSING",
  "txHash": "0x...",
  "processedAt": "2024-01-01T00:01:00Z"
}
```

---

## 4. Service Layer

### `WithdrawService`

```typescript
class WithdrawService {
  // Create withdraw request (validates, deducts chips immediately)
  createWithdraw(
    userId: string,
    dto: CreateWithdrawDto,
  ): Promise<WithdrawRequest>;

  // Get withdraw status
  getWithdrawStatus(id: string, userId: string): Promise<WithdrawRequest>;

  // Get user withdraw history
  getWithdrawHistory(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult>;

  // Get available balance for withdraw
  getAvailableBalance(userId: string): Promise<WithdrawBalanceDto>;

  // Check cooldown
  getCooldownRemaining(userId: string): Promise<CooldownDto>;

  // Admin: list all requests
  listRequests(query: ListWithdrawQuery): Promise<PaginatedResult>;

  // Admin: get single request
  getRequestById(id: string): Promise<WithdrawRequest>;

  // Admin: process withdraw (approve/reject)
  processWithdraw(
    id: string,
    adminId: string,
    action: string,
    reason?: string,
  ): Promise<WithdrawRequest>;

  // Internal: execute chain transfer (called after PROCESSING)
  executeChainWithdraw(request: WithdrawRequest): Promise<string>; // returns txHash

  // Internal: poll for confirmation
  pollWithdrawConfirmation(requestId: string): Promise<void>;

  // Internal: handle chain failure
  handleWithdrawFailure(requestId: string, reason: string): Promise<void>;
}
```

### State Machine

```
PENDING ──(admin APPROVE)──→ PROCESSING ──(tx confirmed)──→ CONFIRMED
    │                              │
    └──(admin REJECT)──→ FAILED ←──┴──(chain REVERT)
```

### Chain Interaction

- Use `ethers.Contract` with `USDT.transfer(to, amountInUnits)`
- Owner wallet: `HDNodeWallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0")`
- Provider: `ethers.JsonRpcProvider(process.env.ETH_RPC_URL)`
- USDT contract: `process.env.USDT_CONTRACT_ADDRESS`
- Transfer amount in USDT smallest unit (6 decimals)

### Cooldown Implementation

Use in-memory `Map<string, number>` (userId → timestamp) — same pattern as `DepositService.faucetCooldowns`.

---

## 5. Frontend Design

### `/withdraw` Page

**Layout:** Mirrors the `/deposit` page structure.

**Components:**

1. **BalanceCard** - Shows available chips, min withdraw info
2. **WithdrawForm** - Address input + amount input + submit
3. **CooldownTimer** - 60-second countdown after last withdraw
4. **HistoryTable** - Paginated withdraw history

**WithdrawForm States:**

- `idle` - Ready to submit
- `cooldown` - Shows countdown timer, submit disabled
- `submitting` - Loading state
- `success` - Shows tx hash and confirmation
- `error` - Shows error message

**Form Validation:**

- ETH address: regex `^0x[a-fA-F0-9]{40}$`
- Amount: integer, >= 1000 chips
- Balance check (client-side for UX, server-side for security)

---

### `/admin/withdraw` Page

**Components:**

1. **WithdrawTable** - Paginated, filterable by status
2. **WithdrawDetailModal** - Shows full request details
3. **ProcessActions** - Approve/Reject buttons for PENDING requests

---

## 6. WebSocket Events

Publish `withdraw_status_updated` event when status changes:

```typescript
{
  event: 'withdraw_status_updated',
  data: {
    requestId: string,
    status: 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FAILED',
    txHash?: string,
  }
}
```

Emit to the specific user's room: `server.to(`user:${userId}`)`.

---

## 7. Testing Plan

### Unit Tests

1. `WithdrawService.createWithdraw` - validates:
   - ✅ Minimum amount (1000 chips)
   - ✅ Balance check
   - ✅ Cooldown check
   - ✅ Valid ETH address
   - ✅ Chips deducted immediately

2. `WithdrawService.processWithdraw` - validates:
   - ✅ Only PENDING requests can be processed
   - ✅ Chips returned on REJECT
   - ✅ Chips NOT returned on APPROVE (already deducted)
   - ✅ Admin log created

3. `WithdrawService.executeChainWithdraw` - validates:
   - ✅ Correct USDT amount sent
   - ✅ Correct recipient address

### Integration Tests

1. Full flow: create → admin approve → chain confirm → CONFIRMED
2. Full flow: create → admin reject → FAILED + chips returned
3. Concurrent withdraw attempts (should fail with cooldown)
4. Withdraw with insufficient balance (should fail)

### Manual Testing Checklist

- [ ] Create withdraw request with valid amount
- [ ] See 60s cooldown after creation
- [ ] Cannot create another withdraw during cooldown
- [ ] Admin sees new pending request
- [ ] Admin approves → status becomes PROCESSING
- [ ] After block confirmation → status becomes CONFIRMED
- [ ] Admin rejects → chips returned, status FAILED
- [ ] Cannot withdraw more than available balance
- [ ] Cannot withdraw below minimum (1000 chips)
- [ ] Invalid ETH address rejected
- [ ] History page shows correct records
