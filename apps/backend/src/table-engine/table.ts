import { Player, PlayerStatus } from './player';
import { determineWinners } from './hand-evaluator';

export interface HandResultEntry {
  playerId: string;
  nickname: string;
  handName: string;
  winAmount: number;
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

  constructor(id: string, roomId: string, maxPlayers: number, smallBlind: number, bigBlind: number, minBuyIn?: number, roomPassword?: string | null) {
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
  }

  static fromSnapshot(
    snapshot: TableSnapshot,
    maxPlayers: number,
    smallBlind: number,
    bigBlind: number,
    minBuyIn?: number,
    roomPassword?: string | null,
  ): Table {
    const table = new Table(snapshot.id, snapshot.roomId, maxPlayers, smallBlind, bigBlind, minBuyIn, roomPassword);
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
    };
  }

  addPlayer(player: any, initialStack = 1000): boolean {
    if (this.hasPlayer(player.sub)) {
      // Refresh nickname from JWT on every connect/reconnect
      const existing = this.players.find(p => p?.id === player.sub);
      if (existing) {
        existing.nickname = player.nickname ?? player.username;
      }
      return true;
    }

    const seatIndex = this.players.findIndex(p => p === null);
    if (seatIndex === -1) return false;
    
    // transform user to player
    const newPlayer: Player = {
      id: player.sub,
      nickname: player.nickname ?? player.username,
      avatar: '',
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
      ready: false,
    };
    
    this.players[seatIndex] = newPlayer;
    return true;
  }

  removePlayer(playerId: string): Player | null {
    const index = this.players.findIndex(p => p && p.id === playerId);
    if (index !== -1) {
      const removedPlayer = this.players[index];
      this.players[index] = null;
      return removedPlayer;
    }

    return null;
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
      .filter((player): player is Player => player !== null && player.stack <= 0)
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

  getTimeoutAction(): { action: 'check' | 'fold'; playerId: string } | null {
    if (!this.isActionStage()) {
      return null;
    }

    const activePlayer = this.players[this.activePlayerIndex];
    if (!activePlayer || activePlayer.status !== PlayerStatus.ACTIVE) {
      return null;
    }

    return {
      playerId: activePlayer.id,
      action: this.currentBet <= activePlayer.bet ? 'check' : 'fold',
    };
  }

  private isActionStage() {
    return (
      this.currentStage === GameStage.PREFLOP ||
      this.currentStage === GameStage.FLOP ||
      this.currentStage === GameStage.TURN ||
      this.currentStage === GameStage.RIVER
    );
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
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
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

  private startHand() {
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

      case 'check':
        // Only legal when no outstanding bet to call
        if (this.currentBet > activePlayer.bet) return false;
        activePlayer.hasActed = true;
        handled = true;
        break;

      case 'call': {
        const callAmount = Math.min(this.currentBet - activePlayer.bet, activePlayer.stack);
        if (callAmount <= 0) return false;
        activePlayer.stack -= callAmount;
        activePlayer.bet += callAmount;
        activePlayer.totalBet += callAmount;
        this.pot += callAmount;
        activePlayer.hasActed = true;
        if (activePlayer.stack === 0) activePlayer.status = PlayerStatus.ALLIN;
        handled = true;
        break;
      }

      case 'raise': {
        // `amount` is the total bet for this street (raise-to amount)
        const minRaiseTo = this.currentBet + this.minBet;
        if (amount < minRaiseTo) return false;
        const toAdd = Math.min(amount - activePlayer.bet, activePlayer.stack);
        if (toAdd <= 0) return false;
        this.minBet = amount - this.currentBet; // raise increment becomes new min-raise
        activePlayer.stack -= toAdd;
        activePlayer.bet += toAdd;
        activePlayer.totalBet += toAdd;
        this.pot += toAdd;
        this.currentBet = activePlayer.bet;
        activePlayer.hasActed = true;
        if (activePlayer.stack === 0) activePlayer.status = PlayerStatus.ALLIN;
        // Re-open action for everyone else still active
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
          this.players.forEach((p) => {
            if (p && p.id !== playerId && p.status === PlayerStatus.ACTIVE) {
              p.hasActed = false;
            }
          });
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

    this.actionEndsAt = null;

    // Check if only one non-folded player remains → that player wins
    const notFolded = this.players.filter((p) => p && p.status !== PlayerStatus.FOLD) as Player[];
    if (notFolded.length === 1) {
      const winner = notFolded[0];
      const winAmount = this.pot;
      winner.stack += winAmount;
      this.pot = 0;
      this.lastHandResult = this.players
        .filter((p) => p !== null)
        .map((p) => ({
          playerId: p!.id,
          nickname: p!.nickname,
          handName: p!.id === winner.id ? '其他玩家弃牌' : '弃牌',
          winAmount: p!.id === winner.id ? winAmount : 0,
        }));
      this.currentStage = GameStage.SETTLEMENT;
      return true;
    }

    // Check if the betting round is complete
    if (this.isBettingRoundComplete()) {
      this.advanceStreet();
    } else {
      this.activePlayerIndex = this.nextActiveFrom(this.activePlayerIndex);
    }

    return true;
  }

  private isBettingRoundComplete(): boolean {
    const active = this.players.filter((p) => p && p.status === PlayerStatus.ACTIVE) as Player[];
    return active.length === 0 || active.every((p) => p.hasActed && p.bet === this.currentBet);
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
        this.communityCards.push(this.deck.pop()!, this.deck.pop()!, this.deck.pop()!);
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
    // Only non-folded players compete
    const eligible = this.players.filter(
      (p) => p && p.status !== PlayerStatus.FOLD,
    ) as Player[];

    if (eligible.length === 0) {
      this.currentStage = GameStage.SETTLEMENT;
      return;
    }

    const { winners, all } = determineWinners(
      eligible.map((p) => ({ id: p.id, nickname: p.nickname, cards: p.cards })),
      this.communityCards,
    );

    // Split pot evenly; remainder to the first winner (closest after dealer)
    const share = Math.floor(this.pot / winners.length);
    const remainder = this.pot - share * winners.length;
    const winAmounts = new Map<string, number>();
    winners.forEach((w, idx) => winAmounts.set(w.playerId, share + (idx === 0 ? remainder : 0)));

    // Credit stacks
    for (const [pid, amount] of winAmounts) {
      const p = this.players.find((pl) => pl && pl.id === pid);
      if (p) p.stack += amount;
    }

    // Build result for all seated players
    const scoreMap = new Map(all.map((r) => [r.playerId, r]));
    this.lastHandResult = this.players
      .filter((p) => p !== null)
      .map((p) => {
        const isFolded = p!.status === PlayerStatus.FOLD;
        const result = scoreMap.get(p!.id);
        return {
          playerId: p!.id,
          nickname: p!.nickname,
          handName: isFolded ? '弃牌' : (result?.score.name ?? ''),
          winAmount: winAmounts.get(p!.id) ?? 0,
        };
      });

    this.pot = 0;
    this.currentStage = GameStage.SETTLEMENT;
    this.actionEndsAt = null;
  }

  /** Reset table back to WAITING for a new hand. Advances the dealer button. */
  resetToWaiting() {
    // Advance dealer button clockwise for next hand
    this.dealerIndex = this.nextSeatedFrom(this.dealerIndex);

    const seated = this.players.filter((p) => p !== null) as Player[];
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
    this.currentStage = GameStage.WAITING;
  }

  /**
   * Returns a serializable snapshot of the table where opponent hole cards are
   * hidden (replaced with ['??','??']) unless it's showdown/settlement.
   */
  getMaskedView(forPlayerId: string): object {
    const revealAll =
      this.currentStage === GameStage.SHOWDOWN ||
      this.currentStage === GameStage.SETTLEMENT;

    const maskedPlayers = this.players.map((p) => {
      if (!p) return null;
      const isOwn = p.id === forPlayerId;
      return {
        ...p,
        cards:
          isOwn || revealAll
            ? p.cards
            : p.cards.map(() => '??'),
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
    };
  }
}
