import { Test, TestingModule } from '@nestjs/testing';
import { MatchmakingService, BLIND_TIERS } from './matchmaking.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MatchmakingService', () => {
  let service: MatchmakingService;

  const mockPrisma = {
    room: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(),
    handAction: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    // Re-apply global defaults that jest.clearAllMocks resets
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.handAction.findMany.mockResolvedValue([]);
    mockPrisma.handAction.groupBy.mockResolvedValue([]);
    // $transaction: await array of promises or pass through to callback
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      if (Array.isArray(fn)) return Promise.all(fn);
      return fn(mockPrisma);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MatchmakingService>(MatchmakingService);
  });

  // ─── hashIp ─────────────────────────────────────────────────────────────────

  describe('hashIp', () => {
    it('should return a sha256 hash of the input IP', () => {
      const hash = service.hashIp('192.168.1.1');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should return consistent hashes for the same IP', () => {
      const hash1 = service.hashIp('10.0.0.1');
      const hash2 = service.hashIp('10.0.0.1');
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different IPs', () => {
      const hash1 = service.hashIp('10.0.0.1');
      const hash2 = service.hashIp('10.0.0.2');
      expect(hash1).not.toBe(hash2);
    });
  });

  // ─── getPlayerElo ────────────────────────────────────────────────────────────

  describe('getPlayerElo', () => {
    it('should return the user elo when user exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', elo: 1500 });

      const elo = await service.getPlayerElo('user-1');

      expect(elo).toBe(1500);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { elo: true },
      });
    });

    it('should return default 1000 when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const elo = await service.getPlayerElo('nonexistent');

      expect(elo).toBe(1000);
    });
  });

  // ─── recordPlayerJoined ─────────────────────────────────────────────────────

  describe('recordPlayerJoined', () => {
    it('should record player elo and ip in internal maps', () => {
      service.recordPlayerJoined('room-1', 'user-1', 1200, 'hash-ip-1');

      const eloMap = (service as any).roomElos.get('room-1');
      const ipSet = (service as any).roomIps.get('room-1');

      expect(eloMap.get('user-1')).toBe(1200);
      expect(ipSet.has('hash-ip-1')).toBe(true);
    });

    it('should add multiple players to the same room', () => {
      service.recordPlayerJoined('room-1', 'user-1', 1100, 'hash-1');
      service.recordPlayerJoined('room-1', 'user-2', 1300, 'hash-2');

      const eloMap = (service as any).roomElos.get('room-1');
      expect(eloMap.size).toBe(2);
      expect(eloMap.get('user-1')).toBe(1100);
      expect(eloMap.get('user-2')).toBe(1300);
    });

    it('should create separate maps for different rooms', () => {
      service.recordPlayerJoined('room-1', 'user-1', 1200, 'hash-1');
      service.recordPlayerJoined('room-2', 'user-2', 1400, 'hash-2');

      const room1Elos = (service as any).roomElos.get('room-1');
      const room2Elos = (service as any).roomElos.get('room-2');

      expect(room1Elos.size).toBe(1);
      expect(room2Elos.size).toBe(1);
    });
  });

  // ─── recordPlayerLeft ────────────────────────────────────────────────────────

  describe('recordPlayerLeft', () => {
    it('should remove player from room elo map', () => {
      service.recordPlayerJoined('room-1', 'user-1', 1200, 'hash-1');
      service.recordPlayerJoined('room-1', 'user-2', 1300, 'hash-2');

      service.recordPlayerLeft('room-1', 'user-1');

      const eloMap = (service as any).roomElos.get('room-1');
      expect(eloMap.has('user-1')).toBe(false);
      expect(eloMap.has('user-2')).toBe(true);
    });

    it('should clean up room maps when last player leaves', () => {
      service.recordPlayerJoined('room-1', 'user-1', 1200, 'hash-1');

      service.recordPlayerLeft('room-1', 'user-1');

      expect((service as any).roomElos.has('room-1')).toBe(false);
      expect((service as any).roomIps.has('room-1')).toBe(false);
    });

    it('should not throw when removing a non-existent player', () => {
      expect(() => service.recordPlayerLeft('room-1', 'ghost-user')).not.toThrow();
    });
  });

  // ─── findOrCreateMatchmakingRoom ─────────────────────────────────────────────

  describe('findOrCreateMatchmakingRoom', () => {
    const baseParams = {
      userId: 'user-1',
      tier: 'MEDIUM' as const,
      playerElo: 1200,
      ipHash: 'hash-ip-1',
    };

    it('should return existing room id when a suitable room is found', async () => {
      const existingRoom = {
        id: 'room-existing',
        tier: 'MEDIUM',
        isMatchmaking: true,
        status: 'ACTIVE',
        tables: [{ id: 'table-1' }],
      };

      mockPrisma.room.findMany.mockResolvedValue([existingRoom]);

      // Pre-populate roomElos so isRoomSuitable passes ELO check
      (service as any).roomElos.set('room-existing', new Map([['other-user', 1200]]));

      const result = await service.findOrCreateMatchmakingRoom(
        baseParams.userId,
        baseParams.tier,
        baseParams.playerElo,
        baseParams.ipHash,
      );

      expect(result).toBe('room-existing');
      expect(mockPrisma.room.create).not.toHaveBeenCalled();
    });

    it('should create a new room when no suitable room exists', async () => {
      const newRoom = { id: 'room-new', name: '[Match] MEDIUM #1234' };
      mockPrisma.room.findMany.mockResolvedValue([]);
      mockPrisma.room.create.mockResolvedValue(newRoom);

      const result = await service.findOrCreateMatchmakingRoom(
        baseParams.userId,
        baseParams.tier,
        baseParams.playerElo,
        baseParams.ipHash,
      );

      expect(result).toBe('room-new');
      expect(mockPrisma.room.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isMatchmaking: true,
          tier: 'MEDIUM',
          blindSmall: BLIND_TIERS.MEDIUM.blindSmall,
          blindBig: BLIND_TIERS.MEDIUM.blindBig,
          maxPlayers: BLIND_TIERS.MEDIUM.maxPlayers,
          minBuyIn: BLIND_TIERS.MEDIUM.minBuyIn,
        }),
      });
    });

    it('should skip rooms that are full', async () => {
      const fullRoom = {
        id: 'room-full',
        tier: 'MEDIUM',
        isMatchmaking: true,
        status: 'ACTIVE',
        tables: [],
      };

      mockPrisma.room.findMany.mockResolvedValue([fullRoom]);
      // Pre-populate with maxPlayers players (MEDIUM = 9)
      const eloMap = new Map();
      for (let i = 0; i < 9; i++) eloMap.set(`user-${i}`, 1200);
      (service as any).roomElos.set('room-full', eloMap);

      mockPrisma.room.create.mockResolvedValue({ id: 'room-new' });

      const result = await service.findOrCreateMatchmakingRoom(
        baseParams.userId,
        baseParams.tier,
        baseParams.playerElo,
        baseParams.ipHash,
      );

      expect(result).toBe('room-new');
    });

    it('should order candidate rooms by createdAt ascending', async () => {
      mockPrisma.room.findMany.mockResolvedValue([]);
      mockPrisma.room.create.mockResolvedValue({ id: 'room-new' });

      await service.findOrCreateMatchmakingRoom(
        baseParams.userId,
        baseParams.tier,
        baseParams.playerElo,
        baseParams.ipHash,
      );

      expect(mockPrisma.room.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
      );
    });

    it('should filter candidate rooms by tier, isMatchmaking, and status', async () => {
      mockPrisma.room.findMany.mockResolvedValue([]);
      mockPrisma.room.create.mockResolvedValue({ id: 'room-new' });

      await service.findOrCreateMatchmakingRoom(
        baseParams.userId,
        'HIGH',
        baseParams.playerElo,
        baseParams.ipHash,
      );

      expect(mockPrisma.room.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tier: 'HIGH',
            isMatchmaking: true,
            status: 'ACTIVE',
          }),
        }),
      );
    });
  });

  // ─── isRoomSuitable (private) ────────────────────────────────────────────────

  describe('isRoomSuitable', () => {
    // Using findOrCreateMatchmakingRoom as the test surface since isRoomSuitable is private

    it('should reject a room when ELO difference exceeds ELO_MATCH_RANGE (200)', async () => {
      // Existing player in room has elo 1000, new player has elo 1500
      // Difference = 500 > 200, should not match
      const existingRoom = {
        id: 'room-1',
        tier: 'MEDIUM',
        isMatchmaking: true,
        status: 'ACTIVE',
        tables: [{ id: 'table-1' }],
      };

      mockPrisma.room.findMany.mockResolvedValue([existingRoom]);
      (service as any).roomElos.set('room-1', new Map([['existing-user', 1000]]));
      (service as any).roomIps.set('room-1', new Set(['existing-ip-hash']));
      mockPrisma.room.create.mockResolvedValue({ id: 'room-new' });

      const result = await service.findOrCreateMatchmakingRoom(
        'new-user',
        'MEDIUM',
        1500,
        'new-ip-hash',
      );

      // Should not join existing room (diff too large), creates new instead
      expect(result).toBe('room-new');
    });

    it('should accept a room when ELO difference is within ELO_MATCH_RANGE', async () => {
      const existingRoom = {
        id: 'room-elo-match',
        tier: 'MEDIUM',
        isMatchmaking: true,
        status: 'ACTIVE',
        tables: [{ id: 'table-1' }],
      };

      mockPrisma.room.findMany.mockResolvedValue([existingRoom]);
      // Existing player: 1200, new player: 1250 — diff = 50 < 200
      (service as any).roomElos.set('room-elo-match', new Map([['existing-user', 1200]]));
      (service as any).roomIps.set('room-elo-match', new Set(['existing-ip-hash']));

      const result = await service.findOrCreateMatchmakingRoom(
        'new-user',
        'MEDIUM',
        1250,
        'new-ip-hash',
      );

      expect(result).toBe('room-elo-match');
      expect(mockPrisma.room.create).not.toHaveBeenCalled();
    });
  });

  // ─── updateElo ──────────────────────────────────────────────────────────────

  describe('updateElo', () => {
    it('should do nothing when handResult has fewer than 2 participants', async () => {
      await service.updateElo([{ playerId: 'user-1', nickname: 'p1', winAmount: 100, totalBet: 50 }]);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should do nothing when handResult is empty', async () => {
      await service.updateElo([]);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should skip participants with zero totalBet and zero winAmount', async () => {
      const entries = [
        { playerId: 'user-1', nickname: 'p1', winAmount: 0, totalBet: 0 },
        { playerId: 'user-2', nickname: 'p2', winAmount: 0, totalBet: 0 },
      ];

      await service.updateElo(entries);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should calculate correct ELO deltas for winner and loser', async () => {
      const entries = [
        { playerId: 'user-1', nickname: 'winner', winAmount: 1000, totalBet: 200 },
        { playerId: 'user-2', nickname: 'loser', winAmount: 0, totalBet: 100 },
      ];

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        if (Array.isArray(fn)) return Promise.all(fn);
        return fn(mockPrisma);
      });

      await service.updateElo(entries);

      // K=16, expected score = 0.5, actual = 1.0 (winner takes all)
      // delta = 16 * (1.0 - 0.5) = 8
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
      const firstTx = mockPrisma.$transaction.mock.calls[0][0];
      expect(firstTx).toHaveLength(2);
    });

    it('should enforce ELO floor (ELO_MIN = 100) and ceiling (ELO_MAX = 3000)', async () => {
      const entries = [
        { playerId: 'user-1', nickname: 'p1', winAmount: 500, totalBet: 100 },
        { playerId: 'user-2', nickname: 'p2', winAmount: 500, totalBet: 100 },
      ];

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        if (Array.isArray(fn)) return Promise.all(fn);
        return fn(mockPrisma);
      });

      await service.updateElo(entries);

      // Second transaction call should be for floor/ceiling enforcement
      // Check updateMany was called twice: once for floor (lt 100) and once for ceiling (gt 3000)
      const floorCall = mockPrisma.user.updateMany.mock.calls.find(
        (c: any[]) => c[0]?.where?.elo?.lt === 100,
      );
      const ceilingCall = mockPrisma.user.updateMany.mock.calls.find(
        (c: any[]) => c[0]?.where?.elo?.gt === 3000,
      );
      expect(floorCall).toBeDefined();
      expect(floorCall[0].data).toEqual({ elo: 100 });
      expect(ceilingCall).toBeDefined();
      expect(ceilingCall[0].data).toEqual({ elo: 3000 });
    });

    it('should log error and not rethrow when transaction fails', async () => {
      const entries = [
        { playerId: 'user-1', nickname: 'p1', winAmount: 500, totalBet: 100 },
        { playerId: 'user-2', nickname: 'p2', winAmount: 500, totalBet: 100 },
      ];

      const logSpy = jest.spyOn((service as any).logger, 'error');
      mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));

      await service.updateElo(entries);

      expect(logSpy).toHaveBeenCalledWith('Failed to update ELO', expect.any(Error));
    });
  });

  // ─── checkCollusion ─────────────────────────────────────────────────────────

  describe('checkCollusion', () => {
    it('should return false when otherUserIds is empty', async () => {
      const result = await service.checkCollusion('user-1', []);
      expect(result).toBe(false);
    });

    it('should return false when user has no hands in last 24h', async () => {
      mockPrisma.handAction.findMany.mockResolvedValue([]);

      const result = await service.checkCollusion('user-1', ['user-2']);

      expect(result).toBe(false);
    });

    it('should return false when shared hands are below threshold (20)', async () => {
      mockPrisma.handAction.findMany.mockResolvedValue([
        { handId: 'hand-1' },
        { handId: 'hand-2' },
        { handId: 'hand-3' },
      ]);
      mockPrisma.handAction.groupBy.mockResolvedValue([
        { userId: 'user-2', _count: { handId: 5 } },
      ]);

      const result = await service.checkCollusion('user-1', ['user-2']);

      expect(result).toBe(false);
    });

    it('should return true when shared hands exceed threshold (20)', async () => {
      mockPrisma.handAction.findMany.mockResolvedValue([
        { handId: 'hand-1' },
        { handId: 'hand-2' },
      ]);
      mockPrisma.handAction.groupBy.mockResolvedValue([
        { userId: 'user-2', _count: { handId: 25 } },
      ]);

      const result = await service.checkCollusion('user-1', ['user-2']);

      expect(result).toBe(true);
    });

    it('should only check users present in groupBy results', async () => {
      mockPrisma.handAction.findMany.mockResolvedValue([
        { handId: 'hand-1' },
        { handId: 'hand-2' },
      ]);
      // user-3 has high count, user-4 is below threshold
      mockPrisma.handAction.groupBy.mockResolvedValue([
        { userId: 'user-3', _count: { handId: 21 } },
        { userId: 'user-4', _count: { handId: 5 } },
      ]);

      const result = await service.checkCollusion('user-1', ['user-2', 'user-3', 'user-4']);

      expect(result).toBe(true);
    });
  });

  // ─── onModuleInit ───────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('should mark stale matchmaking rooms as INACTIVE', async () => {
      mockPrisma.room.updateMany.mockResolvedValue({ count: 3 });

      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.onModuleInit();

      expect(mockPrisma.room.updateMany).toHaveBeenCalledWith({
        where: { isMatchmaking: true, status: 'ACTIVE' },
        data: { status: 'INACTIVE' },
      });
      expect(logSpy).toHaveBeenCalledWith(
        'Closed 3 stale matchmaking room(s) from previous session',
      );
    });

    it('should not log when no stale rooms exist', async () => {
      mockPrisma.room.updateMany.mockResolvedValue({ count: 0 });

      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.onModuleInit();

      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  // ─── BLIND_TIERS ─────────────────────────────────────────────────────────────

  describe('BLIND_TIERS', () => {
    it('should have all expected tiers defined', () => {
      expect(BLIND_TIERS).toHaveProperty('MICRO');
      expect(BLIND_TIERS).toHaveProperty('LOW');
      expect(BLIND_TIERS).toHaveProperty('MEDIUM');
      expect(BLIND_TIERS).toHaveProperty('HIGH');
      expect(BLIND_TIERS).toHaveProperty('PREMIUM');
    });

    it('should have correct structure for each tier', () => {
      for (const tier of Object.keys(BLIND_TIERS)) {
        const config = BLIND_TIERS[tier as keyof typeof BLIND_TIERS];
        expect(config).toHaveProperty('blindSmall');
        expect(config).toHaveProperty('blindBig');
        expect(config).toHaveProperty('minBuyIn');
        expect(config).toHaveProperty('maxPlayers');
        expect(config).toHaveProperty('label');
        expect(config.blindSmall).toBeLessThan(config.blindBig);
        expect(config.maxPlayers).toBeGreaterThan(0);
      }
    });

    it('should have correct buyin range ordering (MICRO cheapest, PREMIUM most expensive)', () => {
      const tiers = ['MICRO', 'LOW', 'MEDIUM', 'HIGH', 'PREMIUM'] as const;
      for (let i = 1; i < tiers.length; i++) {
        const prev = BLIND_TIERS[tiers[i - 1]].minBuyIn;
        const curr = BLIND_TIERS[tiers[i]].minBuyIn;
        expect(curr).toBeGreaterThan(prev);
      }
    });
  });
});
