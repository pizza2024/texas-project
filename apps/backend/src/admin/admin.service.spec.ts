import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotFoundException } from '@nestjs/common';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;

  beforeEach(async () => {
    const mockPrisma = {
      adminLog: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      wallet: {
        update: jest.fn(),
      },
      room: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
      },
      transaction: {
        count: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
        create: jest.fn(),
      },
      hand: {
        count: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
    };
    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = mockPrisma;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create admin log', async () => {
      prisma.adminLog.create.mockResolvedValue({ id: 'log-1' });
      const result = await service.log({
        adminId: 'admin-1',
        action: 'BAN_USER',
        targetType: 'USER',
        targetId: 'user-1',
        detail: { reason: 'spam' },
      });
      expect(result).toEqual({ id: 'log-1' });
      expect(prisma.adminLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: 'BAN_USER',
          targetType: 'USER',
          targetId: 'user-1',
          detail: '{"reason":"spam"}',
        },
      });
    });
  });

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers = [{ id: 'u1', username: 'alice' }];
      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getUsers({ page: 1, limit: 20 });

      expect(result).toEqual({ total: 1, page: 1, limit: 20, data: mockUsers });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by search', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      await service.getUsers({ page: 1, limit: 20, search: 'alice' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { username: { contains: 'alice' } },
              { nickname: { contains: 'alice' } },
            ],
          },
        }),
      );
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      const mockUser = { id: 'u1', username: 'alice', role: 'PLAYER' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserById('u1');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUser', () => {
    it('should update user', async () => {
      const updated = { id: 'u1', nickname: 'new-nick' };
      prisma.user.update.mockResolvedValue(updated);
      const result = await service.updateUser('u1', { nickname: 'new-nick' });
      expect(result).toEqual(updated);
    });
  });

  describe('adjustBalance', () => {
    it('should adjust balance with transaction', async () => {
      const mockUser = { id: 'u1', coinBalance: 100 };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.$transaction.mockResolvedValue([
        { id: 'u1' },
        { id: 'w1' },
        { id: 't1' },
      ]);
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ id: 'u1', coinBalance: 200 });

      const result = await service.adjustBalance('u1', 100, 'bonus', 'admin-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.adminLog.create).toHaveBeenCalled();
      expect(result?.coinBalance).toBe(200);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.adjustBalance('nonexistent', 100, 'bonus', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRooms', () => {
    it('should return paginated rooms', async () => {
      const mockRooms = [{ id: 'r1', name: 'Room 1', tables: [] }];
      prisma.room.count.mockResolvedValue(1);
      prisma.room.findMany.mockResolvedValue(mockRooms);

      const result = await service.getRooms({ page: 1, limit: 20 });
      expect(result).toEqual({ total: 1, page: 1, limit: 20, data: mockRooms });
    });
  });

  describe('createRoom', () => {
    it('should create a room', async () => {
      const roomData = { name: 'New Room', blindSmall: 5, blindBig: 10 };
      prisma.room.create.mockResolvedValue({ id: 'r1', ...roomData });

      const result = await service.createRoom(roomData);
      expect(result).toEqual({ id: 'r1', ...roomData });
    });
  });

  describe('deleteRoom', () => {
    it('should delete room and log action', async () => {
      prisma.room.delete.mockResolvedValue({ id: 'r1' });
      await service.deleteRoom('r1', 'admin-1');
      expect(prisma.room.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
      expect(prisma.adminLog.create).toHaveBeenCalled();
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      const mockTxs = [{ id: 't1', amount: 100 }];
      prisma.transaction.count.mockResolvedValue(1);
      prisma.transaction.findMany.mockResolvedValue(mockTxs);

      const result = await service.getTransactions({ page: 1, limit: 20 });
      expect(result.total).toBe(1);
      expect(result.data).toEqual(mockTxs);
    });
  });

  describe('getFinanceSummary', () => {
    it('should return finance summary', async () => {
      prisma.user.aggregate.mockResolvedValue({ _sum: { coinBalance: 10000 } });
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 } }) // totalDeposit
        .mockResolvedValueOnce({ _sum: { amount: 1000 } }) // dayFlow
        .mockResolvedValueOnce({ _sum: { amount: 5000 } }) // weekFlow
        .mockResolvedValueOnce({ _sum: { amount: 20000 } }); // monthFlow

      const result = await service.getFinanceSummary();
      expect(result.totalAssets).toBe(10000);
      expect(result.dayFlow).toBe(1000);
    });
  });

  describe('getOverview', () => {
    it('should return overview stats', async () => {
      prisma.user.count.mockResolvedValue(100);
      prisma.room.count.mockResolvedValue(5);
      prisma.hand.count.mockResolvedValue(500);
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 10000 },
        _count: 50,
      });

      const result = await service.getOverview();
      expect(result.totalUsers).toBe(100);
      expect(result.activeRooms).toBe(5);
      expect(result.totalHands).toBe(500);
    });
  });

  describe('getHandsStats', () => {
    it('should return hands statistics', async () => {
      prisma.hand.count.mockResolvedValue(100);
      prisma.hand.aggregate.mockResolvedValue({
        _avg: { potSize: 50.5 },
        _sum: { potSize: 5050 },
      });

      const result = await service.getHandsStats();
      expect(result.total).toBe(100);
      expect(result.avgPot).toBe(50.5);
    });
  });

  describe('getAdminLogs', () => {
    it('should return paginated admin logs', async () => {
      const mockLogs = [{ id: 'log-1', action: 'BAN_USER' }];
      prisma.adminLog.count.mockResolvedValue(1);
      prisma.adminLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getAdminLogs(1, 20);
      expect(result.total).toBe(1);
      expect(result.data).toEqual(mockLogs);
    });
  });
});
