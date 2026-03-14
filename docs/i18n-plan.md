# 国际化（i18n）实施计划

## 目标语言

| 代码 | 语言 |
|---|---|
| `en` | English（英语） |
| `zh-CN` | 简体中文 |
| `zh-TW` | 繁體中文 |
| `ja` | 日本語（日语） |
| `de` | Deutsch（德语） |
| `fil` | Filipino（菲律宾语） |

---

## 一、架构决策

### 1.1 前端方案：`i18next` + `react-i18next`

**选型理由**
- 与 Next.js App Router 完全兼容，不需要 URL 前缀路由（`/en/rooms` 等），符合当前项目不需要 SEO 多语言路由的游戏场景
- 支持插值（`$t('key', { amount: 20 })`），满足大量带动态金额的提示文本
- 生态成熟，TypeScript 类型支持良好
- 翻译文件可直接打包进 bundle（无需异步 HTTP 加载），避免 App Router SSR 水合问题

**语言偏好存储**：`localStorage` key `texas-locale`，首次访问时 fallback 到浏览器语言，最终 fallback 到 `zh-CN`

### 1.2 后端方案：无需修改

**原因**：经过分析，后端 socket 事件只传递**事件名称 + 结构化数据**（如 `{ balance, minimumRequiredBalance }`），不包含任何用户可见文本。前端负责将事件数据翻译成对应语言的提示文案，因此后端天然是 i18n 中立的，无需额外改动。

### 1.3 前后端"统一"的实现方式

- 后端只暴露**语义明确的 key / code**，例如 `insufficient_balance`、`room_full`，这些即为翻译 key
- 前端翻译文件对每个事件 code 维护多语言映射
- 如未来后端需要返回用户可见文本（如邮件、推送），再引入 `nestjs-i18n`

---

## 二、前端实施细节

### 2.1 目录结构

```
apps/web/
├─ lib/
│   ├─ i18n.ts                  # i18next 初始化配置
│   └─ use-locale.ts            # 语言切换 hook（读写 localStorage）
├─ locales/
│   ├─ en.json
│   ├─ zh-CN.json               # 默认语言
│   ├─ zh-TW.json
│   ├─ ja.json
│   ├─ de.json
│   └─ fil.json
└─ components/
    └─ i18n-provider.tsx        # 客户端 Provider，初始化 i18next
```

### 2.2 翻译 key 命名规范

采用**命名空间.语义**结构，扁平化：

```json
{
  "common.loading": "Loading…",
  "common.logout": "Logout",
  "auth.login": "Login",
  "auth.register": "Register",
  "auth.username": "Username",
  "auth.password": "Password",
  "lobby.title": "Lobby",
  "lobby.createTable": "Create New Table",
  "lobby.joinTable": "Join Table →",
  "lobby.insufficientFunds": "At least ${{amount}} required",
  "room.exitRoom": "Exit Room",
  "room.insufficientBalance": "Insufficient balance: requires ${{amount}}",
  "settings.language": "Language",
  "settings.title": "Settings",
  ...
}
```

### 2.3 需翻译的字符串统计

| 页面 / 模块 | 文件 | 字符串数 |
|---|---|---|
| 登录页 | `app/login/page.tsx` | ~15 |
| 注册页 | `app/register/page.tsx` | ~18 |
| 大厅页 | `app/rooms/page.tsx` | ~42 |
| 牌桌页 | `app/room/[id]/page.tsx` | ~48 |
| 设置页 | `app/settings/page.tsx` | ~37 |
| 首页 | `app/page.tsx` | ~20 |
| 系统消息组件 | `components/system-message-provider.tsx` | ~3 |
| **合计** | | **~183 条** |

### 2.4 语言选择器 UI

在**设置页（`/settings`）**新增"语言 / Language"一节：

```
语言 / Language
[下拉选择器]  English / 简体中文 / 繁體中文 / 日本語 / Deutsch / Filipino
```

切换后立即生效（React 状态驱动），并持久化到 localStorage。

---

## 三、实施步骤

### Phase 1 — 基础设施（不改业务逻辑）

| 步骤 | 工作内容 |
|---|---|
| 1 | 安装依赖：`i18next`、`react-i18next` |
| 2 | 创建 `apps/web/lib/i18n.ts`（初始化配置） |
| 3 | 创建 `apps/web/components/i18n-provider.tsx` |
| 4 | 在 `apps/web/app/layout.tsx` 中挂载 `I18nProvider` |
| 5 | 创建 `apps/web/lib/use-locale.ts` hook |
| 6 | 创建 6 个空翻译文件骨架，全部以 `zh-CN.json` 为主语言基准 |

### Phase 2 — 字符串提取与翻译文件填充

| 步骤 | 工作内容 |
|---|---|
| 7 | 提取 `zh-CN.json` 全量 key（~183 条） |
| 8 | 填写 `en.json`（英文翻译） |
| 9 | 填写 `zh-TW.json`（繁体转换 + 人工校对） |
| 10 | 填写 `ja.json`（日语翻译） |
| 11 | 填写 `de.json`（德语翻译） |
| 12 | 填写 `fil.json`（菲律宾语翻译） |

> 翻译可以 AI 辅助生成初稿，需人工审校（尤其是扑克术语：check/fold/raise/blind 等）

### Phase 3 — 页面替换

| 步骤 | 文件 | 优先级 |
|---|---|---|
| 13 | `app/room/[id]/page.tsx` | 🔴 高（游戏核心） |
| 14 | `app/rooms/page.tsx` | 🔴 高 |
| 15 | `app/login/page.tsx` + `app/register/page.tsx` | 🔴 高 |
| 16 | `app/settings/page.tsx` + 添加语言选择器 | 🔴 高 |
| 17 | `components/system-message-provider.tsx` | 🟡 中 |
| 18 | `app/page.tsx`（首页） | 🟢 低 |

### Phase 4 — 验证

| 步骤 | 工作内容 |
|---|---|
| 19 | 前端构建（`npm run build --workspace=apps/web`）通过 |
| 20 | 手动切换所有 6 种语言，确认文案无缺失（key fallback 检测） |
| 21 | 确认带参数插值的文案（金额、倒计时秒数）各语言正常渲染 |
| 22 | 确认设置页语言切换后立即刷新全部 UI |

---

## 四、关键技术风险与处理策略

| 风险 | 应对策略 |
|---|---|
| App Router SSR 水合不一致（服务端渲染语言与客户端不同） | i18next 在客户端初始化，Provider 包裹 `'use client'` 根布局；翻译文件打包进 bundle，不走 HTTP 请求 |
| 扑克术语在各语言的准确性（check/fold/raise/all-in 等） | 创建术语表，统一各语言翻译（附录 A） |
| 中文繁简差异细微，auto-convert 不准确 | 以 `zh-CN` 为基准手动校对 `zh-TW` |
| 带参数的复合字符串 | 统一使用 `t('key', { var: value })` 插值，禁止字符串拼接 |
| 日语/德语文本比中文长，UI 布局溢出 | 按钮、标签需设 `truncate` 或弹性宽度；Phase 4 视觉检查 |

---

## 五、附录 A — 扑克核心术语参考

| 概念 | zh-CN | zh-TW | en | ja | de | fil |
|---|---|---|---|---|---|---|
| 过牌 | 过牌 | 過牌 | Check | チェック | Checken | Check |
| 弃牌 | 弃牌 | 棄牌 | Fold | フォールド | Passen | Fold |
| 跟注 | 跟注 | 跟注 | Call | コール | Mitgehen | Call |
| 加注 | 加注 | 加注 | Raise | レイズ | Erhöhen | Raise |
| 全押 | 全压 | 全壓 | All-in | オールイン | All-in | All-in |
| 小盲注 | 小盲注 | 小盲注 | Small Blind | スモールブラインド | Small Blind | Small Blind |
| 大盲注 | 大盲注 | 大盲注 | Big Blind | ビッグブラインド | Big Blind | Big Blind |
| 底池 | 底池 | 底池 | Pot | ポット | Pot | Pot |
| 公共牌 | 公共牌 | 公共牌 | Community Cards | コミュニティカード | Gemeinschaftskarten | Community Cards |
| 翻牌 | 翻牌 | 翻牌 | Flop | フロップ | Flop | Flop |
| 转牌 | 转牌 | 轉牌 | Turn | ターン | Turn | Turn |
| 河牌 | 河牌 | 河牌 | River | リバー | River | River |
| 摊牌 | 摊牌 | 攤牌 | Showdown | ショーダウン | Showdown | Showdown |
| 准备 | 准备 | 準備 | Ready | 準備完了 | Bereit | Handa |

---

## 六、工作量估算

| 阶段 | 工时 |
|---|---|
| Phase 1（基础设施） | 1–2 小时 |
| Phase 2（翻译文件，AI 辅助） | 2–3 小时 |
| Phase 3（页面替换，6 个文件） | 4–6 小时 |
| Phase 4（验证与修复） | 1–2 小时 |
| **合计** | **8–13 小时** |

---

## 七、本计划不涵盖的内容

- 后端邮件/通知国际化（当前无此功能）
- URL 路径国际化（`/en/rooms`）— 游戏场景无 SEO 需求，不做
- 右至左（RTL）语言支持 — 当前 6 种语言均为 LTR
- 数字/货币/日期格式的地区化（`Intl.NumberFormat` 等）— 可按需后续追加
