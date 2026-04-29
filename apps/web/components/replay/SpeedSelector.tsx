"use client";

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

interface SpeedSelectorProps {
  value: number;
  onChange: (speed: number) => void;
}

const SPEEDS = [
  { label: "0.5×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "2×", value: 2 },
  { label: "4×", value: 4 },
];

export function SpeedSelector({ value, onChange }: SpeedSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {SPEEDS.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          className="px-2 py-0.5 rounded text-xs font-medium transition-all"
          style={{
            background:
              value === s.value ? "rgba(245,158,11,0.2)" : "transparent",
            color: value === s.value ? "#f59e0b" : "rgba(255,255,255,0.4)",
            border:
              value === s.value
                ? "1px solid rgba(245,158,11,0.4)"
                : "1px solid transparent",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
