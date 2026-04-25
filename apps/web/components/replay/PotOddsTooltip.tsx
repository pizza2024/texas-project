'use client';

import { useEffect, useState } from 'react';
import type { ReplayActionNode } from './ReplayModal';

interface PotOddsTooltipProps {
  node: ReplayActionNode | null;
  visible: boolean;
  position?: { x: number; y: number };
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function PotOddsTooltip({ node, visible, position, anchorRef }: PotOddsTooltipProps) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!visible || !node) {
      setTooltipPos(null);
      return;
    }
    if (position) {
      setTooltipPos(position);
      return;
    }
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
    }
  }, [visible, node, position, anchorRef]);

  if (!visible || !node || !tooltipPos) return null;

  const callAmount = node.amount;
  const potAfter = node.potAfter;

  if (callAmount <= 0 || node.action === 'FOLD' || node.action === 'CHECK') {
    return null;
  }

  const potOdds = Math.round((callAmount / potAfter) * 100);

  return (
    <div
      className="fixed z-50 px-3 py-2 rounded-lg text-xs pointer-events-none"
      style={{
        left: tooltipPos.x,
        top: tooltipPos.y,
        background: 'rgba(0,0,0,0.92)',
        border: '1px solid rgba(245,158,11,0.3)',
        transform: 'translate(-50%, calc(-100% - 8px))',
        minWidth: 130,
      }}
    >
      <div className="font-bold mb-1" style={{ color: '#f59e0b' }}>Pot Odds</div>
      <div className="flex flex-col gap-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
        <div>
          Call: <span className="font-bold text-white">{callAmount.toLocaleString()}</span>
        </div>
        <div>
          To win: <span className="font-bold text-white">{potAfter.toLocaleString()}</span>
        </div>
        <div className="mt-1 pt-1" style={{ borderTop: '1px solid rgba(245,158,11,0.15)' }}>
          Odds: <span className="font-bold" style={{ color: potOdds > 50 ? '#f87171' : '#4ade80' }}>{potOdds}%</span>
        </div>
        {potOdds <= 33 && (
          <div className="mt-1" style={{ color: '#4ade80' }}>✓ Good call</div>
        )}
        {potOdds > 33 && potOdds <= 50 && (
          <div className="mt-1" style={{ color: '#fbbf24' }}>◐ Marginal</div>
        )}
        {potOdds > 50 && (
          <div className="mt-1" style={{ color: '#f87171' }}>✗ Overpriced</div>
        )}
      </div>
    </div>
  );
}
