"use client";

import { useTranslation } from 'react-i18next';
import '@/lib/i18n';

export interface Room {
  id: string;
  name: string;
  blindSmall: number;
  blindBig: number;
  maxPlayers: number;
  minBuyIn: number;
  isPrivate?: boolean;
  isClubOnly?: boolean;
  clubId?: string;
  tier?: 'MICRO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'PREMIUM';
  isTournament?: boolean;
  isAnonymous?: boolean;
  tournamentConfig?: {
    type: 'SNG';
    buyin: number;
    maxPlayers: number;
    prizeDistribution: [number, number, number];
  };
}

export interface RoomStatus {
  roomId: string;
  currentPlayers: number;
  maxPlayers: number;
  isFull: boolean;
}

interface RoomCardProps {
  room: Room;
  status: RoomStatus | null;
  currentBalance: number;
  onJoin: (roomId: string) => void;
  gameState?: 'waiting' | 'playing' | null;
}

export function RoomCard({ room, status, currentBalance, onJoin, gameState }: RoomCardProps) {
  const { t } = useTranslation();
  const currentPlayers = status?.currentPlayers ?? 0;
  const maxPlayers = status?.maxPlayers ?? room.maxPlayers;
  const isFull = status?.isFull ?? currentPlayers >= maxPlayers;
  const canJoin = currentBalance >= room.minBuyIn;

  // P2-NEW-030: Color-coded real-time status badge
  const getGameStatus = () => {
    if (isFull || gameState === 'playing') {
      return { label: '进行中', color: 'rgba(16,185,129,0.9)', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' };
    }
    if (currentPlayers < 2) {
      return { label: '缺人', color: 'rgba(248,113,113,0.9)', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' };
    }
    return {
      label: `等待开始 (${currentPlayers}/${maxPlayers})`,
      color: 'rgba(245,158,11,0.9)',
      bg: 'rgba(245,158,11,0.1)',
      border: 'rgba(245,158,11,0.2)',
    };
  };
  const gameStatus = getGameStatus();

  const fillPercent = maxPlayers > 0 ? (currentPlayers / maxPlayers) * 100 : 0;

  const tierColors: Record<string, string> = {
    MICRO: 'rgba(52,211,153)',
    LOW: 'rgba(45,212,191)',
    MEDIUM: 'rgba(245,158,11)',
    HIGH: 'rgba(249,115,22)',
    PREMIUM: 'rgba(168,85,247)',
  };
  const tierColor = room.tier ? tierColors[room.tier] ?? 'rgba(200,200,200,0.5)' : 'rgba(200,200,200,0.5)';

  // Grey out card when user doesn't have enough chips
  const isChipsInsufficient = !canJoin && !isFull;

  return (
    <div
      className={`rounded-2xl p-4 flex flex-col gap-3 transition-all ${!isFull && canJoin ? 'hover:scale-[1.01] cursor-pointer' : ''} ${isChipsInsufficient ? 'opacity-60' : ''}`}
      style={{
        background: isChipsInsufficient
          ? 'linear-gradient(160deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.98) 100%)'
          : 'linear-gradient(160deg, rgba(12,22,16,0.95) 0%, rgba(6,12,9,0.98) 100%)',
        border: isFull
          ? '1px solid rgba(248,113,113,0.2)'
          : isChipsInsufficient
          ? '1px solid rgba(107,114,128,0.15)'
          : '1px solid rgba(234,179,8,0.15)',
        boxShadow: isFull
          ? '0 0 20px rgba(248,113,113,0.05)'
          : isChipsInsufficient
          ? 'none'
          : '0 0 20px rgba(234,179,8,0.05)',
      }}
      onClick={() => !isFull && canJoin && onJoin(room.id)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {room.isPrivate && <span className="text-sm">🔒</span>}
            {room.isClubOnly && <span className="text-sm" title="俱乐部专属">🏠</span>}
            {room.isAnonymous && <span className="text-sm" title="匿名房间">🎭</span>}
            <h3 className="font-black text-white text-base truncate tracking-wide">
              {room.name}
            </h3>
            {room.tier && (
              <span
                className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded"
                style={{
                  background: `${tierColor}20`,
                  color: tierColor,
                  border: `1px solid ${tierColor}40`,
                }}
              >
                {room.tier}
              </span>
            )}
            {room.isTournament && <span className="text-xs font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded ml-1">🏆 SNG</span>}
          </div>
          <p
            className="text-[10px] tracking-[0.2em] uppercase mt-0.5"
            style={{ color: 'rgba(245,158,11,0.5)' }}
          >
            {room.isTournament
              ? `Buy-in: ${room.tournamentConfig?.buyin.toLocaleString()} chips`
              : t('lobby.table.blinds', {
                  small: room.blindSmall,
                  big: room.blindBig,
                })}
          </p>
        </div>

        {/* Seats badge */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div
            className="px-2.5 py-1 rounded-lg text-xs font-bold"
            style={{
              background: isFull
                ? 'rgba(239,68,68,0.15)'
                : 'rgba(16,185,129,0.1)',
              color: isFull ? 'rgba(248,113,113,0.9)' : 'rgba(52,211,153,0.9)',
              border: isFull
                ? '1px solid rgba(239,68,68,0.2)'
                : '1px solid rgba(16,185,129,0.2)',
            }}
          >
            {currentPlayers}/{maxPlayers}
          </div>
          {/* P2-NEW-030: Real-time status badge */}
          <div
            className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide"
            style={{
              background: gameStatus.bg,
              color: gameStatus.color,
              border: `1px solid ${gameStatus.border}`,
            }}
          >
            {gameStatus.label}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${fillPercent}%`,
            background: isFull
              ? 'rgba(248,113,113,0.6)'
              : fillPercent > 75
              ? 'rgba(245,158,11,0.6)'
              : 'rgba(52,211,153,0.6)',
          }}
        />
      </div>

      {/* Prize structure for tournaments */}
      {room.isTournament && room.tournamentConfig && (
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: 'rgba(245,158,11,0.6)' }}>Prize:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold" style={{ color: '#fcd34d' }}>🥇 {room.tournamentConfig.prizeDistribution[0]}%</span>
            <span className="text-[10px] opacity-40">/</span>
            <span className="text-[10px] font-bold" style={{ color: '#d1d5db' }}>🥈 {room.tournamentConfig.prizeDistribution[1]}%</span>
            <span className="text-[10px] opacity-40">/</span>
            <span className="text-[10px] font-bold" style={{ color: '#b45309' }}>🥉 {room.tournamentConfig.prizeDistribution[2]}%</span>
          </div>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Online player count */}
          <span
            className="text-[10px] font-semibold"
            style={{ color: 'rgba(156,163,175,0.65)' }}
          >
            👥 {currentPlayers}/{maxPlayers}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
          <p
            className="text-[10px]"
            style={{ color: isChipsInsufficient ? 'rgba(245,158,11,0.6)' : 'rgba(156,163,175,0.5)' }}
          >
            {t('lobby.table.minBuyIn', { amount: room.minBuyIn.toLocaleString() })}
          </p>
        </div>
        {isFull ? (
          <span
            className="text-[10px] font-bold tracking-wider uppercase"
            style={{ color: 'rgba(248,113,113,0.7)' }}
          >
            🔒 {t('lobby.table.full')}
          </span>
        ) : isChipsInsufficient ? (
          <span
            className="text-[10px] font-bold tracking-wider uppercase"
            style={{ color: 'rgba(245,158,11,0.7)' }}
          >
            🔒 {t('lobby.table.insufficientChips')}
          </span>
        ) : (
          <button
            className="text-xs font-bold px-3 py-1 rounded-lg transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)',
              color: '#000',
              boxShadow: '0 0 15px rgba(245,158,11,0.2)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onJoin(room.id);
            }}
          >
            {t('lobby.table.join')}
          </button>
        )}
      </div>
    </div>
  );
}
