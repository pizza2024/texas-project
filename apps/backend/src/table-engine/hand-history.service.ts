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
    cardsRevealed: boolean;
  }[];
  communityCards: string[];
  pot: number;
  winnerId: string | null;
  cardsRevealed: boolean;
}

// ─── Hand Replay Types ────────────────────────────────────────────────────────

/** A single decision node in the replay timeline. */
export interface ReplayActionNode {
  /** 0-based index into the replay timeline. */
  index: number;
  /** Player who took this action. */
  playerId: string;
  playerNickname: string;
  /** Null for system events (e.g. stage transition). */
  action: string | null;
  /** Chips put in by this player in this action (0 for checks/folds/stage transitions). */
  amount: number;
  /** Player's total chips in the pot this hand (after this action resolved). */
  totalBet: number;
  /** Player's remaining stack after this action. */
  remainingStack: number;
  /** Current accumulated pot size. */
  potAfter: number;
  /** Community cards visible at this point in the timeline. */
  communityCards: string[];
  /** Current game stage. */
  stage: string;
  /** Human-readable description of this event. */
  description: string;
}

/** Full hand replay data returned by GET /hands/:id/replay. */
export interface HandReplayData {
  handId: string;
  roomName: string;
  date: string;
  smallBlind: number;
  bigBlind: number;
  /** Blinds + antes + straddle that started the hand. */
  initialPot: number;
  /** Final pot size at showdown/settlement. */
  finalPot: number;
  /** Each player's hole cards, net profit, and final hand name. */
  players: Array<{
    id: string;
    nickname: string;
    holeCards: string[];
    netProfit: number;
    handName: string;
  }>;
  /** Community cards (full 5-card board at showdown). */
  communityCards: string[];
  /** Winner playerId (null if no winner e.g. all folded). */
  winnerId: string | null;
  /** Ordered timeline of game events for the replay UI. */
  timeline: ReplayActionNode[];
}

interface ParsedPlayer {
  id: string;
  nickname: string;
  holeCards: string[];
  finalHand: string;
  winAmount: number;
  netProfit: number;
  cardsRevealed: boolean;
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
    const playerActions = new Map<
      string,
      { bet: number; fold: boolean; allIn: boolean }
    >();
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

    const players: ParsedPlayer[] = [...playerActions.entries()].map(
      ([pid, pa]) => {
        const actionUser = hand.actions.find((a) => a.userId === pid)?.user;
        const settlement = hand.settlements.find((s) => s.userId === pid);
        const netProfit = (settlement?.amount ?? 0) - pa.totalBet;

        let holeCards: string[] = [];
        let finalHand = '弃牌';
        let winAmount = 0;

        if (!pa.fold && hand.table.stateSnapshot) {
          try {
            const snapshot = JSON.parse(hand.table.stateSnapshot);
            const playerData = snapshot.players?.find(
              (p: any) => p?.id === pid,
            );
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
          cardsRevealed: holeCards[0] !== '??',
        };
      },
    );

    let communityCards: string[] = [];
    let cardsRevealed = false;
    if (hand.table.stateSnapshot) {
      try {
        const snapshot = JSON.parse(hand.table.stateSnapshot);
        communityCards = snapshot.communityCards || [];
        cardsRevealed = true;
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
      cardsRevealed,
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

  async getHandReplay(handId: string): Promise<HandReplayData | null> {
    const hand = await this.prisma.hand.findUnique({
      where: { id: handId },
      include: {
        table: {
          include: { room: true },
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

    // ─── Parse final state from stateSnapshot ─────────────────────────────────
    let snapshotPlayers: any[] = [];
    let communityCards: string[] = [];
    let smallBlind = 0;
    let bigBlind = 0;
    const finalPot = hand.potSize;

    if (hand.table.stateSnapshot) {
      try {
        const snap = JSON.parse(hand.table.stateSnapshot);
        snapshotPlayers = snap.players ?? [];
        communityCards = snap.communityCards ?? [];
        smallBlind = snap.smallBlind ?? 0;
        bigBlind = snap.bigBlind ?? 0;
      } catch {
        // snapshot unparseable — continue with defaults
      }
    }

    // ─── Build per-player net-profit map from settlements ─────────────────────
    const netProfitMap = new Map<string, number>();
    for (const s of hand.settlements) {
      netProfitMap.set(s.userId, s.amount);
    }

    // ─── Build timeline ─────────────────────────────────────────────────────
    const timeline: ReplayActionNode[] = [];
    let potAfter = 0;
    // Track per-player cumulative chip contribution this hand
    const playerTotalBet = new Map<string, number>();
    // Track per-player stack from snapshot (best-effort; may be 0 for inactive players)
    const playerStartingStack = new Map<string, number>();
    for (const p of snapshotPlayers) {
      if (p?.id) {
        playerStartingStack.set(p.id, Number(p.stack) || 0);
        playerTotalBet.set(p.id, 0);
      }
    }
    // Tracks how much each player has put in this street (resets each stage)
    let streetBet = 0;
    let lastCommunityCount = 0;

    const playerNickname = (pid: string): string => {
      const a = hand.actions.find((x) => x.userId === pid)?.user;
      return a?.nickname ?? a?.username ?? 'Unknown';
    };

    const actionLabel = (act: string): string => {
      switch (act) {
        case 'SMALL_BLIND':
          return '小盲';
        case 'BIG_BLIND':
          return '大盲';
        case 'FOLD':
          return '弃牌';
        case 'CHECK':
          return '过牌';
        case 'CALL':
          return '跟注';
        case 'RAISE':
          return '加注';
        case 'ALLIN':
          return '全下';
        case 'STRADDLE':
          return '枪口';
        case 'SITOUT':
          return '坐下';
        default:
          return act;
      }
    };

    const STAGE_LABELS: Record<number, string> = {
      0: 'preflop',
      1: 'flop',
      2: 'turn',
      3: 'river',
      4: 'showdown',
    };

    for (const act of hand.actions) {
      const pid = act.userId;

      // ── Stage-transition node (community cards changed) ────────────────────
      const commCount =
        act.action === 'FLOP'
          ? 3
          : act.action === 'TURN'
            ? 4
            : act.action === 'RIVER'
              ? 5
              : lastCommunityCount;

      if (commCount !== lastCommunityCount && lastCommunityCount > 0) {
        // New street begins — insert a stage marker
        const stageIdx =
          lastCommunityCount === 0
            ? 0
            : lastCommunityCount === 3
              ? 1
              : lastCommunityCount === 4
                ? 2
                : 3;
        timeline.push({
          index: timeline.length,
          playerId: '',
          playerNickname: '',
          action: null,
          amount: 0,
          totalBet: 0,
          remainingStack: 0,
          potAfter,
          communityCards: communityCards.slice(0, lastCommunityCount),
          stage: STAGE_LABELS[stageIdx] ?? 'unknown',
          description: `进入${STAGE_LABELS[stageIdx] === 'flop' ? '翻牌' : STAGE_LABELS[stageIdx] === 'turn' ? '转牌' : STAGE_LABELS[stageIdx] === 'river' ? '河牌' : STAGE_LABELS[stageIdx] === 'showdown' ? '摊牌' : 'preflop'}阶段`,
        });
      }

      // Update community cards state for next iteration
      if (
        act.action === 'FLOP' ||
        act.action === 'TURN' ||
        act.action === 'RIVER'
      ) {
        lastCommunityCount = commCount;
      }

      // ── Pot update ─────────────────────────────────────────────────────────
      const bet = act.amount ?? 0;
      potAfter += bet;
      const prevBet = playerTotalBet.get(pid) ?? 0;
      playerTotalBet.set(pid, prevBet + bet);

      // ── Street bet reset on new street (BB closes each street's betting) ──
      if (
        act.action === 'FLOP' ||
        act.action === 'TURN' ||
        act.action === 'RIVER'
      ) {
        streetBet = 0;
      }

      // ── Remaining stack (best-effort from snapshot; 0 if not found) ───────
      const startingStack = playerStartingStack.get(pid) ?? 0;
      const totalBet = playerTotalBet.get(pid) ?? bet;
      const remainingStack = Math.max(0, startingStack - totalBet);

      const stageIdx =
        lastCommunityCount === 0
          ? 0
          : lastCommunityCount === 3
            ? 1
            : lastCommunityCount === 4
              ? 2
              : lastCommunityCount === 5
                ? 3
                : 4;

      timeline.push({
        index: timeline.length,
        playerId: pid,
        playerNickname: playerNickname(pid),
        action: act.action,
        amount: bet,
        totalBet,
        remainingStack,
        potAfter,
        communityCards: communityCards.slice(0, lastCommunityCount || 0),
        stage: STAGE_LABELS[stageIdx] ?? 'preflop',
        description: `${playerNickname(pid)} ${actionLabel(act.action)}${bet > 0 ? ` ${bet}` : ''}`,
      });
    }

    // ─── Initial pot: SB + BB + straddle (first actions) ─────────────────────
    const firstActions = hand.actions.slice(0, 3);
    const initialPot = firstActions.reduce(
      (sum, a) => sum + (a.amount ?? 0),
      0,
    );

    // ─── Players array ────────────────────────────────────────────────────────
    const winnerId = hand.winnerId;
    const players = hand.actions
      .reduce<string[]>(
        (ids, a) => (ids.includes(a.userId) ? ids : [...ids, a.userId]),
        [],
      )
      .map((pid) => {
        const snap = snapshotPlayers.find((p: any) => p?.id === pid);
        const holeCards: string[] = snap?.cards ?? [];
        const netProfit = netProfitMap.get(pid) ?? 0;
        let handName = '弃牌';
        if (holeCards.length > 0 && communityCards.length >= 3) {
          try {
            handName = bestHandFrom(holeCards, communityCards).name;
          } catch {
            handName = '?';
          }
        }
        return {
          id: pid,
          nickname: playerNickname(pid),
          holeCards,
          netProfit,
          handName,
        };
      });

    return {
      handId: hand.id,
      roomName: hand.table.room?.name ?? 'Unknown Room',
      date: hand.createdAt.toISOString(),
      smallBlind,
      bigBlind,
      initialPot,
      finalPot,
      players,
      communityCards,
      winnerId,
      timeline,
    };
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
