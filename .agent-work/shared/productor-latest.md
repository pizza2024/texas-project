# Productor Latest — 第113轮

> 更新时间: 2026-04-25 08:46

## 状态

| 状态 | P0 | P1 | P2 |
|------|----|----|-----|
| 数量 | 0 🟢 | 1 | 0 🟢 |

## HEAD Commit

`1f3002e`（7个文件未提交）

## P1 进行中（1项）

| ID | 问题 | 状态 | 备注 |
|----|------|------|------|
| P1-CLUB-INVITE-001 | Club 私人邀请码设计文档 | ✅ 本轮完成 | 含完整 DB Schema + API 设计 + 前端流程 |

## Club 私人邀请码 — 本轮完成

### 设计要点

- **DB**: `ClubInviteCode` model — code(6位字母数字)、maxUses、expiresAt、usedCount
- **Code生成**: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`（排除易混淆字符）
- **API**: `POST /clubs/:id/invite-codes`、`POST /clubs/join-by-code`、`GET /clubs/validate-code`
- **前端**: Club Detail弹窗「邀请」标签 + `/club/join?code=XXXX` 公开落地页
- **安全**: 速率限制、统一错误提示防枚举、DB unique index + 重试

### 完整设计文档

见：`.agent-work/productor/report-2026-04-25-0846.md`

## 竞品 Rakeback 对比

| 平台 | 最高 Rakeback | Tiers |
|------|--------------|-------|
| GGPoker | 60%+ | 5+ (Bronze→Diamond) |
| ACR | 55%+ | 多级复杂 |
| CoinPoker | 55%+ | 4 tiers |
| PokerStars | 40-50% | 5星 VIP |
| 888poker | 36% | 3 tiers |
| **本项目** | **30% (GOLD)** | **3 (BR→SIL→GOLD)** |

**差距 30%（绝对值），建议 PLATINUM(40%) + DIAMOND(50%) 扩展方向。**

## 竞品创新亮点（借鉴价值）

| 创新 | 来源 | 借鉴价值 |
|------|------|---------|
| Smart HUD | GGPoker | 内置统计，无需第三方 |
| Zoom Poker | PokerStars | 快速弃牌换桌 |
| Flip & Go | GGPoker/888poker | 前置全下预选娱乐性 |
| 区块链 RNG | CoinPoker | 公开透明随机数 |
| The Beast Race | ACR | 高频玩家周榜激励 |

## Coding/Test 反馈

- **Coding**: P2-TS-NEW-002/003 ✅ 已修复，267 tests pass
- **Test**: P0 全部清零，rakeback.e2e 不再阻塞 P1-RAKEBACK-001

## 下轮行动

1. **P1:** Club 邀请码设计文档传递给 Coding 实现
2. **P1:** Rakeback PLATINUM/DIAMOND tier 扩展设计
3. **P1:** rakeback E2E 验证（P1-RAKEBACK-001）
4. **P2:** Avatar 系统设计方案

---

*Productor 第113轮 — Club 邀请码完整设计文档，竞品调研（60%+ rakeback、Smart HUD、Flip & Go），建议扩展 Rakeback 层级 + Avatar 系统*
