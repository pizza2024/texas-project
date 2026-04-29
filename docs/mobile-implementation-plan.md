# Mobile (RN) 功能对齐实施计划

**项目**: Texas Hold'em Poker  
**目标**: 将 Mobile 版本功能对齐到 Web 版本  
**计划版本**: v1.0  
**创建日期**: 2026-03-21

---

## 📋 实施策略

### 分阶段原则

1. **优先级驱动**: P0 → P1 → P2
2. **增量交付**: 每个功能完成后立即测试和提交
3. **代码质量**: 保持 TypeScript 类型安全，遵循 RN 最佳实践
4. **适配优先**: 移动端特性优先（触摸交互、屏幕适配、性能）

---

## 🎯 第一阶段：P0 核心功能（2-3 天）

### 任务 1.1: 注册页面实现

**优先级**: P0  
**预估时间**: 2-3 小时  
**依赖**: 无

#### 实施步骤

1. 创建 `apps/mobile/app/register.tsx`
2. 参考 `apps/web/app/register/page.tsx`
3. 实现功能:
   - 表单字段: username, nickname, password
   - 表单验证
   - API 调用 `/auth/register`
   - 注册成功后跳转到登录页

#### 技术要点

- 使用 `TextInput` 组件
- `KeyboardAvoidingView` 处理键盘遮挡
- 错误提示使用 `Alert` 或自定义 Toast

#### 验收标准

- [ ] 可以成功注册新用户
- [ ] 表单验证正确（字段必填、长度限制）
- [ ] 错误提示友好
- [ ] 注册成功后自动跳转登录页

---

### 任务 1.2: 国际化 (i18n) 支持

**优先级**: P0  
**预估时间**: 6-8 小时  
**依赖**: 无

#### 实施步骤

1. 安装依赖

   ```bash
   cd apps/mobile
   npm install react-i18next i18next
   ```

2. 创建 `apps/mobile/lib/i18n.ts`
   - 配置 i18next
   - 支持语言: `zh-CN`, `en-US`
   - 语言持久化到 AsyncStorage

3. 创建语言文件 `apps/mobile/locales/`

   ```
   locales/
   ├── zh-CN.json
   └── en-US.json
   ```

4. 重构所有页面
   - `login.tsx`: 替换所有硬编码文本
   - `rooms.tsx`: 替换文本
   - `deposit.tsx`: 替换文本
   - `room/[id].tsx`: 替换文本

5. 在 `app/_layout.tsx` 中初始化 i18n

#### 技术要点

- 语言文件结构参考 Web 版本的翻译 keys
- 使用 `useTranslation()` hook
- 确保所有用户可见文本都支持翻译

#### 验收标准

- [ ] 所有页面支持中英文切换
- [ ] 语言选择持久化
- [ ] 无硬编码中文文本
- [ ] Alert 消息支持翻译

---

### 任务 1.3: 设置页面完整实现

**优先级**: P0  
**预估时间**: 4-6 小时  
**依赖**: 任务 1.2 (i18n)

#### 实施步骤

1. 创建 `apps/mobile/app/settings.tsx`

2. 实现功能模块:
   - **用户信息区块**
     - 显示: 用户名、昵称、余额、User ID
     - 支持复制 User ID
   - **头像管理** (简化版)
     - 显示当前头像
     - 上传按钮 (使用 `expo-image-picker`)
     - 删除按钮
     - **暂不实现裁剪** (移至 P1)
   - **语言设置**
     - 中文/English 切换
     - 即时生效

3. 导航集成
   - 在 `rooms.tsx` Header 添加设置按钮
   - 点击跳转到 `/settings`

#### 技术要点

- 使用 `expo-image-picker` 选择图片
- 图片上传到 `/user/avatar` API
- 语言切换使用 i18n.changeLanguage()
- 用户信息从 `/auth/profile` 获取

#### 验收标准

- [ ] 显示完整用户信息
- [ ] 可以上传/删除头像
- [ ] 语言切换即时生效
- [ ] User ID 可复制
- [ ] 从房间大厅可导航到设置

---

## 🎯 第二阶段：P1 重要功能（2 天）

### 任务 2.1: 统计页面实现

**优先级**: P1  
**预估时间**: 2-3 小时  
**依赖**: i18n

#### 实施步骤

1. 创建 `apps/mobile/app/stats.tsx`
2. 参考 `apps/web/app/stats/page.tsx`
3. 实现数据展示:
   - 总手数 / 胜率
   - 总盈亏
   - 最大单手盈利/亏损
   - 最近牌局记录 (FlatList)

#### 技术要点

- API: `GET /user/stats`
- 使用 `FlatList` 渲染历史记录
- 盈亏用颜色区分 (红/绿)

#### 验收标准

- [ ] 显示所有统计指标
- [ ] 最近记录列表可滚动
- [ ] 无数据时显示空状态
- [ ] 可从房间大厅跳转

---

### 任务 2.2: 创建房间功能

**优先级**: P1  
**预估时间**: 3-4 小时  
**依赖**: i18n

#### 实施步骤

1. 在 `rooms.tsx` 添加"创建房间"按钮
2. 创建创建房间 Modal
   - 房间名称
   - 小盲/大盲
   - 最大座位数 (2-9 选择器)
   - 最小买入
   - 房间密码 (可选)
3. 表单验证
   - 大盲 ≥ 小盲 × 2
   - 最小买入 ≥ 大盲
   - 名称长度限制

#### 技术要点

- Modal 组件
- 使用 `Picker` 或自定义选择器
- API: `POST /rooms`

#### 验收标准

- [ ] 可创建房间并自动进入
- [ ] 表单验证正确
- [ ] 支持设置私密房间
- [ ] 错误提示友好

---

### 任务 2.3: 快速匹配档位选择

**优先级**: P1  
**预估时间**: 2 小时  
**依赖**: i18n

#### 实施步骤

1. 在 `rooms.tsx` 快速匹配按钮点击后弹出 Modal
2. 显示 5 个档位选项:
   - MICRO (5/10, 100 chips)
   - LOW (10/20, 200 chips)
   - MEDIUM (25/50, 500 chips)
   - HIGH (50/100, 1000 chips)
   - PREMIUM (100/200, 2000 chips)
3. 根据余额禁用不可用档位
4. 选择档位后发送 `quick_match` 事件

#### 技术要点

- 档位配置与 Web 版本保持一致
- Socket 事件: `quick_match({ tier })`

#### 验收标准

- [ ] 显示所有档位
- [ ] 余额不足时档位禁用
- [ ] 匹配逻辑正确
- [ ] 匹配中显示加载状态

---

### 任务 2.4: 头像裁剪功能

**优先级**: P1  
**预估时间**: 4 小时  
**依赖**: 设置页面

#### 实施步骤

1. 安装依赖
   ```bash
   npm install react-native-image-crop-picker
   ```
2. 在设置页面上传头像流程中集成裁剪
3. 裁剪配置:
   - 正方形裁剪
   - 压缩质量 0.8
   - 输出尺寸 512x512

#### 技术要点

- 使用 `ImageCropPicker.openPicker()`
- 配置 `cropping: true`
- 处理权限请求

#### 验收标准

- [ ] 选择图片后自动进入裁剪界面
- [ ] 裁剪后上传到服务器
- [ ] 头像实时更新

---

### 任务 2.5: 系统消息统一组件

**优先级**: P1  
**预估时间**: 2-3 小时  
**依赖**: 无

#### 实施步骤

1. 创建 `apps/mobile/components/SystemMessage.tsx`
2. 样式参考 Web 版本的 system-message
3. 支持:
   - 标题 + 消息内容
   - 单按钮/双按钮
   - 自定义按钮文本
   - Promise 返回用户选择

4. 封装为全局 Provider
5. 替换所有 `Alert.alert()` 调用

#### 技术要点

- 使用 React Context + Modal
- 支持 `showSystemMessage()` 函数
- 样式与 Web 版本保持一致

#### 验收标准

- [ ] 可在任意页面调用
- [ ] 样式美观统一
- [ ] 支持异步返回结果
- [ ] 替换所有原生 Alert

---

## 🎯 第三阶段：P2 增强功能（1-2 天）

### 任务 3.1: 首页 (Landing Page)

**优先级**: P2  
**预估时间**: 3-4 小时  
**依赖**: i18n

#### 实施步骤

1. 创建 `apps/mobile/app/index.tsx`
2. 参考 Web 版本设计:
   - 品牌 Logo
   - 核心特性展示 (3 个卡片)
   - 登录/注册按钮
3. 自动登录检测
   - 如已登录，跳转到 `/rooms`

#### 验收标准

- [ ] 首次打开显示首页
- [ ] 已登录用户自动跳转
- [ ] 视觉风格与 Web 一致

---

### 任务 3.2: 用户下拉菜单

**优先级**: P2  
**预估时间**: 2 小时  
**依赖**: 统计页面、设置页面

#### 实施步骤

1. 在 `rooms.tsx` Header 添加用户头像
2. 点击弹出菜单:
   - 统计
   - 设置
   - 退出登录
3. 显示昵称和余额

#### 验收标准

- [ ] 头像显示正确
- [ ] 菜单导航正常
- [ ] 退出登录清理 Token

---

### 任务 3.3: Elo 评分显示

**优先级**: P2  
**预估时间**: 30 分钟  
**依赖**: 无

#### 实施步骤

1. 在 `rooms.tsx` 获取 profile 时提取 elo
2. 在 Header 或用户菜单中显示

#### 验收标准

- [ ] Elo 分数正确显示

---

### 任务 3.4: UI 风格统一

**优先级**: P2  
**预估时间**: 4-6 小时  
**依赖**: 所有页面完成

#### 实施步骤

1. 创建统一的颜色系统 `lib/theme.ts`:
   - 主色: 金黄色 (#f59e0b, #fbbf24)
   - 背景: 深色渐变
   - 强调色: 绿色 (成功)、红色 (错误)
2. 更新所有页面样式
3. 统一卡片、按钮、输入框样式

#### 验收标准

- [ ] 所有页面配色一致
- [ ] 与 Web 版本视觉风格接近
- [ ] 保持 RN 原生手感

---

## 📊 进度跟踪表

| 任务 ID | 任务名称 | 优先级 | 预估时间 | 状态      | 完成日期 |
| ------- | -------- | ------ | -------- | --------- | -------- |
| 1.1     | 注册页面 | P0     | 2-3h     | ⏳ 待开始 | -        |
| 1.2     | 国际化   | P0     | 6-8h     | ⏳ 待开始 | -        |
| 1.3     | 设置页面 | P0     | 4-6h     | ⏳ 待开始 | -        |
| 2.1     | 统计页面 | P1     | 2-3h     | ⏳ 待开始 | -        |
| 2.2     | 创建房间 | P1     | 3-4h     | ⏳ 待开始 | -        |
| 2.3     | 快速匹配 | P1     | 2h       | ⏳ 待开始 | -        |
| 2.4     | 头像裁剪 | P1     | 4h       | ⏳ 待开始 | -        |
| 2.5     | 系统消息 | P1     | 2-3h     | ⏳ 待开始 | -        |
| 3.1     | 首页     | P2     | 3-4h     | ⏳ 待开始 | -        |
| 3.2     | 用户菜单 | P2     | 2h       | ⏳ 待开始 | -        |
| 3.3     | Elo 显示 | P2     | 0.5h     | ⏳ 待开始 | -        |
| 3.4     | UI 统一  | P2     | 4-6h     | ⏳ 待开始 | -        |

---

## 🧪 测试策略

### 每个任务完成后

1. **功能测试**: 手动测试所有功能点
2. **跨页面测试**: 验证导航流程
3. **边界测试**: 网络异常、数据异常
4. **回归测试**: 确保不影响现有功能

### 阶段完成后

1. **集成测试**: 完整用户流程测试
2. **性能测试**: 页面加载、列表滚动
3. **真机测试**: iOS & Android

---

## 📦 依赖安装清单

```bash
cd apps/mobile

# i18n 支持
npm install react-i18next i18next

# 图片选择和裁剪
npm install expo-image-picker react-native-image-crop-picker

# (如需) 头像显示
npm install react-native-fast-image
```

---

## 🚀 提交规范

### Git Commit 格式

```
<type>(<scope>): <subject>

[可选] body
```

**Type**:

- `feat`: 新功能
- `fix`: Bug 修复
- `style`: 样式调整
- `refactor`: 重构
- `i18n`: 国际化相关

**示例**:

```bash
git commit -m "feat(mobile): add register page"
git commit -m "i18n(mobile): add translation support for all pages"
git commit -m "feat(mobile): implement settings page with avatar upload"
```

---

## 📝 进度报告机制

**每完成一个阶段后**，创建进度报告：

- `docs/progress-p0.md`
- `docs/progress-p1.md`
- `docs/progress-p2.md`

**报告内容**:

- 已完成任务列表
- 遇到的问题和解决方案
- 代码修改统计
- 下一阶段计划

---

## ⚠️ 风险与注意事项

### 技术风险

1. **图片裁剪库兼容性**
   - 风险: react-native-image-crop-picker 可能需要原生配置
   - 缓解: 提前测试，准备备用方案 (expo-image-manipulator)

2. **国际化改造范围大**
   - 风险: 遗漏硬编码文本
   - 缓解: 使用 ESLint 规则检查，代码审查

3. **性能影响**
   - 风险: 新增功能可能影响性能
   - 缓解: 使用 React.memo, useMemo, useCallback

### 进度风险

1. **时间估算偏差**
   - 缓解: 保留 20% 缓冲时间
   - 每日记录实际耗时，动态调整

2. **功能依赖阻塞**
   - 缓解: 优先完成无依赖任务
   - 部分功能可并行开发

---

## 📚 参考资料

### 内部文档

- `apps/web/` - Web 版本参考实现
- `packages/shared/` - 共享类型定义
- `docs/mobile-web-comparison.md` - 功能对比分析

### 外部资源

- [Expo Router 文档](https://docs.expo.dev/router/introduction/)
- [react-i18next 文档](https://react.i18next.com/)
- [React Native 最佳实践](https://reactnative.dev/docs/performance)

---

**计划版本**: v1.0  
**创建日期**: 2026-03-21  
**预计完成时间**: 5-7 个工作日  
**制定人**: OpenClaw Subagent
