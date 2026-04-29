"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { HandReplayData } from "./ReplayModal";

interface EquityCurveChartProps {
  data: HandReplayData;
  currentStage: string;
}

// Simple hand strength comparator (higher = better)
function handStrength(name: string): number {
  const order = [
    "皇家同花顺",
    "同花顺",
    "四条",
    "葫芦",
    "同花",
    "顺子",
    "三条",
    "两对",
    "一对",
    "高牌",
  ];
  const idx = order.indexOf(name);
  return idx === -1 ? 0 : order.length - idx;
}

interface EquityPoint {
  stage: string;
  [playerId: string]: string | number;
}

const PLAYER_COLORS = [
  "#f59e0b",
  "#3b82f6",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

export function EquityCurveChart({
  data,
  currentStage: _currentStage,
}: EquityCurveChartProps) {
  void _currentStage;
  // Build equity curve data from timeline
  const stageMap = new Map<number, EquityPoint>();

  for (const node of data.timeline) {
    if (node.action === null) continue; // skip stage markers
    const stageOrder = ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"];
    const stageIdx = stageOrder.indexOf(node.stage.toUpperCase());
    if (stageIdx < 0) continue;

    if (!stageMap.has(stageIdx)) {
      stageMap.set(stageIdx, { stage: node.stage.toUpperCase() });
    }

    void stageMap.get(stageIdx);
    // Approximate equity: give 100% to the player with the best hand at this point
    // Use hand name from the player's final hand (available at SHOWDOWN)
    // For now, distribute based on final hand strength
  }

  // Compute equity per stage based on showdown hand strengths
  const playerHandStrengths = new Map<string, number>();
  for (const p of data.players) {
    playerHandStrengths.set(p.id, handStrength(p.handName));
  }

  const stages = ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"];
  const chartData: EquityPoint[] = [];

  for (const stage of stages) {
    const point: EquityPoint = { stage };
    const activePlayers = data.players.filter((p) => {
      if (stage === "PREFLOP") return true;
      // Players who folded are excluded
      const timelineNode = data.timeline.find(
        (n) => n.playerId === p.id && n.stage.toUpperCase() === stage,
      );
      return timelineNode && timelineNode.action !== "FOLD";
    });

    if (activePlayers.length === 0) {
      for (const p of data.players) {
        point[p.id] = 0;
      }
    } else {
      // Find best hand among active players
      let maxStrength = 0;
      for (const p of activePlayers) {
        const s = playerHandStrengths.get(p.id) ?? 0;
        if (s > maxStrength) maxStrength = s;
      }

      for (const p of data.players) {
        const s = playerHandStrengths.get(p.id) ?? 0;
        const isActive = activePlayers.some((ap) => ap.id === p.id);
        if (!isActive) {
          point[p.id] = 0;
        } else if (s === maxStrength && maxStrength > 0) {
          // Winner(s) get proportional equity
          const winners = activePlayers.filter(
            (ap) => (playerHandStrengths.get(ap.id) ?? 0) === maxStrength,
          );
          point[p.id] = Math.round(100 / winners.length);
        } else {
          point[p.id] = 0;
        }
      }
    }
    chartData.push(point);
  }

  return (
    <div
      className="px-4 py-3 border-b"
      style={{
        borderColor: "rgba(245,158,11,0.1)",
        background: "rgba(0,0,0,0.2)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "rgba(245,158,11,0.7)" }}
        >
          Equity Curve
        </span>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
        >
          <XAxis
            dataKey="stage"
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(0,0,0,0.85)",
              border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 8,
              fontSize: 12,
              color: "white",
            }}
            formatter={(value: number) => [`${value}%`, ""]}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
            formatter={(value) => {
              const player = data.players.find((p) => p.id === value);
              return (
                <span style={{ color: "rgba(255,255,255,0.7)" }}>
                  {player?.nickname ?? value}
                </span>
              );
            }}
          />
          {data.players.map((player, i) => (
            <Line
              key={player.id}
              type="monotone"
              dataKey={player.id}
              stroke={PLAYER_COLORS[i % PLAYER_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
