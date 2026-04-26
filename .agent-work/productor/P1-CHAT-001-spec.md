# P1-CHAT-001: 房间内聊天 UI — 详细规格

## 概述

前端缺失 `ChatPanel` 组件，后端 WebSocket `chat-message` 事件已实现。本规格定义前端实现细节。

## 技术背景

**后端已实现**（参考 `game.handler.ts`）：
- `chat-message` 事件：客户端发送 `{ roomId, content }`，服务器广播给房间内所有玩家
- 消息格式：`{ id, userId, username, content, timestamp }`
- 限流：服务端已有 rate limit 保护

## 前端组件规格

### ChatPanel 组件

**路径**：`apps/web/components/chat/ChatPanel.tsx`

**布局**：
```
┌─────────────────────────────┐
│ 💬 房间聊天            [x] │  ← Header (可折叠)
├─────────────────────────────┤
│                             │
│  [pizza]: 跟注跟注！         │
│  [bot_42]: 你好             │
│  [pizza]: check              │
│                             │
│  (auto-scroll to bottom)    │
├─────────────────────────────┤
│ [输入框...        ] [发送]  │
└─────────────────────────────┘
```

**Props 接口**：
```typescript
interface ChatPanelProps {
  roomId: string;
  className?: string;
}
```

**内部 State**：
```typescript
interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
}
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [input, setInput] = useState('');
const [isCollapsed, setIsCollapsed] = useState(false);
```

**功能需求**：

1. **WebSocket 监听**：
   - 监听 `chat-message` 事件，追加到 `messages`
   - 组件挂载时订阅，卸载时取消订阅（cleanup）

2. **消息发送**：
   - 按 Enter 或点击发送按钮触发 `socket.emit('chat-message', { roomId, content })`
   - 发送后清空输入框
   - 空消息不可发送

3. **自动滚动**：
   - 新消息到达时，滚动到底部
   - 若用户已手动滚动（非底部），不强制滚动

4. **消息显示格式**：
   - `[username]: content` — 简洁单行格式
   - 时间戳显示：相对时间（1分钟前、5分钟前）
   - 系统消息（如"玩家离开了"）显示为斜体/灰色

5. **防刷保护**：
   - 前端本地 debounce：500ms 内不能发送多条
   - 错误提示：后端返回错误时显示 toast

**UI 样式**：
- 高度：200px（可折叠）
- 宽度：跟随父容器
- 背景：`bg-slate-900/80`
- 消息颜色：`text-slate-200`
- 输入框：`bg-slate-800 border-slate-700`

**组件集成位置**：
- `apps/web/app/room/[id]/page.tsx` — 游戏桌页面
- 放置在牌桌右侧边栏，或底部抽屉（mobile）

**导出**：
```typescript
export { ChatPanel };
export type { ChatPanelProps };
```

## 验收标准

1. ✅ 玩家可在房间内发送和接收消息
2. ✅ 刷新页面后消息历史清空（仅实时消息，无持久化）
3. ✅ 移动端有折叠/展开功能
4. ✅ 消息列表自动滚动到最新
5. ✅ 空消息不可发送
6. ✅ 270 tests 继续通过

## 优先级：P1
