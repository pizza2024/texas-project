'use client';

import { useCallback, useEffect } from 'react';
import { SpeedSelector } from './SpeedSelector';

interface AutoPlayPanelProps {
  timelineLength: number;
  currentIndex: number;
  playbackSpeed: number;
  isPlaying: boolean;
  onIndexChange: (value: number | ((prev: number) => number)) => void;
  onPlayingChange: (v: boolean) => void;
  onSpeedChange: (s: number) => void;
}

function getIntervalMs(speed: number): number {
  switch (speed) {
    case 0.5: return 2000;
    case 1: return 1000;
    case 2: return 500;
    case 4: return 250;
    default: return 1000;
  }
}

export function AutoPlayPanel({
  timelineLength,
  currentIndex,
  playbackSpeed,
  isPlaying,
  onIndexChange,
  onPlayingChange,
  onSpeedChange,
}: AutoPlayPanelProps) {
  const goToNext = useCallback(() => {
    onIndexChange((prev) => Math.min(timelineLength - 1, prev + 1));
  }, [timelineLength, onIndexChange]);

  const autoPlayToShowdown = useCallback(() => {
    // Jump to showdown stage
    onIndexChange(timelineLength - 1);
    onPlayingChange(false);
  }, [timelineLength, onIndexChange, onPlayingChange]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      onIndexChange((prev) => {
        if (prev >= timelineLength - 1) {
          onPlayingChange(false);
          return prev;
        }
        return prev + 1;
      });
    }, getIntervalMs(playbackSpeed));
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, timelineLength, onIndexChange, onPlayingChange]);

  return (
    <div
      className="flex items-center justify-between px-4 py-2 border-t"
      style={{ borderColor: 'rgba(245,158,11,0.1)', background: 'rgba(0,0,0,0.15)' }}
    >
      <div className="flex items-center gap-3">
        {/* Auto-play toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Auto-play</span>
          <div
            onClick={() => onPlayingChange(!isPlaying)}
            className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
            style={{
              background: isPlaying ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)',
            }}
          >
            <div
              className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
              style={{
                background: isPlaying ? '#f59e0b' : 'rgba(255,255,255,0.3)',
                left: isPlaying ? '18px' : '2px',
              }}
            />
          </div>
        </label>

        {/* Speed selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Speed:</span>
          <SpeedSelector value={playbackSpeed} onChange={onSpeedChange} />
        </div>
      </div>

      {/* Auto-play to showdown */}
      <button
        type="button"
        onClick={autoPlayToShowdown}
        className="px-3 py-1 rounded text-xs font-medium transition-colors"
        style={{
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.2)',
          color: 'rgba(245,158,11,0.7)',
        }}
      >
        ⏩ To Showdown
      </button>
    </div>
  );
}
