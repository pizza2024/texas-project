"use client";

import type { ReplayActionNode } from "./ReplayModal";

interface ReplayActionLogProps {
  nodes: ReplayActionNode[];
  currentIndex: number;
  onSelectNode: (index: number) => void;
  onHoverNode?: (node: ReplayActionNode | null) => void;
}

export function ReplayActionLog({
  nodes,
  currentIndex,
  onSelectNode,
  onHoverNode,
}: ReplayActionLogProps) {
  return (
    <div className="flex flex-col h-full">
      <div
        className="px-3 py-2 text-xs font-bold uppercase tracking-widest"
        style={{
          color: "rgba(245,158,11,0.7)",
          borderBottom: "1px solid rgba(245,158,11,0.1)",
        }}
      >
        Action Log
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {nodes.map((node, i) => {
          const isActive = i === currentIndex;
          const isStageTransition = node.action === null;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectNode(i)}
              onMouseEnter={() => onHoverNode?.(node)}
              onMouseLeave={() => onHoverNode?.(null)}
              className="w-full text-left px-3 py-2 transition-colors"
              style={{
                background: isActive ? "rgba(245,158,11,0.1)" : "transparent",
                borderLeft: isActive
                  ? "2px solid #f59e0b"
                  : "2px solid transparent",
              }}
            >
              {isStageTransition ? (
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold uppercase"
                    style={{ color: "rgba(245,158,11,0.6)" }}
                  >
                    — {node.stage} —
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-xs font-medium truncate"
                      style={{
                        color: isActive ? "#f59e0b" : "rgba(255,255,255,0.75)",
                      }}
                    >
                      {node.playerNickname}
                    </span>
                    {node.amount > 0 && (
                      <span
                        className="text-xs font-bold tabular-nums flex-shrink-0"
                        style={{ color: "rgba(245,158,11,0.7)" }}
                      >
                        {node.amount > 0 ? `+${node.amount}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-xs font-bold uppercase"
                      style={{
                        color:
                          node.action === "FOLD"
                            ? "#f87171"
                            : node.action === "CHECK"
                              ? "#94a3b8"
                              : node.action === "CALL"
                                ? "#60a5fa"
                                : node.action === "RAISE"
                                  ? "#fbbf24"
                                  : node.action === "ALLIN"
                                    ? "#f87171"
                                    : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {node.action}
                    </span>
                    <span
                      className="text-xs tabular-nums"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      {node.potAfter.toLocaleString()} pot
                    </span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
