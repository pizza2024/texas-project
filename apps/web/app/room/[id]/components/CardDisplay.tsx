'use client';

import { SUIT_SYMBOL } from './types';

export function CardDisplay({
  card,
  large,
  reveal,
  highlight,
}: {
  card: string;
  large?: boolean;
  reveal?: boolean;
  highlight?: boolean;
}) {
  const isHidden = card === '??';
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const isRed = suit === 'h' || suit === 'd';
  const w = reveal ? 'w-16 h-22' : large ? 'w-10 h-14' : 'w-8 h-11';

  if (isHidden) {
    return (
      <div
        className={`${w} rounded-lg flex items-center justify-center text-lg select-none font-bold`}
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2540 100%)',
          border: '1px solid rgba(96,165,250,0.3)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          color: 'rgba(147,197,253,0.6)',
          fontSize: reveal ? '30px' : large ? '20px' : '16px',
        }}
      >
        ♦
      </div>
    );
  }

  return (
    <div
      className={`${w} rounded-lg flex flex-col items-center justify-center select-none`}
      style={{
        background: highlight
          ? 'linear-gradient(160deg, #fef9c3 0%, #fef08a 100%)'
          : 'linear-gradient(160deg, #ffffff 0%, #f0f0f0 100%)',
        border: highlight ? '2px solid rgba(234,179,8,0.9)' : '1px solid rgba(0,0,0,0.15)',
        boxShadow: highlight
          ? '0 0 10px rgba(234,179,8,0.55), 0 2px 8px rgba(0,0,0,0.35)'
          : '0 2px 8px rgba(0,0,0,0.35)',
        color: isRed ? '#dc2626' : '#111827',
      }}
    >
      <span className={`font-black leading-none ${reveal ? 'text-xl' : large ? 'text-sm' : 'text-[11px]'}`}>{rank}</span>
      <span className={`leading-none ${reveal ? 'text-2xl' : large ? 'text-base' : 'text-[12px]'}`}>{SUIT_SYMBOL[suit] ?? suit}</span>
    </div>
  );
}
