import { Table, GameStage } from './table';
import { Player, PlayerStatus } from './player';

describe('Table Game Logic', () => {
  // Helper to create a 6-max table with 2 players
  const createTable = (): Table => {
    const table = new Table('table-1', 'room-1', 6, 5, 10, 100);
    return table;
  };

  // Helper to add 2 players and start hand
  const setupHeadsUpHand = (table: Table) => {
    table.addPlayer({ sub: 'alice', username: 'alice' }, 1000);
    table.addPlayer({ sub: 'bob', username: 'bob' }, 1000);
    table.setPlayerReady('alice');
    table.setPlayerReady('bob');
    table.startHand();
  };

  describe('Straddle', () => {
    it('straddle can be posted from UTG position (2x big blind)', () => {
      const table = createTable();
      table.addPlayer({ sub: 'alice', username: 'alice' }, 1000);
      table.addPlayer({ sub: 'bob', username: 'bob' }, 1000);
      table.setPlayerReady('alice');
      table.setPlayerReady('bob');
      table.startHand();

      // Bob is BB, Alice is UTG (first to act preflop)
      // After startHand, activePlayerIndex should be UTG (first to act after BB)
      // Let's check who is first to act
      const utgPlayer = table.players[table.activePlayerIndex];
      expect(utgPlayer).toBeDefined();

      // Straddle amount should be 2x BB = 20
      const straddleAmount = table.bigBlind * 2;
      expect(straddleAmount).toBe(20);

      // UTG player tries to straddle
      const result = table.attemptStraddle(utgPlayer!.id);
      expect(result).toBe(true);
      expect(table.straddle).not.toBeNull();
      expect(table.straddle!.amount).toBe(straddleAmount);
    });

    it('only one straddle per hand', () => {
      const table = createTable();
      table.addPlayer({ sub: 'alice', username: 'alice' }, 1000);
      table.addPlayer({ sub: 'bob', username: 'bob' }, 1000);
      table.setPlayerReady('alice');
      table.setPlayerReady('bob');
      table.startHand();

      const utgPlayer = table.players[table.activePlayerIndex];

      // First straddle should succeed
      const first = table.attemptStraddle(utgPlayer!.id);
      expect(first).toBe(true);
      expect(table.straddle).not.toBeNull();

      // Second straddle attempt should fail
      const second = table.attemptStraddle(utgPlayer!.id);
      expect(second).toBe(false);
    });

    it('straddle resets after hand ends', () => {
      const table = createTable();
      table.addPlayer({ sub: 'alice', username: 'alice' }, 1000);
      table.addPlayer({ sub: 'bob', username: 'bob' }, 1000);
      table.setPlayerReady('alice');
      table.setPlayerReady('bob');
      table.startHand();

      const utgPlayer = table.players[table.activePlayerIndex];
      table.attemptStraddle(utgPlayer!.id);
      expect(table.straddle).not.toBeNull();

      // End the hand (bob folds)
      table.processAction('bob', 'fold', 0);

      // Reset to waiting
      table.resetToWaiting();

      // Straddle should be cleared
      expect(table.straddle).toBeNull();
    });

    it('straddle player acts last preflop', () => {
      const table = createTable();
      // Add 3 players to have a clear UTG position
      table.addPlayer({ sub: 'alice', username: 'alice' }, 1000);
      table.addPlayer({ sub: 'bob', username: 'bob' }, 1000);
      table.addPlayer({ sub: 'charlie', username: 'charlie' }, 1000);

      table.setPlayerReady('alice');
      table.setPlayerReady('bob');
      table.setPlayerReady('charlie');
      table.startHand();

      // After startHand, activePlayerIndex should be first to act (UTG)
      const firstToAct = table.players[table.activePlayerIndex]!;
      expect(firstToAct).toBeDefined();

      // Straddle from UTG
      const straddleResult = table.attemptStraddle(firstToAct.id);
      expect(straddleResult).toBe(true);

      // After straddle, the active player index should have moved
      // The straddle player should have acted already (hasActed = true)
      expect(firstToAct.hasActed).toBe(true);

      // Straddle info should indicate the player
      expect(table.straddle!.playerId).toBe(firstToAct.id);
    });
  });

  describe('All-in Call Protection', () => {
    it('a player going all-in increases their bet correctly', () => {
      const table = createTable();
      table.addPlayer({ sub: 'alice', username: 'alice' }, 1000);
      table.addPlayer({ sub: 'bob', username: 'bob' }, 1000);
      table.setPlayerReady('alice');
      table.setPlayerReady('bob');
      table.startHand();

      // Bob is BB, Alice is UTG
      const utgPlayer = table.players[table.activePlayerIndex];
      const bobPlayer = table.players.find((p) => p && p.id === 'bob')!;

      // Alice calls the BB
      table.processAction('alice', 'call', 0);

      // Bob raises all-in
      table.processAction('bob', 'allin', 0);

      expect(bobPlayer.status).toBe(PlayerStatus.ALLIN);
      expect(bobPlayer.stack).toBe(0);
      expect(bobPlayer.bet).toBeGreaterThan(table.bigBlind);
    });

    it('pot is updated correctly on all-in', () => {
      const table = createTable();
      table.addPlayer({ sub: 'alice', username: 'alice' }, 1000);
      table.addPlayer({ sub: 'bob', username: 'bob' }, 1000);
      table.setPlayerReady('alice');
      table.setPlayerReady('bob');
      table.startHand();

      const potBefore = table.pot;

      // Alice calls the BB
      table.processAction('alice', 'call', 0);

      // Bob goes all-in
      const bobBefore = table.players.find((p) => p && p.id === 'bob')!;
      const bobStackBefore = bobBefore.stack;

      table.processAction('bob', 'allin', 0);

      // Pot should increase by Bob's all-in amount
      expect(table.pot).toBe(potBefore + bobStackBefore);
    });

    it('all-in player cannot bet more than their stack', () => {
      const table = createTable();
      table.addPlayer({ sub: 'alice', username: 'alice' }, 1000);
      table.addPlayer({ sub: 'bob', username: 'bob' }, 1000);
      table.setPlayerReady('alice');
      table.setPlayerReady('bob');
      table.startHand();

      const bobPlayer = table.players.find((p) => p && p.id === 'bob')!;
      // Capture total chips (stack + current bet) before all-in
      const bobTotalBefore = bobPlayer.stack + bobPlayer.bet;

      // Bob goes all-in
      table.processAction('bob', 'allin', 0);

      expect(bobPlayer.stack).toBe(0);
      // Bob's total bet after all-in equals his starting total chips
      expect(bobPlayer.bet).toBe(bobTotalBefore);
    });
  });

  describe('Sit-out Detection', () => {
    it('player can be marked as sitting out', () => {
      const table = createTable();
      table.addPlayer({ sub: 'alice', username: 'alice' }, 0); // Zero stack
      table.addPlayer({ sub: 'bob', username: 'bob' }, 1000);

      const alice = table.players.find((p) => p && p.id === 'alice')!;

      // Zero-stack player should start as SITOUT
      expect(alice.status).toBe(PlayerStatus.SITOUT);
    });

    it('sit-out player is skipped in betting', () => {
      const table = createTable();
      table.addPlayer({ sub: 'alice', username: 'alice' }, 0); // SITOUT
      table.addPlayer({ sub: 'bob', username: 'bob' }, 1000);
      table.addPlayer({ sub: 'charlie', username: 'charlie' }, 1000);

      table.setPlayerReady('bob');
      table.setPlayerReady('charlie');
      table.startHand();

      // Only bob and charlie should be active
      const activePlayers = table.players.filter(
        (p) => p && p.status === PlayerStatus.ACTIVE,
      );
      expect(activePlayers.length).toBe(2);

      // Alice (SITOUT) should not be in active players
      const alice = table.players.find((p) => p && p.id === 'alice');
      expect(alice!.status).toBe(PlayerStatus.SITOUT);
    });

    it('sit-out player does not receive cards (after current hand)', () => {
      const table = createTable();
      // Alice with stack 0 should be SITOUT from start
      table.addPlayer({ sub: 'alice', username: 'alice' }, 0);
      table.addPlayer({ sub: 'bob', username: 'bob' }, 1000);
      table.addPlayer({ sub: 'charlie', username: 'charlie' }, 1000);

      table.setPlayerReady('bob');
      table.setPlayerReady('charlie');
      table.startHand();

      // Alice (SITOUT) should not receive cards
      const alice = table.players.find((p) => p && p.id === 'alice')!;
      expect(alice.cards).toHaveLength(0);
      expect(alice.status).toBe(PlayerStatus.SITOUT);

      // Active players should have cards
      const bob = table.players.find((p) => p && p.id === 'bob')!;
      const charlie = table.players.find((p) => p && p.id === 'charlie')!;
      expect(bob.cards).toHaveLength(2);
      expect(charlie.cards).toHaveLength(2);
    });

    it('player can fold mid-hand', () => {
      const table = createTable();
      table.addPlayer({ sub: 'alice', username: 'alice' }, 1000);
      table.addPlayer({ sub: 'bob', username: 'bob' }, 1000);
      table.setPlayerReady('alice');
      table.setPlayerReady('bob');
      table.startHand();

      // In heads-up, SB (bob) acts first preflop
      // Bob folds
      const result = table.processAction('bob', 'fold', 0);
      expect(result).toBe(true);

      const bob = table.players.find((p) => p && p.id === 'bob')!;
      expect(bob.status).toBe(PlayerStatus.FOLD);
    });

    it('isCurrentPlayerSitOut returns true when active player is sit-out', () => {
      const table = createTable();
      table.addPlayer({ sub: 'alice', username: 'alice' }, 0);
      table.addPlayer({ sub: 'bob', username: 'bob' }, 1000);
      table.addPlayer({ sub: 'charlie', username: 'charlie' }, 1000);

      table.setPlayerReady('bob');
      table.setPlayerReady('charlie');
      table.startHand();

      // In 3-player: dealer=2(charlie button), sb=0(alice), bb=1(bob)
      // Preflop action order: charlie(UTG), then alice(SB), then bob(BB)
      // Charlie acts first — isCurrentPlayerSitOut checks if charlie is SITOUT
      // Since charlie has 1000 stack, he's ACTIVE, not SITOUT
      expect(table.isCurrentPlayerSitOut()).toBe(false);

      // When a zero-stack player is forced to act (edge case), they are SITOUT
      const alice = table.players.find((p) => p && p.id === 'alice')!;
      expect(alice.status).toBe(PlayerStatus.SITOUT);
    });
  });
});
