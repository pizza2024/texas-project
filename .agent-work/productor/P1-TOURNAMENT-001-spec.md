# P1-TOURNAMENT-001: Tournament SNG Phase 1 — 详细规格

## 概述

SNG（Sit & Go）单桌赛 — 8人桌，固定参赛费，赛前确定奖金分配。

## 规格参数

| 参数 | 值 |
|------|-----|
| 人数 | 8人 |
| Buy-in 范围 | 500 / 1000 / 2500 / 5000 chips |
| 奖励分配 | 第1名 60% / 第2名 30% / 第3名 10% |
| 涨盲节奏 | 每 3 分钟涨盲一次 |
| 初始筹码 | 1500 chips |
| 前注（Straddle） | 无（Phase 1 不含 straddle） |
| 最低开始人数 | 8人（满员开赛） |
| 注册截止 | 比赛开始前 |

## 数据库模型

### Room 扩展
```prisma
model Room {
  // ... existing fields
  isTournament  Boolean  @default(false)
  tournamentConfig Json?  // TournamentConfig JSON
}

type TournamentConfig = {
  type: "SNG";
  buyin: number;
  maxPlayers: 8;
  prizeDistribution: [60, 30, 10];  // percentages
  blindSchedule: BlindLevel[];
}

type BlindLevel = {
  level: number;
  smallBlind: number;
  bigBlind: number;
  durationSeconds: number;  // 180 (3 min)
}
```

## API 端点

### 创建 SNG 房间
```
POST /rooms
Body: {
  name: string;
  password?: string;
  isTournament: true;
  tournamentConfig: TournamentConfig;
}
Response: Room
```

### SNG 房间列表
```
GET /rooms?tournament=true
Response: Room[]  // 仅返回 isTournament=true 的房间
```

### 获取 SNG 奖金分配
```
GET /rooms/:id/prizes
Response: {
  positions: [{ place: 1, percentage: 60 }, ...],
  buyin: number,
  totalPrize: number  // buyin * 8
}
```

## 前端页面

### SNG 房间卡片（rooms/page.tsx）
- 与常规房间共用 RoomCard 组件
- 新增标签：🏆 SNG
- 显示：Buy-in / 当前人数 / 奖励结构

### SNG 入座流程
1. 点击 SNG 房间卡片 → 进入 /room/[id]
2. 满 8 人后，显示倒计时（10s）后自动开始
3. 前 3 名玩家获得奖励

### 奖金展示 Modal
- 显示 buyin、人数、总奖池
- 前3名奖励百分比和绝对值
- 格式：🥇 第1名 60% = X chips

## 后端逻辑

### 涨盲定时器
- BlindTimerService 管理所有 SNG 房间的涨盲
- 每 3 分钟更新一次盲注级别
- 通过 Redis sorted set 管理定时任务

### 比赛开始
- 第 8 名玩家入座后，启动 10 秒倒计时
- 倒计时结束，强制开始游戏
- 所有玩家自动准备（ready-to-play）

### 比赛结束
- 剩余 3 名玩家时，停止涨盲
- 最终排名按最终筹码量排名
- 筹码相同则先完成者排前（由 eliminatedAt 时间戳决定）
- 奖励自动发放至钱包

## 验收标准

1. 可创建 SNG 房间（500/1000/2500/5000 buyin）
2. 8 人满员后自动开始
3. 每 3 分钟涨盲
4. 前 3 名获得奖励（60/30/10%）
5. 270 tests 继续通过
6. 与 Hand Replay Phase 2 兼容

## 后续 Phase
- Phase 2：Jackpot SNG（随机奖池倍数）
- Phase 3：MTT 多桌赛

## 优先级：P1
