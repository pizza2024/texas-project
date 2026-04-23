'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableState, Player } from './types';

interface ActionBarProps {
  table: TableState;
  myUserId: string;
  isWaiting: boolean;
  isReady: boolean;
  isAutoReadyCountdown: boolean;
  readyCountdown: number;
  isSettlement: boolean;
  settlementCountdown: number;
  isActionStage: boolean;
  activeCountdown: number;
  isMyTurn: boolean;
  isUrgentCountdown: boolean;
  actionCountdown: number;
  countdownLabel: string;
  callAmount: number;
  minRaiseTo: number;
  canCheck: boolean;
  showFoldWinChoice: boolean;
  handleAction: (action: string, amount?: number) => void;
  handleReady: () => void;
  raiseAmount: number;
  setRaiseAmount: (v: number) => void;
  handleShowCards: () => void;
  handleMuckCards: () => void;
}

export function ActionBar({
  table,
  myUserId,
  isWaiting,
  isReady,
  isAutoReadyCountdown,
  readyCountdown,
  isSettlement,
  settlementCountdown,
  isActionStage,
  activeCountdown,
  isMyTurn,
  isUrgentCountdown,
  actionCountdown,
  countdownLabel,
  callAmount,
  minRaiseTo,
  canCheck,
  showFoldWinChoice,
  handleAction,
  handleReady,
  raiseAmount,
  setRaiseAmount,
  handleShowCards,
  handleMuckCards,
}: ActionBarProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed bottom-0 left-0 w-full px-6 py-4 flex justify-center gap-3 items-center z-20"
      style={{
        background: 'linear-gradient(180deg, rgba(2,4,6,0) 0%, rgba(2,4,6,0.96) 40%, rgba(2,4,6,1) 100%)',
        borderTop: '1px solid rgba(234,179,8,0.1)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {isWaiting ? (
        <Button
          onClick={handleReady}
          className="h-11 px-10 font-black tracking-[0.2em] text-sm uppercase rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={isReady ? {
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.6)',
          } : {
            background: 'linear-gradient(135deg, #166534 0%, #16a34a 60%, #4ade80 100%)',
            color: '#000',
            border: 'none',
            boxShadow: '0 0 20px rgba(74,222,128,0.25)',
          }}
        >
          {isAutoReadyCountdown
            ? isReady
              ? t('room.readyCancelCountdown', { seconds: readyCountdown })
              : t('room.readyCancelled')
            : isReady
              ? t('room.readyCancel')
              : t('room.ready')}
        </Button>
      ) : isSettlement ? (
        showFoldWinChoice ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(251,191,36,0.85)' }}>
              {t('room.showOrMuck')}
            </span>
            <div className="flex gap-3">
              <Button
                className="h-9 px-5 text-xs font-bold tracking-widest uppercase rounded-xl transition-colors"
                style={{ background: 'rgba(20,83,45,0.88)', border: '1px solid rgba(74,222,128,0.45)', color: '#86efac' }}
                onClick={handleShowCards}
              >
                {t('room.showCards')}
              </Button>
              <Button
                className="h-9 px-5 text-xs font-bold tracking-widest uppercase rounded-xl transition-colors"
                style={{ background: 'rgba(30,27,75,0.88)', border: '1px solid rgba(167,139,250,0.35)', color: '#c4b5fd' }}
                onClick={handleMuckCards}
              >
                {t('room.muck')}
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="h-11 px-6 rounded-xl flex items-center justify-center text-sm font-bold tracking-[0.15em] uppercase"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(234,179,8,0.15)',
              color: 'rgba(245,158,11,0.82)',
            }}
          >
            {t('room.settlementCountdown', { seconds: settlementCountdown })}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div
            className={`px-4 py-2 rounded-full text-[11px] font-bold tracking-[0.12em] uppercase ${
              isMyTurn && isUrgentCountdown ? 'action-timeout-banner action-timeout-banner-urgent' : 'action-timeout-banner'
            }`}
            style={{
              background: isMyTurn
                ? isUrgentCountdown
                  ? 'rgba(127,29,29,0.88)'
                  : 'rgba(30,41,59,0.9)'
                : 'rgba(255,255,255,0.05)',
              border: isMyTurn
                ? isUrgentCountdown
                  ? '1px solid rgba(248,113,113,0.45)'
                  : '1px solid rgba(96,165,250,0.28)'
                : '1px solid rgba(255,255,255,0.08)',
              color: isMyTurn
                ? isUrgentCountdown
                  ? '#fee2e2'
                  : '#dbeafe'
                : 'rgba(156,163,175,0.82)',
              boxShadow: isMyTurn && isUrgentCountdown ? '0 0 20px rgba(248,113,113,0.18)' : 'none',
            }}
          >
            {isMyTurn
              ? t('room.autoActionLabel', { seconds: actionCountdown, action: canCheck ? t('room.autoCheck') : t('room.autoFold') })
              : `等待 ${table.players[table.activePlayerIndex]?.nickname ?? '操作'}${actionCountdown > 0 ? ` · ${actionCountdown}s` : ''}`}
          </div>

          <div className="flex justify-center gap-3 items-center flex-wrap">
            {/* Straddle — only on UTG preflop, before any straddle */}
            {isMyTurn && table.currentStage === 'PREFLOP' && !table.straddle && (
              <Button
                onClick={() => handleAction('straddle')}
                className="h-11 px-5 font-black tracking-wider text-xs uppercase rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-30"
                style={{
                  background: 'linear-gradient(135deg, #854d0e 0%, #a16207 30%, #ca8a04 65%, #facc15 100%)',
                  color: '#000',
                  border: 'none',
                  boxShadow: '0 0 20px rgba(250,204,21,0.3)',
                }}
              >
                {t('room.straddle')}
              </Button>
            )}

            <Button
              onClick={() => handleAction('fold')}
              disabled={!isMyTurn}
              className={`h-11 px-5 font-black tracking-wider text-xs uppercase rounded-lg transition-opacity disabled:opacity-30 ${
                !canCheck && isMyTurn && isUrgentCountdown ? 'action-auto-button action-auto-button-urgent' : ''
              }`}
              style={{
                background: isMyTurn ? 'rgba(185,28,28,0.7)' : 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: isMyTurn ? '#fca5a5' : 'rgba(255,255,255,0.3)',
                boxShadow: !canCheck && isMyTurn && isUrgentCountdown
                  ? '0 0 18px rgba(239,68,68,0.24)'
                  : 'none',
              }}
            >
              {!canCheck && isMyTurn ? t('room.foldCountdown', { seconds: actionCountdown }) : t('room.fold')}
            </Button>

            {canCheck ? (
              <Button
                onClick={() => handleAction('check')}
                disabled={!isMyTurn}
                className={`h-11 px-5 font-black tracking-wider text-xs uppercase rounded-lg transition-opacity disabled:opacity-30 ${
                  isMyTurn && isUrgentCountdown ? 'action-auto-button action-auto-button-urgent' : ''
                }`}
                style={{
                  background: isMyTurn ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(96,165,250,0.3)',
                  color: isMyTurn ? 'rgba(147,197,253,0.9)' : 'rgba(255,255,255,0.3)',
                  boxShadow: isMyTurn && isUrgentCountdown
                    ? '0 0 18px rgba(59,130,246,0.26)'
                    : 'none',
                }}
              >
                {isMyTurn ? t('room.checkCountdown', { seconds: actionCountdown }) : t('room.check')}
              </Button>
            ) : (
              <Button
                onClick={() => handleAction('call')}
                disabled={!isMyTurn}
                className="h-11 px-5 font-black tracking-wider text-xs uppercase rounded-lg transition-opacity disabled:opacity-30"
                style={{
                  background: isMyTurn ? 'rgba(37,99,235,0.5)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(96,165,250,0.4)',
                  color: isMyTurn ? '#93c5fd' : 'rgba(255,255,255,0.3)',
                  boxShadow: isMyTurn ? '0 0 16px rgba(59,130,246,0.2)' : 'none',
                }}
              >
                {t('room.call', { amount: callAmount })}
              </Button>
            )}

            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="h-11 w-24 text-center font-bold rounded-lg border-0 text-white"
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(234,179,8,0.25)',
                  color: isMyTurn ? '#fcd34d' : 'rgba(255,255,255,0.3)',
                }}
                value={raiseAmount || minRaiseTo}
                min={minRaiseTo}
                onChange={(e) => setRaiseAmount(Number(e.target.value))}
                disabled={!isMyTurn}
              />
              <Button
                onClick={() => handleAction('raise', raiseAmount || minRaiseTo)}
                disabled={!isMyTurn}
                className="h-11 px-5 font-black tracking-wider text-xs uppercase rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-30"
                style={isMyTurn ? {
                  background: 'linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)',
                  color: '#000',
                  border: 'none',
                  boxShadow: '0 0 20px rgba(245,158,11,0.25)',
                } : {
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.3)',
                }}
              >
                {t('room.raise')}
              </Button>
            </div>

            {/* Sit-Out — available whenever it's your turn */}
            {isMyTurn && (
              <Button
                onClick={() => handleAction('sit-out')}
                className="h-11 px-4 font-black tracking-wider text-xs uppercase rounded-lg transition-opacity disabled:opacity-30"
                style={{
                  background: 'rgba(75,75,75,0.6)',
                  border: '1px solid rgba(156,163,175,0.25)',
                  color: 'rgba(156,163,175,0.9)',
                }}
              >
                {t('room.sitOut')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
