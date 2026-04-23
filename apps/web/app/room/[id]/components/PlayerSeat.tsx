'use client';

import { useTranslation } from 'react-i18next';
import { Player, getSeatPosition, TABLE_SEAT_COUNT, CHIP_FLIGHT_MS, CHIP_FLIGHT_STAGGER_MS } from './types';
import { CardDisplay } from './CardDisplay';
import { UserAvatar } from '@/components/user-avatar';

interface PlayerSeatProps {
  player: Player;
  seatIndex: number;
  myUserId: string;
  isActive: boolean;
  isActionStage: boolean;
  actionCountdown: number;
  isUrgentCountdown: boolean;
  isWaiting: boolean;
  isSettlement: boolean;
  winnerBestCardsMap: Map<string, Set<string>>;
  winnerHighlightPlayerIds: Set<string>;
  loserHighlightPlayerIds: Set<string>;
  table: import('./types').TableState;
  getDealAnimationStyle: (slotKey: string) => React.CSSProperties | undefined;
}

export function PlayerSeat({
  player,
  seatIndex,
  myUserId,
  isActive,
  isActionStage,
  actionCountdown,
  isUrgentCountdown,
  isWaiting,
  isSettlement,
  winnerBestCardsMap,
  winnerHighlightPlayerIds,
  loserHighlightPlayerIds,
  table,
  getDealAnimationStyle,
}: PlayerSeatProps) {
  const { t } = useTranslation();
  const { top, left } = getSeatPosition(seatIndex);
  const isMe = player.id === myUserId;
  const isFolded = player.status === 'FOLD';
  const isWinnerHighlighted = winnerHighlightPlayerIds.has(player.id);
  const isLoserHighlighted = loserHighlightPlayerIds.has(player.id);

  return (
    <div
      key={seatIndex}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
      style={{ top: `${top}%`, left: `${left}%` }}
    >
      {/* Current user indicator */}
      {isMe && (
        <div
          className="mb-1 px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest uppercase"
          style={{
            background: 'rgba(14,165,233,0.18)',
            border: '1px solid rgba(125,211,252,0.55)',
            color: 'rgba(186,230,253,0.95)',
          }}
        >
          {t('room.youLabel')}
        </div>
      )}

      {/* Hole cards above avatar */}
      {player.cards.length > 0 && (
        <div className="flex gap-1 mb-1">
          {player.cards.map((c, ci) => (
            <div key={ci} style={getDealAnimationStyle(`player-${seatIndex}-card-${ci}`)}>
              <CardDisplay card={c} highlight={winnerBestCardsMap.get(player.id)?.has(c)} />
            </div>
          ))}
        </div>
      )}

      {/* Avatar circle */}
      <div
        className={`relative transition-all duration-300 ${isWinnerHighlighted ? 'winner-avatar-highlight' : ''} ${isLoserHighlighted ? 'loser-avatar-dim' : ''}`}
        style={{
          opacity: isFolded ? 0.45 : isLoserHighlighted ? 0.62 : 1,
          transform: isWinnerHighlighted
            ? 'scale(1.08)'
            : isLoserHighlighted
              ? 'translateY(8px) scale(0.97)'
              : 'scale(1)',
        }}
      >
        {/* Inner clip container for avatar + cards only */}
        <div className="overflow-hidden rounded-full">
          <UserAvatar
            userId={player.id}
            avatar={player.avatar}
            size={68}
            style={{
              background: isFolded
                ? 'rgba(0,0,0,0.5)'
                : isMe
                  ? 'linear-gradient(160deg, rgba(20,40,28,0.95) 0%, rgba(8,20,12,0.98) 100%)'
                  : 'linear-gradient(160deg, rgba(12,22,16,0.95) 0%, rgba(6,12,9,0.98) 100%)',
              border: isActive
                ? '2px solid rgba(250,204,21,0.9)'
                : isWinnerHighlighted
                  ? '2px solid rgba(250,204,21,0.85)'
                : isMe
                  ? '2px solid rgba(125,211,252,0.8)'
                  : '2px solid rgba(255,255,255,0.1)',
              boxShadow: isActive
                ? '0 0 16px rgba(250,204,21,0.5), 0 0 32px rgba(250,204,21,0.2)'
                : isWinnerHighlighted
                  ? '0 0 20px rgba(250,204,21,0.35), 0 0 36px rgba(74,222,128,0.14)'
                : isLoserHighlighted
                  ? '0 2px 8px rgba(0,0,0,0.45)'
                : isMe
                  ? '0 0 0 3px rgba(56,189,248,0.12), 0 0 18px rgba(56,189,248,0.45), 0 4px 16px rgba(0,0,0,0.5)'
                  : '0 4px 12px rgba(0,0,0,0.5)',
            }}
          />
          {/* Nickname overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 rounded-b-full bg-black/55 px-0.5 py-0.5 text-center pointer-events-none">
            <div className="text-[9px] font-bold truncate" style={{ color: isMe ? '#fcd34d' : 'rgba(255,255,255,0.9)' }}>
              {player.nickname}
            </div>
          </div>
          {/* Stack chip top-right */}
          <div className="absolute top-0.5 right-0.5 text-[8px] font-semibold leading-none" style={{ color: 'rgba(74,222,128,0.9)' }}>
            ${player.stack}
          </div>
          {isWaiting && (
            <div className={`absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[7px] font-bold tracking-wider whitespace-nowrap ${player.ready ? 'text-green-400' : 'text-gray-500'}`}>
              {player.ready ? t('room.readyTag') : t('room.standby')}
            </div>
          )}
          {isActionStage && isActive && actionCountdown > 0 && (
            <div
              className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 h-5 rounded-full flex items-center justify-center text-[9px] font-black tracking-[0.12em] ${
                isUrgentCountdown ? 'seat-action-countdown seat-action-countdown-urgent' : 'seat-action-countdown'
              }`}
              style={{
                background: isUrgentCountdown ? 'rgba(127,29,29,0.95)' : 'rgba(30,41,59,0.92)',
                border: isUrgentCountdown
                  ? '1px solid rgba(248,113,113,0.5)'
                  : '1px solid rgba(96,165,250,0.35)',
                color: isUrgentCountdown ? '#fee2e2' : '#dbeafe',
                boxShadow: isUrgentCountdown
                  ? '0 0 16px rgba(248,113,113,0.25)'
                  : '0 0 14px rgba(59,130,246,0.18)',
              }}
            >
              {actionCountdown}s
            </div>
          )}
        </div>

        {/* Position badges */}
        <div className="absolute -top-1.5 -right-1 flex gap-0.5">
          {isWinnerHighlighted && (
            <span
              className="text-[8px] font-black px-1.5 rounded-full leading-4"
              style={{
                background: 'linear-gradient(135deg, #facc15 0%, #f59e0b 100%)',
                color: '#000',
                boxShadow: '0 0 12px rgba(250,204,21,0.25)',
              }}
            >
              WIN
            </span>
          )}
          {player.isButton && (
            <span
              className="text-[8px] font-black px-1.5 rounded-full leading-4"
              style={{ background: '#fcd34d', color: '#000' }}
            >D</span>
          )}
          {player.isSmallBlind && (
            <span
              className="text-[8px] font-black px-1 rounded-full leading-4"
              style={{ background: '#3b82f6', color: '#fff' }}
            >SB</span>
          )}
          {player.isBigBlind && (
            <span
              className="text-[9px] font-black px-1.5 rounded-full leading-4"
              style={{ background: '#ef4444', color: '#fff' }}
            >BB</span>
          )}
        </div>
      </div>

      {/* Bet chip */}
      {player.bet > 0 && (
        <div
          className="mt-1 text-[9px] font-black px-2 py-0.5 rounded-full"
          style={{
            background: 'linear-gradient(135deg, #92400e, #d97706)',
            color: '#000',
            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
          }}
        >
          ${player.bet}
        </div>
      )}
    </div>
  );
}
