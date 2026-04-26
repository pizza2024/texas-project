# Productor Latest — 第273轮

**时间:** 2026-04-27 01:00
**HEAD:** `6f52aa5` — 0 P0 / 0 P1 / ~5 P2

---

## 系统状态

- **HEAD:** `6f52aa5` — fix(wallet.spec): resolve TS type error in $transaction mock loop
- **测试:** 31 suites / 410 tests ✅
- **P2:** ~5 项（P2-WALLET-SPEC-TS, P2-WEB-SPEC, P2-ROOM-RETRY, P2-CODE-PATTERN, P2-WS-RATE-UNIT）

---

## 本轮调研 — Tournament Prize Display UX

### 竞品对标

| 特性 | GGPoker | PokerStars Blast | 本项目 |
|------|---------|------------------|--------|
| 总奖池金额 | ✅ | ✅ | ❌ 缺失 |
| GTD 标签 | ✅ | ✅ | ❌ 缺失 |
| 已注册人数 | ✅ | ✅ | ❌ 缺失 |
| 乘数揭示动画（SPINS） | ✅ | ✅ | ❌ 待实施 |
| 5分钟强制 showdown | ✅ | ✅ | ❌ 待实施 |

---

## P1-PRIZE-DISPLAY 规格建议

### 当前 ScheduleEntry 缺失字段
- `prizePool` — 总奖池金额
- `isGuarantee` — 是否有 GTD 保障
- `registeredCount` — 当前报名人数

### 建议前端 TournamentCard 变更
```tsx
// 总奖池 + GTD 标签
{prizePool && (
  <div className="flex items-center gap-2">
    <span className="text-yellow-400 font-bold text-lg">
      {formatChips(prizePool)} chips
    </span>
    {isGuarantee && (
      <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded font-bold">
        GTD
      </span>
    )}
  </div>
)}

// 已注册人数
{registeredCount !== undefined && (
  <span className="text-gray-400 text-sm">
    {registeredCount}/{maxPlayers} registered
  </span>
)}
```

---

## P2 状态

| ID | 描述 | 状态 |
|----|------|------|
| P2-CHAT-IDEMPOTENCY | 聊天幂等键 | ✅ 已修复 |
| P2-TOURNAMENT-SPEC | Tournament spec | ✅ 已完成 |
| P2-WALLET-SPEC | Wallet spec | ✅ 已完成 |
| P2-WEB-SPEC | Web 测试覆盖 | 🟡 部分完成 |
| P2-WS-RATE-UNIT | 时间单位注释混淆 | 🔍 待认领 |
| P2-CODE-PATTERN | Promise.all 优化 | 🔍 待认领 |
| P2-ROOM-RETRY | 重试无指数退避 | 🔍 待认领 |
| P2-WALLET-SPEC-TS | $transaction mock TS 类型错误 | 🔍 待认领 |

---

## 下轮调研

1. **CoinPoker 链上验证功能深度研究** — verifiable shuffle 技术
2. **WSOP Mobile UX 截图分析** — 竞品移动端界面
3. **P1-PRIZE-DISPLAY 实施追踪** — 确认 Coding 认领状态
4. **Blast 奖池 UI 设计** — 参考 GGPoker SPINS 动画

---

## 已完成规格

| 规格 | 状态 |
|------|------|
| SPINS/Blast | 📋 P1-BLAST-001 规格已完成，待 Coding 实施 |
| 每日任务 | ✅ |
| 首充奖励 | ✅ |
| 好友/聊天 | ✅ |
| Tournament SNG Phase 1+2 | ✅ |
| 手牌复盘 Phase 1+2 | ✅ |
| Emoji 互动 | ✅ |
| Rakeback 5层 | ✅ |
| Matchmaking/Wallet spec | ✅ |
| P2-CHAT-IDEMPOTENCY | ✅ |
| FriendService spec | ✅ |
| Admin lint 0 warnings | ✅ |

---

*Productor 第273轮 — 2026-04-27 01:00*
