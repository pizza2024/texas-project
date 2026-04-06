import { GameStage, RAKE_RATE, RAKE_CAP } from './table-state';
import { Player, PlayerStatus } from './player';
import { determineWinners } from './hand-evaluator';
import { Table } from './table';

/** Rake for fold-wins (reduced since no showdown). */
const FOLD_RAKE_RATE = RAKE_RATE;
const FOLD_RAKE_CAP = RAKE_CAP;

export class TableRound {
  constructor(private table: Table) {}

  // ─── Round / street helpers ───────────────────────────────────────────────

  /** Returns true when the table is in a live betting stage. */
  isActionStage(): boolean {
    return (
      this.table.currentStage === GameStage.PREFLOP ||
      this.table.currentStage === GameStage.FLOP ||
      this.table.currentStage === GameStage.TURN ||
      this.table.currentStage === GameStage.RIVER
    );
  }

  /**
   * Returns true when all active players have acted and matched the current bet.
   * Used to determine if the betting round is complete.
   */
  isBettingRoundComplete(): boolean {
    const active = this.table.players.filter(
      (p) => p && p.status === PlayerStatus.ACTIVE,
    ) as Player[];
    return (
      active.length === 0 ||
      active.every((p) => p.hasActed && p.bet === this.table.currentBet)
    );
  }

  /** Next seat with ACTIVE status, wrapping around. */
  nextActiveFrom(fromIndex: number): number {
    const len = this.table.players.length;
    for (let i = 1; i <= len; i++) {
      const idx = (fromIndex + i) % len;
      const p = this.table.players[idx];
      if (p && p.status === PlayerStatus.ACTIVE) return idx;
    }
    return fromIndex;
  }

  // ─── Straddle ─────────────────────────────────────────────────────────────

  /**
   * Attempt to post a straddle (2x BB) from UTG position.
   * Only valid during preflop when the player is first to act.
   * The straddle effectively makes them act last preflop.
   */
  attemptStraddle(playerId: string): boolean {
    if (this.table.currentStage !== GameStage.PREFLOP) return false;
    if (this.table.straddle !== null) return false;

    const activePlayer = this.table.players[this.table.activePlayerIndex];
    if (!activePlayer || activePlayer.id !== playerId) return false;

    const straddleAmount = Math.min(
      this.table.bigBlind * 2,
      activePlayer.stack,
    );
    if (straddleAmount < this.table.bigBlind * 2) return false;

    const extraAmount = straddleAmount - activePlayer.bet;
    activePlayer.stack -= extraAmount;
    activePlayer.bet = straddleAmount;
    activePlayer.totalBet += extraAmount;
    this.table.pot += extraAmount;
    this.table.currentBet = straddleAmount;
    this.table.minBet = this.table.bigBlind;
    if (activePlayer.stack === 0) {
      activePlayer.status = PlayerStatus.ALLIN;
    }

    this.table.straddle = {
      playerId: activePlayer.id,
      amount: straddleAmount,
      position: activePlayer.position,
    };

    this.table.activePlayerIndex = this.nextActiveFrom(
      this.table.activePlayerIndex,
    );

    this.table.players.forEach((p) => {
      if (p && p.status === PlayerStatus.ACTIVE && p.id !== playerId) {
        p.hasActed = false;
      }
    });

    // Mark straddle player as having acted — they've put in 2x BB and will act last preflop.
    activePlayer.hasActed = true;

    return true;
  }

  // ─── Street / round advancement ───────────────────────────────────────────

  /**
   * Advance from the current betting round to the next street.
   * Resets per-street bets, burns and deals community cards, or triggers showdown.
   */
  advanceStreet(): void {
    // Reset per-street bet tracking
    this.table.players.forEach((p) => {
      if (p) {
        p.bet = 0;
        p.hasActed = false;
      }
    });
    this.table.currentBet = 0;
    this.table.minBet = this.table.bigBlind;

    switch (this.table.currentStage) {
      case GameStage.PREFLOP:
        this.table.currentStage = GameStage.FLOP;
        this.table.deck.pop(); // burn
        this.table.communityCards.push(
          this.table.deck.pop()!,
          this.table.deck.pop()!,
          this.table.deck.pop()!,
        );
        break;
      case GameStage.FLOP:
        this.table.currentStage = GameStage.TURN;
        this.table.deck.pop(); // burn
        this.table.communityCards.push(this.table.deck.pop()!);
        break;
      case GameStage.TURN:
        this.table.currentStage = GameStage.RIVER;
        this.table.deck.pop(); // burn
        this.table.communityCards.push(this.table.deck.pop()!);
        break;
      case GameStage.RIVER:
        this.table.currentStage = GameStage.SHOWDOWN;
        this.performShowdown();
        return; // hand evaluation handled here
    }

    // Post-flop: first active player after dealer acts first
    this.table.activePlayerIndex = this.nextActiveFrom(this.table.dealerIndex);
  }

  // ─── Showdown ──────────────────────────────────────────────────────────────

  private performShowdown(): void {
    const allPlayers = this.table.players.filter(
      (p): p is Player => p !== null,
    );
    const eligible = allPlayers.filter((p) => p.status !== PlayerStatus.FOLD);

    if (eligible.length === 0) {
      this.table.currentStage = GameStage.SETTLEMENT;
      return;
    }

    // --- Rake: deduct before distribution ---
    const rake = Math.min(
      Math.floor(this.table.pot * RAKE_RATE),
      RAKE_CAP,
    );
    this.table.pot -= rake;

    // --- Build pots (handles Side Pots for All-in players) ---
    const pots = this.buildPots(allPlayers);

    // Get hand rankings for all eligible players once (for display)
    const { all } = determineWinners(
      eligible.map((p) => ({ id: p.id, nickname: p.nickname, cards: p.cards })),
      this.table.communityCards,
    );

    // Distribute each pot to its winner(s)
    const winAmounts = new Map<string, number>();

    for (const pot of pots) {
      const potEligible = eligible.filter((p) =>
        pot.eligiblePlayerIds.includes(p.id),
      );
      if (potEligible.length === 0) continue;

      const { winners: potWinners } = determineWinners(
        potEligible.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          cards: p.cards,
        })),
        this.table.communityCards,
      );

      const share = Math.floor(pot.amount / potWinners.length);
      const remainder = pot.amount - share * potWinners.length;
      potWinners.forEach((w, idx) => {
        const current = winAmounts.get(w.playerId) ?? 0;
        winAmounts.set(
          w.playerId,
          current + share + (idx === 0 ? remainder : 0),
        );
      });
    }

    // Credit stacks
    for (const [pid, amount] of winAmounts) {
      const p = this.table.players.find((pl) => pl && pl.id === pid);
      if (p) p.stack += amount;
    }

    // Build result for all seated players
    const scoreMap = new Map(all.map((r) => [r.playerId, r]));
    this.table.lastHandResult = allPlayers.map((p) => {
      const isFolded = p.status === PlayerStatus.FOLD;
      const result = scoreMap.get(p.id);
      return {
        playerId: p.id,
        nickname: p.nickname,
        handName: isFolded ? '弃牌' : (result?.score.name ?? ''),
        winAmount: winAmounts.get(p.id) ?? 0,
        totalBet: p.totalBet,
        bestCards: isFolded ? [] : (result?.score.bestCards ?? []),
      };
    });

    this.table.pot = 0;
    this.table.isFoldWin = false;
    this.table.foldWinnerRevealed = false;
    this.table.currentStage = GameStage.SETTLEMENT;
    this.table.actionEndsAt = null;
  }

  // ─── Pot building ─────────────────────────────────────────────────────────

  /**
   * Build Main Pot + Side Pots based on each player's total contribution.
   * Folded players contribute to pots but are not eligible to win them.
   */
  buildPots(allPlayers: Player[]): import('./table-state').Pot[] {
    const contributors = allPlayers.filter((p) => p.totalBet > 0);
    const levels = [...new Set(contributors.map((p) => p.totalBet))].sort(
      (a, b) => a - b,
    );

    const pots: import('./table-state').Pot[] = [];
    let prevLevel = 0;

    for (const level of levels) {
      const contribution = level - prevLevel;
      const atThisLevel = allPlayers.filter((p) => p.totalBet >= level);
      const amount = contribution * atThisLevel.length;

      if (amount > 0) {
        const eligiblePlayerIds = atThisLevel
          .filter((p) => p.status !== PlayerStatus.FOLD)
          .map((p) => p.id);

        if (eligiblePlayerIds.length > 0) {
          pots.push({ amount, eligiblePlayerIds });
        } else if (pots.length > 0) {
          // All contributors at this level folded — add to previous pot
          pots[pots.length - 1].amount += amount;
        }
      }

      prevLevel = level;
    }

    return pots;
  }

  // ─── Fold-win resolution (called from multiple entry points) ─────────────

  /**
   * Resolve a fold-win: award the pot to the remaining player,
   * deduct rake, and transition to SETTLEMENT.
   */
  resolveFoldWin(winner: Player): void {
    const rake = Math.min(
      Math.floor(this.table.pot * FOLD_RAKE_RATE),
      FOLD_RAKE_CAP,
    );
    const winAmount = this.table.pot - rake;
    winner.stack += winAmount;
    this.table.pot = 0;
    this.table.lastHandResult = this.table.players
      .filter((p) => p !== null)
      .map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        handName: p.id === winner.id ? '其他玩家弃牌' : '弃牌',
        winAmount: p.id === winner.id ? winAmount : 0,
        totalBet: p.totalBet,
      }));
    this.table.isFoldWin = true;
    this.table.foldWinnerRevealed = false;
    this.table.currentStage = GameStage.SETTLEMENT;
  }

  /**
   * Award the pot to the given winner and transition to SETTLEMENT.
   * Used after all opponents fold mid-hand.
   */
}
