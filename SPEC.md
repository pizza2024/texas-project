# SPEC.md - Texas Poker Web3 游戏项目规格

## 📌 项目概述

- **项目名称**: Texas Poker - Online Texas Hold'em + Web3
- **定位**: 链上德州扑克游戏，集成 ETH/BNB 生态
- **当前阶段**: 开发中，已有基础功能，目标是完成测试环境完整流程 + 社交功能
- **技术栈**: NestJS (后端) + Next.js (Web前端) + React Native (移动端)
- **链**: ETH Sepolia / BNB Testnet

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────────┐  │
│  │  Web    │  │ Mobile  │  │  Admin  │  │  Smart Wallets│  │
│  │(Next.js)│  │   (RN)  │  │ (Next.js)│  │  (wagmi/ Rainbow)│ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └───────┬───────┘  │
│       └───────────┴───────────┴────────────────┘           │
│                         │ WebSocket + REST                  │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                   Backend (NestJS)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Auth │ Wallet │ Game │ Room │ Match │ Social │ Admin │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                   │
│         ┌───────────────┼───────────────┐                  │
│         ▼               ▼               ▼                  │
│   ┌──────────┐   ┌──────────┐   ┌──────────────┐           │
│   │PostgreSQL│   │  Redis   │   │  Chain Service│           │
│   └──────────┘   └──────────┘   └──────┬───────┘           │
│                                         │                   │
└─────────────────────────────────────────┼───────────────────┘
                                          │
                         ┌────────────────┴────────────────┐
                         ▼                                 ▼
                  ┌─────────────┐              ┌─────────────────┐
                  │ETH Sepolia   │              │BNB Testnet      │
                  │(or Goerli)   │              │                 │
                  └─────────────┘              └─────────────────┘
```

---

## ✅ 已有功能

### 核心游戏
- [x] 德州扑克游戏引擎 (table-engine)
- [x] 房间系统 (私人房、俱乐部房、匹配房)
- [x] 比赛系统 (SNG、MTT、Blast)
- [x] 保险 (Insurance)
- [x] Bad Beat Jackpot
- [x] 站位自动 fold

### 财务系统
- [x] 钱包 (chips, frozenChips, balance)
- [x] 充值 (Deposit)
- [x] 提现 (Withdraw)
- [x] Rakeback

### 社交系统
- [x] 好友系统 (Friend)
- [x] 俱乐部 (Club)
- [x] 邮件验证

### 基础架构
- [x] JWT 认证
- [x] Redis 会话
- [x] WebSocket 实时通信
- [x] Docker 部署配置
- [x] 多 Agent 开发流程 (Producer / Test / Coding)

---

## 🎯 目标功能

### Phase 1: 测试环境完整流程 ⭐ 当前重点

#### 1.1 链上充值提现 (ETH/BNB 生态)

| 功能 | 描述 | 状态 |
|------|------|------|
| 链上充值 | 用户从 L1 充值 USDT 到游戏账户 | 🔄 进行中 |
| 链上提现 | 用户从游戏账户提现 USDT 到 L1 | 🔄 进行中 |
| 多链支持 | ETH Sepolia / BNB Testnet | 📋 待规划 |
| 充提 UI | 完善充值提现页面 UX | 📋 待做 |
| 充值上限 | 防止洗钱风险控制 | 📋 待做 |

**需要**:
- 部署 ERC20 Token 合约 (已存在 TestUSDT.sol)
- 部署 Bridge 合约或使用现有桥
- 充值监控服务 (监听链上交易)
- 提现签名服务

#### 1.2 游戏完整流程测试

| 功能 | 描述 | 状态 |
|------|------|------|
| 充值→游戏→结算→提现 全链路 | 端到端测试 | 🔄 进行中 |
| 多人游戏流程 | 6-9人桌流程测试 | 🔄 进行中 |
| 比赛流程 | SNG/MTT 完整流程 | 🔄 进行中 |
| 保险理赔 | All-in 保险触发和赔付 | 🔄 进行中 |

### Phase 2: 社交功能

#### 2.1 好友系统增强

| 功能 | 描述 | 状态 |
|------|------|------|
| 好友列表 UI | 展示好友、在线状态 | 📋 待做 |
| 好友请求 | 发送/接受/拒绝好友请求 | 📋 待做 |
| 好友聊天 | 好友私聊功能 | 📋 待做 |
| 黑名单 | 屏蔽用户 | 📋 待做 |

#### 2.2 在线聊天

| 功能 | 描述 | 状态 |
|------|------|------|
| 全局大厅聊天 | 大厅公开聊天 | 📋 待做 |
| 俱乐部聊天 | 俱乐部内部聊天 | 📋 待做 |
| 聊天反垃圾 | 敏感词过滤、限流 | 📋 待做 |

#### 2.3 对局内聊天

| 功能 | 描述 | 状态 |
|------|------|------|
| 座位聊天 | 玩家之间快捷消息 | 📋 待做 |
| emoji 表情 | 牌桌表情互动 | 📋 待做 |
| 语音转文字 (可选) | 高级功能 | 📋 待规划 |

---

## 🔧 技术规格

### 智能合约

| 合约 | 网络 | 地址 | 状态 |
|------|------|------|------|
| TestUSDT | ETH Sepolia | 待部署 | 📋 |
| TestUSDT | BNB Testnet | 待部署 | 📋 |
| Bridge (可选) | - | - | 📋 |

### API 端点

```
# 认证
POST /auth/register
POST /auth/login
POST /auth/verify-email

# 用户
GET  /user/profile
PUT  /user/profile
GET  /user/stats

# 钱包
GET  /wallet/balance
POST /wallet/deposit/address    # 获取充值地址
POST /wallet/withdraw           # 提现申请
GET  /wallet/deposit-records    # 充值记录

# 游戏
GET  /rooms                    # 房间列表
POST /rooms                    # 创建房间
GET  /rooms/:id                # 房间详情
POST /rooms/:id/join           # 加入房间

# WebSocket Events
- player:action               # 玩家动作 (bet/fold/call/raise)
- table:state                 # 牌桌状态更新
- chat:message                # 聊天消息
- notification               # 系统通知

# 社交
GET  /friends                  # 好友列表
POST /friends/request         # 发送好友请求
POST /friends/accept          # 接受好友请求
GET  /friends/requests        # 待处理请求
```

### 数据库

- **PostgreSQL**: 用户、游戏、钱包、社交
- **Redis**: 会话、实时状态、缓存

---

## 📂 项目结构

```
texas-project/
├── apps/
│   ├── web/              # Next.js 前端 (主要)
│   ├── mobile/           # React Native 移动端
│   ├── admin/            # 管理后台
│   └── backend/          # NestJS 后端
│       └── src/
│           ├── auth/      # 认证模块
│           ├── user/      # 用户模块
│           ├── wallet/    # 钱包模块
│           ├── deposit/   # 充值模块
│           ├── withdraw/  # 提现模块
│           ├── room/      # 房间模块
│           ├── table-engine/  # 游戏引擎
│           ├── friend/    # 好友模块
│           ├── club/      # 俱乐部模块
│           ├── chat/      # 聊天模块
│           └── ...
├── packages/
│   └── shared/           # 共享类型和工具
├── local-chain/
│   ├── contracts/        # Hardhat 合约
│   └── deploy-*.ts       # 部署脚本
├── docker/
│   ├── backend/
│   ├── web/
│   └── nginx/
└── .agent-work/          # 多Agent工作区
    ├── shared/           # 共享文件
    │   ├── task-queue.md
    │   ├── producer-latest.md
    │   └── test-latest.md
    ├── producer/
    ├── test/
    └── coding/
```

---

## 🔄 开发流程

### 当前流程 (已有)

```
Cron (每15分钟)
    │
    ├─→ Producer Agent ─→ producer-latest.md ─┐
    ├─→ Test Agent    ─→ test-latest.md      │
    └─────────────────────────────┬──────────┘
                                   ▼
                          Coding Agent ─→ 执行任务
                                   │
                                   ▼
                          task-queue.md (更新状态)
```

### 改进目标

1. **增加 Release 闭环**: Coding → 测试验证 → 自动部署到测试服务器
2. **增加 Feedback 收集**: 运行时错误 → 自动创建 Issue/Ticket
3. **增加 链上事件监控**: 充提状态 → 实时更新到 UI

---

## 📊 关键指标 (KPIs)

| 指标 | 目标 | 当前 |
|------|------|------|
| 端到端游戏流程 | 0 blockers | 🔄 |
| 链上充值成功率 | >99% | 🔄 |
| 链上提现成功率 | >99% | 🔄 |
| P0 Bug 数 | 0 | 🔄 |
| P1 Bug 数 | <5 | 🔄 |
| 测试覆盖率 | >80% | 📋 |

---

## 🗺️ 开发里程碑

### Milestone 1: 测试环境完整流程 (当前)
- [ ] 链上 USDT 充值流程跑通
- [ ] 链上 USDT 提现流程跑通
- [ ] 完整游戏流程测试通过
- [ ] 充提 + 游戏 + 结算 串联测试

### Milestone 2: 社交功能
- [ ] 好友列表 UI + 功能
- [ ] 在线大厅聊天
- [ ] 俱乐部聊天
- [ ] 对局内聊天

### Milestone 3: 性能与安全
- [ ] 负载测试
- [ ] 安全审计
- [ ] 代码优化

---

_Last updated: 2026-05-13 by TT_
