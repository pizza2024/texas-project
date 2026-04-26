import { Test, TestingModule } from '@nestjs/testing';
import {
  MissionService,
  MISSION_DEFINITIONS,
  MISSION_KEY_FIRST_DEPOSIT,
  MISSION_KEY_DAILY_PLAY,
  MISSION_KEY_DAILY_WIN,
  MISSION_KEY_DAILY_DEPOSIT,
  MISSION_KEY_DAILY_Rake,
  MISSION_KEY_DAILY_HOUR,
  MISSION_KEY_DAILY_BIG_POT,
  MISSION_KEY_WEEKLY_WINS,
  MISSION_KEY_WEEKLY_PROFIT,
} from './mission.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

// Helper to build a mock mission
function mockMission(
  overrides: Partial<{
    id: string;
    key: string;
    title: string;
    description: string;
    type: string;
    periodType: string | null;
    rewardChips: number;
    target: number;
  }> = {},
) {
  return {
    id: 'mission-id-1',
    key: MISSION_KEY_DAILY_PLAY,
    title: 'Daily Grind',
    description: 'Play 3 hands in any room',
    type: 'DAILY',
    periodType: 'DAY',
    rewardChips: 300,
    target: 3,
    ...overrides,
  };
}

// Helper to build a mock userMission
function mockUserMission(
  overrides: Partial<{
    id: string;
    userId: string;
    missionId: string;
    status: string;
    progress: number;
    completedAt: Date | null;
    claimedAt: Date | null;
    periodStart: Date;
  }> = {},
) {
  return {
    id: 'um-id-1',
    userId: 'user-1',
    missionId: 'mission-id-1',
    status: 'ACTIVE',
    progress: 0,
    completedAt: null,
    claimedAt: null,
    periodStart: new Date(),
    ...overrides,
  };
}

describe('MissionService', () => {
  let service: MissionService;
  let mockPrismaService: ReturnType<typeof createMockPrismaService>;
  let mockWalletService: jest.Mocked<WalletService>;

  function createMockPrismaService() {
    return {
      mission: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      userMission: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
    };
  }

  beforeEach(async () => {
    mockPrismaService = createMockPrismaService();
    mockWalletService = {
      addChips: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WalletService, useValue: mockWalletService },
      ],
    }).compile();

    service = module.get<MissionService>(MissionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── seedMissions ───────────────────────────────────────────────────────────

  describe('seedMissions', () => {
    it('should upsert all mission definitions', async () => {
      mockPrismaService.mission.upsert.mockResolvedValue({} as any);

      await service.seedMissions();

      expect(mockPrismaService.mission.upsert).toHaveBeenCalledTimes(
        MISSION_DEFINITIONS.length,
      );
    });

    it('should upsert each definition with correct create data', async () => {
      mockPrismaService.mission.upsert.mockResolvedValue({} as any);

      await service.seedMissions();

      // Verify one of the upsert calls has correct structure
      const firstCall = mockPrismaService.mission.upsert.mock.calls[0];
      expect(firstCall[0].where).toEqual({ key: MISSION_KEY_FIRST_DEPOSIT });
      expect(firstCall[0].create).toMatchObject({
        key: MISSION_KEY_FIRST_DEPOSIT,
        type: 'ONE_TIME',
        rewardChips: 10000,
        target: 1,
      });
    });
  });

  // ── resetDailyMissions ──────────────────────────────────────────────────────

  describe('resetDailyMissions', () => {
    it('should updateMany daily missions with status ACTIVE or COMPLETED to EXPIRED', async () => {
      mockPrismaService.userMission.updateMany.mockResolvedValue({
        count: 5,
      } as any);

      const result = await service.resetDailyMissions();

      expect(mockPrismaService.userMission.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['ACTIVE', 'COMPLETED'] },
            mission: { type: 'DAILY', periodType: 'DAY' },
          }),
          data: { status: 'EXPIRED' },
        }),
      );
      expect(result).toBe(5);
    });
  });

  // ── resetWeeklyMissions ─────────────────────────────────────────────────────

  describe('resetWeeklyMissions', () => {
    it('should updateMany weekly missions with status ACTIVE or COMPLETED to EXPIRED', async () => {
      mockPrismaService.userMission.updateMany.mockResolvedValue({
        count: 2,
      } as any);

      const result = await service.resetWeeklyMissions();

      expect(mockPrismaService.userMission.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['ACTIVE', 'COMPLETED'] },
            mission: { type: 'WEEKLY', periodType: 'WEEK' },
          }),
          data: { status: 'EXPIRED' },
        }),
      );
      expect(result).toBe(2);
    });
  });

  // ── progressMission ─────────────────────────────────────────────────────────

  describe('progressMission', () => {
    const userId = 'user-1';
    const missionKey = MISSION_KEY_DAILY_WIN;

    beforeEach(() => {
      mockPrismaService.mission.findUnique.mockResolvedValue(
        mockMission({
          id: 'mid-1',
          key: missionKey,
          type: 'DAILY',
          periodType: 'DAY',
          target: 1,
          rewardChips: 200,
        }),
      );
    });

    it('should return { completed: false, rewardChips: 0 } when mission not found', async () => {
      mockPrismaService.mission.findUnique.mockResolvedValue(null);

      const result = await service.progressMission(userId, 'UNKNOWN_KEY');

      expect(result).toEqual({ completed: false, rewardChips: 0 });
    });

    it('should create a new UserMission if none exists for the current period', async () => {
      mockPrismaService.userMission.findUnique.mockResolvedValue(null);
      mockPrismaService.userMission.create.mockResolvedValue(
        mockUserMission({
          id: 'new-um',
          missionId: 'mid-1',
          status: 'ACTIVE',
          progress: 0,
        }),
      );
      mockPrismaService.userMission.update.mockResolvedValue({} as any);
      mockWalletService.addChips.mockResolvedValue(undefined);
      mockPrismaService.transaction.create.mockResolvedValue({} as any);

      await service.progressMission(userId, missionKey);

      expect(mockPrismaService.userMission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          missionId: 'mid-1',
          status: 'ACTIVE',
          progress: 0,
          periodStart: expect.any(Date),
        }),
      });
    });

    it('should skip already completed or claimed missions', async () => {
      mockPrismaService.userMission.findUnique.mockResolvedValue(
        mockUserMission({ status: 'CLAIMED', progress: 1 }),
      );

      const result = await service.progressMission(userId, missionKey);

      expect(result).toEqual({ completed: false, rewardChips: 0 });
      expect(mockPrismaService.userMission.update).not.toHaveBeenCalled();
    });

    it('should increment progress and auto-complete when target is reached', async () => {
      const existingUm = mockUserMission({
        id: 'um-1',
        missionId: 'mid-1',
        status: 'ACTIVE',
        progress: 0,
      });
      mockPrismaService.userMission.findUnique.mockResolvedValue(existingUm);
      mockPrismaService.userMission.update.mockResolvedValue({} as any);
      mockWalletService.addChips.mockResolvedValue(undefined);
      mockPrismaService.transaction.create.mockResolvedValue({} as any);

      // target is 1, increment is 1 → should complete
      const result = await service.progressMission(userId, missionKey, 1);

      expect(mockPrismaService.userMission.update).toHaveBeenCalledWith({
        where: { id: 'um-1' },
        data: {
          progress: 1,
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        },
      });
      expect(result.completed).toBe(true);
      expect(result.rewardChips).toBe(200);
    });

    it('should not exceed target when incrementing progress', async () => {
      const existingUm = mockUserMission({
        id: 'um-1',
        missionId: 'mid-1',
        status: 'ACTIVE',
        progress: 1,
      });
      mockPrismaService.userMission.findUnique.mockResolvedValue(existingUm);
      mockPrismaService.userMission.update.mockResolvedValue({} as any);

      // target is 1, existing progress is 1, increment is 5 → capped at 1
      await service.progressMission(userId, missionKey, 5);

      expect(mockPrismaService.userMission.update).toHaveBeenCalledWith({
        where: { id: 'um-1' },
        data: expect.objectContaining({ progress: 1 }),
      });
    });

    it('should NOT claim (auto-complete) for COMPLETED status missions', async () => {
      const existingUm = mockUserMission({
        id: 'um-1',
        missionId: 'mid-1',
        status: 'ACTIVE',
        progress: 0,
      });
      mockPrismaService.userMission.findUnique.mockResolvedValue(existingUm);
      mockPrismaService.userMission.update.mockResolvedValue({} as any);
      // Mission with target: 1 (easy to reach)
      mockPrismaService.mission.findUnique.mockResolvedValue(
        mockMission({
          id: 'mid-1',
          key: missionKey,
          type: 'DAILY',
          periodType: 'DAY',
          target: 1,
          rewardChips: 200,
        }),
      );
      mockWalletService.addChips.mockResolvedValue(undefined);
      mockPrismaService.transaction.create.mockResolvedValue({} as any);

      await service.progressMission(userId, missionKey, 1);

      // Auto-complete calls claimMission → walletService.addChips + transaction.create + update to CLAIMED
      expect(mockWalletService.addChips).toHaveBeenCalledWith(userId, 200);
      expect(mockPrismaService.transaction.create).toHaveBeenCalledWith({
        data: { userId, amount: 200, type: 'MISSION_REWARD' },
      });
    });

    it('should leave progress unchanged for non-ACTIVE missions', async () => {
      mockPrismaService.userMission.findUnique.mockResolvedValue(
        mockUserMission({ status: 'EXPIRED', progress: 5 }),
      );

      const result = await service.progressMission(userId, missionKey, 1);

      expect(result).toEqual({ completed: false, rewardChips: 0 });
      expect(mockPrismaService.userMission.update).not.toHaveBeenCalled();
    });
  });

  // ── getUserMissions ─────────────────────────────────────────────────────────

  describe('getUserMissions', () => {
    const userId = 'user-1';

    beforeEach(() => {
      mockPrismaService.mission.findMany.mockResolvedValue([
        mockMission({
          id: 'mid-daily',
          key: MISSION_KEY_DAILY_PLAY,
          type: 'DAILY',
          periodType: 'DAY',
          target: 3,
          rewardChips: 300,
        }),
        mockMission({
          id: 'mid-weekly',
          key: MISSION_KEY_WEEKLY_WINS,
          type: 'WEEKLY',
          periodType: 'WEEK',
          target: 20,
          rewardChips: 3000,
        }),
        mockMission({
          id: 'mid-onetime',
          key: MISSION_KEY_FIRST_DEPOSIT,
          type: 'ONE_TIME',
          periodType: null,
          target: 1,
          rewardChips: 10000,
        }),
      ]);
    });

    it('should return all mission definitions with progress merged from userMissions', async () => {
      const dailyStart = new Date();
      dailyStart.setUTCHours(0, 0, 0, 0);

      mockPrismaService.userMission.findMany.mockResolvedValue([
        mockUserMission({
          id: 'um-1',
          missionId: 'mid-daily',
          status: 'ACTIVE',
          progress: 2,
          periodStart: dailyStart,
        }),
      ]);

      const result = await service.getUserMissions(userId);

      expect(result).toHaveLength(3);

      const dailyMission = result.find(
        (m) => m.key === MISSION_KEY_DAILY_PLAY,
      )!;
      expect(dailyMission.progress).toBe(2);
      expect(dailyMission.status).toBe('ACTIVE');

      const weeklyMission = result.find(
        (m) => m.key === MISSION_KEY_WEEKLY_WINS,
      )!;
      expect(weeklyMission.progress).toBe(0); // default when no userMission
      expect(weeklyMission.status).toBe('ACTIVE');

      const onetimeMission = result.find(
        (m) => m.key === MISSION_KEY_FIRST_DEPOSIT,
      )!;
      expect(onetimeMission.progress).toBe(0);
      expect(onetimeMission.status).toBe('ACTIVE');
    });

    it('should map userMission fields correctly (completedAt, claimedAt)', async () => {
      const dailyStart = new Date();
      dailyStart.setUTCHours(0, 0, 0, 0);
      const completedAt = new Date();
      const claimedAt = new Date();

      mockPrismaService.userMission.findMany.mockResolvedValue([
        mockUserMission({
          id: 'um-1',
          missionId: 'mid-daily',
          status: 'COMPLETED',
          progress: 3,
          completedAt,
          claimedAt: null,
          periodStart: dailyStart,
        }),
      ]);

      const result = await service.getUserMissions(userId);

      const dailyMission = result.find(
        (m) => m.key === MISSION_KEY_DAILY_PLAY,
      )!;
      expect(dailyMission.status).toBe('COMPLETED');
      expect(dailyMission.completedAt).toBe(completedAt);
      expect(dailyMission.claimedAt).toBeNull();
    });
  });

  // ── getActiveMissions ───────────────────────────────────────────────────────

  describe('getActiveMissions', () => {
    const userId = 'user-1';

    it('should return ACTIVE/COMPLETED non-ONE_TIME missions for current period', async () => {
      const dailyStart = new Date();
      dailyStart.setUTCHours(0, 0, 0, 0);

      const mockUserMissions = [
        mockUserMission({
          id: 'um-1',
          missionId: 'mid-1',
          status: 'ACTIVE',
          progress: 2,
          periodStart: dailyStart,
        }),
      ];
      mockPrismaService.userMission.findMany.mockResolvedValue(
        mockUserMissions as any,
      );

      const result = await service.getActiveMissions(userId);

      expect(mockPrismaService.userMission.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          mission: { type: { not: 'ONE_TIME' } },
          periodStart: { gte: expect.any(Date) },
        },
        include: { mission: true },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ── hasReceivedFirstDepositReward ───────────────────────────────────────────

  describe('hasReceivedFirstDepositReward', () => {
    const userId = 'user-1';

    it('should return false when mission does not exist', async () => {
      mockPrismaService.mission.findUnique.mockResolvedValue(null);

      const result = await service.hasReceivedFirstDepositReward(userId);

      expect(result).toBe(false);
    });

    it('should return true when user has CLAIMED the first deposit mission', async () => {
      mockPrismaService.mission.findUnique.mockResolvedValue(
        mockMission({
          id: 'mid-first-deposit',
          key: MISSION_KEY_FIRST_DEPOSIT,
        }),
      );
      mockPrismaService.userMission.findUnique.mockResolvedValue(
        mockUserMission({ missionId: 'mid-first-deposit', status: 'CLAIMED' }),
      );

      const result = await service.hasReceivedFirstDepositReward(userId);

      expect(result).toBe(true);
    });

    it('should return false when user has not claimed the first deposit mission', async () => {
      mockPrismaService.mission.findUnique.mockResolvedValue(
        mockMission({
          id: 'mid-first-deposit',
          key: MISSION_KEY_FIRST_DEPOSIT,
        }),
      );
      mockPrismaService.userMission.findUnique.mockResolvedValue(
        mockUserMission({ missionId: 'mid-first-deposit', status: 'ACTIVE' }),
      );

      const result = await service.hasReceivedFirstDepositReward(userId);

      expect(result).toBe(false);
    });

    it('should return false when user has no userMission record', async () => {
      mockPrismaService.mission.findUnique.mockResolvedValue(
        mockMission({
          id: 'mid-first-deposit',
          key: MISSION_KEY_FIRST_DEPOSIT,
        }),
      );
      mockPrismaService.userMission.findUnique.mockResolvedValue(null);

      const result = await service.hasReceivedFirstDepositReward(userId);

      expect(result).toBe(false);
    });
  });

  // ── Game event helpers ───────────────────────────────────────────────────────

  describe('onHandWon', () => {
    it('should progress DAILY_PLAY, DAILY_WIN, WEEKLY_WINS missions', async () => {
      const progressMissionSpy = jest
        .spyOn(service, 'progressMission')
        .mockResolvedValue({ completed: false, rewardChips: 0 });

      await service.onHandWon('user-1', 500);

      expect(progressMissionSpy).toHaveBeenCalledWith(
        'user-1',
        MISSION_KEY_DAILY_PLAY,
      );
      expect(progressMissionSpy).toHaveBeenCalledWith(
        'user-1',
        MISSION_KEY_DAILY_WIN,
      );
      expect(progressMissionSpy).toHaveBeenCalledWith(
        'user-1',
        MISSION_KEY_WEEKLY_WINS,
      );
    });

    it('should also progress DAILY_BIG_POT when potSize >= 1000', async () => {
      const progressMissionSpy = jest
        .spyOn(service, 'progressMission')
        .mockResolvedValue({ completed: false, rewardChips: 0 });

      await service.onHandWon('user-1', 1500);

      expect(progressMissionSpy).toHaveBeenCalledWith(
        'user-1',
        MISSION_KEY_DAILY_BIG_POT,
      );
    });

    it('should NOT progress DAILY_BIG_POT when potSize < 1000', async () => {
      const progressMissionSpy = jest
        .spyOn(service, 'progressMission')
        .mockResolvedValue({ completed: false, rewardChips: 0 });

      await service.onHandWon('user-1', 500);

      expect(progressMissionSpy).not.toHaveBeenCalledWith(
        'user-1',
        MISSION_KEY_DAILY_BIG_POT,
      );
    });
  });

  describe('onHandPlayed', () => {
    it('should progress DAILY_PLAY mission', async () => {
      const progressMissionSpy = jest
        .spyOn(service, 'progressMission')
        .mockResolvedValue({ completed: false, rewardChips: 0 });

      await service.onHandPlayed('user-1');

      expect(progressMissionSpy).toHaveBeenCalledWith(
        'user-1',
        MISSION_KEY_DAILY_PLAY,
      );
    });
  });

  describe('onSettlement', () => {
    it('should progress WEEKLY_PROFIT only when chipDelta is positive', async () => {
      const progressMissionSpy = jest
        .spyOn(service, 'progressMission')
        .mockResolvedValue({ completed: false, rewardChips: 0 });

      await service.onSettlement('user-1', 500);

      expect(progressMissionSpy).toHaveBeenCalledWith(
        'user-1',
        MISSION_KEY_WEEKLY_PROFIT,
        500,
      );
    });

    it('should NOT progress any mission when chipDelta is negative', async () => {
      const progressMissionSpy = jest
        .spyOn(service, 'progressMission')
        .mockResolvedValue({ completed: false, rewardChips: 0 });

      await service.onSettlement('user-1', -200);

      expect(progressMissionSpy).not.toHaveBeenCalled();
    });

    it('should NOT progress any mission when chipDelta is zero', async () => {
      const progressMissionSpy = jest
        .spyOn(service, 'progressMission')
        .mockResolvedValue({ completed: false, rewardChips: 0 });

      await service.onSettlement('user-1', 0);

      expect(progressMissionSpy).not.toHaveBeenCalled();
    });
  });

  describe('onDeposit', () => {
    it('should progress FIRST_DEPOSIT and DAILY_DEPOSIT missions', async () => {
      const progressMissionSpy = jest
        .spyOn(service, 'progressMission')
        .mockResolvedValue({ completed: false, rewardChips: 0 });

      await service.onDeposit('user-1');

      expect(progressMissionSpy).toHaveBeenCalledWith(
        'user-1',
        MISSION_KEY_FIRST_DEPOSIT,
      );
      expect(progressMissionSpy).toHaveBeenCalledWith(
        'user-1',
        MISSION_KEY_DAILY_DEPOSIT,
      );
    });
  });

  describe('onRakeContributed', () => {
    it('should progress DAILY_RAKE mission with the rake amount as increment', async () => {
      const progressMissionSpy = jest
        .spyOn(service, 'progressMission')
        .mockResolvedValue({ completed: false, rewardChips: 0 });

      await service.onRakeContributed('user-1', 50);

      expect(progressMissionSpy).toHaveBeenCalledWith(
        'user-1',
        MISSION_KEY_DAILY_Rake,
        50,
      );
    });
  });

  describe('onPlayTimeUpdated', () => {
    it('should progress DAILY_HOUR mission with totalMinutes as increment', async () => {
      const progressMissionSpy = jest
        .spyOn(service, 'progressMission')
        .mockResolvedValue({ completed: false, rewardChips: 0 });

      await service.onPlayTimeUpdated('user-1', 30);

      expect(progressMissionSpy).toHaveBeenCalledWith(
        'user-1',
        MISSION_KEY_DAILY_HOUR,
        30,
      );
    });
  });

  // ── emitMissionUpdate ────────────────────────────────────────────────────────

  describe('emitMissionUpdate', () => {
    it('should emit mission_updated event to the correct user room', async () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      const mockServer = { to: toMock } as any;
      const userId = 'user-1';
      const missionKey = MISSION_KEY_DAILY_PLAY;
      const completed = true;
      const rewardChips = 300;

      await service.emitMissionUpdate(
        userId,
        missionKey,
        completed,
        rewardChips,
        mockServer,
      );

      expect(toMock).toHaveBeenCalledWith(userId);
      expect(emitMock).toHaveBeenCalledWith('mission_updated', {
        missionKey,
        completed,
        rewardChips,
      });
    });
  });
});
