// ─── Re-export all public types from table-state ───────────────────────────
export type {
  HandResultEntry,
  PlayerInput,
  StraddleInfo,
  Pot,
  TableSnapshot,
  TableConfig,
} from './table-state';
// GameStage is an enum (value) — export both type and value
export { GameStage } from './table-state';

import {
  GameStage,
  TableConfig,
  TableSnapshot,
  RAKE_RATE,
  RAKE_CAP,
} from './table-state';
import { Player, PlayerStatus } from './player';
import { TableGameLogic } from './table-game-logic';
import { TableRound } from './table-round';
import { TablePlayerOps } from './table-player-ops';

// ─── Fold-win rake constants (kept here for inline use in Table methods) ──
const FOLD_RAKE_RATE = RAKE_RATE;
const FOLD_RAKE_CAP = RAKE_CAP;

export class Table {
  // ─── Core state ───────────────────────────────────────────────────────────
  id: string;
  roomId: string;
  players: (Player | null)[]; // Fixed size array for seats (e.g. 9)
  deck: string[];
  communityCards: string[];
  pot: number;
  currentBet: number;
  currentStage: GameStage;
  activePlayerIndex: number;
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  roomPassword: string | null;
  /** Room tier used for tier-based rake calculation (MICRO | LOW | MEDIUM | HIGH | PREMIUM). */
  tier: string;
  minBet: number;
  lastHandResult: import('./table-state').HandResultEntry[] | null;
  settlementEndsAt: number | null;
  readyCountdownEndsAt: number | null;
  actionEndsAt: number | null;
  /** True when the hand ended because all opponents folded (no showdown). */
  isFoldWin: boolean;
  /** True when the fold-win winner chose to reveal their cards. */
  foldWinnerRevealed: boolean;
  /** UTG straddle: 2x BB, becomes the effective bet to act last preflop. */
  straddle: import('./table-state').StraddleInfo | null;
  /**
   * Tracks the all-in amount that has been called this street.
   * Prevents re-opening action.
   */
  calledAllIn: number | null;
  /** Milliseconds to wait before auto-folding a sitting-out player whose turn it is. */
  sittingOutTimeout: number;
  /** Rake deducted in the current hand (used for DB persistence). */
  rakeAmount: number;
  /** Rake percentage applied in the current hand. */
  rakePercent: number;

  /** True if a straddle has been placed this hand. */
  get hasStraddle(): boolean {
    return this.straddle !== null;
  }

  /** Info about the last player auto-folded due to sitting out (playerId + seatIndex). */
  lastSitoutAutoFold: { playerId: string; seatIndex: number } | null;

  // ─── Composed modules ──────────────────────────────────────────────────────
  private readonly _gameLogic: TableGameLogic;
  private readonly _round: TableRound;
  private readonly _playerOps: TablePlayerOps;

  // ─── Constructor ──────────────────────────────────────────────────────────

  constructor(
    id: string,
    roomId: string,
    maxPlayers: number,
    smallBlind: number,
    bigBlind: number,
    minBuyIn?: number,
    roomPassword?: string | null,
    config?: TableConfig,
  ) {
    this.id = id;
    this.roomId = roomId;
    this.players = new Array(maxPlayers).fill(null);
    this.deck = [];
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.currentStage = GameStage.WAITING;
    this.activePlayerIndex = -1;
    this.dealerIndex = 0;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.minBuyIn = minBuyIn ?? bigBlind;
    this.roomPassword = roomPassword ?? null;
    this.tier = 'LOW'; // default; updated by TableManagerService from Room.tier
    this.minBet = bigBlind;
    this.lastHandResult = null;
    this.settlementEndsAt = null;
    this.readyCountdownEndsAt = null;
    this.actionEndsAt = null;
    this.isFoldWin = false;
    this.foldWinnerRevealed = false;
    this.straddle = null;
    this.calledAllIn = null;
    this.sittingOutTimeout = config?.sittingOutTimeout ?? 30000;
    this.lastSitoutAutoFold = null;
    this.rakeAmount = 0;
    this.rakePercent = 0;

    // Initialise composed modules (they hold no state of their own)
    this._gameLogic = new TableGameLogic(this);
    this._round = new TableRound(this);
    this._playerOps = new TablePlayerOps(this, this._round);
  }

  // ─── Factory ──────────────────────────────────────────────────────────────

  static fromSnapshot(
    snapshot: TableSnapshot,
    maxPlayers: number,
    smallBlind: number,
    bigBlind: number,
    minBuyIn?: number,
    roomPassword?: string | null,
    config?: TableConfig,
  ): Table {
    const table = new Table(
      snapshot.id,
      snapshot.roomId,
      maxPlayers,
      smallBlind,
      bigBlind,
      minBuyIn,
      roomPassword,
      config,
    );
    table.players = snapshot.players;
    table.deck = [...snapshot.deck];
    table.communityCards = [...snapshot.communityCards];
    table.pot = snapshot.pot;
    table.currentBet = snapshot.currentBet;
    table.currentStage = snapshot.currentStage;
    table.activePlayerIndex = snapshot.activePlayerIndex;
    table.dealerIndex = snapshot.dealerIndex;
    table.minBet = snapshot.minBet;
    table.lastHandResult = snapshot.lastHandResult;
    table.settlementEndsAt = snapshot.settlementEndsAt;
    table.readyCountdownEndsAt = snapshot.readyCountdownEndsAt;
    table.actionEndsAt = snapshot.actionEndsAt ?? null;
    table.isFoldWin = snapshot.isFoldWin ?? false;
    table.foldWinnerRevealed = snapshot.foldWinnerRevealed ?? false;
    table.straddle = snapshot.straddle ?? null;
    table.calledAllIn = snapshot.calledAllIn ?? null;
    table.sittingOutTimeout = config?.sittingOutTimeout ?? 30000;
    table.lastSitoutAutoFold = null;
    table.tier = (snapshot as any).tier ?? 'LOW';
    table.rakeAmount = (snapshot as any).rakeAmount ?? 0;
    table.rakePercent = (snapshot as any).rakePercent ?? 0;
    return table;
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────────

  toSnapshot(): TableSnapshot {
    return {
      id: this.id,
      roomId: this.roomId,
      players: this.players,
      deck: [...this.deck],
      communityCards: [...this.communityCards],
      pot: this.pot,
      currentBet: this.currentBet,
      currentStage: this.currentStage,
      activePlayerIndex: this.activePlayerIndex,
      dealerIndex: this.dealerIndex,
      minBet: this.minBet,
      lastHandResult: this.lastHandResult,
      settlementEndsAt: this.settlementEndsAt,
      readyCountdownEndsAt: this.readyCountdownEndsAt,
      actionEndsAt: this.actionEndsAt,
      isFoldWin: this.isFoldWin,
      foldWinnerRevealed: this.foldWinnerRevealed,
      straddle: this.straddle,
      calledAllIn: this.calledAllIn,
      sittingOutTimeout: this.sittingOutTimeout,
      tier: this.tier,
      rakeAmount: this.rakeAmount,
      rakePercent: this.rakePercent,
    };
  }

  // ─── Query helpers ─────────────────────────────────────────────────────────

  hasPlayer(playerId: string): boolean {
    return this.players.some((player) => player?.id === playerId);
  }

  getPlayerCount(): number {
    return this.players.filter((player) => player !== null).length;
  }

  isFull(): boolean {
    return this.getPlayerCount() >= this.players.length;
  }

  /** True when the player is seated, has a stack, and is not SITOUT. */
  isPlayablePlayer(player: Player | null): player is Player {
    return !!player && player.stack > 0;
  }

  getPersistentBalances(): Array<{ userId: string; balance: number }> {
    return this.players
      .filter((player): player is Player => player !== null)
      .map((player) => ({
        userId: player.id,
        balance: player.stack,
      }));
  }

  // ─── Player operations ────────────────────────────────────────────────────

  addPlayer(
    player: import('./table-state').PlayerInput,
    initialStack = 1000,
  ): boolean {
    return this._playerOps.addPlayer(player, initialStack);
  }

  removePlayer(playerId: string): Player | null {
    return this._playerOps.removePlayer(playerId);
  }

  setPlayerReady(playerId: string): boolean {
    return this._playerOps.setPlayerReady(playerId);
  }

  areAllSeatedPlayersReady(): boolean {
    const playable = this.players.filter((p) => this.isPlayablePlayer(p));
    return playable.length >= 2 && playable.every((p) => p.ready);
  }

  startHandIfReady(): boolean {
    if (!this.areAllSeatedPlayersReady()) {
      return false;
    }
    this._gameLogic.startHand();
    return true;
  }

  foldPlayerOnLeave(playerId: string): boolean {
    return this._playerOps.foldPlayerOnLeave(playerId);
  }

  foldSitOutPlayer(): boolean {
    return this._playerOps.foldSitOutPlayer();
  }

  checkAndAutoFoldSittingOut(): boolean {
    return this._playerOps.checkAndAutoFoldSittingOut();
  }

  processAction(playerId: string, action: string, amount: number): boolean {
    return this._playerOps.processAction(playerId, action, amount);
  }

  // ─── Round management ─────────────────────────────────────────────────────

  isActionStage(): boolean {
    return this._round.isActionStage();
  }

  attemptStraddle(playerId: string): boolean {
    return this._round.attemptStraddle(playerId);
  }

  isSittingOutPlayer(seatIndex: number): boolean {
    if (!this.isActionStage()) return false;
    const player = this.players[seatIndex];
    if (!player) return false;
    return player.status === PlayerStatus.SITOUT;
  }

  isCurrentPlayerSitOut(): boolean {
    if (!this.isActionStage()) {
      return false;
    }
    const activePlayer = this.players[this.activePlayerIndex];
    return !!activePlayer && activePlayer.status === PlayerStatus.SITOUT;
  }

  // ─── Countdown / timeout management ───────────────────────────────────────

  beginSettlementCountdown(durationMs: number) {
    this.settlementEndsAt = Date.now() + durationMs;
    this.readyCountdownEndsAt = null;
    this.actionEndsAt = null;
  }

  beginReadyCountdown(durationMs: number) {
    const playable = this.players.filter((p) => this.isPlayablePlayer(p));
    playable.forEach((player) => {
      player.ready = true;
    });
    this.players
      .filter(
        (player): player is Player => player !== null && player.stack <= 0,
      )
      .forEach((player) => {
        player.ready = false;
      });
    this.readyCountdownEndsAt = Date.now() + durationMs;
    this.settlementEndsAt = null;
    this.actionEndsAt = null;
  }

  clearReadyCountdown() {
    this.readyCountdownEndsAt = null;
  }

  beginActionCountdown(durationMs: number) {
    if (!this.isActionStage()) {
      this.actionEndsAt = null;
      return;
    }
    this.actionEndsAt = Date.now() + durationMs;
  }

  clearActionCountdown() {
    this.actionEndsAt = null;
  }

  getTimeoutAction(): {
    action: 'check' | 'fold' | 'sitout';
    playerId: string;
  } | null {
    if (!this.isActionStage()) {
      return null;
    }

    const activePlayer = this.players[this.activePlayerIndex];
    if (!activePlayer) {
      return null;
    }

    // SITOUT players (e.g. zero-stack players who somehow reached their turn)
    // are auto-folded — they never have a legal action.
    if (activePlayer.status === PlayerStatus.SITOUT) {
      return { playerId: activePlayer.id, action: 'sitout' };
    }

    if (activePlayer.status !== PlayerStatus.ACTIVE) {
      return null;
    }

    return {
      playerId: activePlayer.id,
      action: this.currentBet <= activePlayer.bet ? 'check' : 'fold',
    };
  }

  // ─── Game logic (hand start / reset) ──────────────────────────────────────

  /** Visible for integration tests (table-game-logic.spec.ts). */
  startHand() {
    this._gameLogic.startHand();
  }

  resetToWaiting() {
    this._gameLogic.resetToWaiting();
  }

  // ─── Settlement ───────────────────────────────────────────────────────────

  /** Called when the fold-win winner chooses to reveal their cards. */
  revealFoldWinnerCards(): void {
    if (this.isFoldWin && this.currentStage === GameStage.SETTLEMENT) {
      this.foldWinnerRevealed = true;
    }
  }

  // ─── Masked view ───────────────────────────────────────────────────────────

  /**
   * Returns a serializable snapshot of the table where opponent hole cards are
   * hidden (replaced with ['??','??']) unless it's showdown/settlement.
   */
  getMaskedView(forPlayerId: string): object {
    // In a fold-win settlement, only reveal the winner's cards if they chose to show.
    // In a showdown (or post-showdown settlement), reveal all cards.
    const isShowdownSettlement =
      this.currentStage === GameStage.SHOWDOWN ||
      (this.currentStage === GameStage.SETTLEMENT && !this.isFoldWin);

    const maskedPlayers = this.players.map((p) => {
      if (!p) return null;
      const isOwn = p.id === forPlayerId;
      let showCards: boolean;
      if (isOwn) {
        showCards = true;
      } else if (isShowdownSettlement) {
        showCards = true;
      } else if (this.currentStage === GameStage.SETTLEMENT && this.isFoldWin) {
        // Show fold-win winner's cards only if they chose to reveal
        const isWinner =
          this.lastHandResult?.some(
            (e) => e.playerId === p.id && e.winAmount > 0,
          ) ?? false;
        showCards = isWinner && this.foldWinnerRevealed;
      } else {
        showCards = false;
      }
      return {
        ...p,
        cards: showCards ? p.cards : p.cards.map(() => '??'),
      };
    });

    return {
      id: this.id,
      roomId: this.roomId,
      players: maskedPlayers,
      communityCards: this.communityCards,
      pot: this.pot,
      currentBet: this.currentBet,
      currentStage: this.currentStage,
      activePlayerIndex: this.activePlayerIndex,
      dealerIndex: this.dealerIndex,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      lastHandResult: this.lastHandResult,
      settlementEndsAt: this.settlementEndsAt,
      readyCountdownEndsAt: this.readyCountdownEndsAt,
      actionEndsAt: this.actionEndsAt,
      isFoldWin: this.isFoldWin,
      foldWinnerRevealed: this.foldWinnerRevealed,
      straddle: this.straddle,
      calledAllIn: this.calledAllIn,
      sittingOutTimeout: this.sittingOutTimeout,
    };
  }
}
