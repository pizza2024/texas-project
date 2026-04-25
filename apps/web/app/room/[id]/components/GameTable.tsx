'use client';

import { useTranslation } from 'react-i18next';
import { TableState, ChipFlight, PayoutFlight, CHIP_FLIGHT_MS } from './types';
import { CardDisplay } from './CardDisplay';
import { PlayerSeat } from './PlayerSeat';

interface GameTableProps {
  table: TableState;
  myUserId: string;
  chipFlights: ChipFlight[];
  payoutFlights: PayoutFlight[];
  winnerHighlights: string[];
  loserHighlights: string[];
  winnerBestCardsMap: Map<string, Set<string>>;
  highlightedCommunityCardsSet: Set<string>;
  getDealAnimationStyle: (slotKey: string) => React.CSSProperties | undefined;
  isWaiting: boolean;
  isActionStage: boolean;
  isUrgentCountdown: boolean;
  actionCountdown: number;
}

export function GameTable({
  table,
  myUserId,
  chipFlights,
  payoutFlights,
  winnerHighlights,
  loserHighlights,
  winnerBestCardsMap,
  highlightedCommunityCardsSet,
  getDealAnimationStyle,
  isActionStage,
  isWaiting,
  isUrgentCountdown,
  actionCountdown,
}: GameTableProps) {
  const { t } = useTranslation();
  const winnerHighlightPlayerIds = new Set(winnerHighlights);
  const loserHighlightPlayerIds = new Set(loserHighlights);

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4">
      <div
        className="rounded-[50%] border-[10px] aspect-[2/1] relative shadow-2xl"
        style={{
          background: 'radial-gradient(ellipse at 50% 45%, #0f5a28 0%, #083d19 50%, #041f0d 100%)',
          borderColor: '#78350f',
          boxShadow: '0 0 0 2px rgba(234,179,8,0.2), 0 0 80px rgba(0,0,0,0.9), inset 0 0 100px rgba(0,0,0,0.3)',
        }}
      >
        {/* Table inner gold ring */}
        <div
          className="absolute inset-3 rounded-[50%] pointer-events-none"
          style={{ border: '1px solid rgba(234,179,8,0.12)' }}
        />

        {/* Community cards */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <div
            className="absolute right-[calc(100%+18px)] top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          >
            <div className="relative w-10 h-14">
              <div className="absolute inset-0 rounded-lg bg-slate-950/80 border border-yellow-900/40" />
              <div className="absolute inset-[2px] rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 border border-blue-400/20" />
              <div className="absolute inset-[4px] rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#0f2540] flex items-center justify-center text-blue-200/50 font-black text-lg">
                ♦
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {table.communityCards.length > 0
              ? table.communityCards.map((card, i) => (
                  <div key={i} style={getDealAnimationStyle(`community-${i}`)}>
                    <CardDisplay card={card} large highlight={highlightedCommunityCardsSet.has(card)} />
                  </div>
                ))
              : <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.15)' }}>{t('room.waitingForDeal')}</span>
            }
          </div>
        </div>

        {/* Pot */}
        <div className="absolute top-[36%] left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            className="px-4 py-1 rounded-full text-sm font-black tracking-wider"
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(234,179,8,0.3)',
              color: '#fcd34d',
              boxShadow: '0 0 12px rgba(234,179,8,0.1)',
            }}
          >
            💰 ${table.pot}
          </div>
        </div>

        {/* Flying chips */}
        {chipFlights.map((flight) => (
          <div
            key={flight.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
            style={{
              top: flight.active ? '36%' : `${flight.top}%`,
              left: flight.active ? '50%' : `${flight.left}%`,
              opacity: flight.active ? 0 : 1,
              transform: flight.active
                ? 'translate(-50%, -50%) scale(0.72)'
                : 'translate(-50%, -50%) scale(1)',
              transition: `top ${CHIP_FLIGHT_MS}ms cubic-bezier(0.18, 0.9, 0.32, 1) ${flight.delay}ms, left ${CHIP_FLIGHT_MS}ms cubic-bezier(0.18, 0.9, 0.32, 1) ${flight.delay}ms, transform ${CHIP_FLIGHT_MS}ms cubic-bezier(0.18, 0.9, 0.32, 1) ${flight.delay}ms, opacity 180ms ease ${flight.delay + CHIP_FLIGHT_MS - 120}ms`,
              willChange: 'top, left, transform, opacity',
            }}
          >
            <div className="relative flex items-center justify-center">
              <div
                className="absolute w-7 h-7 rounded-full"
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #fef3c7 0%, #f59e0b 45%, #92400e 100%)',
                  boxShadow: '0 0 18px rgba(245,158,11,0.35), 0 4px 10px rgba(0,0,0,0.45)',
                  border: '2px solid rgba(120,53,15,0.85)',
                }}
              />
              <span
                className="relative z-10 text-[9px] font-black px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(0,0,0,0.72)',
                  border: '1px solid rgba(234,179,8,0.3)',
                  color: '#fcd34d',
                  transform: 'translateY(18px)',
                  whiteSpace: 'nowrap',
                }}
              >
                +${flight.amount}
              </span>
            </div>
          </div>
        ))}

        {/* Payout chips */}
        {payoutFlights.map((flight) => (
          <div
            key={flight.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
            style={{
              top: flight.active ? `${flight.top}%` : '36%',
              left: flight.active ? `${flight.left}%` : '50%',
              opacity: flight.active ? 0.08 : 1,
              transform: flight.active
                ? 'translate(-50%, -50%) scale(0.88)'
                : 'translate(-50%, -50%) scale(0.74)',
              transition: `top ${CHIP_FLIGHT_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${flight.delay}ms, left ${CHIP_FLIGHT_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${flight.delay}ms, transform ${CHIP_FLIGHT_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${flight.delay}ms, opacity 220ms ease ${flight.delay + CHIP_FLIGHT_MS - 120}ms`,
              willChange: 'top, left, transform, opacity',
            }}
          >
            <div className="relative flex items-center justify-center">
              <div
                className="absolute w-8 h-8 rounded-full"
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #fde68a 0%, #f59e0b 42%, #854d0e 100%)',
                  boxShadow: '0 0 22px rgba(251,191,36,0.4), 0 4px 12px rgba(0,0,0,0.5)',
                  border: '2px solid rgba(120,53,15,0.9)',
                }}
              />
              <span
                className="relative z-10 text-[9px] font-black px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(6,78,59,0.8)',
                  border: '1px solid rgba(74,222,128,0.25)',
                  color: '#86efac',
                  transform: 'translateY(19px)',
                  whiteSpace: 'nowrap',
                }}
              >
                +${flight.amount}
              </span>
            </div>
          </div>
        ))}

        {/* Players */}
        {table.players.map((player, i) => {
          if (!player) return null;
          return (
            <PlayerSeat
              key={i}
              player={player}
              seatIndex={i}
              myUserId={myUserId}
              isActive={table.activePlayerIndex === i}
              isActionStage={isActionStage}
              actionCountdown={actionCountdown}
              isUrgentCountdown={isUrgentCountdown}
              isWaiting={isWaiting}
              winnerBestCardsMap={winnerBestCardsMap}
              winnerHighlightPlayerIds={winnerHighlightPlayerIds}
              loserHighlightPlayerIds={loserHighlightPlayerIds}
              table={table}
              getDealAnimationStyle={getDealAnimationStyle}
            />
          );
        })}
      </div>
    </div>
  );
}
