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
    this.currentStage = GameStage.WAITING;
    this.activePlayerIndex = -1;
    this.dealerIndex = 0;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.minBet = bigBlind;
  }

  // Methods: addPlayer, removePlayer, startHand, processAction, etc.
  
  addPlayer(player: any): boolean {
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
      hasActed: false
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

  processAction(playerId: string, action: string, amount: number) {
    // Basic validation
    const player = this.players.find(p => p && p.id === playerId);
    if (!player) return;

    // Update state based on action (simplified)
    console.log(`Player ${playerId} performed ${action} with amount ${amount}`);
  }
}
