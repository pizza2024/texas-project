import { Player, PlayerStatus } from './player';

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
  minBet: number;

  constructor(id: string, roomId: string, maxPlayers: number, smallBlind: number, bigBlind: number) {
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
    this.minBet = bigBlind;
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
  
  addPlayer(player: any): boolean {
    if (this.hasPlayer(player.sub)) {
      return true;
    }

    const seatIndex = this.players.findIndex(p => p === null);
    if (seatIndex === -1) return false;
    
    // transform user to player
    const newPlayer: Player = {
      id: player.sub,
      nickname: player.username,
      avatar: '',
      stack: 1000, // Default buy-in
      bet: 0,
      totalBet: 0,
      status: PlayerStatus.ACTIVE,
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

  removePlayer(playerId: string) {
    const index = this.players.findIndex(p => p && p.id === playerId);
    if (index !== -1) {
      this.players[index] = null;
    }
  }

  // Toggle ready state for a player. Returns true if the game started as a result.
  setPlayerReady(playerId: string): boolean {
    if (this.currentStage !== GameStage.WAITING) return false;

    const player = this.players.find((p) => p && p.id === playerId);
    if (!player) return false;

    player.ready = !player.ready;

    const seated = this.players.filter((p) => p !== null) as Player[];
    const allReady = seated.length >= 2 && seated.every((p) => p.ready);
    if (allReady) {
      seated.forEach((p) => { p.ready = false; });
      this.startHand();
      return true;
    }
    return false;
  }

  // Returns the index of the next non-null seat starting from (fromIndex + 1), wrapping around.
  private nextSeatedFrom(fromIndex: number): number {
    const len = this.players.length;
    for (let i = 1; i <= len; i++) {
      const idx = (fromIndex + i) % len;
      if (this.players[idx] !== null) return idx;
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
    const seated = this.players.filter((p) => p !== null) as Player[];

    // Reset all player state for the new hand
    seated.forEach((p) => {
      p.isButton = false;
      p.isSmallBlind = false;
      p.isBigBlind = false;
      p.cards = [];
      p.bet = 0;
      p.totalBet = 0;
      p.hasActed = false;
      p.status = PlayerStatus.ACTIVE;
    });

    // Reset board state
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;

    // Assign positions
    const dealerIdx = this.dealerIndex;
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

    sbPlayer.stack -= this.smallBlind;
    sbPlayer.bet = this.smallBlind;
    sbPlayer.totalBet = this.smallBlind;

    bbPlayer.stack -= this.bigBlind;
    bbPlayer.bet = this.bigBlind;
    bbPlayer.totalBet = this.bigBlind;

    this.pot = this.smallBlind + this.bigBlind;
    this.currentBet = this.bigBlind;

    // First to act preflop: UTG (seat after BB)
    this.activePlayerIndex = this.nextSeatedFrom(bbIdx);
    this.currentStage = GameStage.PREFLOP;
  }

  processAction(playerId: string, action: string, amount: number) {
    // Basic validation
    const player = this.players.find(p => p && p.id === playerId);
    if (!player) return;

    // Update state based on action (simplified)
    console.log(`Player ${playerId} performed ${action} with amount ${amount}`);
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
    };
  }
}
