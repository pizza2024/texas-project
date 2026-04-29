# Texas Hold'em 项目开发环境配置总结

**日期**: 2026-03-22  
**提交**: 734b79e

## 📋 今日完成工作

### 1. 开发环境搭建

#### 数据库配置

- ✅ 安装 PostgreSQL 16 (Homebrew)
- ✅ 安装 Redis 7 (Homebrew)
- ✅ 配置本地数据库服务（不使用 Docker）
- ✅ 创建数据库：`texas_dev`
- ✅ 运行 Prisma 迁移

**连接信息**:

```
PostgreSQL: postgresql://pizza@localhost:5432/texas_dev
Redis: redis://localhost:6379
```

**服务管理**:

```bash
# 启动
brew services start postgresql@16
brew services start redis

# 停止
brew services stop postgresql@16
brew services stop redis

# 状态
brew services list
```

#### 后端配置

- ✅ 更新 `apps/backend/.env.development` 使用本地数据库
- ✅ 安装缺失依赖：
  - `@nestjs/schedule`
  - `ethers`
  - `bignumber.js`
- ✅ 后端成功启动在 `http://localhost:4000`

#### Mobile 配置

- ✅ 创建 `apps/mobile/.env` 文件
- ✅ 配置 API URL：`http://localhost:4000`
- ✅ 配置 adb reverse 端口转发（4000, 8081）
- ✅ 添加调试日志到 `api.ts` 和 `login.tsx`

#### Android 模拟器

- ✅ 模拟器：Medium_Phone_API_36.1 (API 36, arm64-v8a)
- ✅ 设备 ID：emulator-5554
- ✅ Expo Go 已安装

### 2. 测试账号创建

已创建4个测试账号，每个账号初始筹码 10,000：

| 用户名  | 密码    | 昵称     | 余额   | ELO  |
| ------- | ------- | -------- | ------ | ---- |
| test    | test123 | 测试玩家 | 10,000 | 1000 |
| player1 | pass1   | 玩家1    | 10,000 | 1000 |
| player2 | pass2   | 玩家2    | 10,000 | 1000 |
| player3 | pass3   | 玩家3    | 10,000 | 1000 |

**创建方式**:

```bash
# 创建账号
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "test123", "nickname": "测试玩家"}'

# 设置初始筹码
psql -d texas_dev -c "UPDATE users SET \"coinBalance\" = 10000 WHERE role = 'PLAYER';"
```

### 3. 代码修改

#### 调试增强

**apps/mobile/lib/api.ts**:

```typescript
// 添加调试日志
console.log("🔧 [API] BASE_URL:", BASE_URL);
console.log("🔧 [API] EXPO_PUBLIC_API_URL:", process.env.EXPO_PUBLIC_API_URL);
```

**apps/mobile/app/login.tsx**:

```typescript
// 详细错误日志
console.log("🔐 [Login] Attempting login:", { username: username.trim() });
console.error(
  "❌ [Login] Error:",
  error.response?.data || error.message || error,
);
const errorMsg =
  error.response?.data?.message || error.message || t("auth.loginFailedMsg");
Alert.alert(t("auth.loginFailed"), errorMsg);
```

#### 构建系统

- ✅ 添加 `apps/docs/.gitignore` 排除 `.next` 构建文件
- ✅ 清理 90+ 个 Next.js 构建缓存文件

### 4. 运行中的服务

| 服务             | 状态       | 地址/端口      | 会话          |
| ---------------- | ---------- | -------------- | ------------- |
| PostgreSQL 16    | ✅ Running | localhost:5432 | brew services |
| Redis 7          | ✅ Running | localhost:6379 | brew services |
| Backend (NestJS) | ✅ Running | localhost:4000 | oceanic-ember |
| Metro Bundler    | ✅ Running | localhost:8081 | delta-valley  |
| Android Emulator | ✅ Online  | emulator-5554  | -             |

**检查服务状态**:

```bash
# 后端
curl http://localhost:4000

# 数据库
brew services list

# 模拟器
adb devices

# 登录 API
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

## ⚠️ 已知问题

### 1. Mobile 应用加载失败

**现象**: Expo Go 显示 "Something went wrong" 错误页面

**可能原因**:

- Metro bundler 没有收到编译请求
- 应用配置或依赖问题
- 网络连接问题

**下一步调试**:

1. 在 Expo Go 中点击 "View error log" 查看详细错误
2. 检查 Metro bundler 日志
3. 尝试清除 Expo Go 缓存
4. 验证 `app.json` 配置

### 2. lsof 命令缺失

**现象**: `npx expo start --android` 失败

**错误**:

```
Error: spawnSync lsof ENOENT
at Object.spawnSync (node:internal/child_process:1103:20)
```

**影响**: 无法使用 Expo CLI 自动启动模拟器

**解决方案**: 手动启动 Metro 并使用 adb 打开应用

### 3. 包版本警告

**警告**:

```
@react-native-async-storage/async-storage@3.0.1
expected version: 2.2.0
```

**影响**: 可能导致兼容性问题

**建议**: 更新到推荐版本

## 🚀 启动指南

### 完整启动流程

```bash
# 1. 启动数据库（首次需要）
brew services start postgresql@16
brew services start redis

# 2. 启动后端
cd texas-project/apps/backend
npm run dev

# 3. 启动 Metro Bundler（新终端）
cd texas-project/apps/mobile
npx expo start

# 4. 启动模拟器（新终端）
export ANDROID_HOME=~/Library/Android/sdk
$ANDROID_HOME/emulator/emulator -avd Medium_Phone_API_36.1

# 5. 配置端口转发
$ANDROID_HOME/platform-tools/adb reverse tcp:4000 tcp:4000
$ANDROID_HOME/platform-tools/adb reverse tcp:8081 tcp:8081

# 6. 在 Expo Go 中打开应用
# 手动输入: exp://localhost:8081
# 或使用: exp://192.168.0.106:8081
```

### 快速测试

```bash
# 测试后端
curl http://localhost:4000

# 测试登录
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'

# 检查模拟器
adb devices

# 查看应用日志
adb logcat | grep -E "🔧|🔐|✅|❌|ReactNativeJS"
```

## 📝 下一步工作

### 紧急 (P0)

1. [ ] 修复 Expo Go 加载错误
2. [ ] 验证 mobile 登录功能
3. [ ] 测试 API 连接

### 重要 (P1)

4. [ ] 更新 async-storage 到推荐版本
5. [ ] 测试 WebSocket 连接
6. [ ] 验证完整游戏流程

### 优化 (P2)

7. [ ] 添加错误边界和日志
8. [ ] 优化 Metro bundler 配置
9. [ ] 考虑安装 lsof（可选）
10. [ ] 配置 git 用户信息

## 🔧 故障排除

### 如果后端无法启动

```bash
# 检查端口占用
lsof -ti:4000 | xargs kill -9

# 或重启数据库
brew services restart postgresql@16
brew services restart redis
```

### 如果模拟器无响应

```bash
# 重启模拟器
adb reboot

# 或强制停止应用
adb shell am force-stop host.exp.exponent
```

### 如果 Metro 缓存问题

```bash
cd texas-project/apps/mobile
npx expo start --clear
```

## 📚 相关文档

- [项目设计文档](./ProjectDesign.md)
- [德州扑克规则](./TEXAS_HOLDEM_RULES.md)
- [Expo 文档](https://docs.expo.dev/)
- [NestJS 文档](https://docs.nestjs.com/)
- [Prisma 文档](https://www.prisma.io/docs)

## 🔐 环境变量

### Backend (.env)

```bash
DATABASE_URL="postgresql://pizza@localhost:5432/texas_dev"
JWT_SECRET="dev-jwt-secret-please-change-in-production"
PORT=4000
```

### Mobile (.env)

```bash
EXPO_PUBLIC_API_URL=http://localhost:4000
```

**注意**: `.env` 文件已被 `.gitignore` 忽略，不会提交到 Git。

## 📊 项目统计

- **提交**: 734b79e
- **文件修改**: 90 files
- **代码增加**: +55 lines
- **代码删除**: -22,239 lines (主要是清理构建文件)
- **测试账号**: 4 个
- **运行时间**: ~6 小时 (12:06 - 18:06)

## 📧 Development Email Testing

### Option 1: Ethereal Email (Recommended - No Account Needed)

1. Go to https://ethereal.email and click "Create Account"
2. You'll receive free SMTP credentials instantly
3. Add to `apps/backend/.env.development.local`:

```
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-username
SMTP_PASS=your-ethereal-password
SMTP_FROM=noreply@chips-poker.com
```

4. All sent emails appear at the preview URL shown after sending

### Option 2: Mailtrap

1. Sign up at https://mailtrap.io (free tier: 5 inboxes)
2. Get SMTP credentials from your inbox settings
3. Add to `apps/backend/.env.development.local`:

```
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-password
SMTP_FROM=noreply@chips-poker.com
```

### Option 3: Console Logging (Current Default)

When SMTP is not configured, all emails are printed to the backend console with the OTP code visible. This is sufficient for development but not convenient for testing email rendering.

> **Note:** In production, set real SMTP credentials from your email provider (SendGrid, AWS SES, Mailgun, etc.).

---

**最后更新**: 2026-03-27 17:16 GMT+8  
**提交者**: pizza
