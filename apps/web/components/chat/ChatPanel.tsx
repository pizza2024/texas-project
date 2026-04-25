'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import { getStoredToken } from '@/lib/auth';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
}

export interface ChatPanelProps {
  roomId: string;
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ChatPanel({ roomId, className = '' }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSentRef = useRef<number>(0);
  const isUserScrolledUp = useRef(false);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  const scrollToBottom = useCallback((force = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (force || !isUserScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;

    const socket = getSocket(token);

    const handleChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-199), msg]); // keep last 200
      setTimeout(() => scrollToBottom(), 10);
    };

    socket.on('chat-message', handleChatMessage);

    return () => {
      socket.off('chat-message', handleChatMessage);
    };
  }, [roomId, scrollToBottom]);

  // ── Detect manual scroll ──────────────────────────────────────────────────

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      isUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 60;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Send ─────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const now = Date.now();
      if (now - lastSentRef.current < 500) {
        setLocalError('发送太频繁，请稍后再试。');
        setTimeout(() => setLocalError(null), 2000);
        return;
      }

      const token = getStoredToken();
      if (!token) return;

      setIsSending(true);
      lastSentRef.current = now;

      const socket = getSocket(token);
      socket.emit('chat-message', { roomId, content: trimmed });
      setIsSending(false);

      setInput('');
    },
    [roomId],
  );

  // ── Keyboard ─────────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Collapsed toggle ──────────────────────────────────────────────────────

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => !prev);
    if (isCollapsed) {
      setTimeout(() => scrollToBottom(true), 50);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const panelBg = 'bg-slate-900/80';
  const headerBg = 'bg-slate-800/90';
  const inputBg = 'bg-slate-800 border border-slate-700';
  const textColor = 'text-slate-200';
  const mutedColor = 'text-slate-400';
  const senderColor = 'text-amber-400';
  const errorColor = 'text-red-400 text-xs';

  return (
    <div
      className={`flex flex-col rounded-lg border border-slate-700/50 overflow-hidden ${panelBg} ${className}`}
      style={{ height: isCollapsed ? 'auto' : '200px' }}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 cursor-pointer select-none ${headerBg}`}
        onClick={toggleCollapsed}
      >
        <div className={`flex items-center gap-1.5 text-sm font-medium ${textColor}`}>
          <span>💬</span>
          <span>房间聊天</span>
          {!isCollapsed && messages.length > 0 && (
            <span className={`text-xs ${mutedColor}`}>({messages.length})</span>
          )}
        </div>
        <button
          className={`text-xs ${mutedColor} hover:text-slate-200 transition-colors`}
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapsed();
          }}
          aria-label={isCollapsed ? '展开聊天' : '收起聊天'}
        >
          {isCollapsed ? '▲' : '▼'}
        </button>
      </div>

      {/* Messages */}
      {!isCollapsed && (
        <>
          <div
            ref={messagesContainerRef}
            className={`flex-1 overflow-y-auto px-3 py-2 space-y-1 ${textColor}`}
            style={{ minHeight: 0 }}
          >
            {messages.length === 0 && (
              <div className={`text-xs ${mutedColor} text-center py-4`}>
                暂无消息，开始聊天吧！
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`text-xs leading-relaxed ${textColor}`}>
                <span className={`font-medium ${senderColor}`}>[{msg.username}]</span>
                <span className="mx-1">:</span>
                <span>{msg.content}</span>
                <span className={`ml-2 ${mutedColor}`}>
                  {formatRelativeTime(msg.timestamp)}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {localError && (
            <div className={`px-3 py-1 ${errorColor}`}>{localError}</div>
          )}

          {/* Input */}
          <div className={`flex items-center gap-2 px-3 py-2 border-t border-slate-700/40`}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              maxLength={200}
              disabled={isSending}
              className={`flex-1 rounded px-2 py-1.5 text-sm ${inputBg} ${textColor} placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-600 disabled:opacity-50`}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isSending || !input.trim()}
              className={`px-3 py-1.5 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            >
              发送
            </button>
          </div>
        </>
      )}
    </div>
  );
}
