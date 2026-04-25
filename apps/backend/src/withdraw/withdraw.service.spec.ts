import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { RedisService } from '../redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import { WithdrawQueueService } from '../queue/withdraw-queue.service';

describe('WithdrawService', () => {
  let service: WithdrawService;
  let prisma: any;
  let walletService: any;

  const mockUserId = 'user-123';
  const mockAdminId = 'admin-456';
  const mockAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f2E5b6';

  const mockWallet = { userId: mockUserId, chips: 50000, frozenChips: 0 };

  beforeEach(async () => {
    // Clear any Jest module cache to ensure fresh DI container per test
    jest.resetModules();

    const mockPrisma = {
      withdrawRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      adminLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockWalletService = {
      getAvailableBalance: jest.fn(),
      getBalance: jest.fn(),
      setBalance: jest.fn(),
    };

    // RedisService mock: simulates available Redis for SETNX/TTL.
    // Uses closure state to properly simulate cooldown lock behavior across
    // multiple calls within a test. cooldowns set/cleared between tests via
    // beforeEach so each test gets fresh state.
    const redisLockState = { cooldownActive: false };
    const mockSetNX = jest.fn().mockImplementation(() => {
      if (redisLockState.cooldownActive) return Promise.resolve(false);
      redisLockState.cooldownActive = true;
      return Promise.resolve(true);
    });
    const mockTTL = jest.fn().mockImplementation(() => {
      if (redisLockState.cooldownActive) return Promise.resolve(60);
      return Promise.resolve(-1);
    });
    const mockDel = jest.fn().mockImplementation(() => {
      redisLockState.cooldownActive = false;
      return Promise.resolve(1);
    });

    const mockRedisService = {
      isAvailable: true,
      get: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
      set: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
      del: mockDel,
      ttl: mockTTL,
      incr: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
      ping: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
      setNX: mockSetNX,
    };

    // NotificationService mock: all methods are no-ops for testing
    const mockNotificationService = {
      sendAdminAlert: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };

    // WithdrawQueueService mock: enqueueWithdraw throws to force fallback to direct execution
    const mockWithdrawQueue = {
      enqueueWithdraw: jest
        .fn()
        .mockRejectedValue(new Error('Queue unavailable')),
      isInQueue: jest.fn().mockResolvedValue(false),
      getStats: jest
        .fn()
        .mockResolvedValue({ waiting: 0, active: 0, failed: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WalletService, useValue: mockWalletService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: WithdrawQueueService, useValue: mockWithdrawQueue },
      ],
    }).compile();

    service = module.get<WithdrawService>(WithdrawService);
    prisma = module.get(PrismaService);
    walletService = module.get(WalletService);

    // Clear in-memory cooldown state between tests for isolation
    // (Access via prototype to bypass private field restriction in tests)
    (service as any).cooldowns.clear();
  });

  describe('getCooldownRemaining', () => {
    it('should return canWithdraw=true when no previous withdraw', async () => {
      const result = await service.getCooldownRemaining(mockUserId);
      expect(result.canWithdraw).toBe(true);
      expect(result.remainingMs).toBe(0);
    });

    it('should return canWithdraw=false during cooldown', async () => {
      // Create a withdraw to start cooldown
      prisma.withdrawRequest.create.mockResolvedValue({
        id: 'req-1',
        userId: mockUserId,
        amountChips: 1000,
        amountUsdt: 10,
        toAddress: mockAddress,
        status: 'PENDING',
        createdAt: new Date(),
      } as any);
      walletService.getAvailableBalance.mockResolvedValue(50000);
      prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
      prisma.wallet.findUnique.mockResolvedValue(mockWallet as any);
      prisma.wallet.update.mockResolvedValue({} as any);
      prisma.user.update.mockResolvedValue({} as any);

      await service.createWithdraw(mockUserId, {
        toAddress: mockAddress,
        amountChips: 1000,
      });

      const result = await service.getCooldownRemaining(mockUserId);
      expect(result.canWithdraw).toBe(false);
      expect(result.remainingMs).toBeGreaterThan(0);
    });
  });

  describe('getAvailableBalance', () => {
    it('should return correct balance info', async () => {
      walletService.getAvailableBalance.mockResolvedValue(50000);
      const result = await service.getAvailableBalance(mockUserId);
      expect(result.availableChips).toBe(50000);
      expect(result.minWithdrawChips).toBe(1000);
      expect(result.minWithdrawUsdt).toBe(10);
      expect(result.rate).toBe(100);
    });
  });

  describe('createWithdraw', () => {
    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
      prisma.wallet.findUnique.mockResolvedValue(mockWallet as any);
      prisma.wallet.update.mockResolvedValue({} as any);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.withdrawRequest.create.mockResolvedValue({
        id: 'req-1',
        userId: mockUserId,
        amountChips: 5000,
        amountUsdt: 50,
        toAddress: mockAddress,
        status: 'PENDING',
        createdAt: new Date(),
      } as any);
    });

    it('should create withdraw successfully', async () => {
      walletService.getAvailableBalance.mockResolvedValue(50000);

      const result = await service.createWithdraw(mockUserId, {
        toAddress: mockAddress,
        amountChips: 5000,
      });

      expect(result.amountChips).toBe(5000);
      expect(result.amountUsdt).toBe(50);
      expect(result.status).toBe('PENDING');
      expect(prisma.withdrawRequest.create).toHaveBeenCalled();
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: mockUserId, type: 'WITHDRAW' }),
      });
    });

    it('should throw BadRequestException when balance insufficient', async () => {
      walletService.getAvailableBalance.mockResolvedValue(100);

      await expect(
        service.createWithdraw(mockUserId, {
          toAddress: mockAddress,
          amountChips: 5000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount below minimum', async () => {
      walletService.getAvailableBalance.mockResolvedValue(50000);

      await expect(
        service.createWithdraw(mockUserId, {
          toAddress: mockAddress,
          amountChips: 500,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException during cooldown', async () => {
      walletService.getAvailableBalance.mockResolvedValue(50000);

      // First withdraw succeeds
      await service.createWithdraw(mockUserId, {
        toAddress: mockAddress,
        amountChips: 1000,
      });

      // Second should fail cooldown
      await expect(
        service.createWithdraw(mockUserId, {
          toAddress: mockAddress,
          amountChips: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('processWithdraw (reject)', () => {
    const mockPendingRequest = {
      id: 'req-1',
      userId: mockUserId,
      amountChips: 5000,
      amountUsdt: 50,
      toAddress: mockAddress,
      status: 'PENDING',
      createdAt: new Date(),
    };

    beforeEach(() => {
      prisma.withdrawRequest.findUnique.mockResolvedValue(
        mockPendingRequest as any,
      );
      prisma.wallet.findUnique.mockResolvedValue(mockWallet as any);
      prisma.wallet.upsert.mockResolvedValue({} as any);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.withdrawRequest.update.mockResolvedValue({} as any);
      prisma.transaction.create.mockResolvedValue({} as any);
      prisma.adminLog.create.mockResolvedValue({} as any);
    });

    it('should reject and refund chips', async () => {
      // Handle $transaction called with array (prisma transaction batching)
      prisma.$transaction.mockImplementation(async (operations: any) => {
        if (Array.isArray(operations)) {
          // refundChips: [walletUpsert, userUpdate, txCreate]
          return Promise.all(operations.map((op: any) => op));
        }
        // Or called with a callback function
        return operations(prisma);
      });

      prisma.wallet.upsert.mockResolvedValue({
        userId: mockUserId,
        chips: 55000,
      } as any);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.transaction.create.mockResolvedValue({} as any);
      prisma.withdrawRequest.update.mockResolvedValue({
        ...mockPendingRequest,
        status: 'FAILED',
        failureReason: 'Invalid address',
      } as any);

      const result = await service.processWithdraw(
        'req-1',
        mockAdminId,
        'REJECT',
        'Invalid address',
      );

      expect(result.status).toBe('FAILED');
      expect(prisma.adminLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: mockAdminId,
          action: 'WITHDRAW_REJECT',
        }),
      });
    });
  });

  describe('processWithdraw (approve)', () => {
    const mockPendingRequest = {
      id: 'req-1',
      userId: mockUserId,
      amountChips: 5000,
      amountUsdt: 50,
      toAddress: mockAddress,
      status: 'PENDING',
      createdAt: new Date(),
    };

    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
      prisma.withdrawRequest.findUnique.mockResolvedValue(
        mockPendingRequest as any,
      );
      prisma.withdrawRequest.update.mockResolvedValue({
        ...mockPendingRequest,
        status: 'PROCESSING',
      } as any);
      prisma.adminLog.create.mockResolvedValue({} as any);
    });

    it('should move to PROCESSING status on APPROVE', async () => {
      const result = await service.processWithdraw(
        'req-1',
        mockAdminId,
        'APPROVE',
      );

      expect(result.status).toBe('PROCESSING');
      expect(prisma.adminLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: mockAdminId,
          action: 'WITHDRAW_APPROVE',
        }),
      });
    });

    it('should throw BadRequestException if not PENDING', async () => {
      prisma.withdrawRequest.findUnique.mockResolvedValue({
        ...mockPendingRequest,
        status: 'CONFIRMED',
      } as any);

      await expect(
        service.processWithdraw('req-1', mockAdminId, 'APPROVE'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listRequests', () => {
    it('should return paginated results with user info', async () => {
      const mockRequests = [
        {
          id: 'req-1',
          userId: mockUserId,
          amountChips: 5000,
          amountUsdt: 50,
          toAddress: mockAddress,
          status: 'PENDING',
          createdAt: new Date(),
          user: { id: mockUserId, username: 'player1', nickname: 'Player1' },
        },
      ];

      prisma.withdrawRequest.count.mockResolvedValue(1);
      prisma.withdrawRequest.findMany.mockResolvedValue(mockRequests as any);

      const result = await service.listRequests({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.data[0].user.nickname).toBe('Player1');
    });
  });

  describe('handleWithdrawFailure', () => {
    const mockFailedRequest = {
      id: 'req-fail-1',
      userId: mockUserId,
      amountChips: 3000,
      amountUsdt: 30,
      toAddress: mockAddress,
      status: 'PROCESSING',
      createdAt: new Date(),
    };

    beforeEach(() => {
      // refundChips uses array-style $transaction (non-interactive Prisma transaction)
      prisma.$transaction.mockImplementation(async (operations: any) => {
        if (Array.isArray(operations)) {
          return Promise.all(operations.map((op: any) => op));
        }
        return operations(prisma);
      });

      prisma.withdrawRequest.findUnique.mockResolvedValue(
        mockFailedRequest as any,
      );
      prisma.withdrawRequest.update.mockResolvedValue({
        ...mockFailedRequest,
        status: 'FAILED',
        failureReason: 'Chain transfer failed',
      } as any);
      prisma.wallet.findUnique.mockResolvedValue({
        userId: mockUserId,
        chips: 53000,
      } as any);
      prisma.wallet.upsert.mockResolvedValue({
        userId: mockUserId,
        chips: 56000,
      } as any);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.transaction.create.mockResolvedValue({} as any);
    });

    it('should set status to FAILED and refund chips', async () => {
      await service.handleWithdrawFailure('req-fail-1', 'Chain transfer failed');

      expect(prisma.withdrawRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-fail-1' },
        data: {
          status: 'FAILED',
          failureReason: 'Chain transfer failed',
        },
      });
      // Verifies refundChips was called (wallet updated)
      expect(prisma.wallet.upsert).toHaveBeenCalled();
    });

    it('should early return if request not found', async () => {
      prisma.withdrawRequest.findUnique.mockResolvedValue(null);

      await service.handleWithdrawFailure('non-existent', 'Chain transfer failed');

      expect(prisma.withdrawRequest.update).not.toHaveBeenCalled();
    });

    it('should early return if already CONFIRMED', async () => {
      prisma.withdrawRequest.findUnique.mockResolvedValue({
        ...mockFailedRequest,
        status: 'CONFIRMED',
      } as any);

      await service.handleWithdrawFailure('req-fail-1', 'Chain transfer failed');

      expect(prisma.withdrawRequest.update).not.toHaveBeenCalled();
    });

    it('should early return if already FAILED', async () => {
      prisma.withdrawRequest.findUnique.mockResolvedValue({
        ...mockFailedRequest,
        status: 'FAILED',
      } as any);

      await service.handleWithdrawFailure('req-fail-1', 'Already failed');

      expect(prisma.withdrawRequest.update).not.toHaveBeenCalled();
    });
  });
});
