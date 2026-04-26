import { z } from 'zod';

export const JoinRoomSchema = z.object({
  roomId: z.string().min(1),
  password: z.string().optional(),
});

export const PlayerActionSchema = z.object({
  action: z.enum(['check', 'fold', 'call', 'raise', 'allin', 'straddle', 'sit-out']),
  amount: z.number().int().optional(),
  roomId: z.string().min(1).optional(), // Optional - can be derived from user's current room
});

export const QuickMatchSchema = z.object({
  tier: z.enum(['MICRO', 'LOW', 'MEDIUM', 'HIGH', 'PREMIUM']),
});

/** 5 allowed emoji reactions */
export const EmojiReactionSchema = z.object({
  emoji: z.enum(['👍', '❤️', '😂', '😮', '🔥']),
});

export type JoinRoomInput = z.infer<typeof JoinRoomSchema>;
export type PlayerActionInput = z.infer<typeof PlayerActionSchema>;
export type QuickMatchInput = z.infer<typeof QuickMatchSchema>;
export type EmojiReactionInput = z.infer<typeof EmojiReactionSchema>;
