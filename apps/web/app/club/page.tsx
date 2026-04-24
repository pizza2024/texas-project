'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import api from '@/lib/api';
import { getStoredToken } from '@/lib/auth';
import { io, type Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import type {
  ClubInfo,
  ClubMember,
  ClubChatMessage,
  ClubDetailResponse,
  ClubListResponse,
  ClubRole,
  ClubChatMessagePayload,
  ClubErrorPayload,
} from '@texas/shared';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Tab = 'explore' | 'my-clubs' | 'create';

interface ClubDetailTab {
  info: ClubDetailResponse;
  myRole?: ClubRole;
}

/* ─── Role Badge ────────────────────────────────────────────────────────── */

function RoleBadge({ role }: { role: ClubRole }) {
  const colors: Record<ClubRole, { bg: string; text: string; label: string }> = {
    OWNER: { bg: 'rgba(245,158,11,0.2)', text: '#fcd34d', label: '👑 OWNER' },
    ADMIN: { bg: 'rgba(168,85,247,0.2)', text: '#c084fc', label: '⚡ ADMIN' },
    MEMBER: { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd', label: '◇ MEMBER' },
  };
  const c = colors[role] ?? colors.MEMBER;
  return (
    <span
      className="inline-flex items-center text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

/* ─── Status Badge ──────────────────────────────────────────────────────── */

function StatusDot({ status }: { status: 'OFFLINE' | 'ONLINE' | 'PLAYING' }) {
  if (status === 'ONLINE') {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
      </span>
    );
  }
  if (status === 'PLAYING') {
    return <span className="text-[10px]">🎮</span>;
  }
  return <span className="h-2.5 w-2.5 rounded-full bg-gray-600 inline-block" />;
}

/* ─── Club Avatar ───────────────────────────────────────────────────────── */

function ClubAvatar({ avatar, name, size = 'md' }: { avatar: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-12 h-12 text-sm';
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatar} alt={name} className={`${sz} rounded-xl object-cover`} />
    );
  }
  return (
    <div
      className={`${sz} rounded-xl flex items-center justify-center font-black`}
      style={{
        background: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)',
        color: '#fff',
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/* ─── Club Card ─────────────────────────────────────────────────────────── */

interface ClubCardProps {
  club: ClubInfo;
  myRole?: ClubRole;
  isMember: boolean;
  isAuthenticated: boolean;
  onEnter: (club: ClubInfo) => void;
  onJoin: (clubId: string) => void;
  onLeave: (clubId: string) => void;
  loadingId?: string | null;
}

function ClubCard({ club, myRole, isMember, isAuthenticated, onEnter, onJoin, onLeave, loadingId }: ClubCardProps) {
  const { t } = useTranslation();
  return (
    <div
      className="relative rounded-2xl p-5 flex flex-col gap-4 transition-all hover:scale-[1.01] hover:shadow-xl"
      style={{
        background: 'linear-gradient(160deg, rgba(20,12,4,0.95) 0%, rgba(10,8,3,0.98) 100%)',
        border: '1px solid rgba(217,119,6,0.2)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <div className="flex items-start gap-3">
        <ClubAvatar avatar={club.avatar} name={club.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-black tracking-wide text-amber-200 truncate">{club.name}</h3>
            {myRole && <RoleBadge role={myRole} />}
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">
            👤 {club.ownerNickname}
          </p>
          <p className="text-[10px] text-gray-500">
            👥 {club.memberCount} {t('club.members', { count: club.memberCount })}
          </p>
        </div>
      </div>

      {club.description && (
        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{club.description}</p>
      )}

      <div className="flex items-center gap-2 mt-auto pt-1">
        {isAuthenticated ? (
          isMember ? (
            <>
              <Button
                onClick={() => onEnter(club)}
                className="flex-1 h-9 rounded-xl text-xs font-bold uppercase tracking-wider"
                style={{
                  background: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)',
                  color: '#fff',
                  border: 'none',
                }}
              >
                {t('club.enter')}
              </Button>
              {myRole !== 'OWNER' && (
                <Button
                  onClick={() => onLeave(club.id)}
                  disabled={loadingId === club.id}
                  className="h-9 px-3 rounded-xl text-xs font-bold uppercase tracking-wider"
                  style={{
                    background: 'rgba(220,38,38,0.6)',
                    color: '#fca5a5',
                    border: 'none',
                  }}
                >
                  {loadingId === club.id ? '…' : t('club.leave')}
                </Button>
              )}
            </>
          ) : (
            <Button
              onClick={() => onJoin(club.id)}
              disabled={loadingId === club.id}
              className="flex-1 h-9 rounded-xl text-xs font-bold uppercase tracking-wider"
              style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #10b981 100%)',
                color: '#ecfdf5',
                border: 'none',
              }}
            >
              {loadingId === club.id ? '…' : t('club.join')}
            </Button>
          )
        ) : (
          <Button
            onClick={() => onEnter(club)}
            className="flex-1 h-9 rounded-xl text-xs font-bold uppercase tracking-wider"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: '#9ca3af',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {t('club.view')}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Create Club Form ─────────────────────────────────────────────────── */

interface CreateClubFormProps {
  onSuccess: () => void;
}

function CreateClubForm({ onSuccess }: CreateClubFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2 || name.trim().length > 50) {
      setError(t('club.nameLengthError'));
      return;
    }
    if (description.length > 500) {
      setError(t('club.descriptionLengthError'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/clubs', {
        name: name.trim(),
        description: description.trim() || null,
        avatar: avatar.trim() || null,
      });
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      if (Array.isArray(msg)) setError(msg[0]);
      else setError(String(msg || t('club.createError')));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(217,119,6,0.25)',
    color: '#fff',
    borderRadius: '0.75rem',
    padding: '0.625rem 1rem',
    outline: 'none',
    width: '100%',
    fontSize: '0.875rem',
    boxShadow: 'none',
  };

  return (
    <div
      className="rounded-2xl p-6 space-y-5"
      style={{
        background: 'linear-gradient(160deg, rgba(20,12,4,0.95) 0%, rgba(10,8,3,0.98) 100%)',
        border: '1px solid rgba(217,119,6,0.2)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">🏠</span>
        <div>
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase" style={{ color: 'rgba(217,119,6,0.6)' }}>
            {t('club.createNew')}
          </p>
          <h2 className="text-lg font-black tracking-wide" style={{ color: '#fcd34d' }}>
            {t('club.createTitle')}
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-1.5" style={{ color: 'rgba(217,119,6,0.6)' }}>
            {t('club.clubName')} *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('club.namePlaceholder')}
            maxLength={50}
            style={inputStyle}
          />
          <p className="text-[10px] text-gray-600 mt-1 text-right">{name.length}/50</p>
        </div>

        <div>
          <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-1.5" style={{ color: 'rgba(217,119,6,0.6)' }}>
            {t('club.description')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('club.descriptionPlaceholder')}
            maxLength={500}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
          />
          <p className="text-[10px] text-gray-600 mt-1 text-right">{description.length}/500</p>
        </div>

        <div>
          <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-1.5" style={{ color: 'rgba(217,119,6,0.6)' }}>
            {t('club.avatarUrl')}
          </label>
          <input
            type="url"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center py-1">{error}</p>
        )}

        <Button
          type="submit"
          disabled={loading || name.trim().length < 2}
          className="w-full h-11 rounded-xl text-xs font-bold uppercase tracking-widest"
          style={{
            background: loading
              ? 'rgba(217,119,6,0.3)'
              : 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 0 20px rgba(217,119,6,0.2)',
            cursor: loading || name.trim().length < 2 ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '…' : t('club.createBtn')}
        </Button>
      </form>
    </div>
  );
}

/* ─── Club Detail Overlay ─────────────────────────────────────────────── */

interface ClubDetailProps {
  club: ClubInfo;
  onClose: () => void;
  isAuthenticated: boolean;
  myRole?: ClubRole;
}

function ClubDetail({ club, onClose, isAuthenticated, myRole }: ClubDetailProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'members' | 'chat'>('members');
  const [detail, setDetail] = useState<ClubDetailResponse | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [memberCursor, setMemberCursor] = useState<string | null>(null);
  const [hasMoreMembers, setHasMoreMembers] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersSearch, setMembersSearch] = useState('');

  // Chat state
  const [messages, setMessages] = useState<ClubChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatError, setChatError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  /* ── Load club detail ── */
  useEffect(() => {
    const loadDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await api.get<ClubDetailResponse>(`/clubs/${club.id}`);
        setDetail(res.data);
        setMembers(res.data.members ?? []);
      } catch {
        // silent
      } finally {
        setLoadingDetail(false);
      }
    };
    loadDetail();
  }, [club.id]);

  /* ── Load members ── */
  const loadMembers = useCallback(async (search = '', cursor?: string | null) => {
    setLoadingMembers(true);
    try {
      const params: Record<string, string> = { limit: '20' };
      if (search) params.search = search;
      if (cursor) params.cursor = cursor;
      const res = await api.get<{ data: ClubMember[]; nextCursor: string | null }>(`/clubs/${club.id}/members`, { params });
      const data = res.data.data ?? [];
      if (cursor) {
        setMembers(prev => [...prev, ...data]);
      } else {
        setMembers(data);
      }
      setMemberCursor(res.data.nextCursor);
      setHasMoreMembers(!!res.data.nextCursor);
    } catch {
      // silent
    } finally {
      setLoadingMembers(false);
    }
  }, [club.id]);

  useEffect(() => {
    loadMembers(membersSearch);
  }, [membersSearch, loadMembers]);

  /* ── Load chat history ── */
  const loadChat = useCallback(async (cursor?: string | null) => {
    setLoadingMessages(true);
    try {
      const params: Record<string, string> = { limit: '50' };
      if (cursor) params.cursor = cursor;
      const res = await api.get<{ data: ClubChatMessage[]; nextCursor: string | null }>(`/clubs/${club.id}/chat`, { params });
      const data = res.data.data ?? [];
      if (cursor) {
        setMessages(prev => [...data.reverse(), ...prev]);
      } else {
        setMessages(data.reverse());
      }
    } catch {
      // silent
    } finally {
      setLoadingMessages(false);
    }
  }, [club.id]);

  /* ── WebSocket ── */
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;

    const socket: Socket = io(WS_URL, {
      query: { token },
      transports: ['websocket'],
      reconnectionAttempts: 3,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_club', { clubId: club.id });
    });

    socket.on('club_chat_message', (data: ClubChatMessagePayload) => {
      setMessages(prev => [...prev, {
        id: data.id,
        clubId: data.clubId,
        userId: data.userId,
        nickname: data.nickname,
        avatar: data.avatar,
        message: data.message,
        createdAt: data.createdAt,
      }]);
    });

    socket.on('club_error', (data: ClubErrorPayload) => {
      setChatError(data.message);
      setTimeout(() => setChatError(''), 3000);
    });

    socket.on('disconnect', () => {
      // silent
    });

    return () => {
      socket.emit('leave_club', { clubId: club.id });
      socket.disconnect();
    };
  }, [club.id]);

  /* ── Auto-scroll to bottom on new message ── */
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  /* ── Open chat tab ── */
  const openChat = () => {
    setActiveTab('chat');
    if (messages.length === 0) {
      loadChat();
    }
  };

  /* ── Send message ── */
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMessage) return;
    const token = getStoredToken();
    if (!token) {
      setChatError(t('club.loginRequired'));
      return;
    }
    setSendingMessage(true);
    setChatError('');
    try {
      const res = await api.post<ClubChatMessage>(`/clubs/${club.id}/chat`, { message: newMessage.trim() });
      setMessages(prev => [...prev, res.data]);
      setNewMessage('');
    } catch {
      setChatError(t('club.sendError'));
    } finally {
      setSendingMessage(false);
    }
  };

  const displayClub = detail ?? club;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(15,10,4,0.99) 0%, rgba(8,6,2,1) 100%)',
          border: '1px solid rgba(217,119,6,0.3)',
          boxShadow: '0 0 60px rgba(217,119,6,0.1), 0 24px 80px rgba(0,0,0,0.8)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="p-5" style={{ borderBottom: '1px solid rgba(217,119,6,0.15)' }}>
          <div className="flex items-start gap-3">
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 transition-colors text-lg mt-0.5"
            >
              ←
            </button>
            <ClubAvatar avatar={displayClub.avatar} name={displayClub.name} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black tracking-wide text-amber-200">{displayClub.name}</h2>
                {myRole && <RoleBadge role={myRole} />}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">👤 {displayClub.ownerNickname}</p>
              <p className="text-[11px] text-gray-500">👥 {displayClub.memberCount} {t('club.members', { count: displayClub.memberCount })}</p>
            </div>
          </div>
          {displayClub.description && (
            <p className="text-xs text-gray-400 mt-3 leading-relaxed">{displayClub.description}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(217,119,6,0.15)' }}>
          {(['members', 'chat'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); if (tab === 'chat') openChat(); }}
              className="flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors"
              style={{
                color: activeTab === tab ? '#fcd34d' : 'rgba(156,163,175,0.5)',
                borderBottom: activeTab === tab ? '2px solid #fcd34d' : '2px solid transparent',
              }}
            >
              {tab === 'members' ? t('club.members') : t('club.chat')}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'members' && (
            <div className="flex-1 overflow-y-auto">
              {/* Search */}
              <div className="p-3 sticky top-0 z-10" style={{ background: 'rgba(15,10,4,0.98)' }}>
                <input
                  type="text"
                  value={membersSearch}
                  onChange={(e) => setMembersSearch(e.target.value)}
                  placeholder={t('club.searchMembers')}
                  className="w-full h-9 rounded-xl px-4 text-xs text-white placeholder:text-gray-600"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(217,119,6,0.2)',
                  }}
                />
              </div>

              {loadingDetail && members.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <span className="text-gray-600 text-xs">…</span>
                </div>
              ) : (
                <div className="px-4 pb-4 space-y-2">
                  {members.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      {member.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={member.avatar} className="w-8 h-8 rounded-lg object-cover" alt={member.nickname} />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                          style={{ background: 'linear-gradient(135deg, #374151, #1f2937)', color: '#9ca3af' }}
                        >
                          {member.nickname.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-200 truncate">{member.nickname}</p>
                        <RoleBadge role={member.role} />
                      </div>
                      <StatusDot status={member.status} />
                    </div>
                  ))}

                  {hasMoreMembers && (
                    <button
                      onClick={() => loadMembers(membersSearch, memberCursor)}
                      disabled={loadingMembers}
                      className="w-full py-2 text-xs text-amber-600 hover:text-amber-400 transition-colors"
                    >
                      {loadingMembers ? '…' : t('club.loadMore')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Messages */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
              >
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <span className="text-gray-600 text-xs">…</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <p className="text-xs text-gray-600">{t('club.noMessages')}</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className="flex gap-2.5">
                      {msg.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={msg.avatar} className="w-7 h-7 rounded-lg object-cover mt-0.5 flex-shrink-0" alt={msg.nickname} />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                          style={{ background: 'linear-gradient(135deg, #374151, #1f2937)', color: '#9ca3af' }}
                        >
                          {msg.nickname.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs font-bold text-amber-300">{msg.nickname}</span>
                          <span className="text-[10px] text-gray-600">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed break-words">{msg.message}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Error */}
              {chatError && (
                <div className="px-4 py-1.5">
                  <p className="text-xs text-red-400 text-center">{chatError}</p>
                </div>
              )}

              {/* Input */}
              {isAuthenticated ? (
                <form onSubmit={handleSendMessage} className="p-3 flex gap-2" style={{ borderTop: '1px solid rgba(217,119,6,0.15)' }}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={t('club.messagePlaceholder')}
                    maxLength={500}
                    disabled={sendingMessage}
                    className="flex-1 h-9 rounded-xl px-4 text-xs text-white placeholder:text-gray-600 disabled:opacity-50"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(217,119,6,0.25)',
                    }}
                  />
                  <Button
                    type="submit"
                    disabled={sendingMessage || !newMessage.trim()}
                    className="h-9 px-4 rounded-xl text-xs font-bold"
                    style={{
                      background: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)',
                      color: '#fff',
                      border: 'none',
                      cursor: sendingMessage || !newMessage.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {sendingMessage ? '…' : '➤'}
                  </Button>
                </form>
              ) : (
                <div className="p-3 text-center" style={{ borderTop: '1px solid rgba(217,119,6,0.15)' }}>
                  <p className="text-xs text-gray-500">{t('club.loginRequiredToChat')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */

const pageBg: React.CSSProperties = {
  background: 'radial-gradient(ellipse at 50% 20%, #1a0f04 0%, #0a0804 55%, #020302 100%)',
};

export default function ClubPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('explore');
  const [exploreClubs, setExploreClubs] = useState<ClubInfo[]>([]);
  const [myClubs, setMyClubs] = useState<ClubInfo[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(true);
  const [loadingMyClubs, setLoadingMyClubs] = useState(false);
  const [search, setSearch] = useState('');
  const [exploreCursor, setExploreCursor] = useState<string | null>(null);
  const [hasMoreExplore, setHasMoreExplore] = useState(false);
  const [loadingMoreExplore, setLoadingMoreExplore] = useState(false);
  const [selectedClub, setSelectedClub] = useState<ClubDetailTab | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [myRoleMap, setMyRoleMap] = useState<Record<string, ClubRole>>({});

  /* ── Auth check ── */
  useEffect(() => {
    const token = getStoredToken();
    setIsAuthenticated(!!token);
  }, []);

  /* ── Load explore clubs ── */
  const loadExplore = useCallback(async (searchQuery = '', cursor?: string | null) => {
    if (!cursor) setLoadingExplore(true);
    else setLoadingMoreExplore(true);
    try {
      const params: Record<string, string> = { limit: '20' };
      if (searchQuery) params.search = searchQuery;
      if (cursor) params.cursor = cursor;
      const res = await api.get<ClubListResponse>('/clubs', { params });
      const data = res.data.data ?? [];
      if (cursor) {
        setExploreClubs(prev => [...prev, ...data]);
      } else {
        setExploreClubs(data);
      }
      setExploreCursor(res.data.nextCursor);
      setHasMoreExplore(!!res.data.nextCursor);
    } catch {
      // silent
    } finally {
      setLoadingExplore(false);
      setLoadingMoreExplore(false);
    }
  }, []);

  /* ── Load my clubs ── */
  const loadMyClubs = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setLoadingMyClubs(true);
    try {
      const res = await api.get<ClubInfo[]>('/clubs/me/clubs');
      const data = res.data;
      setMyClubs(data);
      const roleMap: Record<string, ClubRole> = {};
      data.forEach(club => {
        if (club.myRole) roleMap[club.id] = club.myRole;
      });
      setMyRoleMap(roleMap);
    } catch {
      // silent
    } finally {
      setLoadingMyClubs(false);
    }
  }, []);

  /* ── Initial load ── */
  useEffect(() => {
    loadExplore();
    if (isAuthenticated) {
      loadMyClubs();
    }
  }, [isAuthenticated, loadExplore, loadMyClubs]);

  /* ── Search debounce ── */
  useEffect(() => {
    const timer = setTimeout(() => {
      loadExplore(search);
      setExploreCursor(null);
      setHasMoreExplore(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, loadExplore]);

  /* ── Join club ── */
  const handleJoin = async (clubId: string) => {
    const token = getStoredToken();
    if (!token) { router.push('/login'); return; }
    setLoadingAction(clubId);
    try {
      await api.post(`/clubs/${clubId}/join`);
      await loadMyClubs();
      setMyRoleMap(prev => ({ ...prev, [clubId]: 'MEMBER' }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      alert(Array.isArray(msg) ? msg[0] : String(msg || t('club.joinError')));
    } finally {
      setLoadingAction(null);
    }
  };

  /* ── Leave club ── */
  const handleLeave = async (clubId: string) => {
    const token = getStoredToken();
    if (!token) { router.push('/login'); return; }
    setLoadingAction(clubId);
    try {
      await api.post(`/clubs/${clubId}/leave`);
      setMyClubs(prev => prev.filter(c => c.id !== clubId));
      setMyRoleMap(prev => { const m = { ...prev }; delete m[clubId]; return m; });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      alert(Array.isArray(msg) ? msg[0] : String(msg || t('club.leaveError')));
    } finally {
      setLoadingAction(null);
    }
  };

  /* ── Enter club (open detail) ── */
  const handleEnter = async (club: ClubInfo) => {
    const token = getStoredToken();
    const role = myRoleMap[club.id];
    if (role || (token && club.myRole)) {
      setSelectedClub({ info: { ...club, members: [] }, myRole: role ?? club.myRole });
    } else {
      // fetch full detail without auth
      try {
        const res = await api.get<ClubDetailResponse>(`/clubs/${club.id}`);
        setSelectedClub({ info: res.data, myRole: undefined });
      } catch {
        setSelectedClub({ info: { ...club, members: [] }, myRole: undefined });
      }
    }
  };

  const gridBg: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem',
  };

  return (
    <div className="min-h-screen" style={pageBg}>
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <span className="absolute top-6 left-4 text-[10rem] font-serif opacity-[0.03] text-yellow-400 -rotate-12">♠</span>
        <span className="absolute bottom-10 right-4 text-[11rem] font-serif opacity-[0.03] text-yellow-400 rotate-6">♥</span>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-6 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-300 transition-colors text-lg">←</button>
            <div>
              <h1
                className="text-2xl font-black tracking-[0.08em] uppercase"
                style={{
                  background: 'linear-gradient(135deg, #d97706 0%, #fcd34d 45%, #d97706 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                🏠 {t('club.title')}
              </h1>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 mb-6" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem', padding: '4px' }}>
          {([
            { id: 'explore' as Tab, label: t('club.explore'), icon: '🔍' },
            { id: 'my-clubs' as Tab, label: t('club.myClubs'), icon: '🏠' },
            { id: 'create' as Tab, label: t('club.create'), icon: '➕' },
          ]).map(tb => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
              style={{
                background: tab === tb.id ? 'rgba(217,119,6,0.2)' : 'transparent',
                color: tab === tb.id ? '#fcd34d' : 'rgba(156,163,175,0.5)',
                border: tab === tb.id ? '1px solid rgba(217,119,6,0.3)' : '1px solid transparent',
              }}
            >
              <span>{tb.icon}</span>
              <span>{tb.label}</span>
              {tb.id === 'my-clubs' && myClubs.length > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{ background: 'rgba(217,119,6,0.3)', color: '#fcd34d' }}
                >
                  {myClubs.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Explore ── */}
        {tab === 'explore' && (
          <div>
            {/* Search */}
            <div className="mb-5">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('club.searchPlaceholder')}
                className="w-full h-11 rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(217,119,6,0.2)',
                  boxShadow: '0 0 0 3px rgba(217,119,6,0.05)',
                }}
              />
            </div>

            {loadingExplore ? (
              <div className="flex items-center justify-center py-16">
                <span className="text-amber-600 text-sm">…</span>
              </div>
            ) : exploreClubs.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-2xl mb-2">🏠</p>
                <p className="text-sm text-gray-500">{t('club.noClubs')}</p>
              </div>
            ) : (
              <>
                <div style={gridBg}>
                  {exploreClubs.map(club => (
                    <ClubCard
                      key={club.id}
                      club={club}
                      myRole={myRoleMap[club.id] ?? club.myRole}
                      isMember={!!myRoleMap[club.id] || club.myRole !== undefined}
                      isAuthenticated={isAuthenticated}
                      onEnter={handleEnter}
                      onJoin={handleJoin}
                      onLeave={handleLeave}
                      loadingId={loadingAction}
                    />
                  ))}
                </div>

                {hasMoreExplore && (
                  <div className="mt-6 text-center">
                    <Button
                      onClick={() => loadExplore(search, exploreCursor)}
                      disabled={loadingMoreExplore}
                      className="px-8 h-10 rounded-xl text-xs font-bold uppercase tracking-widest"
                      style={{
                        background: 'rgba(217,119,6,0.1)',
                        color: '#fcd34d',
                        border: '1px solid rgba(217,119,6,0.3)',
                      }}
                    >
                      {loadingMoreExplore ? '…' : t('club.loadMore')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── My Clubs ── */}
        {tab === 'my-clubs' && (
          <div>
            {!isAuthenticated ? (
              <div className="text-center py-16">
                <p className="text-2xl mb-3">🔐</p>
                <p className="text-sm text-gray-400 mb-4">{t('club.loginRequired')}</p>
                <Button
                  onClick={() => router.push('/login')}
                  className="h-10 px-6 rounded-xl text-xs font-bold uppercase tracking-widest"
                  style={{
                    background: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)',
                    color: '#fff',
                    border: 'none',
                  }}
                >
                  {t('common.login')}
                </Button>
              </div>
            ) : loadingMyClubs ? (
              <div className="flex items-center justify-center py-16">
                <span className="text-amber-600 text-sm">…</span>
              </div>
            ) : myClubs.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-2xl mb-2">🏠</p>
                <p className="text-sm text-gray-500 mb-4">{t('club.noMyClubs')}</p>
                <Button
                  onClick={() => setTab('explore')}
                  className="h-10 px-6 rounded-xl text-xs font-bold uppercase tracking-widest"
                  style={{
                    background: 'rgba(217,119,6,0.1)',
                    color: '#fcd34d',
                    border: '1px solid rgba(217,119,6,0.3)',
                  }}
                >
                  {t('club.explore')}
                </Button>
              </div>
            ) : (
              <div style={gridBg}>
                {myClubs.map(club => (
                  <ClubCard
                    key={club.id}
                    club={club}
                    myRole={myRoleMap[club.id] ?? club.myRole}
                    isMember={true}
                    isAuthenticated={isAuthenticated}
                    onEnter={handleEnter}
                    onJoin={handleJoin}
                    onLeave={handleLeave}
                    loadingId={loadingAction}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Create ── */}
        {tab === 'create' && (
          <div className="max-w-md mx-auto">
            {!isAuthenticated ? (
              <div className="text-center py-16">
                <p className="text-2xl mb-3">🔐</p>
                <p className="text-sm text-gray-400 mb-4">{t('club.loginRequired')}</p>
                <Button
                  onClick={() => router.push('/login')}
                  className="h-10 px-6 rounded-xl text-xs font-bold uppercase tracking-widest"
                  style={{
                    background: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)',
                    color: '#fff',
                    border: 'none',
                  }}
                >
                  {t('common.login')}
                </Button>
              </div>
            ) : (
              <CreateClubForm
                onSuccess={() => {
                  loadMyClubs();
                  setTab('my-clubs');
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Club Detail Modal */}
      {selectedClub && (
        <ClubDetail
          club={selectedClub.info}
          onClose={() => setSelectedClub(null)}
          isAuthenticated={isAuthenticated}
          myRole={selectedClub.myRole}
        />
      )}
    </div>
  );
}
