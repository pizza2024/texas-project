'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { getStoredToken, getTokenPayload, isTokenExpired } from '@/lib/auth';
import type { TableState, Player } from '@texas/shared';

// ── Types ────────────────────────────────────────────────────────────────────

interface HandResultEntry {
  playerId: string;
  nickname: string;
  handName: string;
  winAmount: number;
  bestCards?: string[];
}

// ── Card display ─────────────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

function CardDisplay({ card, large }: { card: string; large?: boolean }) {
  const hidden = card === '??';
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const red = suit === 'h' || suit === 'd';
  const w = large ? 'w-14 h-20' : 'w-9 h-13';
  const fs = large ? 'text-lg' : 'text-[10px]';
  const ss = large ? 'text-2xl' : 'text-xs';

  if (hidden) {
    return (
      <div
        className={`${w} rounded-lg flex items-center justify-center font-bold`}
        style={{
          background: 'linear-gradient(135deg, #1e3a5f, #0f2540)',
          border: '1px solid rgba(96,165,250,0.3)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          color: 'rgba(147,197,253,0.5)',
          fontSize: large ? '28px' : '16px',
        }}
      >
        ♦
      </div>
    );
  }

  return (
    <div
      className={`${w} rounded-lg flex flex-col items-center justify-center`}
      style={{
        background: 'linear-gradient(160deg, #fff, #f0f0f0)',
        border: '1px solid rgba(0,0,0,0.15)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        color: red ? '#dc2626' : '#111827',
      }}
    >
      <span className={`font-black leading-none ${fs}`}>{rank}</span>
      <span className={`leading-none ${ss}`}>{SUIT_SYMBOL[suit] ?? suit}</span>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getMyUserId() {
  const token = getStoredToken();
  return token ? (getTokenPayload(token)?.sub ?? '') : '';
}

function fmt(n: number) {
  return n.toLocaleString();
}

// ── Page ─────────────────────────────────────────────────────────────────────

const pageBg = { background: 'linear-gradient(180deg, #050d08 0%, #020405 100%)' };

export default function MobileRoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const [table, setTable] = useState<TableState | null>(null);
  const [myUserId] = useState<string>(getMyUserId);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [raiseAmount, setRaiseAmount] = useState(0);
  const autoActRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Socket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = getStoredToken();
    if (!token || isTokenExpired(token, 1000)) { router.replace('/login'); return; }
    const socket = getSocket(token);
    socket.on('connect', () => {
      const pw = sessionStorage.getItem(`room-password:${id}`);
      sessionStorage.removeItem(`room-password:${id}`);
      socket.emit('join_room', { roomId: id as string, password: pw ?? undefined });
    });
    socket.on('room_update', (data: TableState) => setTable(data));
    socket.on('disconnect', () => { const t = getStoredToken(); if (!t || isTokenExpired(t, 1000)) router.replace('/login'); });
    socket.on('room_full', () => router.replace('/rooms'));
    socket.on('error', (msg: string) => { if (msg === 'Room not found') router.replace('/rooms'); });
    return () => { socket.off('connect'); socket.off('room_update'); socket.off('disconnect'); socket.off('room_full'); socket.off('error'); disconnectSocket(); };
  }, [id, router]);

  // ── Countdown ticker ────────────────────────────────────────────────────
  useEffect(() => {
    if (!table?.actionEndsAt && !table?.settlementEndsAt && !table?.readyCountdownEndsAt) return;
    setCountdownNow(Date.now());
    const iv = setInterval(() => setCountdownNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [table?.actionEndsAt, table?.settlementEndsAt, table?.readyCountdownEndsAt]);

  // ── Auto-action ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoActRef.current) clearTimeout(autoActRef.current);
    if (!table) return;
    // Derive isMyTurn fresh from current table state to avoid stale closure.
    const activePlayer = table.activePlayerIndex >= 0 ? table.players[table.activePlayerIndex] : null;
    const isMyTurnNow = table.currentStage !== 'WAITING' && table.currentStage !== 'SETTLEMENT' && activePlayer?.id === myUserId;
    if (!isMyTurnNow) return;
    const remaining = (table.actionEndsAt ?? 0) - Date.now();
    if (remaining <= 0) {
      doAutoAction(table);
      return;
    }
    autoActRef.current = setTimeout(() => doAutoAction(table), remaining);
    return () => { if (autoActRef.current) clearTimeout(autoActRef.current); };
  }, [table?.actionEndsAt, table?.currentStage, table, myUserId]);

  function doAutoAction(currentTable: typeof table) {
    if (!currentTable) return;
    const socket = getSocket(getStoredToken()!);
    if (!socket) return;
    // Derive canCheck fresh to avoid stale closure.
    const myP = currentTable.players.find((p: Player | null) => p?.id === myUserId) as Player | null;
    const callAmt = myP ? Math.max(0, (currentTable.currentBet ?? 0) - myP.bet) : 0;
    const action = callAmt === 0 ? 'check' : 'fold';
    socket.emit('player_action', { roomId: id as string, action });
  }

  // ── Derived state ───────────────────────────────────────────────────────
  if (!table) return (
    <div className="min-h-screen flex items-center justify-center" style={pageBg}>
      <p className="text-sm text-yellow-500/60 tracking-widest uppercase animate-pulse">Loading…</p>
    </div>
  );

  const players = table.players.filter(Boolean) as Player[];
  const myPlayer = players.find((p) => p.id === myUserId);
  const isWaiting = table.currentStage === 'WAITING';
  const isSettlement = table.currentStage === 'SETTLEMENT';
  const isActionStage = !isWaiting && !isSettlement;
  const activePlayer = table.activePlayerIndex >= 0 ? table.players[table.activePlayerIndex] : null;
  const isMyTurn = isActionStage && activePlayer?.id === myUserId;

  const callAmt = myPlayer ? Math.max(0, (table.currentBet ?? 0) - myPlayer.bet) : 0;
  const canCheck = callAmt === 0;
  const minRaise = (table.currentBet ?? 0) + (table.bigBlind ?? 0);

  const actionSecs = table.actionEndsAt ? Math.max(0, Math.ceil((table.actionEndsAt - countdownNow) / 1000)) : 0;
  const settleSecs = table.settlementEndsAt ? Math.max(0, Math.ceil((table.settlementEndsAt - countdownNow) / 1000)) : 0;
  const readySecs = table.readyCountdownEndsAt ? Math.max(0, Math.ceil((table.readyCountdownEndsAt - countdownNow) / 1000)) : 0;

  // Winner info for settlement overlay
  const winners = (table.lastHandResult ?? []).filter((e: HandResultEntry) => e.winAmount > 0);
  const myResult = (table.lastHandResult ?? []).find((e: HandResultEntry) => e.playerId === myUserId);
  const didIFold = myResult?.handName === '弃牌';

  // ── Actions ────────────────────────────────────────────────────────────
  const emit = (action: string, amount?: number) => {
    const token = getStoredToken(); if (!token) return;
    getSocket(token).emit('player_action', { roomId: id as string, action, amount });
  };
  const handleReady = () => {
    const token = getStoredToken(); if (!token) return;
    getSocket(token).emit('player_ready', { roomId: id as string });
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen text-white relative flex flex-col" style={pageBg}>

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(234,179,8,0.12)', background: 'rgba(2,4,6,0.8)' }}
      >
        <Button
          onClick={() => router.push('/rooms')}
          className="h-9 px-3 text-xs font-bold uppercase tracking-widest rounded-lg"
          style={{ background: 'transparent', border: '1px solid rgba(234,179,8,0.3)', color: 'rgba(245,158,11,0.7)' }}
        >
          ← Back
        </Button>
        <span className="text-xs font-bold tracking-wider" style={{ color: 'rgba(245,158,11,0.6)' }}>
          {table.currentStage}
        </span>
        <div className="w-16" />
      </div>

      {/* ── Stage banner ── */}
      <div className="px-4 py-1.5 text-center text-xs tracking-widest uppercase shrink-0"
        style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(156,163,175,0.6)' }}>
        {isSettlement
          ? `Settlement · ${settleSecs}s`
          : isMyTurn
            ? `Your turn · ${actionSecs}s`
            : activePlayer
              ? `Waiting ${activePlayer.nickname} · ${actionSecs}s`
              : isWaiting
                ? `Waiting · ${readySecs}s`
                : table.currentStage}
      </div>

      {/* ── Player strip ── */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto shrink-0" style={{ background: 'rgba(0,0,0,0.25)' }}>
        {players.map((p) => {
          const active = table.activePlayerIndex >= 0 && table.players[table.activePlayerIndex]?.id === p.id;
          const folded = p.status === 'FOLD';
          return (
            <div key={p.id} className="flex flex-col items-center gap-0.5 shrink-0">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: folded ? 'rgba(80,80,80,0.5)' : 'linear-gradient(135deg, #1a3a2a, #0d2015)',
                  border: active ? '2px solid #facc15' : p.id === myUserId ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: active ? '0 0 10px rgba(250,204,21,0.4)' : 'none',
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '10px',
                }}
              >
                {p.nickname.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-[9px] font-bold truncate max-w-[44px]" style={{ color: p.id === myUserId ? '#fcd34d' : 'rgba(255,255,255,0.7)' }}>
                {p.id === myUserId ? 'You' : p.nickname}
              </span>
              <span className="text-[9px] font-semibold" style={{ color: 'rgba(74,222,128,0.8)' }}>
                ${fmt(p.stack)}
              </span>
              {p.isButton && <span className="text-[7px] font-black px-1 rounded-full" style={{ background: '#fcd34d', color: '#000' }}>D</span>}
              {p.isBigBlind && <span className="text-[7px] font-black px-1 rounded-full" style={{ background: '#ef4444', color: '#fff' }}>BB</span>}
              {p.isSmallBlind && <span className="text-[7px] font-black px-1 rounded-full" style={{ background: '#3b82f6', color: '#fff' }}>SB</span>}
              {folded && <span className="text-[7px] text-gray-500">FOLD</span>}
            </div>
          );
        })}
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 py-3">

        {/* Community cards */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(156,163,175,0.5)' }}>Community</span>
          <div className="flex gap-1.5">
            {table.communityCards.length > 0
              ? table.communityCards.map((c, i) => <CardDisplay key={i} card={c} />)
              : <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>---</span>
            }
          </div>
        </div>

        {/* Pot */}
        <div
          className="px-5 py-1.5 rounded-full text-sm font-black"
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(234,179,8,0.35)',
            color: '#fcd34d',
            boxShadow: '0 0 12px rgba(234,179,8,0.1)',
          }}
        >
          💰 ${fmt(table.pot)}
        </div>

        {/* My cards */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(156,163,175,0.5)' }}>Your Hand</span>
          <div className="flex gap-2">
            {myPlayer && myPlayer.cards.length > 0
              ? myPlayer.cards.map((c, i) => <CardDisplay key={i} card={c} large />)
              : [<div key={0} className="w-14 h-20 rounded-lg" style={{ background: 'rgba(30,58,95,0.5)', border: '1px solid rgba(96,165,250,0.2)' }} />,
                 <div key={1} className="w-14 h-20 rounded-lg" style={{ background: 'rgba(30,58,95,0.5)', border: '1px solid rgba(96,165,250,0.2)' }} />]}
          </div>
          {myPlayer && <span className="text-xs font-semibold" style={{ color: 'rgba(74,222,128,0.8)' }}>Stack $${fmt(myPlayer.stack)}</span>}
        </div>
      </div>

      {/* ── Action bar (fixed bottom) ── */}
      <div
        className="shrink-0 px-4 py-4"
        style={{
          background: 'linear-gradient(180deg, rgba(2,4,6,0) 0%, rgba(2,4,6,0.97) 40%, rgba(2,4,6,1) 100%)',
          borderTop: '1px solid rgba(234,179,8,0.1)',
        }}
      >
        {isWaiting ? (
          <Button
            onClick={handleReady}
            className="w-full h-14 font-black tracking-[0.2em] text-sm uppercase rounded-xl"
            style={myPlayer?.ready
              ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }
              : { background: 'linear-gradient(135deg, #166534, #16a34a)', color: '#000', border: 'none', boxShadow: '0 0 20px rgba(74,222,128,0.2)' }}
          >
            {myPlayer?.ready ? 'Cancel Ready' : 'Ready'}
          </Button>
        ) : isSettlement ? (
          <div className="flex flex-col items-center gap-2">
            {winners.length > 0 && (
              <div className="text-center">
                <p className="text-xs font-bold tracking-wider" style={{ color: 'rgba(251,191,36,0.85)' }}>
                  {winners.map((w: HandResultEntry) => `${w.nickname} wins $${fmt(w.winAmount)}`).join(' / ')}
                </p>
              </div>
            )}
            <div className="w-full h-12 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(234,179,8,0.15)', color: 'rgba(245,158,11,0.7)' }}>
              {settleSecs > 0 ? `Settling… ${settleSecs}s` : 'Settling…'}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Timer bar */}
            {isMyTurn && actionSecs > 0 && (
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    background: actionSecs <= 3 ? '#ef4444' : actionSecs <= 8 ? '#f59e0b' : '#22c55e',
                    width: `${Math.min(100, (actionSecs / 15) * 100)}%`,
                  }}
                />
              </div>
            )}

            {/* Main actions */}
            <div className="flex gap-2">
              <Button
                onClick={() => emit('fold')}
                disabled={!isMyTurn}
                className="flex-1 h-14 font-black text-xs uppercase tracking-wider rounded-xl disabled:opacity-30"
                style={{ background: 'rgba(185,28,28,0.7)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
              >
                Fold
              </Button>

              {canCheck ? (
                <Button
                  onClick={() => emit('check')}
                  disabled={!isMyTurn}
                  className="flex-1 h-14 font-black text-xs uppercase tracking-wider rounded-xl disabled:opacity-30"
                  style={{ background: 'rgba(37,99,235,0.25)', border: '1px solid rgba(96,165,250,0.3)', color: 'rgba(147,197,253,0.9)' }}
                >
                  Check
                </Button>
              ) : (
                <Button
                  onClick={() => emit('call')}
                  disabled={!isMyTurn}
                  className="flex-1 h-14 font-black text-xs uppercase tracking-wider rounded-xl disabled:opacity-30"
                  style={{ background: 'rgba(37,99,235,0.5)', border: '1px solid rgba(96,165,250,0.4)', color: '#93c5fd' }}
                >
                  Call ${fmt(callAmt)}
                </Button>
              )}

              <Button
                onClick={() => emit('raise', raiseAmount || minRaise)}
                disabled={!isMyTurn}
                className="flex-1 h-14 font-black text-xs uppercase tracking-wider rounded-xl disabled:opacity-30"
                style={isMyTurn
                  ? { background: 'linear-gradient(135deg, #92400e, #d97706)', color: '#000', border: 'none' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}
              >
                Raise
              </Button>
            </div>

            {/* Raise amount */}
            {isMyTurn && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  className="flex-1 h-2 rounded-full"
                  style={{ accentColor: '#f59e0b' }}
                  min={minRaise}
                  max={myPlayer?.stack ?? minRaise}
                  value={raiseAmount || minRaise}
                  onChange={(e) => setRaiseAmount(Number(e.target.value))}
                />
                <div
                  className="w-20 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,179,8,0.25)', color: '#fcd34d' }}
                >
                  ${fmt(raiseAmount || minRaise)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
