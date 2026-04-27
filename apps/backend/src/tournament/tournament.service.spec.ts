import { Test, TestingModule } from '@nestjs/testing';
import { TournamentService } from './tournament.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
import { RoomService } from '../room/room.service';
import { BroadcastService } from '../websocket/broadcast.service';
import { TableManagerService } from '../table-engine/table-manager.service';

// Re-export types for convenience
const SNG_MAX_PLAYERS_CONSTANT = 8;

describe('TournamentService', () => {
  let service: TournamentService;

  const mockPrisma = {
    room: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
  };

  const mockRedisService = {
    isAvailable: true,
    zadd: jest.fn().mockResolvedValue(1),
    zrem: jest.fn().mockResolvedValue(1),
    hset: jest.fn().mockResolvedValue('OK'),
    hgetall: jest.fn(),
    lpush: jest.fn().mockResolvedValue(1),
    lrange: jest.fn(),
  };

  const mockWalletService = {
    unfreezeAndAward: jest.fn().mockResolvedValue(undefined),
    freezeBalance: jest.fn().mockResolvedValue(undefined),
  };

  const mockRoomService = {
    findOne: jest.fn(),
  };

  const mockBroadcastService = {
    broadcastToRoom: jest.fn(),
  };

  const mockTableManagerService = {
    getTable: jest.fn(),
    getPersistentBalances: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
        { provide: WalletService, useValue: mockWalletService },
        { provide: RoomService, useValue: mockRoomService },
        { provide: BroadcastService, useValue: mockBroadcastService },
        { provide: TableManagerService, useValue: mockTableManagerService },
      ],
    }).compile();

    service = module.get<TournamentService>(TournamentService);
  });

  // ─── createSngConfig ────────────────────────────────────────────────────────

  describe('createSngConfig', () => {
    it('should create a valid SNG config with correct totalPrize', () => {
      const config = service.createSngConfig(1000, 10);

      expect(config.type).toBe('SNG');
      expect(config.buyin).toBe(1000);
      expect(config.maxPlayers).toBe(8);
      expect(config.totalPrize).toBe(8000);
      expect(config.prizeDistribution).toEqual([60, 30, 10]);
      expect(config.currentBlindLevel).toBe(0);
      expect(config.blindSchedule.length).toBeGreaterThan(0);
    });

    it('should generate a blind schedule with correct structure', () => {
      const config = service.createSngConfig(500, 5);

      expect(config.blindSchedule[0]).toMatchObject({
        level: 1,
        smallBlind: 5,
        bigBlind: 10,
      });
    });

    it('should set blindLevelStartedAt to current timestamp', () => {
      const before = Date.now();
      const config = service.createSngConfig(1000, 10);
      const after = Date.now();

      expect(config.blindLevelStartedAt).toBeGreaterThanOrEqual(before);
      expect(config.blindLevelStartedAt).toBeLessThanOrEqual(after);
    });
  });

  // ─── getPrizeDistribution ──────────────────────────────────────────────────

  describe('getPrizeDistribution', () => {
    it('should return null if room does not exist', async () => {
      mockRoomService.findOne.mockResolvedValue(null);

      const result = await service.getPrizeDistribution('room-1');

      expect(result).toBeNull();
    });

    it('should return null if room is not a tournament', async () => {
      mockRoomService.findOne.mockResolvedValue({
        id: 'room-1',
        isTournament: false,
        tournamentConfig: null,
      });

      const result = await service.getPrizeDistribution('room-1');

      expect(result).toBeNull();
    });

    it('should return null if tournamentConfig is missing', async () => {
      mockRoomService.findOne.mockResolvedValue({
        id: 'room-1',
        isTournament: true,
        tournamentConfig: null,
      });

      const result = await service.getPrizeDistribution('room-1');

      expect(result).toBeNull();
    });

    it('should return correct prize distribution for valid tournament room', async () => {
      mockRoomService.findOne.mockResolvedValue({
        id: 'room-1',
        isTournament: true,
        tournamentConfig: {
          type: 'SNG',
          buyin: 1000,
          maxPlayers: 8,
          prizeDistribution: [60, 30, 10] as [number, number, number],
          blindSchedule: [],
          currentBlindLevel: 0,
          blindLevelStartedAt: Date.now(),
          totalPrize: 8000,
        },
      });

      const result = await service.getPrizeDistribution('room-1');

      expect(result).not.toBeNull();
      expect(result!.buyin).toBe(1000);
      expect(result!.totalPrize).toBe(8000);
      expect(result!.maxPlayers).toBe(8);
      expect(result!.positions).toHaveLength(3);
      expect(result!.positions[0]).toEqual({
        place: 1,
        percentage: 60,
        chips: 4800,
      });
      expect(result!.positions[1]).toEqual({
        place: 2,
        percentage: 30,
        chips: 2400,
      });
      expect(result!.positions[2]).toEqual({
        place: 3,
        percentage: 10,
        chips: 800,
      });
    });

    it('should correctly calculate chips for different buyins', async () => {
      mockRoomService.findOne.mockResolvedValue({
        id: 'room-1',
        isTournament: true,
        tournamentConfig: {
          type: 'SNG',
          buyin: 2500,
          maxPlayers: 8,
          prizeDistribution: [60, 30, 10] as [number, number, number],
          blindSchedule: [],
          currentBlindLevel: 0,
          blindLevelStartedAt: Date.now(),
          totalPrize: 20000,
        },
      });

      const result = await service.getPrizeDistribution('room-1');

      expect(result!.positions[0].chips).toBe(12000);
      expect(result!.positions[1].chips).toBe(6000);
      expect(result!.positions[2].chips).toBe(2000);
    });
  });

  // ─── shouldStopBlindIncreases ───────────────────────────────────────────────

  describe('shouldStopBlindIncreases', () => {
    it('should return false when more than 3 players remain', () => {
      expect(service.shouldStopBlindIncreases(8)).toBe(false);
      expect(service.shouldStopBlindIncreases(7)).toBe(false);
      expect(service.shouldStopBlindIncreases(4)).toBe(false);
    });

    it('should return true when 3 or fewer players remain', () => {
      expect(service.shouldStopBlindIncreases(3)).toBe(true);
      expect(service.shouldStopBlindIncreases(2)).toBe(true);
      expect(service.shouldStopBlindIncreases(1)).toBe(true);
      expect(service.shouldStopBlindIncreases(0)).toBe(true);
    });
  });

  // ─── clearBlindTimer ───────────────────────────────────────────────────────

  describe('clearBlindTimer', () => {
    it('should do nothing when no timer exists for roomId', () => {
      expect(() => service.clearBlindTimer('nonexistent-room')).not.toThrow();
    });

    it('should remove timer from internal map and call Redis zrem', () => {
      const timerId = setTimeout(() => {}, 1000);
      (service as any).blindTimers.set('room-timer', timerId as any);

      mockRedisService.isAvailable = true;
      mockRedisService.zrem.mockResolvedValue(1);

      service.clearBlindTimer('room-timer');

      expect((service as any).blindTimers.has('room-timer')).toBe(false);
      expect(mockRedisService.zrem).toHaveBeenCalled();
    });

    it('should not call Redis when Redis is not available', () => {
      const timerId = setTimeout(() => {}, 1000);
      (service as any).blindTimers.set('room-timer', timerId as any);
      mockRedisService.isAvailable = false;

      service.clearBlindTimer('room-timer');

      expect(mockRedisService.zrem).not.toHaveBeenCalled();
      clearTimeout(timerId as any);
    });
  });

  // ─── calculateFinalRankings ──────────────────────────────────────────────────

  describe('calculateFinalRankings', () => {
    it('should return empty array when room does not exist', async () => {
      mockRoomService.findOne.mockResolvedValue(null);

      const result = await service.calculateFinalRankings('nonexistent-room');

      expect(result).toEqual([]);
    });

    it('should return empty array when table is unavailable', async () => {
      mockRoomService.findOne.mockResolvedValue({ id: 'room-1' });
      mockTableManagerService.getTable.mockResolvedValue(null);

      const result = await service.calculateFinalRankings('room-1');

      expect(result).toEqual([]);
    });

    it('should return empty array when table has no players', async () => {
      mockRoomService.findOne.mockResolvedValue({ id: 'room-1' });
      mockTableManagerService.getTable.mockResolvedValue({
        getPersistentBalances: () => [],
      } as any);

      const result = await service.calculateFinalRankings('room-1');

      expect(result).toEqual([]);
    });

    it('should return rankings sorted by chips descending', async () => {
      mockRoomService.findOne.mockResolvedValue({ id: 'room-1' });
      mockTableManagerService.getTable.mockResolvedValue({
        getPersistentBalances: () => [
          { userId: 'player-3', balance: 500 },
          { userId: 'player-1', balance: 2000 },
          { userId: 'player-2', balance: 1000 },
        ],
      } as any);

      const result = await service.calculateFinalRankings('room-1');

      expect(result).toEqual([
        { place: 1, playerId: 'player-1', chips: 2000 },
        { place: 2, playerId: 'player-2', chips: 1000 },
        { place: 3, playerId: 'player-3', chips: 500 },
      ]);
    });
  });

  // ─── getCurrentBlindInfo ───────────────────────────────────────────────────

  describe('getCurrentBlindInfo', () => {
    it('should return null when room does not exist', async () => {
      mockRoomService.findOne.mockResolvedValue(null);

      const result = await service.getCurrentBlindInfo('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when room is not a tournament', async () => {
      mockRoomService.findOne.mockResolvedValue({
        id: 'room-1',
        isTournament: false,
        tournamentConfig: null,
      });

      const result = await service.getCurrentBlindInfo('room-1');

      expect(result).toBeNull();
    });

    it('should return current blind level info', async () => {
      mockRoomService.findOne.mockResolvedValue({
        id: 'room-1',
        isTournament: true,
        tournamentConfig: {
          type: 'SNG',
          buyin: 1000,
          maxPlayers: 8,
          prizeDistribution: [60, 30, 10] as [number, number, number],
          blindSchedule: [
            { level: 1, smallBlind: 10, bigBlind: 20, durationSeconds: 180 },
            { level: 2, smallBlind: 20, bigBlind: 40, durationSeconds: 180 },
          ],
          currentBlindLevel: 1,
          blindLevelStartedAt: Date.now(),
          totalPrize: 8000,
        },
      });

      const result = await service.getCurrentBlindInfo('room-1');

      expect(result).toEqual({
        level: 2,
        smallBlind: 20,
        bigBlind: 40,
        durationSeconds: 180,
      });
    });
  });

  // ─── onModuleDestroy ────────────────────────────────────────────────────────

  describe('onModuleDestroy', () => {
    it('should clear all timers on module destroy', () => {
      const timer1 = setTimeout(() => {}, 1000);
      const timer2 = setTimeout(() => {}, 2000);

      (service as any).blindTimers.set('room-1', timer1 as any);
      (service as any).blindTimers.set('room-2', timer2 as any);

      const clearSpy = jest.spyOn(global, 'clearTimeout');

      service.onModuleDestroy();

      expect(clearSpy).toHaveBeenCalledTimes(2);
      expect((service as any).blindTimers.size).toBe(0);

      clearSpy.mockRestore();
      clearTimeout(timer1 as any);
      clearTimeout(timer2 as any);
    });
  });

  // ─── Blast Lobby Methods ─────────────────────────────────────────────────────

  describe('createBlastLobby', () => {
    it('should create a blast lobby with correct structure', async () => {
      const result = await service.createBlastLobby(1000, 'player-1');

      expect(result).toMatchObject({
        buyin: 1000,
        playerIds: ['player-1'],
        maxPlayers: 3,
        status: 'waiting',
        creatorId: 'player-1',
        smallBlind: 10,
        bigBlind: 20,
      });
      expect(result.id).toBeDefined();
    });

    it('should apply correct small blind for 500 buyin', async () => {
      const result = await service.createBlastLobby(500, 'player-1');
      expect(result.smallBlind).toBe(5);
      expect(result.bigBlind).toBe(10);
    });

    it('should apply correct small blind for 10000 buyin', async () => {
      const result = await service.createBlastLobby(10000, 'player-1');
      expect(result.smallBlind).toBe(100);
      expect(result.bigBlind).toBe(200);
    });

    it('should fallback to 1/100 ratio for unknown buyin', async () => {
      const result = await service.createBlastLobby(750, 'player-1');
      expect(result.smallBlind).toBe(7);
    });
  });

  describe('getBlastLobbies', () => {
    it('should return empty array when Redis unavailable', async () => {
      mockRedisService.isAvailable = false;

      const result = await service.getBlastLobbies();

      expect(result).toEqual([]);
      mockRedisService.isAvailable = true;
    });

    it('should return waiting lobbies from Redis', async () => {
      const lobbyData = JSON.stringify({
        id: 'lobby-1',
        buyin: 1000,
        playerIds: ['player-1'],
        maxPlayers: 3,
        status: 'waiting',
        createdAt: Date.now(),
        creatorId: 'player-1',
        smallBlind: 10,
        bigBlind: 20,
      });

      mockRedisService.lrange.mockResolvedValue(['lobby-1']);
      mockRedisService.hgetall.mockResolvedValue({ data: lobbyData });

      const result = await service.getBlastLobbies();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('lobby-1');
      expect(result[0].status).toBe('waiting');
    });

    it('should skip non-waiting lobbies', async () => {
      const lobbyData = JSON.stringify({
        id: 'lobby-1',
        status: 'active',
        playerIds: [],
        maxPlayers: 3,
        buyin: 1000,
        createdAt: Date.now(),
        creatorId: 'player-1',
        smallBlind: 10,
        bigBlind: 20,
      });

      mockRedisService.lrange.mockResolvedValue(['lobby-1']);
      mockRedisService.hgetall.mockResolvedValue({ data: lobbyData });

      const result = await service.getBlastLobbies();

      expect(result).toHaveLength(0);
    });
  });

  describe('getBlastLobby', () => {
    it('should return null when Redis unavailable', async () => {
      mockRedisService.isAvailable = false;

      const result = await service.getBlastLobby('lobby-1');

      expect(result).toBeNull();
      mockRedisService.isAvailable = true;
    });

    it('should return null when lobby not found', async () => {
      mockRedisService.hgetall.mockResolvedValue({});

      const result = await service.getBlastLobby('nonexistent');

      expect(result).toBeNull();
    });

    it('should return parsed lobby data', async () => {
      const lobbyData = JSON.stringify({
        id: 'lobby-1',
        buyin: 1000,
        playerIds: ['player-1'],
        maxPlayers: 3,
        status: 'waiting',
        createdAt: Date.now(),
        creatorId: 'player-1',
        smallBlind: 10,
        bigBlind: 20,
      });
      mockRedisService.hgetall.mockResolvedValue({ data: lobbyData });

      const result = await service.getBlastLobby('lobby-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('lobby-1');
    });
  });

  describe('joinBlastLobby', () => {
    it('should return null when Redis unavailable', async () => {
      mockRedisService.isAvailable = false;

      const result = await service.joinBlastLobby('lobby-1', 'player-2');

      expect(result).toBeNull();
      mockRedisService.isAvailable = true;
    });

    it('should return null when lobby not found', async () => {
      mockRedisService.hgetall.mockResolvedValue({});

      const result = await service.joinBlastLobby('nonexistent', 'player-2');

      expect(result).toBeNull();
    });

    it('should add player and return updated lobby', async () => {
      const lobbyData = JSON.stringify({
        id: 'lobby-1',
        buyin: 1000,
        playerIds: ['player-1'],
        maxPlayers: 3,
        status: 'waiting',
        createdAt: Date.now(),
        creatorId: 'player-1',
        smallBlind: 10,
        bigBlind: 20,
      });
      mockRedisService.hgetall.mockResolvedValue({ data: lobbyData });

      const result = await service.joinBlastLobby('lobby-1', 'player-2');

      expect(result).not.toBeNull();
      expect(result!.playerIds).toContain('player-2');
      expect(mockRedisService.hset).toHaveBeenCalled();
    });

    it('should transition to starting when 3rd player joins', async () => {
      const lobbyData = JSON.stringify({
        id: 'lobby-1',
        buyin: 1000,
        playerIds: ['player-1', 'player-2'],
        maxPlayers: 3,
        status: 'waiting',
        createdAt: Date.now(),
        creatorId: 'player-1',
        smallBlind: 10,
        bigBlind: 20,
      });
      mockRedisService.hgetall.mockResolvedValue({ data: lobbyData });

      const result = await service.joinBlastLobby('lobby-1', 'player-3');

      expect(result!.status).toBe('starting');
    });

    it('should reject join when player already in lobby', async () => {
      const lobbyData = JSON.stringify({
        id: 'lobby-1',
        buyin: 1000,
        playerIds: ['player-1'],
        maxPlayers: 3,
        status: 'waiting',
        createdAt: Date.now(),
        creatorId: 'player-1',
        smallBlind: 10,
        bigBlind: 20,
      });
      mockRedisService.hgetall.mockResolvedValue({ data: lobbyData });

      const result = await service.joinBlastLobby('lobby-1', 'player-1');

      expect(result).toBeNull();
    });

    it('should reject join when lobby is full', async () => {
      const lobbyData = JSON.stringify({
        id: 'lobby-1',
        buyin: 1000,
        playerIds: ['player-1', 'player-2', 'player-3'],
        maxPlayers: 3,
        status: 'waiting',
        createdAt: Date.now(),
        creatorId: 'player-1',
        smallBlind: 10,
        bigBlind: 20,
      });
      mockRedisService.hgetall.mockResolvedValue({ data: lobbyData });

      const result = await service.joinBlastLobby('lobby-1', 'player-4');

      expect(result).toBeNull();
    });
  });
});
