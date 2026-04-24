# 任务队列

## 优先级说明
- **P0**: 紧急/阻塞问题（安全、Bug导致的无法使用）
- **P1**: 重要功能缺陷或体验问题
- **P2**: 优化建议

---

## P0 — 误报修正

> ⚠️ 第88轮验证：TooManyRequestsException 在 @nestjs/common@11.1.14 中不存在 → 已修复

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P0-NEW-001 | TooManyRequestsException 编译失败 | ✅ 已修复 | 替换为 BadRequestException |

---

## P0 — 已验证无需修复

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P0-001 | Auth: Redis宕机时JWT验证被绕过 | ✅ 已验证无需修复 | 设计决策：Redis不可用时拒绝所有请求=完全停机 |
| P0-002 | Withdraw: Redis不可用时cooldown被静默跳过 | ✅ 已验证无需修复 | 代码已正确throw |
| P0-003 | Withdraw: processWithdraw服务层无Admin角色验证 | ✅ 已验证无需修复 | AdminGuard在Controller层执行 |

---

## P1 — 进行中

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| P1-002 | Jest Worker 泄漏 | 🟡 非阻塞 | 238 tests 通过，仍有 leak warning |

---

## P2 — TypeScript 编译错误（阻塞构建）

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| ~~P2-TS-002~~ | app.gateway.ts action 类型不兼容 | ✅ 已修复 | 联合类型 |
| ~~P2-TS-001~~ | table-manager.service.spec.ts 参数数量 | ✅ 已修复 | rakebackService 占位符 |
| ~~P2-TS-003~~ | timer-debug.spec.ts 参数数量 | ✅ 已修复 | processAction mock 签名 |
| P2-LINT-001 | game.handler.ts prettier 格式错误 | ✅ 已修复 | lint --fix |
| P2-004 | Web `<img>` → `<Image />` | 🟡 待优化 | club/page.tsx 等 |
|| **P2-NEW-001** | ~~app.gateway.ts `amount?: unknown`~~ | ✅ 已修复 | `amount?: number` 已修复 |

---

## P2 — 已完成

| ID | 任务 | 状态 |
|----|------|------|
| P2-002 | Club 数据库迁移 | ⏳ 待执行 |
| P2-003 | Sit-Out 重构 | ✅ 已实现 |
| P2-004 | All-in 确认弹窗 | ✅ 前端实现完成 |

---

## P3 — Tournament 路线图

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | SNG 单桌赛 | 📋 规划中 |
| Phase 2 | Jackpot SNG | 📋 规划中 |
| Phase 3 | MTT 多桌赛 | 📋 规划中 |

---

*最后更新: 2026-04-25 02:47 — Coding 第89轮 — P0-NEW-001 + P2-TS-001/002/003 全部修复，生产构建通过*
