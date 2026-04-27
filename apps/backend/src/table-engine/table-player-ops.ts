import { GameStage, PlayerInput } from './table-state';
import { Player, PlayerStatus } from './player';
import { Table } from './table';
import { TableRound } from './table-round';

/** Option C: Max consecutive action timeouts before forced sit-out (per seat). */
const MAX_CONSECUTIVE_TIMEOUTS = 3;

export class TablePlayerOps {
  constructor(
    private table: Table,
    private round: TableRound,
  ) {}

  // ─── Player membership ────────────────────────────────────────────────────

  addPlayer(player: PlayerInput, initialStack = 1000): boolean {
    const playerId = player.sub ?? player.id!;
    if (!playerId) return false;

    if (this.table.hasPlayer(playerId)) {
      // Refresh display name and avatar from latest data on every connect/reconnect
      const existing = this.table.players.find((p) => p?.id === playerId);
      if (existing) {
        existing.nickname =
          player.nickname ?? player.username ?? existing.nickname;
        existing.avatar = player.avatar ?? existing.avatar ?? '';
      }
      return true;
    }

    const seatIndex = this.table.players.findIndex((p) => p === null);
    if (seatIndex === -1) return false;

    // transform user to player
    const newPlayer: Player = {
      id: playerId,
      nickname: player.nickname ?? player.username ?? 'Unknown',
      avatar: player.avatar ?? '',
      stack: Math.max(0, initialStack),
      bet: 0,
      totalBet: 0,
      status: initialStack > 0 ? PlayerStatus.ACTIVE : PlayerStatus.SITOUT,
      cards: [],
      position: seatIndex,
      isButton: false,
      isSmallBlind: false,
      isBigBlind: false,
      hasActed: false,
      // Preserve ready=true for bots (auto-ready), default to false for humans
      ready: player.ready ?? false,
      consecutiveTimeouts: 0,
    };

    this.table.players[seatIndex] = newPlayer;
    return true;
  }

  removePlayer(playerId: string): Player | null {
    const index = this.table.players.findIndex((p) => p && p.id === playerId);
    if (index !== -1) {
      const removedPlayer = this.table.players[index];
      this.table.players[index] = null;
      return removedPlayer;
    }
    return null;
  }

  // ─── Ready management ─────────────────────────────────────────────────────

  /** Toggle ready state for a player. Returns whether all seated players are ready afterwards. */
  setPlayerReady(playerId: string): boolean {
    if (this.table.currentStage !== GameStage.WAITING) return false;

    const player = this.table.players.find((p) => p && p.id === playerId);
    if (!player || player.stack <= 0) return false;

    player.ready = !player.ready;
    return this.table.areAllSeatedPlayersReady();
  }

  // ─── Mid-hand forced fold (player leaving) ───────────────────────────────

  /**
   * Force-fold a player who is leaving mid-hand.
   * Only acts during active betting stages (PREFLOP/FLOP/TURN/RIVER).
   * Triggers fold-win if only one non-folded player remains, or advances
   * the turn/street when the leaving player was active or their fold
   * completes the betting round.
   * Returns true if the hand reached SETTLEMENT as a result.
   */
  foldPlayerOnLeave(playerId: string): boolean {
    if (!this.round.isActionStage()) return false;

    const playerIndex = this.table.players.findIndex(
      (p) => p && p.id === playerId,
    );
    if (playerIndex === -1) return false;

    const player = this.table.players[playerIndex];
    if (!player) return false;

    // Already out of betting action — nothing to fold.
    if (
      player.status === PlayerStatus.FOLD ||
      player.status === PlayerStatus.ALLIN
    )
      return false;

    player.status = PlayerStatus.FOLD;
    this.table.actionEndsAt = null;

    // Check if only one non-folded player remains → fold-win.
    const notFolded = this.table.players.filter(
      (p) => p && p.status !== PlayerStatus.FOLD,
    ) as Player[];
    if (notFolded.length === 1) {
      this.round.resolveFoldWin(notFolded[0]);
      return true;
    }

    // Advance turn or street when appropriate.
    if (
      this.table.activePlayerIndex === playerIndex ||
      this.round.isBettingRoundComplete()
    ) {
      if (this.round.isBettingRoundComplete()) {
        this.round.advanceStreet();
      } else {
        this.table.activePlayerIndex = this.round.nextActiveFrom(
          this.table.activePlayerIndex,
        );
      }
    }

    return this.table.currentStage === GameStage.SETTLEMENT;
  }

  // ─── Auto-fold sit-out player ─────────────────────────────────────────────

  /**
   * Auto-folds the current active player if they are sitting out.
   * Returns true if the player was folded and action was advanced.
   */
  foldSitOutPlayer(): boolean {
    if (!this.round.isActionStage()) {
      return false;
    }

    const activePlayer = this.table.players[this.table.activePlayerIndex];
    if (!activePlayer || activePlayer.status !== PlayerStatus.SITOUT) {
      return false;
    }

    activePlayer.status = PlayerStatus.FOLD;
    activePlayer.hasActed = true;
    this.table.actionEndsAt = null;

    const notFolded = this.table.players.filter(
      (p) => p && p.status !== PlayerStatus.FOLD,
    ) as Player[];
    if (notFolded.length === 1) {
      this.round.resolveFoldWin(notFolded[0]);
      return true;
    }

    if (this.round.isBettingRoundComplete()) {
      this.round.advanceStreet();
    } else {
      this.table.activePlayerIndex = this.round.nextActiveFrom(
        this.table.activePlayerIndex,
      );
    }

    return true;
  }

  /**
   * Checks if the current active player is sitting out.
   * If so, auto-folds them, starts the sit-out timeout countdown, and records the event.
   * Called at the end of each action resolution in processAction.
   * Returns true if a sit-out player was auto-folded (hand did not end).
   *
   * Option C (折中): Increments consecutive timeout counter each time a player is
   * auto-folded due to timing out (hasn't acted when actionEndsAt expires).
   * After MAX_CONSECUTIVE_TIMEOUTS (3) consecutive timeouts, the player is
   * forcibly moved to SITOUT status for the remainder of the session and their
   * counter is reset.
   */
  checkAndAutoFoldSittingOut(): boolean {
    if (!this.round.isActionStage()) return false;
    if (this.table.activePlayerIndex < 0) return false;

    const player = this.table.players[this.table.activePlayerIndex];
    if (!player) return false;

    if (player.status !== PlayerStatus.SITOUT) return false;

    // Record the auto-fold event
    this.table.lastSitoutAutoFold = {
      playerId: player.id,
      seatIndex: this.table.activePlayerIndex,
    };

    // Increment consecutive timeout counter (Option C)
    player.consecutiveTimeouts += 1;

    // Option C: Force SITOUT after 3 consecutive timeouts
    if (player.consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
      // Player is forcibly moved to sit-out; they keep the SITOUT status.
      // They will be skipped in future hands until they interact again.
      // Reset counter so they start fresh if they manually return.
      player.consecutiveTimeouts = 0;
      // Force-fold: player stays SITOUT for remainder of session.
      player.status = PlayerStatus.FOLD;
      player.hasActed = true;
      this.table.actionEndsAt = null;

      // Check if this fold results in only one remaining player (fold-win)
      const notFolded = this.table.players.filter(
        (p) => p && p.status !== PlayerStatus.FOLD,
      ) as Player[];
      if (notFolded.length === 1) {
        this.round.resolveFoldWin(notFolded[0]);
        return false;
      }

      // Advance to the next active player — P0-NEW-TABLE-STUCK fix
      if (this.round.isBettingRoundComplete()) {
        this.round.advanceStreet();
      } else {
        this.table.activePlayerIndex = this.round.nextActiveFrom(
          this.table.activePlayerIndex,
        );
      }
      return true;
    }

    // Auto-fold: mark player as folded (normal case, under limit)
    player.status = PlayerStatus.FOLD;
    player.hasActed = true;
    this.table.actionEndsAt = null;

    // Check if this fold results in only one remaining player
    const notFolded = this.table.players.filter(
      (p) => p && p.status !== PlayerStatus.FOLD,
    ) as Player[];
    if (notFolded.length === 1) {
      this.round.resolveFoldWin(notFolded[0]);
      return false;
    }

    // Advance to the next active player
    if (this.round.isBettingRoundComplete()) {
      this.round.advanceStreet();
    } else {
      this.table.activePlayerIndex = this.round.nextActiveFrom(
        this.table.activePlayerIndex,
      );
    }

    return true;
  }

  // ─── Action processing ─────────────────────────────────────────────────────

  /**
   * Process a player's action (fold/call/raise/allin/check/straddle/sit-out).
   * Returns true if the action was valid and applied.
   */
  processAction(playerId: string, action: string, amount: number): boolean {
    // Must be this player's turn
    const activePlayer = this.table.players[this.table.activePlayerIndex];
    if (!activePlayer || activePlayer.id !== playerId) return false;

    let handled = false;

    switch (action) {
      case 'fold':
        activePlayer.status = PlayerStatus.FOLD;
        activePlayer.hasActed = true;
        // Option C: reset consecutive timeout counter on any player action
        activePlayer.consecutiveTimeouts = 0;
        handled = true;
        break;

      case 'straddle':
        if (this.round.attemptStraddle(playerId)) {
          return true;
        }
        return false;

      case 'sit-out':
        // Voluntary sit-out: player chooses to sit out for the rest of the hand.
        // Mark as SITOUT and immediately fold via foldSitOutPlayer, which also
        // handles fold-win if this is the last active player.
        if (!this.round.isActionStage()) return false;
        activePlayer.status = PlayerStatus.SITOUT;
        // foldSitOutPlayer will set hasActed, handle fold-win, and advance.
        return this.foldSitOutPlayer();

      case 'check':
        // Only legal when no outstanding bet to call
        if (this.table.currentBet > activePlayer.bet) return false;
        activePlayer.hasActed = true;
        // Option C: reset consecutive timeout counter on any player action
        activePlayer.consecutiveTimeouts = 0;
        handled = true;
        break;

      case 'call': {
        const callAmount = Math.min(
          this.table.currentBet - activePlayer.bet,
          activePlayer.stack,
        );
        if (callAmount <= 0) return false;
        activePlayer.stack -= callAmount;
        activePlayer.bet += callAmount;
        activePlayer.totalBet += callAmount;
        this.table.pot += callAmount;
        activePlayer.hasActed = true;
        // Option C: reset consecutive timeout counter on any player action
        activePlayer.consecutiveTimeouts = 0;
        if (activePlayer.stack === 0) activePlayer.status = PlayerStatus.ALLIN;
        if (
          this.table.calledAllIn === null &&
          activePlayer.status === PlayerStatus.ALLIN
        ) {
          this.table.calledAllIn = activePlayer.bet;
        }
        handled = true;
        break;
      }

      case 'raise': {
        // After calledAllIn is set (someone went all-in and was called), no further raises allowed this street
        if (this.table.calledAllIn !== null) {
          return false;
        }
        const minRaiseTo = this.table.currentBet + this.table.minBet;
        if (amount < minRaiseTo) return false;
        const toAdd = Math.min(amount - activePlayer.bet, activePlayer.stack);
        if (toAdd <= 0) return false;
        this.table.minBet = amount - this.table.currentBet;
        activePlayer.stack -= toAdd;
        activePlayer.bet += toAdd;
        activePlayer.totalBet += toAdd;
        this.table.pot += toAdd;
        this.table.currentBet = activePlayer.bet;
        activePlayer.hasActed = true;
        // Option C: reset consecutive timeout counter on any player action
        activePlayer.consecutiveTimeouts = 0;
        if (activePlayer.stack === 0) activePlayer.status = PlayerStatus.ALLIN;
        this.table.calledAllIn = null;
        this.table.players.forEach((p) => {
          if (p && p.id !== playerId && p.status === PlayerStatus.ACTIVE) {
            p.hasActed = false;
          }
        });
        handled = true;
        break;
      }

      case 'allin': {
        const allInAmount = activePlayer.stack;
        if (allInAmount <= 0) return false;
        activePlayer.bet += allInAmount;
        activePlayer.totalBet += allInAmount;
        this.table.pot += allInAmount;
        activePlayer.stack = 0;
        activePlayer.status = PlayerStatus.ALLIN;
        activePlayer.hasActed = true;
        // Option C: reset consecutive timeout counter on any player action
        activePlayer.consecutiveTimeouts = 0;
        if (activePlayer.bet > this.table.currentBet) {
          this.table.minBet = activePlayer.bet - this.table.currentBet;
          this.table.currentBet = activePlayer.bet;
          this.table.calledAllIn = null;
          this.table.players.forEach((p) => {
            if (p && p.id !== playerId && p.status === PlayerStatus.ACTIVE) {
              p.hasActed = false;
            }
          });
        } else if (this.table.calledAllIn === null) {
          this.table.calledAllIn = activePlayer.bet;
        }
        handled = true;
        break;
      }

      default:
        return false;
    }

    if (!handled) {
      return false;
    }

    this.table.actionEndsAt = null;

    // Check if only one non-folded player remains → that player wins
    const notFolded = this.table.players.filter(
      (p) => p && p.status !== PlayerStatus.FOLD,
    ) as Player[];
    if (notFolded.length === 1) {
      this.round.resolveFoldWin(notFolded[0]);
      return true;
    }

    // Check if the betting round is complete
    if (this.round.isBettingRoundComplete()) {
      this.round.advanceStreet();
    } else {
      this.table.activePlayerIndex = this.round.nextActiveFrom(
        this.table.activePlayerIndex,
      );
    }

    // After advancing the turn, check if the new active player is sitting out and auto-fold them
    this.checkAndAutoFoldSittingOut();

    return true;
  }
}
