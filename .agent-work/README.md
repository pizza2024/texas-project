# 子代理协作工作区

## 目录结构

```
.agent-work/
├── shared/              # 共享信息（三个代理都能读写）
│   ├── producer-latest.md   # Productor 最新报告
│   ├── test-latest.md       # Test 最新报告
│   └── task-queue.md        # 任务队列（Coding 按优先级处理）
├── producer/            # Productor 工作目录
│   └── reports/        # 历史报告
├── test/               # Test 工作目录
│   └── reports/        # 历史报告
└── coding/             # Coding 工作目录
    └── reports/        # 历史报告
```

## 协作流程

```
┌─────────────────────────────────────────────────────┐
│           每15分钟 cron 触发一次                     │
└─────────────────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │Productor │  │   Test   │  │  Coding  │
    │  代理    │  │   代理   │  │   代理   │
    └────┬─────┘  └────┬─────┘  └────┬─────┘
         │              │              │
         │ 写产品报告   │ 写测试报告   │ 读任务队列
         │              │ 写任务队列   │ 读 test/productor 报告
         ▼              ▼              ▼
    ┌────────────────────────────────────────────┐
    │           shared/ 共享文件                 │
    │  • producer-latest.md                      │
    │  • test-latest.md                          │
    │  • task-queue.md                           │
    └────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   Coding 代理处理    │
              │   按优先级执行优化   │
              └──────────────────────┘
```

## 代理职责

### Productor（产品代理）

- 体验项目，记录产品问题
- 调研竞品，输出产品分析
- 写 `shared/producer-latest.md`

### Test（测试代理）

- CodeReview 代码
- 体验项目，记录测试问题
- 更新 `shared/task-queue.md`（按 P0/P1/P2 排序）
- 写 `shared/test-latest.md`

### Coding（编码代理）

- 优先读取 `task-queue.md`
- 处理 P0 > P1 > P2 任务
- 执行代码优化
- 标记已完成任务
- 写报告记录工作

## 定时任务 ID

- `productor-agent`: 每15分钟
- `test-agent`: 每15分钟
- `coding-agent`: 每15分钟
