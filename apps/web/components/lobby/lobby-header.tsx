"use client";

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { UserDropdown } from './user-dropdown';

interface LobbyHeaderProps {
  nickname: string;
  userId: string;
  avatar: string | null;
  onLogout: () => void;
  onQuickMatch: () => void;
  onCreateTable: () => void;
  currentBalance: number;
}

export function LobbyHeader({
  nickname,
  userId,
  avatar,
  onLogout,
  onQuickMatch,
  onCreateTable,
}: LobbyHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <header
      className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6"
      style={{ borderBottom: '1px solid rgba(234,179,8,0.15)' }}
    >
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🎰</span>
          <h1
            className="text-3xl font-black tracking-[0.08em] uppercase"
            style={{
              background:
                'linear-gradient(135deg, #d97706 0%, #fcd34d 45%, #d97706 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {t('lobby.title')}
          </h1>
        </div>
        <p
          className="text-[10px] tracking-[0.3em] uppercase"
          style={{ color: 'rgba(245,158,11,0.45)' }}
        >
          {t('lobby.subtitle')}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Match button */}
        <Button
          onClick={() => {/* passed via prop */}}
          className="font-bold tracking-widest text-xs uppercase h-10 px-3 sm:px-5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{
            background:
              'linear-gradient(135deg, #065f46 0%, #047857 40%, #10b981 100%)',
            color: '#ecfdf5',
            border: 'none',
            boxShadow:
              '0 0 20px rgba(16,185,129,0.2), 0 4px 10px rgba(0,0,0,0.4)',
          }}
        >
          ⚡ <span className="hidden sm:inline">{t('lobby.quickMatchBtn')}</span>
        </Button>

        {/* Create Table button */}
        <Button
          onClick={() => {/* passed via prop */}}
          className="font-bold tracking-widest text-xs uppercase h-10 px-3 sm:px-5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{
            background:
              'linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)',
            color: '#000',
            border: 'none',
            boxShadow:
              '0 0 20px rgba(245,158,11,0.2), 0 4px 10px rgba(0,0,0,0.4)',
          }}
        >
          <span className="hidden sm:inline">{t('lobby.createTable')}</span>
          <span className="sm:hidden">+ Table</span>
        </Button>

        {/* Deposit button — sm+ only */}
        <Button
          onClick={() => router.push('/deposit')}
          className="hidden sm:flex font-bold tracking-widest text-xs uppercase h-10 px-5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{
            background:
              'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #4ade80 100%)',
            color: '#ecfdf5',
            border: 'none',
            boxShadow:
              '0 0 20px rgba(74,222,128,0.2), 0 4px 10px rgba(0,0,0,0.4)',
          }}
        >
          💰 {t('common.deposit')}
        </Button>

        {/* Withdraw button — sm+ only */}
        <Button
          onClick={() => router.push('/withdraw')}
          className="hidden sm:flex font-bold tracking-widest text-xs uppercase h-10 px-5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{
            background:
              'linear-gradient(135deg, #3b0a0a 0%, #5f1111 40%, #dc2626 100%)',
            color: '#fecaca',
            border: 'none',
            boxShadow:
              '0 0 20px rgba(220,38,38,0.2), 0 4px 10px rgba(0,0,0,0.4)',
          }}
        >
          💸 {t('common.withdraw')}
        </Button>

        {/* Friends button — sm+ only */}
        <Button
          onClick={() => router.push('/friends')}
          className="hidden sm:flex font-bold tracking-widest text-xs uppercase h-10 px-4 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{
            background:
              'linear-gradient(135deg, #0c2d3d 0%, #0e3d52 40%, #38bdf8 100%)',
            color: '#e0f2fe',
            border: 'none',
            boxShadow:
              '0 0 20px rgba(56,189,248,0.15), 0 4px 10px rgba(0,0,0,0.4)',
          }}
        >
          👥 {t('friends.title')}
        </Button>

        {/* Clubs button — sm+ only */}
        <Button
          onClick={() => router.push('/club')}
          className="hidden sm:flex font-bold tracking-widest text-xs uppercase h-10 px-4 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{
            background:
              'linear-gradient(135deg, #78350f 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)',
            color: '#fff',
            border: 'none',
            boxShadow:
              '0 0 20px rgba(217,119,6,0.15), 0 4px 10px rgba(0,0,0,0.4)',
          }}
        >
          🏠 {t('club.title', 'Clubs')}
        </Button>

        {/* User dropdown */}
        <UserDropdown
          nickname={nickname}
          userId={userId}
          avatar={avatar}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}
