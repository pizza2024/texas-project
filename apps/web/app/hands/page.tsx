'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import api from '@/lib/api';
import { getStoredToken, getTokenPayload, handleExpiredSession, isTokenExpired } from '@/lib/auth';
import { UserAvatar } from '@/components/user-avatar';

interface PlayerEntry {
  id: string;
  nickname: string;
  holeCards: string[];
  finalHand: string;
  winAmount: number;
  netProfit: number;
}

interface HandHistoryEntry {
  handId: string;
  roomName: string;
  date: string;
  players: PlayerEntry[];
  communityCards: string[];
  pot: number;
  winnerId: string | null;
}

const pageBg: React.CSSProperties = {
  background: 'radial-gradient(ellipse at 50% 20%, #0d2818 0%, #060e10 55%, #020406 100%)',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function rankToDisplay(rank: string): string {
  return rank;
}

function ProfitText({ value, className = '' }: { value: number; className?: string }) {
  const color = value >= 0 ? '#4ade80' : '#f87171';
  const sign = value >= 0 ? '+' : '';
  return (
    <span className={className} style={{ color }}>
      {sign}{value.toFixed(2)}
    </span>
  );
}

function CardDisplay({ card, small = false }: { card: string; small?: boolean }) {
  if (!card || card === '??') {
    return (
      <span
        className="inline-flex items-center justify-center rounded font-bold"
        style={{
          width: small ? 24 : 36,
          height: small ? 32 : 48,
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.3)',
          fontSize: small ? 12 : 16,
        }}
      >
        ?
      </span>
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const isRed = suit === 'h' || suit === 'd';

  return (
    <span
      className="inline-flex items-center justify-center rounded font-black"
      style={{
        width: small ? 24 : 36,
        height: small ? 32 : 48,
        background: 'white',
        color: isRed ? '#dc2626' : '#1e293b',
        fontSize: small ? 12 : 16,
      }}
    >
      {rank}
      <span style={{ fontSize: small ? 10 : 14 }}>{suit}</span>
    </span>
  );
}

export default function HandsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [hands, setHands] = useState<HandHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    if (isTokenExpired(token, 1000)) {
      void handleExpiredSession({ returnTo: '/hands' });
      return;
    }
    const payload = getTokenPayload(token);
    setNickname(payload?.username ?? '');
    setUserId(payload?.sub ?? '');

    let cancelled = false;
    const loadHands = async () => {
      try {
        const { data } = await api.get<HandHistoryEntry[]>('/user/hands', {
          params: { limit: LIMIT, offset: 0 },
        });
        if (!cancelled) {
          setHands(data);
          setHasMore(data.length === LIMIT);
          setOffset(LIMIT);
        }
      } catch {
        if (!cancelled) setError(t('hands.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadHands();
    return () => { cancelled = true; };
  }, [router, t]);

  const loadMore = async () => {
    try {
      const { data } = await api.get<HandHistoryEntry[]>('/user/hands', {
        params: { limit: LIMIT, offset },
      });
      setHands((prev) => [...prev, ...data]);
      setHasMore(data.length === LIMIT);
      setOffset((o) => o + data.length);
    } catch {
      // silent fail for load more
    }
  };

  return (
    <div className="min-h-screen text-white" style={pageBg}>
      {/* Nav */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(0,0,0,0.4)' }}
      >
        <button
          type="button"
          onClick={() => router.push('/rooms')}
          className="text-sm font-medium transition-colors"
          style={{ color: 'rgba(245,158,11,0.8)' }}
        >
          {t('common.backToLobby')}
        </button>
        <h1 className="text-base font-bold tracking-widest uppercase" style={{ color: '#f59e0b' }}>
          {t('hands.title')}
        </h1>
        <div className="flex items-center gap-2">
          <UserAvatar userId={userId} size={28} />
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{nickname}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <span className="text-sm" style={{ color: 'rgba(245,158,11,0.6)' }}>{t('common.loading')}</span>
          </div>
        )}

        {error && (
          <div
            className="rounded-xl p-4 text-sm text-center"
            style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
          >
            {error}
          </div>
        )}

        {!loading && !error && hands.length === 0 && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.1)' }}
          >
            <p className="text-lg font-bold mb-2" style={{ color: 'rgba(245,158,11,0.6)' }}>
              {t('hands.empty')}
            </p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {t('hands.emptyHint')}
            </p>
          </div>
        )}

        {!loading && !error && hands.map((hand) => (
          <div
            key={hand.handId}
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(245,158,11,0.15)', background: 'rgba(0,0,0,0.25)' }}
          >
            {/* Hand header */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ background: 'rgba(245,158,11,0.07)', borderBottom: '1px solid rgba(245,158,11,0.1)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>
                  #{hand.handId.slice(0, 8)}
                </span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {hand.roomName}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>
                  {t('hands.pot')}: {hand.pot.toLocaleString()}
                </span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {formatDateTime(hand.date)}
                </span>
              </div>
            </div>

            {/* Community cards */}
            {hand.communityCards.length > 0 && (
              <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-widest mr-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {t('hands.board')}:
                </span>
                {hand.communityCards.map((card, i) => (
                  <CardDisplay key={i} card={card} small />
                ))}
              </div>
            )}

            {/* Players */}
            <div className="divide-y" style={{ borderColor: 'rgba(245,158,11,0.06)' }}>
              {hand.players.map((player) => {
                const isMe = player.id === userId;
                const isWinner = hand.winnerId === player.id && player.winAmount > 0;

                return (
                  <div
                    key={player.id}
                    className="px-4 py-3 flex items-center gap-3"
                    style={{
                      background: isWinner
                        ? 'rgba(74,222,128,0.06)'
                        : isMe
                        ? 'rgba(59,130,246,0.06)'
                        : 'transparent',
                    }}
                  >
                    {/* Cards */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {player.holeCards.length > 0 ? (
                        player.holeCards.map((card, i) => (
                          <CardDisplay key={i} card={card} small />
                        ))
                      ) : (
                        <>
                          <CardDisplay card="??" small />
                          <CardDisplay card="??" small />
                        </>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-sm font-medium truncate"
                          style={{ color: isMe ? '#93c5fd' : 'rgba(255,255,255,0.8)' }}
                        >
                          {player.nickname}
                          {isMe && <span className="ml-1 text-xs">(me)</span>}
                        </span>
                        {isWinner && (
                          <span
                            className="px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0"
                            style={{ background: 'rgba(74,222,128,0.2)', color: '#4ade80' }}
                          >
                            WIN
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {rankToDisplay(player.finalHand)}
                        </span>
                      </div>
                    </div>

                    {/* Profit */}
                    <div className="flex flex-col items-end flex-shrink-0">
                      <ProfitText value={player.netProfit} className="text-sm font-bold tabular-nums" />
                      {player.winAmount > 0 && (
                        <span className="text-xs" style={{ color: 'rgba(74,222,128,0.6)' }}>
                          +{t('hands.won')} {player.winAmount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={() => { void loadMore(); }}
              className="px-6 py-2.5 rounded-xl text-sm font-bold transition-colors"
              style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.25)',
                color: '#f59e0b',
              }}
            >
              {t('hands.loadMore')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
