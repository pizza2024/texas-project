'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { getStoredToken, getTokenPayload, isTokenExpired } from '@/lib/auth';
import confetti from 'canvas-confetti';
import type { TableState, Player } from '@texas/shared';

// ── Types ────────────────────────────────────────────────────────────────────

interface HandResultEntry {
  playerId: string;
  nickname: string;
  handName: string;
  winAmount: number;
  bestCards?: string[];
}

interface ChipFlight {
  id: string;
  amount: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
  active: boolean;
}

interface PayoutFlight {
  id: string;
  amount: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
  active: boolean;
}

const CHIP_FLIGHT_MS = 620;
const CHIP_FLIGHT_STAGGER_MS = 70;

// ── Card display ─────────────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

function CardDisplay({ card, large }: { card: string; large?: boolean }) {
  const hidden = card === '??';
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const red = suit === 'h' || suit === 'd';
  // Mobile-optimised sizes: larger than before for readability
  const w = large ? 'w-16 h-[5.5rem]' : 'w-12 h-[4.25rem]';
  const fs = large ? 'text-xl' : 'text-sm';
  const ss = large ? 'text-3xl' : 'text-base';

  if (hidden) {
    return (
      <div
        className={`${w} rounded-xl flex flex-col items-center justify-center font-black relative overflow-hidden`}
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2540 60%, #0a1a30 100%)',
          border: '1px solid rgba(96,165,250,0.4)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5), inset 0 0 20px rgba(96,165,250,0.05)',
          color: 'rgba(147,197,253,0.55)',
        }}
      >
        {/* Decorative inner border */}
        <div
          className="absolute inset-1 rounded-lg pointer-events-none"
          style={{ border: '1px solid rgba(96,165,250,0.15)' }}
        />
        {/* Card-back diamond pattern */}
        <span className="text-2xl" style={{ color: 'rgba(147,197,253,0.35)', fontSize: large ? '36px' : '24px' }}>♦</span>
        <span
          className="absolute bottom-1 text-[8px] font-black"
          style={{ color: 'rgba(147,197,253,0.25)', fontSize: large ? '10px' : '8px' }}
        >
          TEXAS
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${w} rounded-xl flex flex-col items-center justify-center`}
      style={{
        background: 'linear-gradient(160deg, #fff 0%, #f5f5f5 100%)',
        border: '1px solid rgba(0,0,0,0.18)',
        boxShadow: '0 3px 12px rgba(0,0,0,0.4)',
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

function getElementCenter(el: HTMLElement | null) {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

const pageBg = { background: 'linear-gradient(180deg, #050d08 0%, #020405 100%)' };

export default function MobileRoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const [table, setTable] = useState<TableState | null>(null);
  const [myUserId] = useState<string>(getMyUserId);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [chipFlights, setChipFlights] = useState<ChipFlight[]>([]);
  const [payoutFlights, setPayoutFlights] = useState<PayoutFlight[]>([]);
  const [winnerHighlights, setWinnerHighlights] = useState<string[]>([]);
  const [foldWinChoiceMade, setFoldWinChoiceMade] = useState(false);
  const autoActRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionPendingRef = useRef<boolean>(false); // P2-TEST-006: block duplicate submissions
  const previousTableRef = useRef<TableState | null>(null);
  const chipCleanupRef = useRef<number | null>(null);
  const chipActivationRef = useRef<number | null>(null);
  const payoutCleanupRef = useRef<number | null>(null);
  const payoutActivationRef = useRef<number | null>(null);
  const winnerHighlightCleanupRef = useRef<number | null>(null);
  const playerNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const potRef = useRef<HTMLDivElement | null>(null);

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
    const iv = setInterval(() => setCountdownNow(Date.now()), 250);
    // Fire immediately to set initial countdown value, then every 250 ms
    // eslint-disable-next-line
    setCountdownNow(Date.now());
    return () => clearInterval(iv);
  }, [table?.actionEndsAt, table?.settlementEndsAt, table?.readyCountdownEndsAt]);

  // ── Auto-action ─────────────────────────────────────────────────────────
  const doAutoAction = useCallback((currentTable: typeof table) => {
    if (!currentTable) return;
    const socket = getSocket(getStoredToken()!);
    if (!socket) return;
    const myP = currentTable.players.find((p: Player | null) => p?.id === myUserId) as Player | null;
    const callAmt = myP ? Math.max(0, (currentTable.currentBet ?? 0) - myP.bet) : 0;
    const action = callAmt === 0 ? 'check' : 'fold';
    socket.emit('player_action', { roomId: id as string, action });
  }, [id, myUserId]);

  useEffect(() => {
    if (autoActRef.current) clearTimeout(autoActRef.current);
    if (!table) return;
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
  }, [table?.actionEndsAt, table?.currentStage, table, myUserId, doAutoAction]);

  const queueChipFlights = (flights: Omit<ChipFlight, 'active'>[]) => {
    if (flights.length === 0) return;

    if (chipActivationRef.current !== null) window.cancelAnimationFrame(chipActivationRef.current);
    if (chipCleanupRef.current !== null) window.clearTimeout(chipCleanupRef.current);

    setChipFlights(flights.map((flight) => ({ ...flight, active: false })));
    chipActivationRef.current = window.requestAnimationFrame(() => {
      setChipFlights((prev) => prev.map((flight) => ({ ...flight, active: true })));
      chipActivationRef.current = null;
    });

    const maxDelay = Math.max(...flights.map((flight) => flight.delay), 0);
    chipCleanupRef.current = window.setTimeout(() => {
      setChipFlights([]);
      chipCleanupRef.current = null;
    }, CHIP_FLIGHT_MS + maxDelay + 180);
  };

  const queuePayoutFlights = (flights: Omit<PayoutFlight, 'active'>[]) => {
    if (flights.length === 0) return;

    if (payoutActivationRef.current !== null) window.cancelAnimationFrame(payoutActivationRef.current);
    if (payoutCleanupRef.current !== null) window.clearTimeout(payoutCleanupRef.current);

    setPayoutFlights(flights.map((flight) => ({ ...flight, active: false })));
    payoutActivationRef.current = window.requestAnimationFrame(() => {
      setPayoutFlights((prev) => prev.map((flight) => ({ ...flight, active: true })));
      payoutActivationRef.current = null;
    });

    const maxDelay = Math.max(...flights.map((flight) => flight.delay), 0);
    payoutCleanupRef.current = window.setTimeout(() => {
      setPayoutFlights([]);
      payoutCleanupRef.current = null;
    }, CHIP_FLIGHT_MS + maxDelay + 220);
  };

  const queueWinnerHighlights = (playerIds: string[]) => {
    if (winnerHighlightCleanupRef.current !== null) {
      window.clearTimeout(winnerHighlightCleanupRef.current);
      winnerHighlightCleanupRef.current = null;
    }

    setWinnerHighlights(playerIds);
    if (playerIds.length > 0) {
      winnerHighlightCleanupRef.current = window.setTimeout(() => {
        setWinnerHighlights([]);
        winnerHighlightCleanupRef.current = null;
      }, 3200);
    }
  };

  useEffect(() => {
    if (!table) return;

    const previousTable = previousTableRef.current;
    if (previousTable) {
      const nextChipFlights: Omit<ChipFlight, 'active'>[] = [];
      const nextPayoutFlights: Omit<PayoutFlight, 'active'>[] = [];
      const nextWinnerHighlights: string[] = [];
      let chipIndex = 0;
      let payoutIndex = 0;

      table.players.forEach((player, idx) => {
        if (!player || table.currentStage === 'WAITING') return;
        const previousBet = previousTable.players[idx]?.bet ?? 0;
        if (player.bet <= previousBet) return;

        const potCenter = getElementCenter(potRef.current);
        const playerCenter = getElementCenter(playerNodeRefs.current[player.id] ?? null);
        if (!potCenter || !playerCenter) return;

        nextChipFlights.push({
          id: `chip-flight-${Date.now()}-${player.id}-${chipIndex}`,
          amount: player.bet - previousBet,
          startX: playerCenter.x,
          startY: playerCenter.y,
          endX: potCenter.x,
          endY: potCenter.y,
          delay: chipIndex * CHIP_FLIGHT_STAGGER_MS,
        });
        chipIndex += 1;
      });

      if (
        previousTable.currentStage !== 'SETTLEMENT' &&
        table.currentStage === 'SETTLEMENT' &&
        table.lastHandResult
      ) {
        // eslint-disable-next-line
        setFoldWinChoiceMade(false);
        const winners = table.lastHandResult.filter((entry: HandResultEntry) => entry.winAmount > 0);
        const myResult = table.lastHandResult.find((entry: HandResultEntry) => entry.playerId === myUserId);
        const didIFold = myResult?.handName === '弃牌';

        winners.forEach((entry: HandResultEntry) => {
          const playerIndex = table.players.findIndex((player) => player?.id === entry.playerId);
          if (playerIndex < 0) return;

          const potCenter = getElementCenter(potRef.current);
          const playerCenter = getElementCenter(playerNodeRefs.current[entry.playerId] ?? null);
          if (!potCenter || !playerCenter) return;

          nextPayoutFlights.push({
            id: `payout-flight-${Date.now()}-${entry.playerId}-${payoutIndex}`,
            amount: entry.winAmount,
            startX: potCenter.x,
            startY: potCenter.y,
            endX: playerCenter.x,
            endY: playerCenter.y,
            delay: payoutIndex * CHIP_FLIGHT_STAGGER_MS,
          });
          payoutIndex += 1;
          nextWinnerHighlights.push(entry.playerId);

          if (entry.playerId === myUserId && !didIFold) {
            const burst = (originX: number) =>
              confetti({
                particleCount: 85,
                spread: 70,
                startVelocity: 42,
                origin: { x: originX, y: 0.62 },
                colors: ['#facc15', '#86efac', '#60a5fa', '#f472b6', '#fb923c'],
              });
            burst(0.35);
            burst(0.65);
          }
        });
      }

      queueChipFlights(nextChipFlights);
      queuePayoutFlights(nextPayoutFlights);
      queueWinnerHighlights(nextWinnerHighlights);
    }

    previousTableRef.current = table;
  }, [table, myUserId]);

  useEffect(() => {
    return () => {
      if (chipCleanupRef.current !== null) window.clearTimeout(chipCleanupRef.current);
      if (chipActivationRef.current !== null) window.cancelAnimationFrame(chipActivationRef.current);
      if (payoutCleanupRef.current !== null) window.clearTimeout(payoutCleanupRef.current);
      if (payoutActivationRef.current !== null) window.cancelAnimationFrame(payoutActivationRef.current);
      if (winnerHighlightCleanupRef.current !== null) window.clearTimeout(winnerHighlightCleanupRef.current);
    };
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────
  if (!table) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={pageBg}>
      <div className="text-5xl animate-pulse">🃏</div>
      <p className="text-sm tracking-[0.3em] uppercase font-semibold text-yellow-500/70">Connecting…</p>
      <p className="text-xs text-white/30">Hold on while we join the table</p>
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
  const winnerHighlightSet = new Set(winnerHighlights);
  const isFoldWinSettlement = isSettlement && !!table.isFoldWin;
  const isFoldWinWinner = isFoldWinSettlement && winners.some((w: HandResultEntry) => w.playerId === myUserId);
  const showFoldWinChoice = isFoldWinWinner && !foldWinChoiceMade;

  // ── Actions ────────────────────────────────────────────────────────────
  const emit = (action: string, amount?: number) => {
    // P2-TEST-006: debounce duplicate submissions
    if (actionPendingRef.current) return;
    const token = getStoredToken(); if (!token) return;
    actionPendingRef.current = true;
    getSocket(token).emit('player_action', { roomId: id as string, action, amount });
    setTimeout(() => { actionPendingRef.current = false; }, 1000);
  };
  const handleReady = () => {
    const token = getStoredToken(); if (!token) return;
    getSocket(token).emit('player_ready', { roomId: id as string });
  };
  const handleShowCards = () => {
    const token = getStoredToken();
    if (!token) return;
    getSocket(token).emit('show_cards', { roomId: id as string });
    setFoldWinChoiceMade(true);
  };
  const handleMuckCards = () => {
    setFoldWinChoiceMade(true);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen text-white relative flex flex-col pb-52" style={pageBg}>

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
      <div className="relative shrink-0">
        <div
          className="flex gap-2.5 px-3 py-2.5 overflow-x-auto"
          style={{ background: 'rgba(0,0,0,0.25)' }}
          id="player-strip"
        >
          {players.map((p) => {
            const active = table.activePlayerIndex >= 0 && table.players[table.activePlayerIndex]?.id === p.id;
            const folded = p.status === 'FOLD';
            const winner = winnerHighlightSet.has(p.id);
            return (
              <div
                key={p.id}
                className="flex flex-col items-center gap-0.5 shrink-0"
                ref={(el) => {
                  playerNodeRefs.current[p.id] = el;
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: folded ? 'rgba(80,80,80,0.5)' : 'linear-gradient(135deg, #1a3a2a, #0d2015)',
                    border: winner
                      ? '2.5px solid rgba(250,204,21,0.95)'
                      : active
                        ? '2.5px solid #facc15'
                        : p.id === myUserId
                          ? '2.5px solid #38bdf8'
                          : '1px solid rgba(255,255,255,0.12)',
                    boxShadow: winner
                      ? '0 0 14px rgba(250,204,21,0.45), 0 0 24px rgba(74,222,128,0.2)'
                      : active
                        ? '0 0 12px rgba(250,204,21,0.5)'
                        : 'none',
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: '10px',
                  }}
                >
                  {p.nickname.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-[9px] font-bold truncate max-w-[48px]" style={{ color: p.id === myUserId ? '#fcd34d' : 'rgba(255,255,255,0.7)' }}>
                  {p.id === myUserId ? 'You' : p.nickname}
                </span>
                <span className="text-[9px] font-semibold" style={{ color: 'rgba(74,222,128,0.8)' }}>
                  ${fmt(p.stack)}
                </span>
                {p.isButton && <span className="text-[7px] font-black px-1 rounded-full" style={{ background: '#fcd34d', color: '#000' }}>D</span>}
                {p.isBigBlind && <span className="text-[9px] font-black px-1.5 rounded-full leading-none" style={{ background: '#ef4444', color: '#fff' }}>BB</span>}
                {p.isSmallBlind && <span className="text-[7px] font-black px-1 rounded-full" style={{ background: '#3b82f6', color: '#fff' }}>SB</span>}
                {winner && <span className="text-[7px] font-black px-1 rounded-full" style={{ background: '#facc15', color: '#000' }}>WIN</span>}
                {folded && <span className="text-[7px] text-gray-500">FOLD</span>}
              </div>
            );
          })}
        </div>
        {/* Scroll fade indicators */}
        <div className="absolute left-0 top-0 bottom-0 w-6 pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(2,4,6,0.6) 0%, transparent 100%)' }} />
        <div className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none" style={{ background: 'linear-gradient(270deg, rgba(2,4,6,0.6) 0%, transparent 100%)' }} />
      </div>

      {/* ── Main area ── */}
      <div className="relative flex-1 flex flex-col items-center justify-center gap-5 px-4 py-4">

        {/* Community cards */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(156,163,175,0.5)' }}>Community</span>
          <div className="flex gap-2">
            {table.communityCards.length > 0
              ? table.communityCards.map((c, i) => <CardDisplay key={i} card={c} />)
              : <span className="text-sm" style={{ color: 'rgba(255,255,255,0.15)' }}>---</span>
            }
          </div>
        </div>

        {/* Pot */}
        <div
          ref={potRef}
          className="px-6 py-2 rounded-full text-base font-black"
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(234,179,8,0.35)',
            color: '#fcd34d',
            boxShadow: '0 0 16px rgba(234,179,8,0.12)',
          }}
        >
          💰 ${fmt(table.pot)}
        </div>

        {/* Flying chips to pot */}
        {chipFlights.map((flight) => (
          <div
            key={flight.id}
            className="fixed -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
            style={{
              top: flight.active ? flight.endY : flight.startY,
              left: flight.active ? flight.endX : flight.startX,
              opacity: flight.active ? 0 : 1,
              transform: flight.active
                ? 'translate(-50%, -50%) scale(0.72)'
                : 'translate(-50%, -50%) scale(1)',
              transition: `top ${CHIP_FLIGHT_MS}ms cubic-bezier(0.18,0.9,0.32,1) ${flight.delay}ms, left ${CHIP_FLIGHT_MS}ms cubic-bezier(0.18,0.9,0.32,1) ${flight.delay}ms, transform ${CHIP_FLIGHT_MS}ms cubic-bezier(0.18,0.9,0.32,1) ${flight.delay}ms, opacity 160ms ease ${flight.delay + CHIP_FLIGHT_MS - 120}ms`,
            }}
          >
            <div
              className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(0,0,0,0.72)',
                border: '1px solid rgba(234,179,8,0.35)',
                color: '#fcd34d',
                boxShadow: '0 0 16px rgba(245,158,11,0.28)',
              }}
            >
              +${fmt(flight.amount)}
            </div>
          </div>
        ))}

        {/* Payout chips from pot */}
        {payoutFlights.map((flight) => (
          <div
            key={flight.id}
            className="fixed -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
            style={{
              top: flight.active ? flight.endY : flight.startY,
              left: flight.active ? flight.endX : flight.startX,
              opacity: flight.active ? 0.08 : 1,
              transform: flight.active
                ? 'translate(-50%, -50%) scale(0.84)'
                : 'translate(-50%, -50%) scale(0.7)',
              transition: `top ${CHIP_FLIGHT_MS}ms cubic-bezier(0.16,1,0.3,1) ${flight.delay}ms, left ${CHIP_FLIGHT_MS}ms cubic-bezier(0.16,1,0.3,1) ${flight.delay}ms, transform ${CHIP_FLIGHT_MS}ms cubic-bezier(0.16,1,0.3,1) ${flight.delay}ms, opacity 220ms ease ${flight.delay + CHIP_FLIGHT_MS - 110}ms`,
            }}
          >
            <div
              className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(6,78,59,0.82)',
                border: '1px solid rgba(74,222,128,0.28)',
                color: '#86efac',
                boxShadow: '0 0 18px rgba(74,222,128,0.26)',
              }}
            >
              +${fmt(flight.amount)}
            </div>
          </div>
        ))}

        {/* My cards */}
        <div className="flex flex-col items-center gap-2.5">
          <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(156,163,175,0.5)' }}>Your Hand</span>
          <div className="flex gap-3">
            {myPlayer && myPlayer.cards.length > 0
              ? myPlayer.cards.map((c, i) => <CardDisplay key={i} card={c} large />)
              : [<div key={0} className="w-16 h-[5.5rem] rounded-xl" style={{ background: 'rgba(30,58,95,0.5)', border: '1px solid rgba(96,165,250,0.2)' }} />,
                 <div key={1} className="w-16 h-[5.5rem] rounded-xl" style={{ background: 'rgba(30,58,95,0.5)', border: '1px solid rgba(96,165,250,0.2)' }} />]}
          </div>
          {myPlayer && <span className="text-xs font-semibold" style={{ color: 'rgba(74,222,128,0.8)' }}>Stack $${fmt(myPlayer.stack)}</span>}
        </div>
      </div>

      {/* ── Action bar (fixed bottom) ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-3"
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
            {showFoldWinChoice ? (
              <div className="w-full flex flex-col items-center gap-2">
                <span className="text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ color: 'rgba(251,191,36,0.82)' }}>
                  Show or Muck
                </span>
                <div className="w-full flex gap-2">
                  <Button
                    onClick={handleShowCards}
                    className="flex-1 h-12 font-black text-xs uppercase tracking-wider rounded-xl"
                    style={{ background: 'rgba(20,83,45,0.9)', border: '1px solid rgba(74,222,128,0.45)', color: '#86efac' }}
                  >
                    Show Cards
                  </Button>
                  <Button
                    onClick={handleMuckCards}
                    className="flex-1 h-12 font-black text-xs uppercase tracking-wider rounded-xl"
                    style={{ background: 'rgba(30,27,75,0.9)', border: '1px solid rgba(167,139,250,0.35)', color: '#c4b5fd' }}
                  >
                    Muck
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full h-12 rounded-xl flex items-center justify-center text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(234,179,8,0.15)', color: 'rgba(245,158,11,0.7)' }}>
                {settleSecs > 0 ? `Settling… ${settleSecs}s` : 'Settling…'}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Timer bar — taller for mobile visibility */}
            {isMyTurn && actionSecs > 0 && (
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
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

            {/* Pot-Relative Raise Presets */}
            {isMyTurn && (
              <div className="flex gap-2">
                {/* Min Raise */}
                <button
                  onClick={() => setRaiseAmount(Math.min(minRaise, myPlayer?.stack ?? minRaise))}
                  disabled={!isMyTurn || (myPlayer?.stack ?? 0) < minRaise}
                  className="flex-1 h-10 rounded-lg font-black text-[10px] uppercase tracking-wider disabled:opacity-25"
                  style={{
                    background: 'rgba(20,20,20,0.8)',
                    border: '1px solid rgba(234,179,8,0.25)',
                    color: '#fcd34d',
                  }}
                >
                  <div className="flex flex-col items-center leading-none">
                    <span>{t('room.min', 'Min')}</span>
                    <span className="text-[9px] opacity-60">{Math.min(minRaise, myPlayer?.stack ?? minRaise)}</span>
                  </div>
                </button>
                {/* 1/2 Pot */}
                <button
                  onClick={() => setRaiseAmount(Math.min(Math.floor((table.pot ?? 0) * 0.5), myPlayer?.stack ?? 0))}
                  disabled={!isMyTurn || (table.pot ?? 0) < minRaise}
                  className="flex-1 h-10 rounded-lg font-black text-[10px] uppercase tracking-wider disabled:opacity-25"
                  style={{
                    background: 'rgba(20,20,20,0.8)',
                    border: '1px solid rgba(234,179,8,0.25)',
                    color: '#fcd34d',
                  }}
                >
                  <div className="flex flex-col items-center leading-none">
                    <span>½ Pot</span>
                    <span className="text-[9px] opacity-60">{Math.min(Math.floor((table.pot ?? 0) * 0.5), myPlayer?.stack ?? 0)}</span>
                  </div>
                </button>
                {/* All-in */}
                <button
                  onClick={() => setRaiseAmount(myPlayer?.stack ?? 0)}
                  disabled={!isMyTurn || (myPlayer?.stack ?? 0) <= 0}
                  className="flex-1 h-10 rounded-lg font-black text-[10px] uppercase tracking-wider disabled:opacity-25"
                  style={{
                    background: (myPlayer?.stack ?? 0) > 0 && isMyTurn
                      ? 'rgba(185,28,28,0.7)'
                      : 'rgba(20,20,20,0.8)',
                    border: '1px solid rgba(239,68,68,0.4)',
                    color: (myPlayer?.stack ?? 0) > 0 && isMyTurn ? '#fca5a5' : 'rgba(239,68,68,0.5)',
                  }}
                >
                  <div className="flex flex-col items-center leading-none">
                    <span>{t('room.allIn', 'All-in')}</span>
                    <span className="text-[9px] opacity-80">{myPlayer?.stack ?? 0}</span>
                  </div>
                </button>
              </div>
            )}

            {/* Raise amount — touch-friendly slider + step buttons */}
            {isMyTurn && (
              <div className="flex items-center gap-2">
                {/* Step-down */}
                <button
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black shrink-0 select-none"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,179,8,0.2)', color: '#fcd34d' }}
                  onClick={() => setRaiseAmount(Math.max(minRaise, raiseAmount - (myPlayer?.stack ?? minRaise) / 10))}
                  disabled={raiseAmount <= minRaise}
                >
                  −
                </button>
                {/* Slider — taller for thumb accuracy */}
                <input
                  type="range"
                  className="flex-1 h-3 rounded-full cursor-pointer"
                  style={{ accentColor: '#f59e0b' }}
                  min={minRaise}
                  max={myPlayer?.stack ?? minRaise}
                  value={raiseAmount || minRaise}
                  onChange={(e) => setRaiseAmount(Number(e.target.value))}
                />
                {/* Step-up */}
                <button
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black shrink-0 select-none"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,179,8,0.2)', color: '#fcd34d' }}
                  onClick={() => setRaiseAmount(Math.min(myPlayer?.stack ?? minRaise, raiseAmount + (myPlayer?.stack ?? minRaise) / 10))}
                  disabled={raiseAmount >= (myPlayer?.stack ?? minRaise)}
                >
                  +
                </button>
                {/* Amount display — larger for readability */}
                <div
                  className="w-24 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(234,179,8,0.25)', color: '#fcd34d' }}
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
