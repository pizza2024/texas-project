import { Table } from './table';
import { GameStage } from './table';
import { PlayerStatus } from './player';

/**
 * In this Table implementation with 3 players started with start3max():
 * - dealerIndex=0 → Button at seat 0
 * - SB at seat 1, BB at seat 2
 * - First to act preflop = Button (seat 0)
 */
function makePlayer(overrides: Partial<{
  sub: string; nickname: string; stack: number; status: PlayerStatus; hasActed: boolean;
}> = {}): any {
  return {
    sub: 'player-1',
    username: 'Player1',
    nickname: 'Player One',
    avatar: '',
    stack: 1000,
    status: PlayerStatus.ACTIVE,
    hasActed: false,
    ...overrides,
  };
}

function createTable3max(): Table {
  return new Table('table-1', 'room-1', 6, 5, 10, 1000, null);
}

/**
 * 3 players: Alice=Button(seat0), Bob=SB(seat1), Carol=BB(seat2)
 * First to act preflop = Alice (Button)
 */
function start3max(table: Table): void {
  table.addPlayer(makePlayer({ sub: 'p1', nickname: 'Alice', stack: 1000 }), 1000);
  table.addPlayer(makePlayer({ sub: 'p2', nickname: 'Bob', stack: 1000 }), 1000);
  table.addPlayer(makePlayer({ sub: 'p3', nickname: 'Carol', stack: 1000 }), 1000);
  table.startHand();
}

describe('Straddle', () => {
  describe('straddle placement restrictions', () => {
    it('returns false when not in PREFLOP', () => {
      const table = createTable3max();
      start3max(table);

      table.currentStage = GameStage.FLOP;
      // activePlayerIndex = 0 (Button)
      expect(table.processAction('p1', 'straddle', 0)).toBe(false);
    });

    it('returns false when currentBet != bigBlind (already raised)', () => {
      const table = createTable3max();
      start3max(table);

      // Alice (Button) raises
      table.processAction('p1', 'raise', 30);

      // Alice tries to straddle — currentBet is now 30, not BB
      expect(table.processAction('p1', 'straddle', 0)).toBe(false);
    });

    it('returns false when player has already acted (hasActed=true)', () => {
      const table = createTable3max();
      start3max(table);

      // Alice (Button) calls
      table.processAction('p1', 'call', 0);

      // Alice tries to straddle after calling — hasActed is now true
      expect(table.processAction('p1', 'straddle', 0)).toBe(false);
    });

    it('returns false when player stack < 2x bigBlind', () => {
      const table = createTable3max();
      // Alice (Button) has only 19 chips — less than 2x BB (20)
      table.addPlayer(makePlayer({ sub: 'p1', nickname: 'Alice', stack: 19 }), 19);
      table.addPlayer(makePlayer({ sub: 'p2', nickname: 'Bob', stack: 1000 }), 1000);
      table.addPlayer(makePlayer({ sub: 'p3', nickname: 'Carol', stack: 1000 }), 1000);
      table.startHand();

      // Alice is Button (first to act)
      expect(table.activePlayerIndex).toBe(0);
      expect(table.processAction('p1', 'straddle', 0)).toBe(false);
    });
  });

  describe('valid straddle', () => {
    it('succeeds when all conditions are met (Button straddle)', () => {
      const table = createTable3max();
      start3max(table);

      // Alice is Button, first to act, hasn't acted, currentBet == BB
      expect(table.activePlayerIndex).toBe(0);
      expect(table.currentBet).toBe(10); // BB posted
      expect(table.hasStraddle).toBe(false);

      const result = table.processAction('p1', 'straddle', 0);

      expect(result).toBe(true);
      expect(table.hasStraddle).toBe(true);
      expect(table.currentBet).toBe(20); // 2x BB
      expect(table.minBet).toBe(10); // BB
      expect(table.players[0]!.stack).toBe(980); // 1000 - 20
      expect(table.players[0]!.hasActed).toBe(true);
    });

    it('sets player to ALLIN if stack exactly equals 2x BB', () => {
      const table = createTable3max();
      // Alice (Button) has exactly 2x BB chips
      table.addPlayer(makePlayer({ sub: 'p1', nickname: 'Alice', stack: 20 }), 20);
      table.addPlayer(makePlayer({ sub: 'p2', nickname: 'Bob', stack: 1000 }), 1000);
      table.addPlayer(makePlayer({ sub: 'p3', nickname: 'Carol', stack: 1000 }), 1000);
      table.startHand();

      // Alice straddles with exactly 20 chips
      expect(table.activePlayerIndex).toBe(0);
      table.processAction('p1', 'straddle', 0);

      expect(table.players[0]!.status).toBe(PlayerStatus.ALLIN);
      expect(table.players[0]!.stack).toBe(0);
    });

    it('only one straddle allowed per hand', () => {
      const table = createTable3max();
      start3max(table);

      // First straddle by Button succeeds
      expect(table.processAction('p1', 'straddle', 0)).toBe(true);
      expect(table.hasStraddle).toBe(true);

      // Second straddle fails (hasStraddle already true)
      expect(table.processAction('p2', 'straddle', 0)).toBe(false);
    });
  });

  describe('straddle re-opens action', () => {
    it('resets hasActed for all other ACTIVE players after straddle', () => {
      const table = createTable3max();
      start3max(table);

      // Alice (Button) straddles
      table.processAction('p1', 'straddle', 0);

      // After straddle: SB (Bob) and BB (Carol) should have hasActed reset
      expect(table.players[1]!.hasActed).toBe(false);
      expect(table.players[2]!.hasActed).toBe(false);
    });
  });
});
