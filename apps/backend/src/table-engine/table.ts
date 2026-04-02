import { Player, PlayerStatus } from './player';
import { determineWinners } from './hand-evaluator';

export interface HandResultEntry {
  playerId: string;
  nickname: string;
  handName: string;
  winAmount: number;
  /** Total chips this player contributed to the pot this hand (for P&L records). */
  totalBet: number;
  /** The best 5-card combination for showdown results (empty for fold-wins). */
  bestCards?: string[];
}

export interface StraddleInfo {
  playerId: string;
  amount: number;
  position: number;
}

export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface TableSnapshot {
  id: string;
  roomId: string;
  players: (Player | null)[];
  deck: string[];
  communityCards: string[];
  pot: number;
  currentBet: number;
  currentStage: GameStage;
  activePlayerIndex: number;
  dealerIndex: number;
  minBet: number;
  lastHandResult: HandResultEntry[] | null;
  settlementEndsAt: number | null;
  readyCountdownEndsAt: number | null;
  actionEndsAt: number | null;
  isFoldWin: boolean;
  foldWinnerRevealed: boolean;
  straddle: StraddleInfo | null;
  calledAllIn: number | null;
  sittingOutTimeout: number;
}

export enum GameStage {
  WAITING = 'WAITING',
  DEALING = 'DEALING',
  PREFLOP = 'PREFLOP',
  FLOP = 'FLOP',
  TURN = 'TURN',
  RIVER = 'RIVER',
  SHOWDOWN = 'SHOWDOWN',
  SETTLEMENT = 'SETTLEMENT',
}

export interface TableConfig {
  sittingOutTimeout?: number; // milliseconds; defaults to 30000
}

export class Table {
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
  minBet: number;
  lastHandResult: HandResultEntry[] | null;
  settlementEndsAt: number | null;
  readyCountdownEndsAt: number | null;
  actionEndsAt: number | null;
  /** True when the hand ended because all opponents folded (no showdown). */
  isFoldWin: boolean;
  /** True when the fold-win winner chose to reveal their cards. */
  foldWinnerRevealed: boolean;
  /** UTG straddle: 2x BB, becomes the effective bet to act last preflop. */
  straddle: StraddleInfo | null;
  /** Tracks the all-in amount that has been called this street. Prevents re-opening action. */
  calledAllIn: number | null;
  /** Milliseconds to wait before auto-folding a sitting-out player whose turn it is. */
  sittingOutTimeout: number;
  /** Info about the last player auto-folded due to sitting out (playerId + seatIndex). */
  lastSitoutAutoFold: { playerId: string; seatIndex: number } | null;

  /** True when a straddle has been placed this hand. */
  get hasStraddle(): boolean {
    return this.straddle !== null;
  }

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
  }

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
    table.calledAllIn = (snapshot as any).calledAllIn ?? null;
    table.sittingOutTimeout = config?.sittingOutTimeout ?? 30000;
    table.lastSitoutAutoFold = null;
    return table;
  }

  // Methods: addPlayer, removePlayer, startHand, processAction, etc.

  hasPlayer(playerId: string): boolean {
    return this.players.some((player) => player?.id === playerId);
  }

  getPlayerCount(): number {
    return this.players.filter((player) => player !== null).length;
  }

  isFull(): boolean {
    return this.getPlayerCount() >= this.players.length;
  }

  private isPlayablePlayer(player: Player | null): player is Player {
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
    };
  }

  addPlayer(player: any, initialStack = 1000): boolean {
    if (this.hasPlayer(player.sub)) {
      // Refresh display name and avatar from latest data on every connect/reconnect
      const existing = this.players.find((p) => p?.id === player.sub);
      if (existing) {
        existing.nickname = player.nickname ?? player.username;
        existing.avatar = player.avatar ?? existing.avatar ?? '';
      }
      return true;
    }

    const seatIndex = this.players.findIndex((p) => p === null);
    if (seatIndex === -1) return false;

    // transform user to player
    const newPlayer: Player = {
      id: player.sub,
      nickname: player.nickname ?? player.username,
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
    };

    this.players[seatIndex] = newPlayer;
    return true;
  }

  removePlayer(playerId: string): Player | null {
    const index = this.players.findIndex((p) => p && p.id === playerId);
    if (index !== -1) {
      const removedPlayer = this.players[index];
      this.players[index] = null;
      return removedPlayer;
    }

    return null;
  }

  /**
   * Force-fold a player who is leaving mid-hand.
   * Only acts during active betting stages (PREFLOP/FLOP/TURN/RIVER).
   * Triggers fold-win if only one non-folded player remains, or advances
   * the turn/street when the leaving player was active or their fold
   * completes the betting round.
   * Returns true if the hand reached SETTLEMENT as a result.
   */
  foldPlayerOnLeave(playerId: string): boolean {
    if (!this.isActionStage()) return false;

    const playerIndex = this.players.findIndex((p) => p && p.id === playerId);
    if (playerIndex === -1) return false;

    const player = this.players[playerIndex];
    if (!player) return false;

    // Already out of betting action — nothing to fold.
    if (
      player.status === PlayerStatus.FOLD ||
      player.status === PlayerStatus.ALLIN
    )
      return false;

    player.status = PlayerStatus.FOLD;
    this.actionEndsAt = null;

    // Check if only one non-folded player remains → fold-win.
    const notFolded = this.players.filter(
      (p) => p && p.status !== PlayerStatus.FOLD,
    ) as Player[];
    if (notFolded.length === 1) {
      const winner = notFolded[0];
      const RAKE_RATE = 0.03;
      const RAKE_CAP = 30;
      const rake = Math.min(Math.floor(this.pot * RAKE_RATE), RAKE_CAP);
      const winAmount = this.pot - rake;
      winner.stack += winAmount;
      this.pot = 0;
      this.lastHandResult = this.players
        .filter((p) => p !== null)
        .map((p) => ({
          playerId: p.id,
          nickname: p.nickname,
          handName: p.id === winner.id ? '其他玩家弃牌' : '弃牌',
          winAmount: p.id === winner.id ? winAmount : 0,
          totalBet: p.totalBet,
        }));
      this.isFoldWin = true;
      this.foldWinnerRevealed = false;
      this.currentStage = GameStage.SETTLEMENT;
      return true;
    }

    // Advance turn or street when appropriate.
    if (
      this.activePlayerIndex === playerIndex ||
      this.isBettingRoundComplete()
    ) {
      if (this.isBettingRoundComplete()) {
        this.advanceStreet();
      } else {
        this.activePlayerIndex = this.nextActiveFrom(this.activePlayerIndex);
      }
    }

    return this.currentStage === GameStage.SETTLEMENT;
  }

  // Toggle ready state for a player. Returns whether all seated players are ready afterwards.
  setPlayerReady(playerId: string): boolean {
    if (this.currentStage !== GameStage.WAITING) return false;

    const player = this.players.find((p) => p && p.id === playerId);
    if (!player || player.stack <= 0) return false;

    player.ready = !player.ready;
    return this.areAllSeatedPlayersReady();
  }

  areAllSeatedPlayersReady(): boolean {
    const playable = this.players.filter((p) => this.isPlayablePlayer(p));
    return playable.length >= 2 && playable.every((p) => p.ready);
  }

  startHandIfReady(): boolean {
    if (!this.areAllSeatedPlayersReady()) {
      return false;
    }

    this.startHand();
    return true;
  }

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

  /**
   * Auto-folds the current active player if they are sitting out.
   * Returns true if the player was folded and action was advanced.
   */
  foldSitOutPlayer(): boolean {
    if (!this.isActionStage()) {
      return false;
    }

    const activePlayer = this.players[this.activePlayerIndex];
    if (!activePlayer || activePlayer.status !== PlayerStatus.SITOUT) {
      return false;
    }

    activePlayer.status = PlayerStatus.FOLD;
    activePlayer.hasActed = true;
    this.actionEndsAt = null;

    const notFolded = this.players.filter(
      (p) => p && p.status !== PlayerStatus.FOLD,
    ) as Player[];
    if (notFolded.length === 1) {
      const winner = notFolded[0];
      const RAKE_RATE = 0.03;
      const RAKE_CAP = 30;
      const rake = Math.min(Math.floor(this.pot * RAKE_RATE), RAKE_CAP);
      const winAmount = this.pot - rake;
      winner.stack += winAmount;
      this.pot = 0;
      this.lastHandResult = this.players
        .filter((p) => p !== null)
        .map((p) => ({
          playerId: p.id,
          nickname: p.nickname,
          handName: p.id === winner.id ? '其他玩家弃牌' : '弃牌',
          winAmount: p.id === winner.id ? winAmount : 0,
          totalBet: p.totalBet,
        }));
      this.isFoldWin = true;
      this.foldWinnerRevealed = false;
      this.currentStage = GameStage.SETTLEMENT;
      return true;
    }

    if (this.isBettingRoundComplete()) {
      this.advanceStreet();
    } else {
      this.activePlayerIndex = this.nextActiveFrom(this.activePlayerIndex);
    }

    return true;
  }

  /** Returns true if the current active player is sitting out and needs auto-fold. */
  isCurrentPlayerSitOut(): boolean {
    if (!this.isActionStage()) {
      return false;
    }
    const activePlayer = this.players[this.activePlayerIndex];
    return !!activePlayer && activePlayer.status === PlayerStatus.SITOUT;
  }

  private isActionStage() {
    return (
      this.currentStage === GameStage.PREFLOP ||
      this.currentStage === GameStage.FLOP ||
      this.currentStage === GameStage.TURN ||
      this.currentStage === GameStage.RIVER
    );
  }

  /**
   * Returns true if the player at the given seat index is sitting out
   * (has a seat, is not ACTIVE, and is not FOLD/ALLIN - i.e. explicitly sitting out).
   * Only applies during an active betting stage.
   */
  isSittingOutPlayer(seatIndex: number): boolean {
    if (!this.isActionStage()) return false;
    const player = this.players[seatIndex];
    if (!player) return false;
    // SITOUT status means the player is explicitly sitting out (not participating)
    return player.status === PlayerStatus.SITOUT;
  }

  /**
   * Checks if the current active player is sitting out.
   * If so, auto-folds them, starts the sit-out timeout countdown, and records the event.
   * Called at the end of each action resolution in processAction.
   * Returns true if a sit-out player was auto-folded (hand did not end).
   */
  checkAndAutoFoldSittingOut(): boolean {
    if (!this.isActionStage()) return false;
    if (this.activePlayerIndex < 0) return false;

    const player = this.players[this.activePlayerIndex];
    if (!player) return false;

    if (player.status !== PlayerStatus.SITOUT) return false;

    // Record the auto-fold event
    this.lastSitoutAutoFold = {
      playerId: player.id,
      seatIndex: this.activePlayerIndex,
    };

    // Auto-fold: mark player as folded
    player.status = PlayerStatus.FOLD;
    player.hasActed = true;
    this.actionEndsAt = null;

    // Check if this fold results in only one remaining player
    const notFolded = this.players.filter((p) => p && p.status !== PlayerStatus.FOLD) as Player[];
    if (notFolded.length === 1) {
      this.resolveFoldWin(notFolded[0]);
      return false;
    }

    // Advance to the next active player
    if (this.isBettingRoundComplete()) {
      this.advanceStreet();
    } else {
      this.activePlayerIndex = this.nextActiveFrom(this.activePlayerIndex);
    }

    return true;
  }

  private resolveFoldWin(winner: Player) {
    const RAKE_RATE = 0.03;
    const RAKE_CAP = 30;
    const rake = Math.min(Math.floor(this.pot * RAKE_RATE), RAKE_CAP);
    const winAmount = this.pot - rake;
    winner.stack += winAmount;
    this.pot = 0;
    this.lastHandResult = this.players
      .filter((p) => p !== null)
      .map((p) => ({
        playerId: p!.id,
        nickname: p!.nickname,
        handName: p!.id === winner.id ? '其他玩家弃牌' : '弃牌',
        winAmount: p!.id === winner.id ? winAmount : 0,
        totalBet: p!.totalBet,
      }));
    this.isFoldWin = true;
    this.foldWinnerRevealed = false;
    this.currentStage = GameStage.SETTLEMENT;
  }

  // Returns the index of the next non-null seat starting from (fromIndex + 1), wrapping around.
  private nextSeatedFrom(fromIndex: number): number {
    const len = this.players.length;
    for (let i = 1; i <= len; i++) {
      const idx = (fromIndex + i) % len;
      if (this.isPlayablePlayer(this.players[idx])) return idx;
    }
    return fromIndex;
  }

  private initDeck(): string[] {
    const ranks = [
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'T',
      'J',
      'Q',
      'K',
      'A',
    ];
    const suits = ['s', 'h', 'd', 'c'];
    const deck: string[] = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(rank + suit);
      }
    }
    return deck;
  }

  private shuffle(deck: string[]): string[] {
    const d = [...deck];
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  /** Visible for integration tests (table-game-logic.spec.ts). */
  startHand() {
    const seated = this.players.filter((p) => this.isPlayablePlayer(p));

    // Reset all player state for the new hand
    this.players
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
      });

    // Reset board state
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.lastHandResult = null;
    this.settlementEndsAt = null;
    this.readyCountdownEndsAt = null;
    this.actionEndsAt = null;
    this.straddle = null;
    this.calledAllIn = null;
    this.lastSitoutAutoFold = null;

    // Assign positions
    const dealerIdx = this.isPlayablePlayer(this.players[this.dealerIndex])
      ? this.dealerIndex
      : this.nextSeatedFrom(this.dealerIndex);
    this.dealerIndex = dealerIdx;
    this.players[dealerIdx]!.isButton = true;

    const sbIdx = this.nextSeatedFrom(dealerIdx);
    this.players[sbIdx]!.isSmallBlind = true;

    const bbIdx = this.nextSeatedFrom(sbIdx);
    this.players[bbIdx]!.isBigBlind = true;

    // Initialize and shuffle deck
    this.deck = this.shuffle(this.initDeck());

    // Deal 2 cards per player clockwise starting from SB (one card at a time)
    const orderedSeatIndices: number[] = [];
    let idx = sbIdx;
    for (let i = 0; i < seated.length; i++) {
      orderedSeatIndices.push(idx);
      idx = this.nextSeatedFrom(idx);
    }

    for (let round = 0; round < 2; round++) {
      for (const seatIdx of orderedSeatIndices) {
        const player = this.players[seatIdx];
        if (player) {
          player.cards.push(this.deck.pop()!);
        }
      }
    }

    // Post blinds: deduct from stacks, add to pot
    const sbPlayer = this.players[sbIdx]!;
    const bbPlayer = this.players[bbIdx]!;
    const sbAmount = Math.min(this.smallBlind, sbPlayer.stack);
    const bbAmount = Math.min(this.bigBlind, bbPlayer.stack);

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

    this.pot = sbAmount + bbAmount;
    this.currentBet = bbAmount;

    // First to act preflop: UTG (seat after BB)
    this.activePlayerIndex = this.nextSeatedFrom(bbIdx);
    this.currentStage = GameStage.PREFLOP;
  }

  /**
   * Attempt to post a straddle (2x BB) from UTG position.
   * Only valid during preflop when the player is first to act.
   * The straddle effectively makes them act last preflop.
   */
  attemptStraddle(playerId: string): boolean {
    if (this.currentStage !== GameStage.PREFLOP) return false;
    if (this.straddle !== null) return false;

    const activePlayer = this.players[this.activePlayerIndex];
    if (!activePlayer || activePlayer.id !== playerId) return false;

    const straddleAmount = Math.min(this.bigBlind * 2, activePlayer.stack);
    if (straddleAmount < this.bigBlind * 2) return false;

    const extraAmount = straddleAmount - activePlayer.bet;
    activePlayer.stack -= extraAmount;
    activePlayer.bet = straddleAmount;
    activePlayer.totalBet += extraAmount;
    this.pot += extraAmount;
    this.currentBet = straddleAmount;
    this.minBet = this.bigBlind;
    if (activePlayer.stack === 0) {
      activePlayer.status = PlayerStatus.ALLIN;
    }

    this.straddle = {
      playerId: activePlayer.id,
      amount: straddleAmount,
      position: activePlayer.position,
    };

    this.activePlayerIndex = this.nextActiveFrom(this.activePlayerIndex);

    this.players.forEach((p) => {
      if (p && p.status === PlayerStatus.ACTIVE && p.id !== playerId) {
        p.hasActed = false;
      }
    });

    // Mark straddle player as having acted — they've put in 2x BB and will act last preflop.
    activePlayer.hasActed = true;

    return true;
  }

  processAction(playerId: string, action: string, amount: number) {
    // Must be this player's turn
    const activePlayer = this.players[this.activePlayerIndex];
    if (!activePlayer || activePlayer.id !== playerId) return false;

    let handled = false;

    switch (action) {
      case 'fold':
        activePlayer.status = PlayerStatus.FOLD;
        activePlayer.hasActed = true;
        handled = true;
        break;

      case 'straddle':
        if (this.attemptStraddle(playerId)) {
          return true;
        }
        return false;

      case 'sit-out':
        // Voluntary sit-out: player chooses to sit out for the rest of the hand.
        // Mark as SITOUT and immediately fold via foldSitOutPlayer, which also
        // handles fold-win if this is the last active player.
        if (!this.isActionStage()) return false;
        activePlayer.status = PlayerStatus.SITOUT;
        // foldSitOutPlayer will set hasActed, handle fold-win, and advance.
        return this.foldSitOutPlayer();

      case 'check':
        // Only legal when no outstanding bet to call
        if (this.currentBet > activePlayer.bet) return false;
        activePlayer.hasActed = true;
        handled = true;
        break;

      case 'call': {
        const callAmount = Math.min(
          this.currentBet - activePlayer.bet,
          activePlayer.stack,
        );
        if (callAmount <= 0) return false;
        activePlayer.stack -= callAmount;
        activePlayer.bet += callAmount;
        activePlayer.totalBet += callAmount;
        this.pot += callAmount;
        activePlayer.hasActed = true;
        if (activePlayer.stack === 0) activePlayer.status = PlayerStatus.ALLIN;
        if (
          this.calledAllIn === null &&
          activePlayer.status === PlayerStatus.ALLIN
        ) {
          this.calledAllIn = activePlayer.bet;
        }
        handled = true;
        break;
      }

      case 'raise': {
        if (this.calledAllIn !== null && activePlayer.bet >= this.calledAllIn) {
          return false;
        }
        const minRaiseTo = this.currentBet + this.minBet;
        if (amount < minRaiseTo) return false;
        const toAdd = Math.min(amount - activePlayer.bet, activePlayer.stack);
        if (toAdd <= 0) return false;
        this.minBet = amount - this.currentBet;
        activePlayer.stack -= toAdd;
        activePlayer.bet += toAdd;
        activePlayer.totalBet += toAdd;
        this.pot += toAdd;
        this.currentBet = activePlayer.bet;
        activePlayer.hasActed = true;
        if (activePlayer.stack === 0) activePlayer.status = PlayerStatus.ALLIN;
        this.calledAllIn = null;
        this.players.forEach((p) => {
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
        this.pot += allInAmount;
        activePlayer.stack = 0;
        activePlayer.status = PlayerStatus.ALLIN;
        activePlayer.hasActed = true;
        if (activePlayer.bet > this.currentBet) {
          this.minBet = activePlayer.bet - this.currentBet;
          this.currentBet = activePlayer.bet;
          this.calledAllIn = null;
          this.players.forEach((p) => {
            if (p && p.id !== playerId && p.status === PlayerStatus.ACTIVE) {
              p.hasActed = false;
            }
          });
        } else if (this.calledAllIn === null) {
          this.calledAllIn = activePlayer.bet;
        }
        handled = true;
        break;
      }

      case 'straddle': {
        // Straddle is a voluntary blind bet of 2x BB made by the player left of BB (UTG)
        // before cards are dealt. Acts as the first raise. Only one straddle per hand.
        if (this.currentStage !== GameStage.PREFLOP) return false;
        // Can only straddle before any raise (currentBet should equal BB at this point)
        if (this.currentBet !== this.bigBlind) return false;
        // Only one straddle per hand
        if (this.straddle !== null) return false;
        // Player must not have acted yet
        if (activePlayer.hasActed) return false;

        const straddleAmount = Math.min(this.bigBlind * 2, activePlayer.stack);
        if (straddleAmount < this.bigBlind * 2) return false; // must be able to cover full straddle

        activePlayer.stack -= straddleAmount;
        activePlayer.bet += straddleAmount;
        activePlayer.totalBet += straddleAmount;
        this.pot += straddleAmount;
        this.currentBet = straddleAmount;
        this.minBet = this.bigBlind; // raise increment is BB
        activePlayer.hasActed = true;
        this.straddle = {
          playerId: activePlayer.id,
          amount: straddleAmount,
          position: activePlayer.position,
        };

        // Re-open action for everyone else still active
        this.players.forEach((p) => {
          if (p && p.id !== playerId && p.status === PlayerStatus.ACTIVE) {
            p.hasActed = false;
          }
        });
        handled = true;
        break;
      }

      default:
        return false;
    }

    if (!handled) {
      return false;
    }

    this.actionEndsAt = null;

    // Check if only one non-folded player remains → that player wins
    const notFolded = this.players.filter(
      (p) => p && p.status !== PlayerStatus.FOLD,
    ) as Player[];
    if (notFolded.length === 1) {
      const winner = notFolded[0];

      // Rake for fold-wins (reduced since no showdown)
      const RAKE_RATE = 0.03;
      const RAKE_CAP = 30;
      const rake = Math.min(Math.floor(this.pot * RAKE_RATE), RAKE_CAP);
      const winAmount = this.pot - rake;

      winner.stack += winAmount;
      this.pot = 0;
      this.lastHandResult = this.players
        .filter((p) => p !== null)
        .map((p) => ({
          playerId: p.id,
          nickname: p.nickname,
          handName: p.id === winner.id ? '其他玩家弃牌' : '弃牌',
          winAmount: p.id === winner.id ? winAmount : 0,
          totalBet: p.totalBet,
        }));
      this.isFoldWin = true;
      this.foldWinnerRevealed = false;
      this.currentStage = GameStage.SETTLEMENT;
      return true;
    }

    // Check if the betting round is complete
    if (this.isBettingRoundComplete()) {
      this.advanceStreet();
    } else {
      this.activePlayerIndex = this.nextActiveFrom(this.activePlayerIndex);
    }

    // After advancing the turn, check if the new active player is sitting out and auto-fold them
    this.checkAndAutoFoldSittingOut();

    return true;
  }

  private isBettingRoundComplete(): boolean {
    const active = this.players.filter(
      (p) => p && p.status === PlayerStatus.ACTIVE,
    ) as Player[];
    return (
      active.length === 0 ||
      active.every((p) => p.hasActed && p.bet === this.currentBet)
    );
  }

  /** Next seat with ACTIVE status, wrapping around. */
  private nextActiveFrom(fromIndex: number): number {
    const len = this.players.length;
    for (let i = 1; i <= len; i++) {
      const idx = (fromIndex + i) % len;
      const p = this.players[idx];
      if (p && p.status === PlayerStatus.ACTIVE) return idx;
    }
    return fromIndex;
  }

  private advanceStreet() {
    // Reset per-street bet tracking
    this.players.forEach((p) => {
      if (p) {
        p.bet = 0;
        p.hasActed = false;
      }
    });
    this.currentBet = 0;
    this.minBet = this.bigBlind;

    switch (this.currentStage) {
      case GameStage.PREFLOP:
        this.currentStage = GameStage.FLOP;
        this.deck.pop(); // burn
        this.communityCards.push(
          this.deck.pop()!,
          this.deck.pop()!,
          this.deck.pop()!,
        );
        break;
      case GameStage.FLOP:
        this.currentStage = GameStage.TURN;
        this.deck.pop(); // burn
        this.communityCards.push(this.deck.pop()!);
        break;
      case GameStage.TURN:
        this.currentStage = GameStage.RIVER;
        this.deck.pop(); // burn
        this.communityCards.push(this.deck.pop()!);
        break;
      case GameStage.RIVER:
        this.currentStage = GameStage.SHOWDOWN;
        this.performShowdown();
        return; // hand evaluation handled here
    }

    // Post-flop: first active player after dealer acts first
    this.activePlayerIndex = this.nextActiveFrom(this.dealerIndex);
  }

  private performShowdown() {
    const allPlayers = this.players.filter((p): p is Player => p !== null);
    const eligible = allPlayers.filter((p) => p.status !== PlayerStatus.FOLD);

    if (eligible.length === 0) {
      this.currentStage = GameStage.SETTLEMENT;
      return;
    }

    // --- Rake: deduct before distribution ---
    const RAKE_RATE = 0.03;
    const RAKE_CAP = 30;
    const rake = Math.min(Math.floor(this.pot * RAKE_RATE), RAKE_CAP);
    this.pot -= rake;

    // --- Build pots (handles Side Pots for All-in players) ---
    const pots = this.buildPots(allPlayers);

    // Get hand rankings for all eligible players once (for display)
    const { all } = determineWinners(
      eligible.map((p) => ({ id: p.id, nickname: p.nickname, cards: p.cards })),
      this.communityCards,
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
        this.communityCards,
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
      const p = this.players.find((pl) => pl && pl.id === pid);
      if (p) p.stack += amount;
    }

    // Build result for all seated players
    const scoreMap = new Map(all.map((r) => [r.playerId, r]));
    this.lastHandResult = allPlayers.map((p) => {
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

    this.pot = 0;
    this.isFoldWin = false;
    this.foldWinnerRevealed = false;
    this.currentStage = GameStage.SETTLEMENT;
    this.actionEndsAt = null;
  }

  /**
   * Build Main Pot + Side Pots based on each player's total contribution.
   * Folded players contribute to pots but are not eligible to win them.
   */
  private buildPots(allPlayers: Player[]): Pot[] {
    const contributors = allPlayers.filter((p) => p.totalBet > 0);
    const levels = [...new Set(contributors.map((p) => p.totalBet))].sort(
      (a, b) => a - b,
    );

    const pots: Pot[] = [];
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

  /** Reset table back to WAITING for a new hand. Advances the dealer button. */
  resetToWaiting() {
    // Advance dealer button clockwise for next hand
    this.dealerIndex = this.nextSeatedFrom(this.dealerIndex);

    const seated = this.players.filter((p) => p !== null);
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

    this.communityCards = [];
    this.deck = [];
    this.pot = 0;
    this.currentBet = 0;
    this.minBet = this.bigBlind;
    this.activePlayerIndex = -1;
    this.lastHandResult = null;
    this.settlementEndsAt = null;
    this.readyCountdownEndsAt = null;
    this.actionEndsAt = null;
    this.isFoldWin = false;
    this.foldWinnerRevealed = false;
    this.straddle = null;
    this.calledAllIn = null;
    this.currentStage = GameStage.WAITING;
    this.lastSitoutAutoFold = null;
  }

  /** Called when the fold-win winner chooses to reveal their cards. */
  revealFoldWinnerCards(): void {
    if (this.isFoldWin && this.currentStage === GameStage.SETTLEMENT) {
      this.foldWinnerRevealed = true;
    }
  }

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
    };
  }
}
