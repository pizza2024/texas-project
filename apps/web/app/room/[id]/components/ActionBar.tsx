'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ALLOWED_EMOJIS, type AllowedEmoji } from '@/lib/use-game-socket';
import { TableState } from './types';

interface ActionBarProps {
  table: TableState;
  isWaiting: boolean;
  isReady: boolean;
  isAutoReadyCountdown: boolean;
  readyCountdown: number;
  isSettlement: boolean;
  settlementCountdown: number;
  isMyTurn: boolean;
  isUrgentCountdown: boolean;
  actionCountdown: number;
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
  myPlayerStack: number;
  /** Consecutive timeouts for Sit-Out Option C (0-3) */
  consecutiveTimeouts?: number;
  /** Called when player clicks All-in; page shows confirmation modal */
  onRequestAllIn?: (allInAmount: number) => void;
  /** Called when player selects an emoji to react with */
  onEmoji?: (emoji: AllowedEmoji) => void;
  /** Whether the emoji picker is open */
  emojiPickerOpen?: boolean;
  /** Toggles emoji picker visibility */
  onToggleEmojiPicker?: () => void;
}

export function ActionBar({
  table,
  isWaiting,
  isReady,
  isAutoReadyCountdown,
  readyCountdown,
  isSettlement,
  settlementCountdown,
  isMyTurn,
  isUrgentCountdown,
  actionCountdown,
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
  myPlayerStack,
  consecutiveTimeouts = 0,
  onRequestAllIn,
  onEmoji,
  emojiPickerOpen = false,
  onToggleEmojiPicker,
}: ActionBarProps) {
  const { t } = useTranslation();
  const pot = table.pot ?? 0;
  const effectiveMinRaiseTo = Math.min(minRaiseTo, myPlayerStack);
  const halfPot = Math.min(Math.floor(pot * 0.5), myPlayerStack);
  const threeQuartersPot = Math.min(Math.floor(pot * 0.75), myPlayerStack);

  // Pot Odds — P-UX-1: displayed next to Call button (竞品标配)
  const potOddsPercent = canCheck ? null : callAmount > 0
    ? Math.round((callAmount / (pot + callAmount)) * 100)
    : null;

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
              <div className="flex flex-col items-center gap-1">
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
                {t('room.call', { amount: callAmount })}</Button>
              {potOddsPercent !== null && isMyTurn && (
                <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: 'rgba(96,165,250,0.7)' }}>
                  Odds {potOddsPercent}%
                </span>
              )}
              </div>
            )}

            {/* Pot-Relative Raise Presets — only on player's turn during action */}
            {isMyTurn && (
              <div className="flex items-center gap-1">
                {/* Min Raise */}
                <Button
                  onClick={() => {
                    setRaiseAmount(effectiveMinRaiseTo);
                    handleAction('raise', effectiveMinRaiseTo);
                  }}
                  disabled={!isMyTurn || effectiveMinRaiseTo > myPlayerStack || effectiveMinRaiseTo < minRaiseTo}
                  className="h-11 px-3 font-black tracking-wider text-[10px] uppercase rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-25"
                  style={{
                    background: 'rgba(20,20,20,0.8)',
                    border: '1px solid rgba(234,179,8,0.25)',
                    color: '#fcd34d',
                  }}
                >
                  <div className="flex flex-col items-center leading-none">
                    <span>{t('room.min')}</span>
                    <span className="text-[9px] opacity-60">{effectiveMinRaiseTo}</span>
                  </div>
                </Button>

                {/* 1/2 Pot */}
                <Button
                  onClick={() => {
                    setRaiseAmount(halfPot);
                    handleAction('raise', halfPot);
                  }}
                  disabled={!isMyTurn || halfPot < minRaiseTo}
                  className="h-11 px-3 font-black tracking-wider text-[10px] uppercase rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-25"
                  style={{
                    background: 'rgba(20,20,20,0.8)',
                    border: '1px solid rgba(234,179,8,0.25)',
                    color: '#fcd34d',
                  }}
                >
                  <div className="flex flex-col items-center leading-none">
                    <span>½ Pot</span>
                    <span className="text-[9px] opacity-60">{halfPot}</span>
                  </div>
                </Button>

                {/* 3/4 Pot */}
                <Button
                  onClick={() => {
                    setRaiseAmount(threeQuartersPot);
                    handleAction('raise', threeQuartersPot);
                  }}
                  disabled={!isMyTurn || threeQuartersPot < minRaiseTo}
                  className="h-11 px-3 font-black tracking-wider text-[10px] uppercase rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-25"
                  style={{
                    background: 'rgba(20,20,20,0.8)',
                    border: '1px solid rgba(234,179,8,0.25)',
                    color: '#fcd34d',
                  }}
                >
                  <div className="flex flex-col items-center leading-none">
                    <span>¾ Pot</span>
                    <span className="text-[9px] opacity-60">{threeQuartersPot}</span>
                  </div>
                </Button>

                {/* All-in */}
                <Button
                  onClick={() => onRequestAllIn ? onRequestAllIn(myPlayerStack) : (() => {
                    setRaiseAmount(myPlayerStack);
                    handleAction('raise', myPlayerStack);
                  })()}
                  disabled={!isMyTurn || myPlayerStack <= 0}
                  className="h-11 px-3 font-black tracking-wider text-[10px] uppercase rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-25"
                  style={{
                    background: myPlayerStack > 0 && isMyTurn
                      ? 'rgba(185,28,28,0.7)'
                      : 'rgba(20,20,20,0.8)',
                    border: '1px solid rgba(239,68,68,0.4)',
                    color: myPlayerStack > 0 && isMyTurn ? '#fca5a5' : 'rgba(239,68,68,0.5)',
                  }}
                >
                  <div className="flex flex-col items-center leading-none">
                    <span>{t('room.allIn')}</span>
                    <span className="text-[9px] opacity-80">{myPlayerStack}</span>
                  </div>
                </Button>
              </div>
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
                value={Math.min(raiseAmount || minRaiseTo, myPlayerStack)}
                min={minRaiseTo}
                max={myPlayerStack}
                onChange={(e) => setRaiseAmount(Math.min(Number(e.target.value), myPlayerStack))}
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
                {consecutiveTimeouts > 0
                  ? t('room.sitOutWithCount', { count: consecutiveTimeouts })
                  : t('room.sitOut')}
              </Button>
            )}

            {/* Emoji Reaction Button */}
            <div className="relative">
              <Button
                onClick={onToggleEmojiPicker}
                className="h-11 px-3 font-black tracking-wider text-xs uppercase rounded-lg transition-opacity disabled:opacity-30"
                style={{
                  background: emojiPickerOpen
                    ? 'rgba(251,191,36,0.2)'
                    : 'rgba(75,75,75,0.6)',
                  border: `1px solid ${emojiPickerOpen ? 'rgba(251,191,36,0.5)' : 'rgba(156,163,175,0.25)'}`,
                  color: emojiPickerOpen ? '#facc15' : 'rgba(156,163,175,0.9)',
                }}
                title={t('room.emojiReaction')}
              >
                😀
              </Button>

              {/* Emoji Picker Popup */}
              {emojiPickerOpen && (
                <div
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex gap-1 p-2 rounded-xl z-50"
                  style={{
                    background: 'rgba(12,22,16,0.97)',
                    border: '1px solid rgba(234,179,8,0.3)',
                    boxShadow: '0 0 24px rgba(0,0,0,0.6)',
                    minWidth: '160px',
                    justifyContent: 'center',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {ALLOWED_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onEmoji?.(emoji as AllowedEmoji);
                        onToggleEmojiPicker?.();
                      }}
                      className="w-9 h-9 flex items-center justify-center text-xl rounded-lg transition-all hover:scale-125 hover:bg-white/10 active:scale-110"
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
