'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface AllInConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Your stack going all-in */
  allInAmount: number;
  /** Current pot size (including the call amount) */
  pot: number;
  /** Estimated equity as a percentage (0-100) */
  equityPercent: number;
  /** Pot odds as a percentage (0-100) */
  potOddsPercent: number;
  /** Whether the call is profitable based on equity vs pot odds */
  isProfitable: boolean;
}

export function AllInConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  allInAmount,
  pot,
  equityPercent,
  potOddsPercent,
  isProfitable,
}: AllInConfirmModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl border p-6 flex flex-col gap-5"
        style={{
          background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
          border: '1px solid rgba(239,68,68,0.4)',
          boxShadow: '0 0 60px rgba(239,68,68,0.15)',
        }}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="h-14 w-14 rounded-full flex items-center justify-center text-3xl font-black"
            style={{
              background: 'rgba(185,28,28,0.3)',
              border: '1px solid rgba(239,68,68,0.5)',
            }}
          >
            ⚠️
          </div>
          <h2
            className="text-lg font-black tracking-wide uppercase"
            style={{ color: '#fca5a5' }}
          >
            {t('room.allInConfirmTitle', 'All-In Confirmation')}
          </h2>
          <p className="text-xs text-center" style={{ color: 'rgba(156,163,175,0.7)' }}>
            {t('room.allInConfirmSubtitle', 'This action cannot be undone')}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Your All-in */}
          <div
            className="rounded-xl p-3 flex flex-col items-center gap-1"
            style={{ background: 'rgba(185,28,28,0.2)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(252,165,165,0.7)' }}>
              {t('room.allInYourStack', 'Your All-In')}
            </span>
            <span className="text-xl font-black" style={{ color: '#fca5a5' }}>
              {allInAmount.toLocaleString()}
            </span>
          </div>

          {/* Current Pot */}
          <div
            className="rounded-xl p-3 flex flex-col items-center gap-1"
            style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(252,211,77,0.7)' }}>
              {t('room.allInPot', 'Current Pot')}
            </span>
            <span className="text-xl font-black" style={{ color: '#fcd34d' }}>
              {pot.toLocaleString()}
            </span>
          </div>

          {/* Equity */}
          <div
            className="rounded-xl p-3 flex flex-col items-center gap-1"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(52,211,153,0.7)' }}>
              {t('room.allInEquity', 'Est. Equity')}
            </span>
            <span className="text-xl font-black" style={{ color: '#34d399' }}>
              {equityPercent}%
            </span>
          </div>

          {/* Pot Odds */}
          <div
            className="rounded-xl p-3 flex flex-col items-center gap-1"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(147,197,253,0.7)' }}>
              {t('room.allInPotOdds', 'Pot Odds')}
            </span>
            <span className="text-xl font-black" style={{ color: '#93c5fd' }}>
              {potOddsPercent}%
            </span>
          </div>
        </div>

        {/* Verdict */}
        <div
          className="rounded-xl p-3 text-center"
          style={{
            background: isProfitable
              ? 'rgba(16,185,129,0.15)'
              : 'rgba(239,68,68,0.1)',
            border: `1px solid ${isProfitable ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)'}`,
          }}
        >
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: isProfitable ? '#6ee7b7' : '#fca5a5' }}>
            {isProfitable
              ? t('room.allInProfitable', '✓ Profitable — equity exceeds pot odds')
              : t('room.allInUnprofitable', '✗ Unprofitable — equity below pot odds')
            }
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            className="flex-1 h-12 font-black tracking-widest uppercase rounded-xl"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {t('room.allInCancel', 'Cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 h-12 font-black tracking-widest uppercase rounded-xl"
            style={{
              background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 40%, #b91c1c 100%)',
              border: '1px solid rgba(239,68,68,0.5)',
              color: '#fee2e2',
              boxShadow: '0 0 30px rgba(239,68,68,0.3)',
            }}
          >
            {t('room.allInConfirm', 'Confirm All-In')}
          </Button>
        </div>
      </div>
    </div>
  );
}
