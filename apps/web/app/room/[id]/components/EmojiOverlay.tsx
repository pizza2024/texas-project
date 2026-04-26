'use client';

import { useCallback } from 'react';

export interface EmojiFlight {
  id: string;
  emoji: string;
  /** Player slot index (0-8) */
  seatIndex: number;
  /** Delay in ms before animation starts */
  delay?: number;
}

/** Position each emoji just above the avatar ring for a given seat index. */
export function getEmojiSeatPosition(seatIndex: number): { top: number; left: number } {
  const angle = (seatIndex / 9) * 2 * Math.PI;
  const radius = 42;
  return {
    top: 50 + radius * Math.sin(angle) - 10,
    left: 50 + radius * Math.cos(angle),
  };
}

interface EmojiOverlayProps {
  flights: EmojiFlight[];
  onFlightComplete?: (id: string) => void;
}

const EMOJI_ANIMATION_DURATION = 1600;

export function EmojiOverlay({ flights, onFlightComplete }: EmojiOverlayProps) {
  const handleAnimationEnd = useCallback(
    (id: string) => {
      onFlightComplete?.(id);
    },
    [onFlightComplete],
  );

  return (
    <>
      {flights.map((flight) => {
        const { top, left } = getEmojiSeatPosition(flight.seatIndex);
        return (
          <EmojiFlightElement
            key={flight.id}
            flight={flight}
            top={top}
            left={left}
            onAnimationEnd={handleAnimationEnd}
          />
        );
      })}
    </>
  );
}

interface EmojiFlightElementProps {
  flight: EmojiFlight;
  top: number;
  left: number;
  onAnimationEnd: (id: string) => void;
}

function EmojiFlightElement({ flight, top, left, onAnimationEnd }: EmojiFlightElementProps) {
  const duration = EMOJI_ANIMATION_DURATION + (flight.delay ?? 0);

  return (
    <div
      className="absolute pointer-events-none z-30"
      style={{
        top: `${top}%`,
        left: `${left}%`,
        animation: `emojiFloatUp ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${flight.delay ?? 0}ms both`,
      }}
      onAnimationEnd={() => onAnimationEnd(flight.id)}
    >
      <span
        className="text-3xl select-none block"
        style={{
          filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
          animation: `emojiPopIn 200ms ease-out ${flight.delay ?? 0}ms both`,
        }}
      >
        {flight.emoji}
      </span>
    </div>
  );
}

/** Inject global keyframe styles for emoji float animation. */
export function EmojiOverlayStyles() {
  return (
    <style jsx global>{`
      @keyframes emojiFloatUp {
        0% {
          opacity: 0;
          transform: translate(-50%, 0px) scale(0.4) rotate(-15deg);
        }
        15% {
          opacity: 1;
          transform: translate(-50%, -12px) scale(1.15) rotate(5deg);
        }
        40% {
          opacity: 1;
          transform: translate(-50%, -28px) scale(1) rotate(-3deg);
        }
        70% {
          opacity: 0.9;
          transform: translate(-50%, -44px) scale(0.95) rotate(2deg);
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -64px) scale(0.8) rotate(-5deg);
        }
      }
      @keyframes emojiPopIn {
        0% {
          opacity: 0;
          transform: scale(0.3);
        }
        60% {
          transform: scale(1.2);
        }
        100% {
          opacity: 1;
          transform: scale(1);
        }
      }
    `}</style>
  );
}
