"use client";

import { useEffect, useRef, useState, startTransition } from "react";
import { motion, useAnimation } from "framer-motion";

interface SpinWheelProps {
  multiplier: number;
  isSpinning: boolean;
  onSpinComplete?: (multiplier: number) => void;
}

// Multiplier segments — 9 tiers (per P2-NEW-024 product spec)
// Common (60%): 2x, 3x, 5x, 10x
// Uncommon (30%): 15x, 25x, 50x
// Rare (10%): 100x, 1000x
const SEGMENTS = [
  { multiplier: 2, color: "#f97316", label: "2x" },    // orange
  { multiplier: 3, color: "#c2410c", label: "3x" },    // burnt
  { multiplier: 5, color: "#f97316", label: "5x" },    // orange
  { multiplier: 10, color: "#ea580c", label: "10x" },  // dark orange
  { multiplier: 15, color: "#f97316", label: "15x" },  // orange
  { multiplier: 25, color: "#c2410c", label: "25x" },  // burnt
  { multiplier: 50, color: "#ea580c", label: "50x" },  // dark orange
  { multiplier: 100, color: "#f97316", label: "100x" }, // orange
  { multiplier: 1000, color: "#fbbf24", label: "1000x" }, // gold — jackpot
];

const SEGMENT_ANGLE = 360 / SEGMENTS.length; // 60° per segment

export function SpinWheel({ multiplier, isSpinning, onSpinComplete }: SpinWheelProps) {
  const controls = useAnimation();
  const multiplierRef = useRef(multiplier);
  const onSpinCompleteRef = useRef(onSpinComplete);
  const hasInitiatedSpinRef = useRef(false);

  // State for rendering
  const [showResult, setShowResult] = useState(false);

  // Keep refs in sync with props
  useEffect(() => {
    onSpinCompleteRef.current = onSpinComplete;
  }, [onSpinComplete]);

  useEffect(() => {
    multiplierRef.current = multiplier;
  }, [multiplier]);

  // Reset when spinning stops - use startTransition to avoid cascading renders
  useEffect(() => {
    if (!isSpinning) {
      hasInitiatedSpinRef.current = false;
      startTransition(() => {
        setShowResult(false);
      });
    }
  }, [isSpinning]);

  // Trigger spin animation
  useEffect(() => {
    if (!isSpinning || hasInitiatedSpinRef.current) return;
    hasInitiatedSpinRef.current = true;

    const targetIndex = SEGMENTS.findIndex(s => s.multiplier === multiplierRef.current);
    if (targetIndex === -1) return;

    const targetSegmentCenter = targetIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const spins = 5 + Math.random() * 3;
    const targetRotation = spins * 360 + (360 - targetSegmentCenter);

    controls.start({
      rotate: targetRotation,
      transition: {
        duration: 4,
        ease: [0.17, 0.67, 0.12, 0.99],
      },
    }).then(() => {
      startTransition(() => {
        setShowResult(true);
      });
      onSpinCompleteRef.current?.(multiplierRef.current);
    });
  }, [isSpinning, controls]);

  return (
    <div className="relative flex flex-col items-center gap-6">
      {/* Glow effect */}
      <div 
        className="absolute rounded-full blur-3xl opacity-30"
        style={{
          width: 280,
          height: 280,
          background: "radial-gradient(circle, #f97316 0%, transparent 70%)",
        }}
      />
      
      {/* Wheel */}
      <div className="relative" style={{ perspective: 1000 }}>
        <motion.div
          animate={controls}
          className="relative rounded-full"
          style={{
            width: 260,
            height: 260,
            background: "conic-gradient(from 0deg, #1a0a00 0deg, #2d1408 360deg)",
            boxShadow: "0 0 40px rgba(249,115,22,0.3), inset 0 0 30px rgba(0,0,0,0.5)",
          }}
        >
          {/* Segments */}
          {SEGMENTS.map((seg, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 flex items-center justify-center font-black text-white"
              style={{
                width: "50%",
                height: "50%",
                transformOrigin: "0 0",
                transform: `rotate(${i * SEGMENT_ANGLE}deg) translate(0, -50%)`,
                background: `conic-gradient(from ${i * SEGMENT_ANGLE}deg, ${seg.color} 0deg, ${seg.color} ${SEGMENT_ANGLE}deg, transparent ${SEGMENT_ANGLE}deg)`,
                clipPath: "polygon(0 0, 100% 0, 100% 100%)",
              }}
            >
              <span
                className="absolute text-xs font-black"
                style={{
                  transform: `rotate(${SEGMENT_ANGLE / 2}deg) translateX(38px)`,
                  textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                  color: "#fff",
                }}
              >
                {seg.label}
              </span>
            </div>
          ))}

          {/* Center hub */}
          <div
            className="absolute rounded-full flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              boxShadow: "0 0 20px rgba(249,115,22,0.5)",
              zIndex: 10,
            }}
          >
            <span className="text-lg">💥</span>
          </div>

          {/* Pointer */}
          <div
            className="absolute w-0 h-0"
            style={{
              top: -8,
              left: "50%",
              transform: "translateX(-50%)",
              borderLeft: "12px solid transparent",
              borderRight: "12px solid transparent",
              borderTop: "20px solid #fff",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
              zIndex: 20,
            }}
          />
        </motion.div>
      </div>

      {/* Multiplier result - shown when animation is done */}
      {showResult && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <p className="text-sm uppercase tracking-widest" style={{ color: "rgba(249,115,22,0.6)" }}>
            Multiplier
          </p>
          <p className="text-5xl font-black" style={{ color: "#f97316", textShadow: "0 0 30px rgba(249,115,22,0.5)" }}>
            {multiplier}x
          </p>
        </motion.div>
      )}
    </div>
  );
}
