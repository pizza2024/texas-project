import { Table } from './table';
import { PlayerStatus } from './player';

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

function createTable(): Table {
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

describe('All-in Call Protection', () => {
  describe('call amount is capped at min(toCall, player.stack)', () => {
    it('call deducts at most player stack even when toCall is larger', () => {
      const table = createTable();
      start3max(table);

      // Alice (Button) raises to 40
      table.activePlayerIndex = 0;
      table.processAction('p1', 'raise', 40);

      // Bob (SB) has only 7 chips left
      table.activePlayerIndex = 1;
      table.players[1]!.stack = 7;
      const bobStackBefore = table.players[1]!.stack;

      // toCall = 40 - 5 (SB posted) = 35, but Bob only has 7
      const result = table.processAction('p2', 'call', 0);

      expect(result).toBe(true);
      // Bob contributes all 7 chips
      expect(table.players[1]!.stack).toBe(0);
      expect(bobStackBefore - table.players[1]!.stack).toBe(7);
    });

    it('player never pays more than their remaining stack on call', () => {
      const table = createTable();
      start3max(table);

      // Alice raises to 50
      table.activePlayerIndex = 0;
      table.processAction('p1', 'raise', 50);

      // Bob (SB) has 3 chips left
      table.activePlayerIndex = 1;
      table.players[1]!.stack = 3;
      const before = table.players[1]!.stack;

      table.processAction('p2', 'call', 0);

      // Stack never goes negative
      expect(table.players[1]!.stack).toBeGreaterThanOrEqual(0);
      expect(table.players[1]!.stack).toBeLessThanOrEqual(before);
    });
  });

  describe('all-in scenarios', () => {
    it('all-in when stack exactly equals toCall', () => {
      const table = createTable();
      start3max(table);

      // Alice raises to 40
      table.activePlayerIndex = 0;
      table.processAction('p1', 'raise', 40);

      // Bob (SB): toCall = 40 - 5 = 35, set Bob's stack to exactly 35
      table.activePlayerIndex = 1;
      table.players[1]!.stack = 35;
      const bobStackBefore = table.players[1]!.stack;

      const result = table.processAction('p2', 'allin', 0);

      expect(result).toBe(true);
      expect(table.players[1]!.stack).toBe(0);
      expect(table.players[1]!.status).toBe(PlayerStatus.ALLIN);
      expect(bobStackBefore - table.players[1]!.stack).toBe(35);
    });

    it('all-in when stack between BB and toCall — player all-ins for full stack', () => {
      const table = createTable();
      start3max(table);

      // Alice raises to 50
      table.activePlayerIndex = 0;
      table.processAction('p1', 'raise', 50);

      // Bob (SB): toCall = 50 - 5 = 45, but Bob only has 17
      table.activePlayerIndex = 1;
      table.players[1]!.stack = 17;

      const result = table.processAction('p2', 'allin', 0);

      expect(result).toBe(true);
      expect(table.players[1]!.stack).toBe(0);
      expect(table.players[1]!.status).toBe(PlayerStatus.ALLIN);
    });

    it('all-in bet exceeding previous currentBet becomes new currentBet and re-opens action', () => {
      const table = createTable();
      start3max(table);

      // Alice (Button) raises to 30
      table.activePlayerIndex = 0;
      table.processAction('p1', 'raise', 30);

      // Bob (SB) has 100 chips, goes all-in — 100 + 5 SB > currentBet 30
      table.activePlayerIndex = 1;
      table.players[1]!.stack = 100;

      table.processAction('p2', 'allin', 0);

      // Bob's total bet = 100 + 5 (SB) = 105 > currentBet 30
      // So currentBet = 105 and minBet = 100
      expect(table.currentBet).toBe(105);
      // Carol (BB) had hasActed reset (re-open)
      expect(table.players[2]!.hasActed).toBe(false);
    });

    it('all-in bet lower than currentBet does not change currentBet', () => {
      const table = createTable();
      start3max(table);

      // Alice raises to 50
      table.activePlayerIndex = 0;
      table.processAction('p1', 'raise', 50);

      // Carol (BB): currentBet=50, Carol has 25, toCall = 50 - 10 = 40
      // Carol's total if all-in = 25 + 10 (BB) = 35 < currentBet 50
      table.activePlayerIndex = 2;
      table.players[2]!.stack = 25;

      table.processAction('p3', 'allin', 0);

      // currentBet stays 50 (Carol's bet 35 < 50)
      expect(table.currentBet).toBe(50);
      expect(table.players[2]!.status).toBe(PlayerStatus.ALLIN);
    });
  });
});
