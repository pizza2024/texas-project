import { Test, TestingModule } from '@nestjs/testing';
import { forwardRef } from '@nestjs/common';
import {
  BlastService,
  BLAST_TOTAL_DURATION_MS,
  BLAST_PRIZE_BASIS_POINTS,
} from './blast.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
import { RoomService } from '../room/room.service';
import { TournamentService } from './tournament.service';
import { TableManagerService } from '../table-engine/table-manager.service';
import { WebSocketManager } from '../websocket/websocket-manager';
import {
  BLAST_MAX_PLAYERS,
  BLAST_INITIAL_CHIPS,
  BLAST_PRIZE_DISTRIBUTION,
  BLAST_LOBBY_KEY_PREFIX,
  BLAST_LOBBY_QUEUE_KEY,
} from '@texas/shared/types/tournament';

describe('BlastService', () => {
  let service: BlastService;

  // ─── Mock Data ────────────────────────────────────────────────────────────────

  const LOBBY_ID = 'lobby-123';
  const PLAYER_1 = 'player-1';
  const PLAYER_2 = 'player-2';
  const PLAYER_3 = 'player-3';
  const BUYIN = 500;
  const SMALL_BLIND = 25;
  const BIG_BLIND = 50;

  const mockLobby = {
    id: LOBBY_ID,
    buyin: BUYIN,
    playerIds: [PLAYER_1, PLAYER_2, PLAYER_3],
    maxPlayers: BLAST_MAX_PLAYERS as typeof BLAST_MAX_PLAYERS,
    status: 'starting' as const,
    createdAt: Date.now(),
    creatorId: PLAYER_1,
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
    multiplier: 2,
    endsAt: 0,
  };

  // ─── Mocks ───────────────────────────────────────────────────────────────────

  const mockPrisma = {
    transaction: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockImplementation(async (fn) => {
      // Pass mockPrisma as the tx so tx.transaction.create === mockPrisma.transaction.create
      return fn(mockPrisma);
    }),
    user: {
      findUnique: jest.fn().mockResolvedValue({ nickname: 'TestUser' }),
    },
  };

  const mockRedisService = {
    isAvailable: true,
    hgetall: jest.fn(),
    hset: jest.fn().mockResolvedValue('OK'),
    set: jest.fn().mockResolvedValue('OK'),
    lrem: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
  };

  const mockWalletService = {
    freezeBalance: jest.fn().mockResolvedValue(undefined),
    unfreezeBalance: jest.fn().mockResolvedValue(undefined),
    unfreezeAndAward: jest.fn().mockResolvedValue(undefined),
  };

  const mockRoomService = {
    createRoom: jest.fn().mockResolvedValue({
      id: LOBBY_ID,
      name: `Blast-${LOBBY_ID.slice(0, 8)}`,
      blindSmall: SMALL_BLIND,
      blindBig: BIG_BLIND,
      maxPlayers: BLAST_MAX_PLAYERS,
      isTournament: true,
      isBlast: true,
    }),
    findOne: jest.fn(),
  };

  const mockTournamentService = {
    calculateFinalRankings: jest.fn(),
  };

  const mockTableManagerService = {
    getTable: jest.fn(),
    registerPlayerRoom: jest.fn(),
    clearTableState: jest.fn().mockResolvedValue(undefined),
    // Mock table instance returned by getTable
    _mockTable: {
      addPlayer: jest.fn(),
      getPlayerCount: () => 0,
    },
  };

  // Make getTable return the mock table by default
  beforeEach(() => {
    mockTableManagerService.getTable.mockReturnValue(
      mockTableManagerService._mockTable,
    );
  });

  const mockWebSocketManager = {
    getServer: jest.fn().mockReturnValue(undefined),
    emitToUser: jest.fn(),
  };

  // ─── Setup ───────────────────────────────────────────────────────────────────

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlastService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
        { provide: WalletService, useValue: mockWalletService },
        { provide: RoomService, useValue: mockRoomService },
        { provide: TableManagerService, useValue: mockTableManagerService },
        { provide: TournamentService, useValue: mockTournamentService },
        { provide: WebSocketManager, useValue: mockWebSocketManager },
      ],
    })
      .overrideProvider(TournamentService)
      .useFactory({
        factory: () =>
          jest.fn().mockImplementation(() => ({
            calculateFinalRankings:
              mockTournamentService.calculateFinalRankings,
          })),
      })
      .compile();

    service = module.get<BlastService>(BlastService);
  });

  // ─── startBlastGame ──────────────────────────────────────────────────────────

  describe('startBlastGame', () => {
    beforeEach(() => {
      mockRedisService.hgetall.mockResolvedValue({
        data: JSON.stringify(mockLobby),
      });
      mockTableManagerService.getTable.mockResolvedValue({
        getPlayerCount: () => 0,
        addPlayer: jest.fn(),
      });
    });

    it('returns null when lobby is not found', async () => {
      mockRedisService.hgetall.mockResolvedValue(null);

      const result = await service.startBlastGame('nonexistent-lobby');

      expect(result).toBeNull();
    });

    it('returns null when lobby has fewer than 3 players', async () => {
      const partialLobby = { ...mockLobby, playerIds: [PLAYER_1, PLAYER_2] };
      mockRedisService.hgetall.mockResolvedValue({
        data: JSON.stringify(partialLobby),
      });

      const result = await service.startBlastGame(LOBBY_ID);

      expect(result).toBeNull();
    });

    it('creates a game record when lobby has 3 players', async () => {
      const result = await service.startBlastGame(LOBBY_ID);

      expect(result).not.toBeNull();
      expect(result!.lobbyId).toBe(LOBBY_ID);
      expect(result!.playerIds).toEqual([PLAYER_1, PLAYER_2, PLAYER_3]);
      expect(result!.buyin).toBe(BUYIN);
      expect([2, 5, 10]).toContain(result!.multiplier); // 60%/30%/10% draw
      expect(result!.totalPrizePool).toBe(
        BUYIN * BLAST_MAX_PLAYERS * result!.multiplier,
      );
      expect(result!.endsAt).toBeGreaterThan(Date.now());
      expect(result!.endsAt - result!.startedAt).toBe(BLAST_TOTAL_DURATION_MS);
    });

    it('freezes buyin chips for all 3 players', async () => {
      await service.startBlastGame(LOBBY_ID);

      expect(mockWalletService.freezeBalance).toHaveBeenCalledTimes(3);
      expect(mockWalletService.freezeBalance).toHaveBeenCalledWith(
        PLAYER_1,
        BUYIN,
      );
      expect(mockWalletService.freezeBalance).toHaveBeenCalledWith(
        PLAYER_2,
        BUYIN,
      );
      expect(mockWalletService.freezeBalance).toHaveBeenCalledWith(
        PLAYER_3,
        BUYIN,
      );
    });

    it('creates a room with correct blast config', async () => {
      await service.startBlastGame(LOBBY_ID);

      expect(mockRoomService.createRoom).toHaveBeenCalledTimes(1);
      const createRoomCall = mockRoomService.createRoom.mock.calls[0]![0];
      expect(createRoomCall.isBlast).toBe(true);
      expect(createRoomCall.isTournament).toBe(true);
      expect(createRoomCall.maxPlayers).toBe(BLAST_MAX_PLAYERS);
    });

    it('registers all players in table manager', async () => {
      await service.startBlastGame(LOBBY_ID);

      expect(mockTableManagerService.registerPlayerRoom).toHaveBeenCalledTimes(
        3,
      );
      expect(mockTableManagerService.registerPlayerRoom).toHaveBeenCalledWith(
        PLAYER_1,
        LOBBY_ID,
      );
      expect(mockTableManagerService.registerPlayerRoom).toHaveBeenCalledWith(
        PLAYER_2,
        LOBBY_ID,
      );
      expect(mockTableManagerService.registerPlayerRoom).toHaveBeenCalledWith(
        PLAYER_3,
        LOBBY_ID,
      );
    });

    it('persists game record to Redis', async () => {
      await service.startBlastGame(LOBBY_ID);

      // Uses redis.set with TTL (not hset) for auto-expiry
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('returns null and rolls back freezes when getTable fails', async () => {
      mockTableManagerService.getTable.mockResolvedValue(undefined);

      const result = await service.startBlastGame(LOBBY_ID);

      expect(result).toBeNull();
      expect(mockWalletService.unfreezeBalance).toHaveBeenCalledWith(PLAYER_1);
      expect(mockWalletService.unfreezeBalance).toHaveBeenCalledWith(PLAYER_2);
      expect(mockWalletService.unfreezeBalance).toHaveBeenCalledWith(PLAYER_3);
    });
  });

  // ─── onBlastHandComplete ────────────────────────────────────────────────────

  describe('onBlastHandComplete', () => {
    it('returns continue when no active game exists', async () => {
      const result = await service.onBlastHandComplete('nonexistent-table', []);

      expect(result).toBe('continue');
    });

    it('returns time_expired when game time has elapsed', async () => {
      mockRedisService.hgetall.mockResolvedValue({
        data: JSON.stringify(mockLobby),
      });
      mockTableManagerService.getTable.mockResolvedValue({
        getPlayerCount: () => 3,
        addPlayer: jest.fn(),
      });
      mockTournamentService.calculateFinalRankings.mockResolvedValue([
        { place: 1, playerId: PLAYER_1, chips: 3000 },
        { place: 2, playerId: PLAYER_2, chips: 1500 },
        { place: 3, playerId: PLAYER_3, chips: 0 },
      ]);

      await service.startBlastGame(LOBBY_ID);

      // Manually set endsAt to past to trigger time expiry
      const game = service.getActiveGame(LOBBY_ID)!;
      game.endsAt = Date.now() - 1000;

      const result = await service.onBlastHandComplete(LOBBY_ID, [PLAYER_1]);

      expect(result).toBe('time_expired');
    });

    it('returns one_player_left when only 1 player remains', async () => {
      mockRedisService.hgetall.mockResolvedValue({
        data: JSON.stringify(mockLobby),
      });
      mockTableManagerService.getTable.mockResolvedValue({
        getPlayerCount: () => 1,
        addPlayer: jest.fn(),
      });
      mockTournamentService.calculateFinalRankings.mockResolvedValue([
        { place: 1, playerId: PLAYER_1, chips: 3000 },
      ]);

      await service.startBlastGame(LOBBY_ID);

      const result = await service.onBlastHandComplete(LOBBY_ID, [PLAYER_1]);

      expect(result).toBe('one_player_left');
    });

    it('returns continue when game is ongoing', async () => {
      mockRedisService.hgetall.mockResolvedValue({
        data: JSON.stringify(mockLobby),
      });
      mockTableManagerService.getTable.mockResolvedValue({
        getPlayerCount: () => 3,
        addPlayer: jest.fn(),
      });

      await service.startBlastGame(LOBBY_ID);

      const result = await service.onBlastHandComplete(LOBBY_ID, [PLAYER_1]);

      expect(result).toBe('continue');
    });
  });

  // ─── endBlastGame ───────────────────────────────────────────────────────────

  describe('endBlastGame', () => {
    it('warns and returns when no active game exists', async () => {
      await service.endBlastGame('nonexistent-table');

      // Should not throw, just log warning
      expect(
        mockTournamentService.calculateFinalRankings,
      ).not.toHaveBeenCalled();
    });

    it('returns frozen chips when no rankings found', async () => {
      mockRedisService.hgetall.mockResolvedValue({
        data: JSON.stringify(mockLobby),
      });
      mockTableManagerService.getTable.mockResolvedValue({
        getPlayerCount: () => 0,
        addPlayer: jest.fn(),
      });
      mockTournamentService.calculateFinalRankings.mockResolvedValue([]);

      await service.startBlastGame(LOBBY_ID);
      await service.endBlastGame(LOBBY_ID);

      expect(mockWalletService.unfreezeAndAward).toHaveBeenCalledTimes(3);
    });

    it('distributes prizes according to basis points', async () => {
      mockRedisService.hgetall.mockResolvedValue({
        data: JSON.stringify(mockLobby),
      });
      mockTableManagerService.getTable.mockResolvedValue({
        getPlayerCount: () => 3,
        addPlayer: jest.fn(),
      });
      mockTournamentService.calculateFinalRankings.mockResolvedValue([
        { place: 1, playerId: PLAYER_1, chips: 3000 },
        { place: 2, playerId: PLAYER_2, chips: 1500 },
        { place: 3, playerId: PLAYER_3, chips: 0 },
      ]);

      await service.startBlastGame(LOBBY_ID);
      const game = service.getActiveGame(LOBBY_ID)!;
      const totalPrize = game.totalPrizePool;

      await service.endBlastGame(LOBBY_ID);

      // Check 1st place: 7000/10000 = 70%
      expect(mockWalletService.unfreezeAndAward).toHaveBeenCalledWith(
        PLAYER_1,
        Math.floor((totalPrize * 7000) / 10000),
      );
      // Check 2nd place: 2000/10000 = 20%
      expect(mockWalletService.unfreezeAndAward).toHaveBeenCalledWith(
        PLAYER_2,
        Math.floor((totalPrize * 2000) / 10000),
      );
      // Check 3rd place: 1000/10000 = 10%
      expect(mockWalletService.unfreezeAndAward).toHaveBeenCalledWith(
        PLAYER_3,
        Math.floor((totalPrize * 1000) / 10000),
      );
    });

    it('creates GAME_WIN transaction records', async () => {
      mockRedisService.hgetall.mockResolvedValue({
        data: JSON.stringify(mockLobby),
      });
      mockTableManagerService.getTable.mockResolvedValue({
        getPlayerCount: () => 3,
        addPlayer: jest.fn(),
      });
      mockTournamentService.calculateFinalRankings.mockResolvedValue([
        { place: 1, playerId: PLAYER_1, chips: 3000 },
        { place: 2, playerId: PLAYER_2, chips: 1500 },
        { place: 3, playerId: PLAYER_3, chips: 0 },
      ]);

      await service.startBlastGame(LOBBY_ID);
      await service.endBlastGame(LOBBY_ID);

      expect(mockPrisma.transaction.create).toHaveBeenCalledTimes(3);
      for (const playerId of [PLAYER_1, PLAYER_2, PLAYER_3]) {
        expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: playerId,
            type: 'GAME_WIN',
          }),
        });
      }
    });

    it('cleans up active games map after ending', async () => {
      mockRedisService.hgetall.mockResolvedValue({
        data: JSON.stringify(mockLobby),
      });
      mockTableManagerService.getTable.mockResolvedValue({
        getPlayerCount: () => 3,
        addPlayer: jest.fn(),
      });
      mockTournamentService.calculateFinalRankings.mockResolvedValue([
        { place: 1, playerId: PLAYER_1, chips: 3000 },
        { place: 2, playerId: PLAYER_2, chips: 1500 },
        { place: 3, playerId: PLAYER_3, chips: 0 },
      ]);

      await service.startBlastGame(LOBBY_ID);
      expect(service.isBlastGame(LOBBY_ID)).toBe(true);

      await service.endBlastGame(LOBBY_ID);

      expect(service.isBlastGame(LOBBY_ID)).toBe(false);
    });
  });

  // ─── forfeitBlast ───────────────────────────────────────────────────────────

  describe('forfeitBlast', () => {
    it('warns when no active game exists', async () => {
      await service.forfeitBlast('nonexistent-table', PLAYER_1);

      // Should not throw, just log warning
      expect(
        mockTournamentService.calculateFinalRankings,
      ).not.toHaveBeenCalled();
    });

    it('removes player from tracked player list', async () => {
      mockRedisService.hgetall.mockResolvedValue({
        data: JSON.stringify(mockLobby),
      });
      mockTableManagerService.getTable.mockResolvedValue({
        getPlayerCount: () => 3,
        addPlayer: jest.fn(),
      });

      await service.startBlastGame(LOBBY_ID);

      await service.forfeitBlast(LOBBY_ID, PLAYER_1);

      const game = service.getActiveGame(LOBBY_ID);
      expect(game!.playerIds).not.toContain(PLAYER_1);
    });

    it('ends game early when only 1 player remains on table', async () => {
      // Start with 3 players, then forfeit one leaving 2 in game.playerIds.
      // Mock getTable to return 1 remaining slot (e.g. one player busted/disconnected).
      mockRedisService.hgetall.mockResolvedValue({
        data: JSON.stringify(mockLobby),
      });
      mockTableManagerService.getTable.mockResolvedValue({
        getPlayerCount: () => 1, // 1 seat occupied on table
        addPlayer: jest.fn(),
      });
      mockTournamentService.calculateFinalRankings.mockResolvedValue([
        { place: 1, playerId: PLAYER_2, chips: 3000 },
      ]);

      await service.startBlastGame(LOBBY_ID);

      await service.forfeitBlast(LOBBY_ID, PLAYER_1);

      // Game should end — isBlastGame should be false
      expect(service.isBlastGame(LOBBY_ID)).toBe(false);
    });
  });

  // ─── Query methods ──────────────────────────────────────────────────────────

  describe('query methods', () => {
    beforeEach(() => {
      mockRedisService.hgetall.mockResolvedValue({
        data: JSON.stringify(mockLobby),
      });
      mockTableManagerService.getTable.mockResolvedValue({
        getPlayerCount: () => 3,
        addPlayer: jest.fn(),
      });
    });

    it('isBlastGame returns false when no active game', () => {
      expect(service.isBlastGame('nonexistent')).toBe(false);
    });

    it('isBlastGame returns true for active game', async () => {
      await service.startBlastGame(LOBBY_ID);
      expect(service.isBlastGame(LOBBY_ID)).toBe(true);
    });

    it('getActiveGame returns undefined for nonexistent table', () => {
      expect(service.getActiveGame('nonexistent')).toBeUndefined();
    });

    it('getActiveGame returns correct record', async () => {
      await service.startBlastGame(LOBBY_ID);
      const game = service.getActiveGame(LOBBY_ID);
      expect(game).toBeDefined();
      expect(game!.lobbyId).toBe(LOBBY_ID);
    });

    it('getAllActiveGames returns all active games', async () => {
      // Start a second lobby concurrently
      const mockLobby2 = {
        ...mockLobby,
        id: 'lobby-456',
        playerIds: ['p4', 'p5', 'p6'],
      };
      mockRedisService.hgetall.mockResolvedValueOnce({
        data: JSON.stringify(mockLobby),
      });
      mockRedisService.hgetall.mockResolvedValueOnce({
        data: JSON.stringify(mockLobby2),
      });

      await service.startBlastGame(LOBBY_ID);
      await service.startBlastGame('lobby-456');

      const allGames = service.getAllActiveGames();
      expect(allGames).toHaveLength(2);
    });
  });
});
