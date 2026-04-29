"use client";

const PLAYER_EMOJIS = [
  "🦁",
  "🐯",
  "🦊",
  "🐼",
  "🐨",
  "🦅",
  "🦋",
  "🐉",
  "🦄",
  "🎩",
  "👑",
  "🃏",
  "🎰",
  "🎲",
  "🦈",
];

export function getPlayerEmoji(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0x7fffffff;
  }
  return PLAYER_EMOJIS[hash % PLAYER_EMOJIS.length];
}

const API_BASE =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")
    : "http://localhost:4000";

interface UserAvatarProps {
  /** DB user id — used for emoji fallback hash */
  userId: string;
  /** Avatar path from DB (e.g. "/uploads/avatars/xxx.jpg"), or null/empty */
  avatar?: string | null;
  /** Display size in px (default 44) */
  size?: number;
  /** Extra className for the outer container */
  className?: string;
  /** Extra inline styles */
  style?: React.CSSProperties;
  /** Called when the avatar is clicked */
  onClick?: () => void;
}

/**
 * Unified avatar component.
 * - Has an image: renders the image with a fallback to emoji on error.
 * - No image: shows a deterministic emoji derived from userId.
 */
export function UserAvatar({
  userId,
  avatar,
  size = 44,
  className = "",
  style,
  onClick,
}: UserAvatarProps) {
  const emoji = getPlayerEmoji(userId);
  const src = avatar ? `${API_BASE}${avatar}` : null;

  return (
    <div
      className={`rounded-full flex items-center justify-center overflow-hidden select-none shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      onClick={onClick}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="avatar"
          className="w-full h-full object-cover"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.style.display = "none";
            const parent = img.parentElement;
            if (parent && !parent.dataset.emojiShown) {
              parent.dataset.emojiShown = "1";
              const span = document.createElement("span");
              span.textContent = emoji;
              span.style.fontSize = `${Math.round(size * 0.52)}px`;
              span.style.lineHeight = "1";
              parent.appendChild(span);
            }
          }}
        />
      ) : (
        <span style={{ fontSize: Math.round(size * 0.52), lineHeight: 1 }}>
          {emoji}
        </span>
      )}
    </div>
  );
}
