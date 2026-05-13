# ROADMAP.md - Texas Poker 开发路线图

> 生成时间: 2026-05-13 | Owner: TT

---

## 🎯 目标

在 **测试服务器 (35.73.94.102)** 上完成:
1. **ETH/BNB 生态** 完整充值提现流程
2. **游戏全流程** 端到端测试
3. **社交功能** 好友 + 聊天系统
4. **自动化闭环** 减少人工干预

---

## 📦 Milestone 1: 测试环境完整流程

**目标日期**: 1-2 周  
**验收标准**: 充→玩→结算→提 全链路可跑

### 1.1 链上充值提现

| 任务 | P | 状态 | 负责人 |
|------|---|------|--------|
| 部署 TestUSDT 到 ETH Sepolia | P0 | 🔄 | TT |
| 部署 TestUSDT 到 BNB Testnet | P0 | 🔄 | TT |
| 实现链上充值监控服务 | P0 | 🔄 | TT |
| 实现提现签名服务 | P0 | 🔄 | TT |
| 完善前端充提 UI | P1 | 📋 | - |
| 添加充值限额风控 | P1 | 📋 | - |
| 多链切换器 UI | P1 | 📋 | - |

### 1.2 游戏完整流程测试

| 任务 | P | 状态 | 备注 |
|------|---|------|------|
| 充值→游戏→结算 单人流程 | P0 | 🔄 | 自动化测试 |
| 多人游戏 (6人桌) | P0 | 🔄 | 内测 |
| 多人游戏 (9人桌) | P1 | 📋 | - |
| SNG 比赛完整流程 | P1 | 📋 | - |
| MTT 比赛完整流程 | P1 | 📋 | - |
| Blast 比赛完整流程 | P1 | 📋 | - |
| 保险理赔全流程 | P1 | 📋 | - |
| Bad Beat Jackpot 触发 | P1 | 📋 | - |

### 1.3 串联测试

| 任务 | P | 状态 |
|------|---|------|
| 充→玩→结算→提 端到端 | P0 | 🔄 |
| 多人 + 充提 并发测试 | P1 | 📋 |

---

## 📦 Milestone 2: 社交功能

**目标日期**: 2-3 周  
**前置条件**: Milestone 1 完成

### 2.1 好友系统增强

| 任务 | P | 状态 |
|------|---|------|
| 好友列表 UI 重构 (Web) | P1 | 📋 |
| 好友列表 UI 重构 (Mobile) | P1 | 📋 |
| 好友请求通知 | P1 | 📋 |
| 好友在线状态实时更新 | P1 | 📋 |
| 好友私聊功能 | P1 | 📋 |
| 黑名单功能 | P2 | 📋 |

### 2.2 在线聊天

| 任务 | P | 状态 |
|------|---|------|
| 大厅聊天室 | P1 | 📋 |
| 俱乐部聊天室 | P1 | 📋 |
| 聊天历史记录 | P1 | 📋 |
| 敏感词过滤 | P1 | 📋 |
| 聊天限流 | P1 | 📋 |

### 2.3 对局内聊天

| 任务 | P | 状态 |
|------|---|------|
| 牌桌快捷消息 (emoji) | P1 | 📋 |
| 牌桌快捷消息 (文字) | P2 | 📋 |
| 座位 @ 功能 | P2 | 📋 |

---

## 📦 Milestone 3: 运营工具

**目标日期**: 3-4 周

| 任务 | P | 状态 |
|------|---|------|
| Admin 后台 - 用户管理 | P1 | 📋 |
| Admin 后台 - 房间管理 | P1 | 📋 |
| Admin 后台 - 财务审计 | P1 | 📋 |
| Admin 后台 - 公告管理 | P2 | 📋 |
| 数据看板 | P2 | 📋 |

---

## 🔄 开发闭环设计

### 当前状态 (Agent 循环)

```
Cron (15min)
    │
    ├─→ Producer ──→ 产品调研 ──→ producer-latest.md
    ├─→ Test    ──→ 测试报告 ──→ test-latest.md
    └──────────────┬──────────────┘
                   ▼
              Coding Agent
                   │
                   ▼
             task-queue.md
```

### 改进: 增加 Release + Feedback 闭环

```
                    ┌─────────────────────────────────────────┐
                    │              Cron Jobs                   │
                    │  (Productor/Test 每15min, Coding 按需)   │
                    └───────────────────┬─────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
               ┌─────────┐        ┌─────────┐         ┌─────────┐
               │Productor│        │  Test   │         │ Coding  │
               └────┬────┘        └────┬────┘         └────┬────┘
                    │                 │                  │
                    ▼                 ▼                  ▼
              ┌───────────┐    ┌───────────┐      ┌───────────────┐
              │ 调研报告   │    │  测试报告  │      │ task-queue.md │
              └───────────┘    └───────────┘      └───────┬───────┘
                                                         │
                                                         ▼
                                                  Coding 执行
                                                         │
                                                         ▼
                                            ┌────────────────────┐
                                            │  代码 → Git Commit  │
                                            └─────────┬──────────┘
                                                      │
                              ┌───────────────────────┼───────────────────────┐
                              ▼                       ▼                       ▼
                       ┌──────────┐            ┌──────────┐           ┌──────────┐
                       │ 合并到   │            │ 构建 +   │           │ 部署到   │
                       │ develop  │──────────→│ 测试     │──────────→│ 测试服务器│
                       └──────────┘            └──────────┘           └────┬─────┘
                                                                            │
                                                                            ▼
                                                                    ┌───────────────┐
                                                                    │  自动 E2E 测试 │
                                                                    └───────┬───────┘
                                                                            │
                                                                            ▼
                                                                    ┌───────────────┐
                                                                    │  Feedback 循环 │
                                                                    │  (错误 → Issue) │
                                                                    └───────────────┘
```

### Cron Jobs 设计

| Job ID | 描述 | 频率 | 触发 |
|--------|------|------|------|
| `productor-agent` | 产品调研、竞品分析 | 每15分钟 | 自动 |
| `test-agent` | 代码审查、测试 | 每15分钟 | 自动 |
| `coding-agent` | 执行任务队列 | 每15分钟 | 自动 |
| `deploy-check` | 检查 develop 分支变更，部署到测试服务器 | 每5分钟 | 自动 |
| `e2e-test` | 运行端到端测试 | 每30分钟 | 部署后 |
| `chain-monitor` | 监控链上充提状态 | 每1分钟 | 自动 |
| `health-check` | 服务器健康检查 | 每5分钟 | 自动 |

---

## 🧪 测试服务器环境配置

### 服务器信息

```
IP: 35.73.94.102
SSH: ~/.ssh/LightsailDefaultKey-ap-northeast-1.pem
User: ubuntu
```

### 部署模式

根据服务器性能 (`60% disk used, 58GB total`)，采用**源码直跑**模式:

```bash
# 当前目录结构
/home/ubuntu/workspace/texas-project/

# 启动服务 (使用 PM2)
pm2 start ecosystem.config.js

# 或使用 Docker (如果性能允许)
docker compose -f docker-compose.remote.yml up -d
```

### 环境变量 (生产环境)

```bash
# Database
DATABASE_URL=postgresql://texas:xxx@localhost:5432/texas_staging

# Redis
REDIS_URL=redis://localhost:6379

# Chain (ETH Sepolia)
ETH_RPC_URL=https://sepolia.infura.io/v3/xxx
USDT_CONTRACT_ADDRESS=0x...

# Chain (BNB Testnet)
BNB_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
BNB_USDT_CONTRACT=0x...

# App
DOMAIN=35.73.94.102
PORT=3000
```

---

## 📝 分支策略

```
main (生产)
  ↑
develop (开发集成)
  ↑
feature/P0-xxx (P0 任务分支)
feature/P1-xxx (P1 任务分支)
feature/P2-xxx (P2 任务分支)

bugfix/P0-xxx  (P0 Bug 修复)
bugfix/P1-xxx  (P1 Bug 修复)
```

### Commit 规范

```
<type>(<scope>): <subject>

Types:
- feat: 新功能
- fix: Bug 修复
- refactor: 重构
- test: 测试
- chore: 维护
- docs: 文档

Examples:
feat(wallet): 添加链上充值监控
fix(game): 修复 Straddle 后 calledAllIn 未重置
test(deposit): 添加 E2E 充值测试
```

---

## 📁 文件结构

```
.agent-work/
├── shared/
│   ├── task-queue.md        # 任务队列 (Source of Truth)
│   ├── producer-latest.md   # Productor 最新报告
│   ├── test-latest.md       # Test 最新报告
│   ├── release-log.md       # 发布记录
│   └── feedback-loop.md    # 反馈闭环记录
├── producer/
│   └── reports/
├── test/
│   └── reports/
└── coding/
    └── reports/
```

---

## 🚀 下一步行动

### Immediate (本周)

1. [ ] 配置测试服务器 SSH + Git 拉取
2. [ ] 部署智能合约 (ETH Sepolia + BNB Testnet)
3. [ ] 启动后端服务
4. [ ] 跑通链上充值流程
5. [ ] 跑通链上提现流程

### Short-term (2周内)

1. [ ] 完成 Milestone 1 所有 P0 任务
2. [ ] 端到端测试通过
3. [ ] 社交功能开发启动

### Medium-term (1个月)

1. [ ] Milestone 2 完成
2. [ ] Milestone 3 启动
3. [ ] 性能优化和安全审计

---

_Last updated: 2026-05-13 by TT_
