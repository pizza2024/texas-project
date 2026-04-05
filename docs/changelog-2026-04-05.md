# Changelog — 2026-04-05

> 本文档记录 2026-04-05 的主要开发变更，按时间顺序排列。

---

## 📌 今日新增 / 变更功能

### 1. 🏧 提现页面 (Withdraw Screen) — `8543918`
**文件:**
- `apps/mobile/app/withdraw.tsx` (新增 451 行)
- `apps/mobile/app/hands.tsx` (新增 285 行)
- `apps/mobile/app/rooms.tsx` (改动 24 行)
- `apps/mobile/app/_layout.tsx` (改动 36 行)
- `apps/mobile/locales/zh-CN.json`, `en-US.json` (各+37 行)
- `docker-compose.yml` (+20 行)
- `docs/admin-mobile-adaptation.md` (新增 280 行)
- `scripts/debug-mobile-charts.mjs` (新增调试脚本)

**内容:**
- 新增完整的 **WithdrawScreen** 组件：显示余额、提现表单、交易历史
- 新增 **Hands 页面**：`/hands` 展示用户手牌历史
- 新增 **Admin 后台移动端适配文档** (`admin-mobile-adaptation.md`)，分析后台响应式问题并提出解决方案
- 新增 Playwright 调试脚本用于抓取移动端图表容器尺寸

---

### 2. 🔐 Rate Limiting 增强 — `7969e7d`
**文件:** `apps/backend/src/auth/rate-limit.guard.ts`, `apps/backend/src/auth/auth.controller.ts`

**内容:**
- 新增 `keyType` 配置选项：支持 `userOrIp | ip | user | emailOrIp` 四种限流维度
- 开发环境（`NODE_ENV !== production`）自动 bypass IP 限流
- 在 auth controller 中应用新的限流策略

---

### 3. 🔌 WebSocket 服务器就绪检测 — `10187ae`
**文件:** `apps/backend/src/main.ts`, `apps/backend/src/websocket/app.gateway.ts`

**内容:**
- `main.ts` 新增服务启动就绪等待逻辑
- `app.gateway.ts` 新增 `server readiness checks`，确保 WebSocket 服务完全就绪后才接受连接
- 增强事件处理稳定性

---

### 4. 🚮 DELETE /rooms/:id 端点 — `eafa54c`
**文件:** `apps/backend/src/room/room.controller.ts`

**内容:**
- 新增 `DELETE /rooms/:id` 接口，支持删除房间
- 修复了 `hourly-test` 中发现的 404 问题

---

### 5. 📧 Email 验证码 Redis 提取脚本 — `87fb8e8`
**文件:** `scripts/get-dev-email-verified-code.sh` (新增)

**内容:**
- 新增开发脚本，从 Redis 中提取邮件验证码，方便开发调试
- 同时修改了 `apps/web/app/room-mobile/[id]/page.tsx`（329 行改动）

---

### 6. 🔒 WebSocket 用户级并发锁 (最新提交前改动)
**文件:** `apps/backend/src/websocket/app.gateway.ts`

**内容:**
- 新增 `userLocks` Map，防止同一用户并发执行 join/leave 导致多房间 membership 问题
- 新增 `withUserLock()` 方法，对每个用户账号加锁
- `already_in_room` 事件新增 `targetRoomId` 和 `canSwitch: true` 字段，支持切换房间
- 房间锁定 (`withRoomLock`) 嵌套于用户锁定内，形成双重保护

---

### 7. 💬 System Message Confirm 弹窗支持 (最新提交前改动)
**文件:** `apps/web/components/system-message-provider.tsx`, `apps/web/lib/system-message.ts`

**内容:**
- 新增 `subscribeConfirmMessage` 确认消息订阅机制
- `PendingConfirmMessage` 队列支持，弹窗可带"确认/取消"按钮
- 完整的 i18n 翻译（de, en, fil, ja, zh-CN, zh-TW 各+5 行）

---

### 8. 🧪 测试文件大量新增 (最新提交前改动)
**文件:**
- `apps/backend/src/table-engine/table-manager.service.spec.ts` (+64 行)
- `apps/backend/src/websocket/app.gateway.spec.ts` (+64 行)
- `apps/backend/src/auth/auth.service.spec.ts` (+7 行)

---

## 📂 新增文档

| 文档 | 说明 |
|------|------|
| `docs/hourly-test-2026-04-05-*.md` | 每小时 API 质检报告（pipi 编写） |
| `docs/admin-mobile-adaptation.md` | Admin 后台移动端适配分析文档 |
| `docs/withdraw-design.md` | 提现功能完整技术设计文档 |

---

## 🐛 问题修复记录

| 问题 | 状态 | 关联 Commit |
|------|------|-------------|
| DELETE /rooms/:id 返回 404 | ✅ 已修复 | `eafa54c` |
| Rate Limit 开发环境误限 | ✅ 已修复 | `7969e7d` |
| WebSocket Upgrade 失败（返回 200 而非 101） | 🔄 部分修复（就绪检测） | `5be2832`, `10187ae` |
| 同一用户并发 join/leave 导致多房间 membership | ✅ 已修复 | (未提交) |
| 登录返回 201 而非 200 | ⚠️ 待修复 | — |

---

## 📊 代码量统计（今日）

```
总计: 24 文件, +679 行, -132 行

apps/backend/src/websocket/app.gateway.ts  ~+200 行（重大重构）
apps/backend/src/table-engine/table-manager.service.ts  ~+85 行
apps/web/components/system-message-provider.tsx  ~+105 行
apps/web/lib/system-message.ts  ~+49 行
apps/mobile/app/withdraw.tsx  +451 行（昨日新增）
apps/mobile/app/hands.tsx  +285 行（昨日新增）
```

---

## 🔜 待办事项

- [ ] 修复 POST /auth/login 返回 201 → 应为 200
- [ ] WebSocket 握手问题彻底排查（hourly-test 报告 101 未返回）
- [ ] Rate Limit 在生产环境下的完整测试
- [ ] Admin 后台移动端适配实际落地
- [ ] 提现功能前后端联调
- [ ] 确认消息弹窗在前端的实际调用接入

---

_本文档由 pipi 🤖 自动生成于 2026-04-05 21:40 CST_
