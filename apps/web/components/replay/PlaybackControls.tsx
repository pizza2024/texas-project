"use client";

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onRewind: () => void;
  onFastForward: () => void;
  disabled?: boolean;
}

export function PlaybackControls({
  isPlaying,
  onPlayPause,
  onRewind,
  onFastForward,
  disabled = false,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Rewind */}
      <button
        type="button"
        onClick={onRewind}
        disabled={disabled}
        className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors"
        style={{
          background: disabled
            ? "rgba(255,255,255,0.05)"
            : "rgba(255,255,255,0.08)",
          color: disabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        title="Rewind 5 steps"
      >
        ‹‹
      </button>

      {/* Play / Pause */}
      <button
        type="button"
        onClick={onPlayPause}
        disabled={disabled}
        className="w-9 h-9 rounded-full flex items-center justify-center text-base transition-colors"
        style={{
          background: disabled
            ? "rgba(245,158,11,0.1)"
            : "rgba(245,158,11,0.2)",
          color: disabled ? "rgba(245,158,11,0.3)" : "#f59e0b",
          cursor: disabled ? "not-allowed" : "pointer",
          border: "1px solid rgba(245,158,11,0.3)",
        }}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      {/* Fast-forward */}
      <button
        type="button"
        onClick={onFastForward}
        disabled={disabled}
        className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors"
        style={{
          background: disabled
            ? "rgba(255,255,255,0.05)"
            : "rgba(255,255,255,0.08)",
          color: disabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        title="Fast-forward 5 steps"
      >
        ››
      </button>
    </div>
  );
}
