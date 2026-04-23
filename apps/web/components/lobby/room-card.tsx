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
}

export function RoomCard({ room, status, currentBalance, onJoin }: RoomCardProps) {
  const { t } = useTranslation();
  const currentPlayers = status?.currentPlayers ?? 0;
  const maxPlayers = status?.maxPlayers ?? room.maxPlayers;
  const isFull = status?.isFull ?? currentPlayers >= maxPlayers;
  const canJoin = currentBalance >= room.minBuyIn;

  const fillPercent = maxPlayers > 0 ? (currentPlayers / maxPlayers) * 100 : 0;

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 transition-all hover:scale-[1.01] cursor-pointer"
      style={{
        background: 'linear-gradient(160deg, rgba(12,22,16,0.95) 0%, rgba(6,12,9,0.98) 100%)',
        border: isFull
          ? '1px solid rgba(248,113,113,0.2)'
          : '1px solid rgba(234,179,8,0.15)',
        boxShadow: isFull
          ? '0 0 20px rgba(248,113,113,0.05)'
          : '0 0 20px rgba(234,179,8,0.05)',
      }}
      onClick={() => !isFull && canJoin && onJoin(room.id)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {room.isPrivate && <span className="text-sm">🔒</span>}
            <h3 className="font-black text-white text-base truncate tracking-wide">
              {room.name}
            </h3>
          </div>
          <p
            className="text-[10px] tracking-[0.2em] uppercase mt-0.5"
            style={{ color: 'rgba(245,158,11,0.5)' }}
          >
            {t('lobby.table.blinds', {
              small: room.blindSmall,
              big: room.blindBig,
            })}
          </p>
        </div>

        {/* Seats badge */}
        <div
          className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold"
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

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <p
          className="text-[10px] text-gray-500"
        >
          {t('lobby.table.minBuyIn', { amount: room.minBuyIn })}
        </p>
        {isFull ? (
          <span
            className="text-[10px] font-bold tracking-wider uppercase"
            style={{ color: 'rgba(248,113,113,0.7)' }}
          >
            {t('lobby.table.full')}
          </span>
        ) : !canJoin ? (
          <span
            className="text-[10px] font-bold tracking-wider uppercase"
            style={{ color: 'rgba(245,158,11,0.6)' }}
          >
            {t('lobby.table.insufficientChips')}
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
