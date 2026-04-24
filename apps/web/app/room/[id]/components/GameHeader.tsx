'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { TableState, Player } from './types';

interface GameHeaderProps {
  table: TableState;
  myUserId: string;
  activeCountdown: number;
  isSettlement: boolean;
  isAutoReadyCountdown: boolean;
  isWaiting: boolean;
  settlementCountdown: number;
  readyCountdown: number;
  actionCountdown: number;
  isActionStage: boolean;
  isMyTurn: boolean;
  isUrgentCountdown: boolean;
  countdownLabel: string;
  seatedPlayers: Player[];
  readyCount: number;
  handleBackToLobby: () => void;
}

export function GameHeader({
  table,
  activeCountdown,
  isSettlement,
  isAutoReadyCountdown,
  isWaiting,
  settlementCountdown,
  readyCountdown,
  actionCountdown,
  isActionStage,
  isMyTurn,
  isUrgentCountdown,
  countdownLabel,
  seatedPlayers,
  readyCount,
  handleBackToLobby,
}: GameHeaderProps) {
  const { t } = useTranslation();
  const activePlayer = table.activePlayerIndex >= 0 ? table.players[table.activePlayerIndex] : null;

  return (
    <div
      className="relative z-10 flex items-center justify-between px-5 py-3"
      style={{ borderBottom: '1px solid rgba(234,179,8,0.1)', background: 'rgba(2,4,6,0.6)', backdropFilter: 'blur(8px)' }}
    >
      <Button
        className="h-8 px-4 text-xs font-bold tracking-widest uppercase rounded-lg transition-colors hover:bg-yellow-900/20"
        style={{ background: 'transparent', border: '1px solid rgba(234,179,8,0.25)', color: 'rgba(245,158,11,0.7)' }}
        onClick={handleBackToLobby}
      >
        ← Rooms
      </Button>

      <div className="text-center">
        {isSettlement ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] tracking-[0.26em] uppercase font-semibold" style={{ color: 'rgba(251,191,36,0.78)' }}>
              {t('room.settling')}
            </span>
            <span
              className={isUrgentCountdown ? 'countdown-badge countdown-badge-urgent' : 'countdown-badge'}
              style={{
                color: isUrgentCountdown ? '#fee2e2' : '#fef3c7',
                borderColor: isUrgentCountdown ? 'rgba(248,113,113,0.5)' : 'rgba(251,191,36,0.35)',
                background: isUrgentCountdown
                  ? 'radial-gradient(circle at 50% 50%, rgba(127,29,29,0.95) 0%, rgba(69,10,10,0.95) 100%)'
                  : 'radial-gradient(circle at 50% 50%, rgba(120,53,15,0.92) 0%, rgba(68,32,10,0.95) 100%)',
                boxShadow: isUrgentCountdown
                  ? '0 0 24px rgba(248,113,113,0.35)'
                  : '0 0 20px rgba(251,191,36,0.2)',
              }}
            >
              {settlementCountdown}s
            </span>
          </div>
        ) : isAutoReadyCountdown ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] tracking-[0.26em] uppercase font-semibold" style={{ color: 'rgba(74,222,128,0.82)' }}>
              {t('room.autoStartCountdown')}
            </span>
            <span
              className={isUrgentCountdown ? 'countdown-badge countdown-badge-urgent' : 'countdown-badge'}
              style={{
                color: isUrgentCountdown ? '#ecfccb' : '#dcfce7',
                borderColor: isUrgentCountdown ? 'rgba(250,204,21,0.45)' : 'rgba(74,222,128,0.35)',
                background: isUrgentCountdown
                  ? 'radial-gradient(circle at 50% 50%, rgba(132,204,22,0.28) 0%, rgba(63,98,18,0.92) 100%)'
                  : 'radial-gradient(circle at 50% 50%, rgba(22,101,52,0.95) 0%, rgba(6,78,59,0.95) 100%)',
                boxShadow: isUrgentCountdown
                  ? '0 0 26px rgba(250,204,21,0.28)'
                  : '0 0 18px rgba(74,222,128,0.18)',
              }}
            >
              {readyCountdown}s
            </span>
          </div>
        ) : isWaiting ? (
          <span className="text-xs tracking-[0.2em] uppercase" style={{ color: 'rgba(245,158,11,0.6)' }}>
            {t('room.waitingReady', { ready: readyCount, total: seatedPlayers.length })}
          </span>
        ) : activePlayer ? (
          <div className="flex flex-col items-center gap-1">
            {/* P-UX-3: Stage indicator — FLOP / TURN / RIVER label */}
            {isActionStage && table.currentStage !== 'PREFLOP' && (
              <span
                className="text-[9px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(234,179,8,0.12)',
                  border: '1px solid rgba(234,179,8,0.3)',
                  color: 'rgba(251,191,36,0.85)',
                }}
              >
                {table.currentStage === 'FLOP' ? '🌱 FLOP' : table.currentStage === 'TURN' ? '🔄 TURN' : table.currentStage === 'RIVER' ? '🎴 RIVER' : table.currentStage}
              </span>
            )}
            <span
              className="text-xs font-semibold tracking-wider"
              style={{ color: isMyTurn ? '#fcd34d' : 'rgba(156,163,175,0.8)' }}
            >
              {isMyTurn ? t('room.yourTurn') : t('room.waitingPlayer', { nickname: activePlayer.nickname })}
            </span>
            {actionCountdown > 0 && (
              <span
                className={isUrgentCountdown ? 'countdown-badge countdown-badge-urgent' : 'countdown-badge'}
                style={{
                  minWidth: '74px',
                  height: '30px',
                  fontSize: '15px',
                  color: isMyTurn ? '#fef3c7' : 'rgba(219,234,254,0.95)',
                  borderColor: isUrgentCountdown ? 'rgba(248,113,113,0.5)' : 'rgba(96,165,250,0.35)',
                  background: isUrgentCountdown
                    ? 'radial-gradient(circle at 50% 50%, rgba(127,29,29,0.95) 0%, rgba(69,10,10,0.95) 100%)'
                    : 'radial-gradient(circle at 50% 50%, rgba(30,64,175,0.95) 0%, rgba(15,23,42,0.95) 100%)',
                  boxShadow: isUrgentCountdown
                    ? '0 0 24px rgba(248,113,113,0.3)'
                    : '0 0 20px rgba(59,130,246,0.22)',
                }}
              >
                {actionCountdown}s
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(107,114,128,0.6)' }}>
            {table.currentStage}
          </span>
        )}
      </div>

      <div className="text-right text-xs" style={{ color: 'rgba(107,114,128,0.5)', minWidth: '60px' }}>
        <span className={`tracking-widest uppercase ${activeCountdown > 0 ? 'countdown-text-glow' : ''}`}>
          {activeCountdown > 0 ? `${countdownLabel} ${activeCountdown}s` : table.currentStage}
        </span>
      </div>
    </div>
  );
}
