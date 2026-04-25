'use client';

interface ReplayStageNavProps {
  currentStage: string;
  onGoToStage: (stage: string) => void;
  stages: string[];
}

export function ReplayStageNav({ currentStage, onGoToStage, stages }: ReplayStageNavProps) {
  return (
    <div
      className="flex items-center justify-center gap-1 px-4 py-2 border-b"
      style={{ borderColor: 'rgba(245,158,11,0.15)', background: 'rgba(0,0,0,0.2)' }}
    >
      {stages.map((stage, i) => {
        const isActive = stage === currentStage;
        const isPast = stages.indexOf(currentStage) > i;

        return (
          <button
            key={stage}
            type="button"
            onClick={() => onGoToStage(stage)}
            className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all"
            style={{
              background: isActive
                ? 'rgba(245,158,11,0.2)'
                : 'transparent',
              color: isActive
                ? '#f59e0b'
                : isPast
                ? 'rgba(245,158,11,0.5)'
                : 'rgba(255,255,255,0.25)',
              border: isActive
                ? '1px solid rgba(245,158,11,0.4)'
                : '1px solid transparent',
            }}
          >
            {stage}
            {i < stages.length - 1 && (
              <span
                className="ml-1"
                style={{ color: 'rgba(255,255,255,0.15)' }}
              >
                ›
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
