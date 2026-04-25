'use client';

import type { ReplayActionNode } from './ReplayModal';

interface ReplayTimelineProps {
  nodes: ReplayActionNode[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function ReplayTimeline({ nodes, currentIndex, onSelect, onPrev, onNext }: ReplayTimelineProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Prev button */}
      <button
        type="button"
        onClick={onPrev}
        disabled={currentIndex === 0}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors"
        style={{
          background: currentIndex === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.15)',
          color: currentIndex === 0 ? 'rgba(255,255,255,0.2)' : '#f59e0b',
          cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
        }}
      >
        ‹
      </button>

      {/* Scrubber */}
      <div className="flex-1 relative">
        {/* Stage labels */}
        <div className="flex justify-between mb-1">
          {['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'].map(stage => (
            <span
              key={stage}
              className="text-xs font-medium uppercase"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              {stage}
            </span>
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(currentIndex / Math.max(nodes.length - 1, 1)) * 100}%`,
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
            }}
          />
        </div>

        {/* Node markers */}
        <div className="relative h-2 mt-1">
          {nodes.map((node, i) => {
            const isActive = i === currentIndex;
            const isStageTransition = node.action === null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(i)}
                className="absolute -translate-x-1/2 w-3 h-3 rounded-full transition-all"
                style={{
                  left: `${(i / Math.max(nodes.length - 1, 1)) * 100}%`,
                  background: isActive
                    ? '#f59e0b'
                    : isStageTransition
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(245,158,11,0.4)',
                  border: isActive ? '2px solid #fbbf24' : 'none',
                  transform: `translateX(-50%) ${isActive ? 'scale(1.3)' : 'scale(1)'}`,
                  top: 0,
                }}
                title={node.description}
              />
            );
          })}
        </div>
      </div>

      {/* Next button */}
      <button
        type="button"
        onClick={onNext}
        disabled={currentIndex === nodes.length - 1}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors"
        style={{
          background: currentIndex === nodes.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.15)',
          color: currentIndex === nodes.length - 1 ? 'rgba(255,255,255,0.2)' : '#f59e0b',
          cursor: currentIndex === nodes.length - 1 ? 'not-allowed' : 'pointer',
        }}
      >
        ›
      </button>

      {/* Index indicator */}
      <span className="text-xs tabular-nums flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {currentIndex + 1} / {nodes.length}
      </span>
    </div>
  );
}
