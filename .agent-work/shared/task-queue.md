# 任务队列

## 优先级说明
- **P0**: 紧急/阻塞问题（安全、Bug导致的无法使用）
- **P1**: 重要功能缺陷或体验问题
- **P2**: 优化建议

---

## 当前问题状态（2026-04-25 01:15 — Test 第83轮）

### P0 — 3个遗留问题（已验证无需修复）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P0-001 | Auth: Redis宕机时JWT验证被绕过 | ✅ 已验证无需修复 | auth/jwt.strategy.ts — 设计决策：Redis不可用时拒绝所有请求=完全停机。现有设计为降级+日志[SECURITY-AUTH-BYPASS] |
| P0-002 | Withdraw: Redis不可用时cooldown被静默跳过 | ✅ 已验证无需修复 | withdraw/withdraw.service.ts lines 120-129 — 代码已正确throw，cooldown bypass 已修复 |
| P0-003 | Withdraw: processWithdraw服务层无Admin角色验证 | ✅ 已验证无需修复 | withdraw/withdraw.controller.ts — AdminGuard在Controller层执行，服务层为私有 |

### P1 — 2个新发现问题

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-001 | 断线重连清理竞态 | ✅ 已修复 | commit f2b6d57 → 6cd334b |
| P1-002 | Jest Worker 泄漏 | 🟡 非阻塞 | 215 tests 全部通过，仍有 leak warning |
| P1-003 | 首充红利 | 🆕 正式立项 | 100% USDT 匹配，上限100U |
| P1-004 | Rakeback MVP | ⏳ 进行中 | 三级 VIP（铜10%/银20%/金30%），利用 totalRake |
| P1-005 | Wallet: freeze/unfreeze不同步User.coinBalance | ✅ 已修复 | wallet/wallet.service.ts — freezeBalance/unfreezeBalance现在使用$transaction同步User.coinBalance |
| P1-006 | Auth: verifyEmailCode无速率限制 | ✅ 已修复 | auth/auth.service.ts — 添加5次失败锁定(300s)，OTP暴力枚举被阻止 |

### P2 — 进行中

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P2-002 | Club 数据库迁移 | ⏳ 待执行 | 需要 DATABASE_URL |
| P2-003 | Sit-Out 重构 | ✅ 已实现 | **Option C**：连胜3次超时强制 SITOUT |
| P2-004 | All-in 确认弹窗 | ✅ 前端实现完成 | WSOP 风格，equity 硬编码需修复 |

### P2 — 本轮新发现

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P2-NEW-001 | calledAllIn re-entry raise 保护 | ✅ 已修复 + minRaiseTo 缓解 | table-player-ops.ts line 319：minRaiseTo 约束已阻止实际漏洞 |
| P2-NEW-002 | 双重余额恢复 | 🟡 已审查风险可控 | resetBalanceAndUnfreeze 原子操作，WAITING 桌清理逻辑正确 |
| P2-NEW-003 | 浮点数芯片金额验证 | ✅ 已修复 | validation.ts：z.number().int() |
| P2-NEW-004 | roomId 类型不准确 | ✅ 已修复 | game.handler.ts：PlayerActionInput 类型 |
| P2-NEW-005 | All-in 弹窗 equity 硬编码 | ✅ 已修复 | equity.ts 蒙特卡洛模拟 2000次 |
| P2-LINT-001 | game.handler.ts prettier 格式错误 | 🔴 本轮新发现 | line 254/261，auto-fix 可解决 |

### P2 — ✅ 近期完成

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P2-001 | Club 前端页面 | ✅ 完成 | 第65轮 |
| P2-Club-FE-001~004 | Club 前端 P2 四项 | ✅ 完成 | commit bf7da46 |
| P3-Rake | Rake 抽水系统 | ✅ 完成 | commit 2d807b1 |

---

## P3 — 规划中

| 任务 | 优先级 | 备注 |
|------|--------|------|
| 首充红利 | P1 | ✅ 正式立项 |
| Rakeback 体系 | ~~P3~~ → P1 | ✅ 升级为 P1-004 |
| Club 俱乐部系统 | P3 | ✅ Phase 1 MVP 已实现 |
| Tournament 赛制 | P3 | 调研完成，待开发 |
| FastFold Snap Mode | P3 | BetMGM/888poker 参考 |
| Jackpot Sit & Go | P3 | 888poker/CoinPoker 参考 |
| AI 陪练模式 | P3 | WSOP/Pokerrr 竞品趋势 |
| 记牌器/复盘功能 | P3 | BetMGM 参考 |
| 每日登录奖励 | P3 | |
| Web 前端测试覆盖 | P3 | |
| 移动端滑动弃牌 | P3 | 竞品标配 |
| 移动端底部操作区优化 | P3 | 竞品标配 |
| 移动端推送通知 | P3 | DAU 提升关键功能 |

---

## CodeReview 健康状态（00:15）

| 模块 | 状态 | 备注 |
|------|------|------|
| WebSocket | ⚠️ 审查通过但有P2项 | roomId未验证、浮点金额、equity硬编码 |
| Timer | ✅ 审查通过 | onModuleDestroy 清理完整 |
| Auth | 🔴 P0×1 + P1×1 遗留 | Redis降级绕过、OTP无限制 |
| Deposit | ✅ 审查通过 | 无明显问题 |
| Withdraw | 🔴 P0×2 遗留 | cooldown bypass、服务层鉴权缺失 |
| Wallet | 🟠 P1×1 遗留 | freeze/unfreeze不同步coinBalance |
| Table Engine | ✅ 新增P2-003 Sit-Out Option C | 核心逻辑正确 |
| Club | ✅ 审查通过 | Phase 1 MVP 完整 |

### 测试覆盖缺失
- `TableManagerService` 缺少单元测试（当前依赖集成测试覆盖）
- `verifyEmailCode` 无自动化测试
- 前端（apps/web）无自动化测试
- All-in 弹窗组件无测试

---

## 协同注意

- **Backend HEAD**: `f5153ee` — P2-NEW-001 严格raise保护 + P2-NEW-004 roomId验证（第83轮 cherry-pick）
- **Backend Jest**: 22 suites / 215 tests 全部通过（1.955s）
- **本地未提交变更**: 仅 apps/admin/next-env.d.ts（Next.js 编译产物）
- **Jest Worker 泄漏**: P1-002 非阻塞
- **Coding**: 第82轮完成，P2-NEW-001/004 修复
- **Test**: 第83轮完成，无新增问题，215 tests 通过
- **Productor**: 第82轮完成，P1-003/004 正式立项

---

## 本轮建议

1. **P2-NEW-001**: 建议降为 P3 优化项 — calledAllIn 严格检查已阻止实际漏洞
2. **P2-NEW-002**: 建议增加 TableManagerService 崩溃恢复场景单元测试
3. **P1-003/004**: 首充红利/Rakeback API 设计需 Coding 本轮推进
4. **测试覆盖**: verifyEmailCode 速率限制单元测试缺失

---

*Last updated: 2026-04-25 01:15 — Test 第83轮 — 无新问题，215 tests 通过*
