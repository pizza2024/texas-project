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

function createTable(maxPlayers = 6): Table {
  return new Table('table-1', 'room-1', maxPlayers, 5, 10, 1000, null);
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

describe('Sit-out Auto-Action', () => {
  describe('isSittingOutPlayer', () => {
    it('returns false when not an action stage (WAITING)', () => {
      const table = createTable();
      expect(table.isSittingOutPlayer(0)).toBe(false);
    });

    it('returns false for a null seat', () => {
      const table = createTable();
      table.addPlayer(makePlayer({ sub: 'p1', nickname: 'Alice', stack: 1000 }), 1000);
      table.startHand();
      expect(table.isSittingOutPlayer(1)).toBe(false);
    });

    it('returns false for an ACTIVE player', () => {
      const table = createTable();
      table.addPlayer(makePlayer({ sub: 'p1', nickname: 'Alice', stack: 1000 }), 1000);
      table.addPlayer(makePlayer({ sub: 'p2', nickname: 'Bob', stack: 1000 }), 1000);
      table.startHand();
      // In 2-player: activePlayerIndex = 0 (Button acts first)
      expect(table.isSittingOutPlayer(table.activePlayerIndex)).toBe(false);
    });

    it('returns true for a SITOUT player at their seat', () => {
      const table = createTable();
      table.addPlayer(makePlayer({ sub: 'p1', nickname: 'Alice', stack: 1000 }), 1000);
      table.addPlayer(makePlayer({ sub: 'p2', nickname: 'Bob', stack: 0, status: PlayerStatus.SITOUT }), 0);
      table.startHand();
      const p2Index = table.players.findIndex(p => p?.id === 'p2');
      expect(table.isSittingOutPlayer(p2Index)).toBe(true);
    });
  });

  describe('checkAndAutoFoldSittingOut', () => {
    it('returns false when not an action stage', () => {
      const table = createTable();
      expect(table.checkAndAutoFoldSittingOut()).toBe(false);
      expect(table.lastSitoutAutoFold).toBeNull();
    });

    it('returns false when active player is ACTIVE (not SITOUT)', () => {
      const table = createTable();
      table.addPlayer(makePlayer({ sub: 'p1', nickname: 'Alice', stack: 1000 }), 1000);
      table.addPlayer(makePlayer({ sub: 'p2', nickname: 'Bob', stack: 1000 }), 1000);
      table.addPlayer(makePlayer({ sub: 'p3', nickname: 'Carol', stack: 1000 }), 1000);
      table.startHand();
      expect(table.checkAndAutoFoldSittingOut()).toBe(false);
      expect(table.lastSitoutAutoFold).toBeNull();
    });

    it('auto-folds a SITOUT player, records lastSitoutAutoFold, sets hasActed=true', () => {
      const table = createTable();
      start3max(table);

      // Alice (Button) is active first — make her SITOUT
      table.activePlayerIndex = 0;
      const alice = table.players[0]!;
      alice.status = PlayerStatus.SITOUT;
      alice.hasActed = false;
      table.actionEndsAt = Date.now() + 5000;

      const result = table.checkAndAutoFoldSittingOut();

      // Hand continues (3 players, 2 remain)
      expect(result).toBe(true);
      expect(table.lastSitoutAutoFold).toEqual({ playerId: 'p1', seatIndex: 0 });
      expect(alice.status).toBe(PlayerStatus.FOLD);
      expect(alice.hasActed).toBe(true);
    });

    it('auto-folds SITOUT player and advances to next active player', () => {
      const table = createTable();
      start3max(table);

      // Alice (Button) is SITOUT
      table.activePlayerIndex = 0;
      table.players[0]!.status = PlayerStatus.SITOUT;
      table.actionEndsAt = Date.now() + 5000;

      table.checkAndAutoFoldSittingOut();

      expect(table.lastSitoutAutoFold).toEqual({ playerId: 'p1', seatIndex: 0 });
      expect(table.players[0]!.status).toBe(PlayerStatus.FOLD);
      // Next active: Bob (SB)
      expect(table.activePlayerIndex).toBe(1);
    });

    it('lastSitoutAutoFold is reset at the start of a new hand', () => {
      const table = createTable();
      start3max(table);

      // Force auto-fold of Alice
      table.activePlayerIndex = 0;
      table.players[0]!.status = PlayerStatus.SITOUT;
      table.actionEndsAt = Date.now() + 5000;
      table.checkAndAutoFoldSittingOut();
      expect(table.lastSitoutAutoFold).not.toBeNull();

      // Start a new hand
      table.resetToWaiting();
      table.addPlayer(makePlayer({ sub: 'p1', nickname: 'Alice', stack: 1000 }), 1000);
      table.addPlayer(makePlayer({ sub: 'p2', nickname: 'Bob', stack: 1000 }), 1000);
      table.addPlayer(makePlayer({ sub: 'p3', nickname: 'Carol', stack: 1000 }), 1000);
      table.startHand();

      expect(table.lastSitoutAutoFold).toBeNull();
    });
  });

  describe('processAction and sit-out flag interaction', () => {
    it('checkAndAutoFoldSittingOut sets hasActed=true for SITOUT player', () => {
      const table = createTable();
      start3max(table);

      // Make Alice SITOUT and active
      table.activePlayerIndex = 0;
      const alice = table.players[0]!;
      alice.status = PlayerStatus.SITOUT;
      alice.hasActed = false;
      table.actionEndsAt = Date.now() + 5000;

      // checkAndAutoFoldSittingOut is called internally at end of processAction
      table.checkAndAutoFoldSittingOut();

      // After auto-fold, hasActed is true — player won't be auto-folded again
      expect(alice.hasActed).toBe(true);
      expect(alice.status).toBe(PlayerStatus.FOLD);
    });

    it('after auto-fold, checkAndAutoFoldSittingOut returns false for the same player', () => {
      const table = createTable();
      start3max(table);

      // Alice SITOUT and active
      table.activePlayerIndex = 0;
      table.players[0]!.status = PlayerStatus.SITOUT;
      table.actionEndsAt = Date.now() + 5000;

      // First auto-fold
      table.checkAndAutoFoldSittingOut();
      expect(table.players[0]!.status).toBe(PlayerStatus.FOLD);

      // Second check — player is no longer SITOUT, returns false
      expect(table.checkAndAutoFoldSittingOut()).toBe(false);
    });
  });
});
