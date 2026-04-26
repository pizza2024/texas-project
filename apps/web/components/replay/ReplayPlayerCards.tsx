'use client';

import type { ReplayPlayer } from './ReplayModal';

interface ReplayPlayerCardsProps {
  players: ReplayPlayer[];
  currentPlayerId: string | null;
  winnerId: string | null;
  showdown: boolean;
}

function CardBack() {
  return (
    <span
      className="inline-flex items-center justify-center rounded font-bold"
      style={{
        width: 40,
        height: 56,
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
        border: '2px solid rgba(245,158,11,0.3)',
      }}
    >
      <span style={{ fontSize: 18, color: 'rgba(245,158,11,0.5)' }}>🎴</span>
    </span>
  );
}

const SUIT_SYMBOLS: Record<string, string> = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

function CardFace({ card }: { card: string }) {
  if (!card || card === '??') return <CardBack />;
  const rank = card.slice(0, -1);
  const suitKey = card.slice(-1);
  const isRed = suitKey === 'h' || suitKey === 'd';
  const suitSymbol = SUIT_SYMBOLS[suitKey] ?? suitKey;
  return (
    <span
      className="inline-flex flex-col items-center justify-center rounded font-black"
      style={{
        width: 40,
        height: 56,
        background: 'white',
        color: isRed ? '#dc2626' : '#1e293b',
        fontSize: 16,
        border: '2px solid rgba(0,0,0,0.15)',
      }}
    >
      {rank}
      <span style={{ fontSize: 14 }}>{suitSymbol}</span>
    </span>
  );
}

export function ReplayPlayerCards({ players, currentPlayerId, winnerId, showdown }: ReplayPlayerCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {players.map((player) => {
        const isWinner = winnerId === player.id;
        const isCurrent = player.id === currentPlayerId;
        const revealed = showdown || isWinner;

        return (
          <div
            key={player.id}
            className="rounded-xl p-3 flex flex-col gap-2"
            style={{
              border: isCurrent
                ? '2px solid rgba(245,158,11,0.6)'
                : isWinner
                ? '2px solid rgba(74,222,128,0.5)'
                : '1px solid rgba(255,255,255,0.08)',
              background: isWinner
                ? 'rgba(74,222,128,0.08)'
                : isCurrent
                ? 'rgba(245,158,11,0.06)'
                : 'rgba(0,0,0,0.3)',
            }}
          >
            {/* Player info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-medium truncate max-w-24"
                  style={{ color: isWinner ? '#4ade80' : 'rgba(255,255,255,0.85)' }}
                >
                  {player.nickname}
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
            </div>

            {/* Cards */}
            <div className="flex gap-1">
              {player.holeCards.length === 0 ? (
                <>
                  <CardBack />
                  <CardBack />
                </>
              ) : (
                player.holeCards.map((card, i) => (
                  <div
                    key={i}
                    className="transition-all duration-300"
                    style={{
                      opacity: revealed ? 1 : 0,
                      transform: revealed ? 'scale(1) rotateY(0deg)' : 'scale(0.8) rotateY(90deg)',
                    }}
                  >
                    <CardFace card={revealed ? card : '??'} />
                  </div>
                ))
              )}
            </div>

            {/* Hand name */}
            {revealed && player.handName && (
              <div className="text-xs font-medium" style={{ color: 'rgba(245,158,11,0.7)' }}>
                {player.handName}
              </div>
            )}

            {/* Net profit */}
            <div className="text-right">
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: player.netProfit >= 0 ? '#4ade80' : '#f87171' }}
              >
                {player.netProfit >= 0 ? '+' : ''}{player.netProfit.toFixed(2)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
