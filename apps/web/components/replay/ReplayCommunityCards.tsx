"use client";

interface ReplayCommunityCardsProps {
  cards: string[];
  stage: string;
}

function CommunityCard({
  card,
  index,
  revealed,
}: {
  card: string;
  index: number;
  revealed: boolean;
}) {
  return (
    <div
      className="relative"
      style={{
        animationDelay: `${index * 200}ms`,
      }}
    >
      <div
        className="flex flex-col items-center justify-center rounded transition-all duration-500"
        style={{
          width: 48,
          height: 68,
          background: revealed
            ? "white"
            : "linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)",
          border: revealed
            ? "2px solid rgba(0,0,0,0.15)"
            : "2px solid rgba(245,158,11,0.3)",
          opacity: revealed ? 1 : 0.3,
          transform: revealed ? "scale(1)" : "scale(0.9)",
        }}
      >
        {revealed && card !== "??" ? (
          <>
            {(() => {
              const rank = card.slice(0, -1);
              const suit = card.slice(-1);
              const isRed = suit === "h" || suit === "d";
              return (
                <>
                  <span
                    className="font-black"
                    style={{
                      fontSize: 18,
                      color: isRed ? "#dc2626" : "#1e293b",
                    }}
                  >
                    {rank}
                  </span>
                  <span
                    style={{
                      fontSize: 16,
                      color: isRed ? "#dc2626" : "#1e293b",
                    }}
                  >
                    {suit}
                  </span>
                </>
              );
            })()}
          </>
        ) : (
          <span style={{ fontSize: 22, color: "rgba(245,158,11,0.4)" }}>
            🎴
          </span>
        )}
      </div>
    </div>
  );
}

export function ReplayCommunityCards({
  cards,
  stage,
}: ReplayCommunityCardsProps) {
  const revealedCount =
    stage === "SHOWDOWN"
      ? 5
      : stage === "RIVER"
        ? 5
        : stage === "TURN"
          ? 4
          : stage === "FLOP"
            ? 3
            : 0;

  // Pad cards to 5
  const padded = [...cards];
  while (padded.length < 5) padded.push("??");

  return (
    <div className="flex gap-2 items-center">
      {padded.map((card, i) => (
        <CommunityCard
          key={i}
          card={card}
          index={i}
          revealed={i < revealedCount}
        />
      ))}
    </div>
  );
}
