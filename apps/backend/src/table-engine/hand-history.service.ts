import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { bestHandFrom, HAND_NAMES } from '../table-engine/hand-evaluator';

export interface HandHistoryEntry {
  handId: string;
  roomName: string;
  date: string;
  players: {
    id: string;
    nickname: string;
    holeCards: string[];
    finalHand: string;
    winAmount: number;
    netProfit: number;
  }[];
  communityCards: string[];
  pot: number;
  winnerId: string | null;
}

interface ParsedPlayer {
  id: string;
  nickname: string;
  holeCards: string[];
  finalHand: string;
  winAmount: number;
  netProfit: number;
}

interface HandForParsing {
  id: string;
  createdAt: Date;
  potSize: number;
  winnerId: string | null;
  actions: Array<{
    userId: string;
    action: string;
    amount: number;
    user?: { nickname: string | null; username: string | null };
  }>;
  settlements: Array<{ userId: string; amount: number }>;
  table: {
    stateSnapshot: string | null;
    room?: { name: string } | null;
  };
}

@Injectable()
export class HandHistoryService {
  constructor(private prisma: PrismaService) {}

  private parseHandToHistoryEntry(hand: HandForParsing): HandHistoryEntry {
    // Build player action summary from actions
    const playerActions = new Map<string, { bet: number; fold: boolean; allIn: boolean }>();
    for (const action of hand.actions) {
      if (!playerActions.has(action.userId)) {
        playerActions.set(action.userId, { bet: 0, fold: false, allIn: false });
      }
      const pa = playerActions.get(action.userId)!;
      if (action.action === 'FOLD') {
        pa.fold = true;
      } else if (action.action === 'ALLIN') {
        pa.allIn = true;
        pa.bet += action.amount;
      } else {
        pa.bet += action.amount;
      }
    }

    const players: ParsedPlayer[] = [...playerActions.entries()].map(([pid, pa]) => {
      const actionUser = hand.actions.find((a) => a.userId === pid)?.user;
      const settlement = hand.settlements.find((s) => s.userId === pid);
      const netProfit = (settlement?.amount ?? 0) - pa.bet;

      let holeCards: string[] = [];
      let finalHand = '弃牌';
      let winAmount = 0;

      if (!pa.fold && hand.table.stateSnapshot) {
        try {
          const snapshot = JSON.parse(hand.table.stateSnapshot);
          const playerData = snapshot.players?.find((p: any) => p?.id === pid);
          if (playerData) {
            holeCards = playerData.cards || [];
            if (snapshot.communityCards?.length >= 3) {
              const score = bestHandFrom(holeCards, snapshot.communityCards);
              finalHand = score.name;
            }
          }
          if (settlement) {
            winAmount = settlement.amount;
          }
        } catch {
          holeCards = ['??', '??'];
        }
      }

      return {
        id: pid,
        nickname: actionUser?.nickname ?? actionUser?.username ?? 'Unknown',
        holeCards,
        finalHand,
        winAmount,
        netProfit,
      };
    });

    let communityCards: string[] = [];
    if (hand.table.stateSnapshot) {
      try {
        const snapshot = JSON.parse(hand.table.stateSnapshot);
        communityCards = snapshot.communityCards || [];
      } catch {
        communityCards = [];
      }
    }

    return {
      handId: hand.id,
      roomName: hand.table.room?.name ?? 'Unknown Room',
      date: hand.createdAt.toISOString(),
      players,
      communityCards,
      pot: hand.potSize,
      winnerId: hand.winnerId,
    };
  }

  async getPlayerHandHistory(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<HandHistoryEntry[]> {
    const hands = await this.prisma.hand.findMany({
      where: {
        actions: {
          some: { userId },
        },
      },
      include: {
        table: {
          include: {
            room: true,
          },
        },
        settlements: true,
        actions: {
          include: { user: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return hands.map((hand) => this.parseHandToHistoryEntry(hand));
  }

  async getHandDetail(handId: string): Promise<HandHistoryEntry | null> {
    const hand = await this.prisma.hand.findUnique({
      where: { id: handId },
      include: {
        table: {
          include: {
            room: true,
          },
        },
        settlements: true,
        actions: {
          include: { user: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!hand) {
      return null;
    }

    return this.parseHandToHistoryEntry(hand);
  }

  exportToText(history: HandHistoryEntry[]): string {
    let output = '=== Hand History Export ===\n\n';

    for (const hand of history) {
      output += `Hand #${hand.handId.slice(0, 8)}\n`;
      output += `Room: ${hand.roomName}\n`;
      output += `Date: ${hand.date}\n`;
      output += `Pot: ${hand.pot}\n`;
      output += `Board: ${hand.communityCards.join(' ')}\n\n`;

      for (const player of hand.players) {
        const cards =
          player.holeCards.length > 0 ? player.holeCards.join(' ') : '-- --';
        output += `${player.nickname}: ${cards} [${player.finalHand}]`;
        if (player.winAmount > 0) {
          output += ` +${player.winAmount}`;
        }
        if (player.netProfit !== 0) {
          output += ` (${player.netProfit >= 0 ? '+' : ''}${player.netProfit})`;
        }
        output += '\n';
      }

      output += '\n' + '─'.repeat(40) + '\n\n';
    }

    return output;
  }
}
