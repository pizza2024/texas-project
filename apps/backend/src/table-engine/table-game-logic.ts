import { GameStage } from './table-state';
import { Player, PlayerStatus } from './player';
import { Table } from './table';

/** Card ranks in order from 2 to A. */
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
/** Card suits. */
const SUITS = ['s', 'h', 'd', 'c'];

export class TableGameLogic {
  constructor(private table: Table) {}

  // ─── Deck management ─────────────────────────────────────────────────────

  /** Initialise a fresh 52-card deck. */
  initDeck(): string[] {
    const deck: string[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push(rank + suit);
      }
    }
    return deck;
  }

  /** Fisher-Yates shuffle using crypto.getRandomValues for cryptographically secure randomness. */
  shuffle(deck: string[]): string[] {
    const d = [...deck];
    const random = new Uint32Array(1);
    for (let i = d.length - 1; i > 0; i--) {
      crypto.getRandomValues(random);
      const j = random[0] % (i + 1);
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  // ─── Seat navigation ──────────────────────────────────────────────────────

  /** Returns the index of the next non-null, non-zero-stack seat starting from (fromIndex + 1), wrapping around. */
  nextSeatedFrom(fromIndex: number): number {
    const len = this.table.players.length;
    for (let i = 1; i <= len; i++) {
      const idx = (fromIndex + i) % len;
      if (this.isPlayablePlayer(this.table.players[idx])) return idx;
    }
    return fromIndex;
  }

  /** True when the player is seated, has a stack, and is not SITOUT. */
  isPlayablePlayer(player: Player | null): player is Player {
    return !!player && player.stack > 0;
  }

  // ─── Hand lifecycle ───────────────────────────────────────────────────────

  /**
   * Start a new hand: assign button/blinds, deal cards, post blinds.
   * Visible for integration tests (table-game-logic.spec.ts).
   */
  startHand(): void {
    const seated = this.table.players.filter((p) => this.isPlayablePlayer(p));

    // Reset all player state for the new hand
    this.table.players
      .filter((player): player is Player => player !== null)
      .forEach((p) => {
        p.isButton = false;
        p.isSmallBlind = false;
        p.isBigBlind = false;
        p.cards = [];
        p.bet = 0;
        p.totalBet = 0;
        p.hasActed = false;
        p.status = p.stack > 0 ? PlayerStatus.ACTIVE : PlayerStatus.SITOUT;
        p.ready = false;
        // Option C: reset consecutive timeout counter each new hand
        p.consecutiveTimeouts = 0;
      });

    // Reset board state
    this.table.communityCards = [];
    this.table.pot = 0;
    this.table.currentBet = 0;
    this.table.lastHandResult = null;
    this.table.settlementEndsAt = null;
    this.table.readyCountdownEndsAt = null;
    this.table.actionEndsAt = null;
    this.table.straddle = null;
    this.table.calledAllIn = null;
    this.table.lastSitoutAutoFold = null;
    this.table.rakeAmount = 0;
    this.table.rakePercent = 0;

    // Assign positions
    const dealerIdx = this.isPlayablePlayer(
      this.table.players[this.table.dealerIndex],
    )
      ? this.table.dealerIndex
      : this.nextSeatedFrom(this.table.dealerIndex);
    this.table.dealerIndex = dealerIdx;
    this.table.players[dealerIdx]!.isButton = true;

    const sbIdx = this.nextSeatedFrom(dealerIdx);
    this.table.players[sbIdx]!.isSmallBlind = true;

    const bbIdx = this.nextSeatedFrom(sbIdx);
    this.table.players[bbIdx]!.isBigBlind = true;

    // Initialize and shuffle deck
    this.table.deck = this.shuffle(this.initDeck());

    // Deal 2 cards per player clockwise starting from SB (one card at a time)
    const orderedSeatIndices: number[] = [];
    let idx = sbIdx;
    for (let i = 0; i < seated.length; i++) {
      orderedSeatIndices.push(idx);
      idx = this.nextSeatedFrom(idx);
    }

    for (let round = 0; round < 2; round++) {
      for (const seatIdx of orderedSeatIndices) {
        const player = this.table.players[seatIdx];
        if (player) {
          player.cards.push(this.table.deck.pop()!);
        }
      }
    }

    // Post blinds: deduct from stacks, add to pot
    const sbPlayer = this.table.players[sbIdx]!;
    const bbPlayer = this.table.players[bbIdx]!;
    const sbAmount = Math.min(this.table.smallBlind, sbPlayer.stack);
    const bbAmount = Math.min(this.table.bigBlind, bbPlayer.stack);

    sbPlayer.stack -= sbAmount;
    sbPlayer.bet = sbAmount;
    sbPlayer.totalBet = sbAmount;
    if (sbPlayer.stack === 0) {
      sbPlayer.status = PlayerStatus.ALLIN;
    }

    bbPlayer.stack -= bbAmount;
    bbPlayer.bet = bbAmount;
    bbPlayer.totalBet = bbAmount;
    if (bbPlayer.stack === 0) {
      bbPlayer.status = PlayerStatus.ALLIN;
    }

    this.table.pot = sbAmount + bbAmount;
    this.table.currentBet = bbAmount;

    // First to act preflop: UTG (seat after BB)
    this.table.activePlayerIndex = this.nextSeatedFrom(bbIdx);
    this.table.currentStage = GameStage.PREFLOP;
  }

  // ─── Reset ───────────────────────────────────────────────────────────────

  /** Reset table back to WAITING for a new hand. Advances the dealer button. */
  resetToWaiting(): void {
    // Advance dealer button clockwise for next hand
    this.table.dealerIndex = this.nextSeatedFrom(this.table.dealerIndex);

    const seated = this.table.players.filter((p) => p !== null);
    seated.forEach((p) => {
      p.cards = [];
      p.bet = 0;
      p.totalBet = 0;
      p.hasActed = false;
      p.isButton = false;
      p.isSmallBlind = false;
      p.isBigBlind = false;
      p.ready = false;
      p.status = p.stack > 0 ? PlayerStatus.ACTIVE : PlayerStatus.SITOUT;
    });

    this.table.communityCards = [];
    this.table.deck = [];
    this.table.pot = 0;
    this.table.currentBet = 0;
    this.table.minBet = this.table.bigBlind;
    this.table.activePlayerIndex = -1;
    this.table.lastHandResult = null;
    this.table.settlementEndsAt = null;
    this.table.readyCountdownEndsAt = null;
    this.table.actionEndsAt = null;
    this.table.isFoldWin = false;
    this.table.foldWinnerRevealed = false;
    this.table.straddle = null;
    this.table.calledAllIn = null;
    this.table.currentStage = GameStage.WAITING;
    this.table.lastSitoutAutoFold = null;
  }
}
