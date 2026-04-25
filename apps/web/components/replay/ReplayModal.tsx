'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ReplayTimeline } from './ReplayTimeline';
import { ReplayPlayerCards } from './ReplayPlayerCards';
import { ReplayCommunityCards } from './ReplayCommunityCards';
import { ReplayActionLog } from './ReplayActionLog';
import { ReplayStageNav } from './ReplayStageNav';

export interface ReplayPlayer {
  id: string;
  nickname: string;
  holeCards: string[];
  netProfit: number;
  handName: string;
}

export interface ReplayActionNode {
  index: number;
  playerId: string;
  playerNickname: string;
  action: string | null;
  amount: number;
  totalBet: number;
  remainingStack: number;
  potAfter: number;
  communityCards: string[];
  stage: string;
  description: string;
}

export interface HandReplayData {
  handId: string;
  roomName: string;
  date: string;
  smallBlind: number;
  bigBlind: number;
  initialPot: number;
  finalPot: number;
  players: ReplayPlayer[];
  communityCards: string[];
  winnerId: string | null;
  timeline: ReplayActionNode[];
}

const STAGES = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];

interface ReplayModalProps {
  handId: string;
  onClose: () => void;
}

export function ReplayModal({ handId, onClose }: ReplayModalProps) {
  const [data, setData] = useState<HandReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch replay data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/table-engine/hands/${handId}/replay`);
        if (!res.ok) throw new Error('Failed to load hand replay');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [handId]);

  const currentNode = data?.timeline[currentIndex] ?? null;

  const goToStage = useCallback((stage: string) => {
    if (!data) return;
    const idx = data.timeline.findIndex(n => n.stage === stage);
    if (idx >= 0) setCurrentIndex(idx);
  }, [data]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(i => Math.max(0, i - 1));
  }, []);

  const goToNext = useCallback(() => {
    if (!data) return;
    setCurrentIndex(i => Math.min(data.timeline.length - 1, i + 1));
  }, [data]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrev();
      else if (e.key === 'ArrowRight') goToNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goToPrev, goToNext, onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Loading hand replay...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
        <div className="text-center max-w-sm">
          <p className="text-red-400 mb-4">{error ?? 'Failed to load replay'}</p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  const stage = currentNode?.stage ?? 'PREFLOP';
  const communityCards = currentNode?.communityCards ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'linear-gradient(180deg, #0d2818 0%, #060e10 100%)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(0,0,0,0.4)' }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium transition-colors"
            style={{ color: 'rgba(245,158,11,0.8)' }}
          >
            ✕ Close
          </button>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>
            #{handId.slice(0, 8)} — {data.roomName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {new Date(data.date).toLocaleString()}
          </span>
          <button
            type="button"
            onClick={() => setIsFullscreen(f => !f)}
            className="text-sm px-3 py-1 rounded"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
          >
            {isFullscreen ? '⊡ Exit Fullscreen' : '⛶ Fullscreen'}
          </button>
        </div>
      </div>

      {/* Stage navigation */}
      <ReplayStageNav
        currentStage={stage}
        onGoToStage={goToStage}
        stages={STAGES}
      />

      {/* Main content area */}
      <div className={`flex-1 flex overflow-hidden ${isFullscreen ? '' : 'max-w-5xl mx-auto w-full p-4'}`}>
        {/* Left: Community cards + Player cards */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Community cards */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Board — {stage}
            </span>
            <ReplayCommunityCards cards={communityCards} stage={stage} />
          </div>

          {/* Players */}
          <div className="flex-1 overflow-y-auto">
            <ReplayPlayerCards
              players={data.players}
              currentPlayerId={currentNode?.playerId ?? null}
              winnerId={data.winnerId}
              showdown={stage === 'SHOWDOWN'}
            />
          </div>
        </div>

        {/* Right: Action log */}
        <div
          className="w-72 flex-shrink-0 border-l overflow-y-auto"
          style={{ borderColor: 'rgba(245,158,11,0.15)' }}
        >
          <ReplayActionLog
            nodes={data.timeline}
            currentIndex={currentIndex}
            onSelectNode={setCurrentIndex}
          />
        </div>
      </div>

      {/* Timeline scrubber */}
      <div className="border-t px-4 py-3" style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
        <ReplayTimeline
          nodes={data.timeline}
          currentIndex={currentIndex}
          onSelect={setCurrentIndex}
          onPrev={goToPrev}
          onNext={goToNext}
        />
      </div>
    </div>
  );
}
