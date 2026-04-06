import { Table, GameStage, TableConfig } from './table';
import { Player, PlayerStatus } from './player';

const DEFAULT_TIMEOUT = 30000;

function makePlayer(overrides: Partial<Player> & { sub?: string } = {}): Player {
  return {
    id: 'player-1',
    username: 'Player1',
    nickname: 'Player One',
    avatar: '',
    stack: 1000,
    bet: 0,
    totalBet: 0,
    status: PlayerStatus.ACTIVE,
    cards: [],
    position: 0,
    isButton: false,
    isSmallBlind: false,
    isBigBlind: false,
    hasActed: false,
    ready: false,
    ...overrides,
  } as Player;
}

function createTable(maxPlayers = 6, config?: TableConfig): Table {
  return new Table('table-1', 'room-1', maxPlayers, 5, 10, 1000, null, config);
}

/** Seat two players and start a hand, returning the table. */
function setupHeadsUp(table: Table): void {
  const p1 = makePlayer({
    sub: 'p1',
    nickname: 'Alice',
    stack: 1000,
    status: PlayerStatus.ACTIVE,
  });
  const p2 = makePlayer({
    sub: 'p2',
    nickname: 'Bob',
    stack: 1000,
    status: PlayerStatus.ACTIVE,
  });

  table.addPlayer(p1, 1000);
  table.addPlayer(p2, 1000);
  table.startHand();
}

describe('Sit-out Detection', () => {
  describe('isSittingOutPlayer', () => {
    it('returns false when not an action stage', () => {
      const table = createTable();
      expect(table.isSittingOutPlayer(0)).toBe(false);
    });

    it('returns false for a null seat', () => {
      const table = createTable();
      table.addPlayer(
        makePlayer({ sub: 'p1', nickname: 'Alice', stack: 1000 }),
        1000,
      );
      table.startHand();
      // activePlayerIndex should be set
      expect(table.isSittingOutPlayer(1)).toBe(false); // empty seat
    });

    it('returns false for an ACTIVE player', () => {
      const table = createTable();
      table.addPlayer(
        makePlayer({ sub: 'p1', nickname: 'Alice', stack: 1000 }),
        1000,
      );
      table.addPlayer(
        makePlayer({ sub: 'p2', nickname: 'Bob', stack: 1000 }),
        1000,
      );
      table.startHand();
      // p1 is SB, p2 is BB, UTG acts first
      // activePlayerIndex should be the UTG (after BB)
      expect(table.isSittingOutPlayer(table.activePlayerIndex)).toBe(false);
    });

    it('returns true for a SITOUT player at their seat', () => {
      const table = createTable();
      table.addPlayer(
        makePlayer({ sub: 'p1', nickname: 'Alice', stack: 1000 }),
        1000,
      );
      table.addPlayer(
        makePlayer({
          sub: 'p2',
          nickname: 'Bob',
          stack: 0,
          status: PlayerStatus.SITOUT,
        }),
        0,
      );
      table.startHand();

      // p2 should have SITOUT status and be at seat 1
      const p2Index = table.players.findIndex((p) => p?.id === 'p2');
      expect(table.isSittingOutPlayer(p2Index)).toBe(true);
    });
  });

  describe('checkAndAutoFoldSittingOut', () => {
    it('does nothing when not an action stage', () => {
      const table = createTable();
      expect(table.checkAndAutoFoldSittingOut()).toBe(false);
      expect(table.lastSitoutAutoFold).toBeNull();
    });

    it('does nothing when active player is ACTIVE', () => {
      const table = createTable();
      setupHeadsUp(table);
      expect(table.checkAndAutoFoldSittingOut()).toBe(false);
      expect(table.lastSitoutAutoFold).toBeNull();
    });

    it('auto-folds a SITOUT player and sets lastSitoutAutoFold', () => {
      const table = createTable();
      // Alice (Button+BB), Bob (SB) — Bob acts first in heads-up preflop
      setupHeadsUp(table);

      const bobIndex = table.players.findIndex((p) => p?.id === 'p2');
      const bob = table.players[bobIndex]!;

      // Bob is already the active player; set him to SITOUT
      // Reset hasActed so the sitout check doesn't skip (BB posted blind has hasActed=true)
      table.activePlayerIndex = bobIndex;
      bob.status = PlayerStatus.SITOUT;
      bob.hasActed = false; // allow the sitout check to proceed
      table.actionEndsAt = Date.now() + 5000;

      // In heads-up, folding the only opponent triggers fold-win → returns false
      expect(table.checkAndAutoFoldSittingOut()).toBe(false);
      expect(table.lastSitoutAutoFold).toEqual({
        playerId: 'p2',
        seatIndex: bobIndex,
      });
      expect(bob.status).toBe(PlayerStatus.FOLD);
      expect(bob.hasActed).toBe(true);
    });

    it('auto-folds a SITOUT player and advances to next active player', () => {
      const table = createTable();
      // 3 players: Alice (SB), Bob (BB), Charlie (UTG)
      table.addPlayer(
        makePlayer({ sub: 'p1', nickname: 'Alice', stack: 1000 }),
        1000,
      );
      table.addPlayer(
        makePlayer({ sub: 'p2', nickname: 'Bob', stack: 1000 }),
        1000,
      );
      table.addPlayer(
        makePlayer({ sub: 'p3', nickname: 'Charlie', stack: 1000 }),
        1000,
      );
      table.startHand();

      // Charlie acts first (UTG). Set Charlie to SITOUT and advance to him.
      const charlieIndex = table.players.findIndex((p) => p?.id === 'p3');
      table.activePlayerIndex = charlieIndex;
      const charlie = table.players[charlieIndex]!;
      charlie.status = PlayerStatus.SITOUT;
      table.actionEndsAt = Date.now() + 5000;

      table.checkAndAutoFoldSittingOut();

      expect(table.lastSitoutAutoFold).toEqual({
        playerId: 'p3',
        seatIndex: charlieIndex,
      });
      expect(charlie.status).toBe(PlayerStatus.FOLD);
      // After folding Charlie, Alice (SB, ACTIVE) should be next
      expect(table.activePlayerIndex).toBe(
        table.players.findIndex((p) => p?.id === 'p1'),
      );
    });

    it('auto-fold of last remaining player triggers fold-win settlement', () => {
      const table = createTable();
      setupHeadsUp(table);

      const bobIndex = table.players.findIndex((p) => p?.id === 'p2');
      const bob = table.players[bobIndex]!;

      // Bob is the only other player; set him to SITOUT and make him active
      table.activePlayerIndex = bobIndex;
      bob.status = PlayerStatus.SITOUT;
      table.actionEndsAt = Date.now() + 5000;

      // After auto-fold, only Alice remains → should reach SETTLEMENT
      table.checkAndAutoFoldSittingOut();

      expect(table.currentStage).toBe(GameStage.SETTLEMENT);
      expect(table.isFoldWin).toBe(true);
      expect(bob.status).toBe(PlayerStatus.FOLD);
    });
  });

  describe('sittingOutTimeout config', () => {
    it('defaults to 30000ms', () => {
      const table = createTable();
      expect(table.sittingOutTimeout).toBe(DEFAULT_TIMEOUT);
    });

    it('uses custom timeout from config', () => {
      const table = createTable(6, { sittingOutTimeout: 15000 });
      expect(table.sittingOutTimeout).toBe(15000);
    });

    it('is serialised in toSnapshot', () => {
      const table = createTable(6, { sittingOutTimeout: 20000 });
      const snapshot = table.toSnapshot();
      expect(snapshot.sittingOutTimeout).toBe(20000);
    });

    it('is restored via fromSnapshot', () => {
      const table = createTable(6, { sittingOutTimeout: 25000 });
      const snapshot = table.toSnapshot();
      const restored = Table.fromSnapshot(snapshot, 6, 5, 10, 1000, null, {
        sittingOutTimeout: 25000,
      });
      expect(restored.sittingOutTimeout).toBe(25000);
    });
  });

  describe('integration with processAction', () => {
    it('auto-folds a SITOUT player when they become the active player', () => {
      const table = createTable();
      // 3 players: Alice (Button), Bob (SB), Charlie (BB) — Alice acts first preflop
      table.addPlayer(
        makePlayer({ sub: 'p1', nickname: 'Alice', stack: 1000 }),
        1000,
      );
      table.addPlayer(
        makePlayer({ sub: 'p2', nickname: 'Bob', stack: 1000 }),
        1000,
      );
      table.addPlayer(
        makePlayer({ sub: 'p3', nickname: 'Charlie', stack: 1000 }),
        1000,
      );
      table.startHand();

      // Manually make Charlie (BB, seat 2) the active player and set him to SITOUT
      const charlieIndex = table.players.findIndex((p) => p?.id === 'p3');
      table.activePlayerIndex = charlieIndex;
      const charlie = table.players[charlieIndex]!;
      charlie.status = PlayerStatus.SITOUT;
      charlie.hasActed = false; // reset so sitout check doesn't skip

      // The sit-out check is called at the end of processAction; we call it directly
      // to verify the auto-fold logic fires when a SITOUT player is active
      const result = table.checkAndAutoFoldSittingOut();

      expect(result).toBe(true);
      expect(table.lastSitoutAutoFold).toEqual({
        playerId: 'p3',
        seatIndex: charlieIndex,
      });
      expect(charlie.status).toBe(PlayerStatus.FOLD);
      // Next active player should be Alice (Button)
      expect(table.activePlayerIndex).toBe(
        table.players.findIndex((p) => p?.id === 'p1'),
      );
    });

    it('does not auto-fold when active player is ACTIVE', () => {
      const table = createTable();
      // 3 players: Alice acts first
      table.addPlayer(
        makePlayer({ sub: 'p1', nickname: 'Alice', stack: 1000 }),
        1000,
      );
      table.addPlayer(
        makePlayer({ sub: 'p2', nickname: 'Bob', stack: 1000 }),
        1000,
      );
      table.addPlayer(
        makePlayer({ sub: 'p3', nickname: 'Charlie', stack: 1000 }),
        1000,
      );
      table.startHand();

      // Alice (seat 0) is active and ACTIVE — checkAndAutoFoldSittingOut should return false
      expect(table.activePlayerIndex).toBe(0);
      expect(table.players[0]!.status).toBe(PlayerStatus.ACTIVE);
      expect(table.checkAndAutoFoldSittingOut()).toBe(false);
      expect(table.lastSitoutAutoFold).toBeNull();
    });

    it('lastSitoutAutoFold is reset at the start of a new hand', () => {
      const table = createTable();
      setupHeadsUp(table);

      // Force a sit-out auto-fold by setting active player to SITOUT
      const bobIndex = table.players.findIndex((p) => p?.id === 'p2');
      table.activePlayerIndex = bobIndex;
      const bob = table.players[bobIndex]!;
      bob.status = PlayerStatus.SITOUT;
      table.actionEndsAt = Date.now() + 5000;
      table.checkAndAutoFoldSittingOut();

      expect(table.lastSitoutAutoFold).not.toBeNull();

      // Start a new hand
      table.resetToWaiting();
      table.addPlayer(
        makePlayer({ sub: 'p1', nickname: 'Alice', stack: 1000 }),
        1000,
      );
      table.addPlayer(
        makePlayer({ sub: 'p2', nickname: 'Bob', stack: 1000 }),
        1000,
      );
      table.startHand();

      expect(table.lastSitoutAutoFold).toBeNull();
    });
  });
});
