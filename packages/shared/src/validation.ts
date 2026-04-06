import { z } from 'zod';

export const JoinRoomSchema = z.object({
  roomId: z.string().min(1),
  password: z.string().optional(),
});

export const PlayerActionSchema = z.object({
  action: z.enum(['check', 'fold', 'call', 'raise', 'allin', 'sit-out']),
  amount: z.number().nonnegative().optional(),
  roomId: z.string().min(1).optional(), // Optional - can be derived from user's current room
});

export const QuickMatchSchema = z.object({
  tier: z.enum(['MICRO', 'LOW', 'MEDIUM', 'HIGH', 'PREMIUM']),
});

export type JoinRoomInput = z.infer<typeof JoinRoomSchema>;
export type PlayerActionInput = z.infer<typeof PlayerActionSchema>;
export type QuickMatchInput = z.infer<typeof QuickMatchSchema>;
