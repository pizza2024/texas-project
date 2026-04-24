import { Test, TestingModule } from '@nestjs/testing';
import { RakebackService } from './rakeback.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RakebackService', () => {
  let service: RakebackService;
  let prisma: any;

  const mockUserId = 'user-123';

  beforeEach(async () => {
    jest.resetModules();

    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RakebackService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RakebackService>(RakebackService);
    prisma = module.get(PrismaService);
  });

  describe('getRakebackRate', () => {
    it('should return BRONZE tier (10%) for totalRake 0-999', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 0,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('BRONZE');
      expect(result.rate).toBe(0.1);
    });

    it('should return BRONZE tier (10%) for totalRake 500', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 500,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('BRONZE');
      expect(result.rate).toBe(0.1);
    });

    it('should return BRONZE tier (10%) for totalRake 999', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 999,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('BRONZE');
      expect(result.rate).toBe(0.1);
    });

    it('should return SILVER tier (20%) for totalRake 1000', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 1000,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('SILVER');
      expect(result.rate).toBe(0.2);
    });

    it('should return SILVER tier (20%) for totalRake 3000', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 3000,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('SILVER');
      expect(result.rate).toBe(0.2);
    });

    it('should return SILVER tier (20%) for totalRake 4999', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 4999,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('SILVER');
      expect(result.rate).toBe(0.2);
    });

    it('should return GOLD tier (30%) for totalRake 5000', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 5000,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('GOLD');
      expect(result.rate).toBe(0.3);
    });

    it('should return GOLD tier (30%) for totalRake 10000', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 10000,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('GOLD');
      expect(result.rate).toBe(0.3);
    });

    it('should return BRONZE tier for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('BRONZE');
      expect(result.rate).toBe(0.1);
    });
  });

  describe('creditRakeback', () => {
    beforeEach(() => {
      // $transaction can be called with either an array of operations or a callback function
      prisma.$transaction.mockImplementation(async (operations: any) => {
        if (Array.isArray(operations)) {
          return Promise.all(operations.map((op: any) => op));
        }
        return operations(prisma);
      });
      prisma.user.update.mockResolvedValue({});
    });

    it('should credit rakeback correctly for BRONZE tier (10%)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 500,
      });

      await service.creditRakeback(mockUserId, 100);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 10 } },
      });
    });

    it('should credit rakeback correctly for SILVER tier (20%)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 3000,
      });

      await service.creditRakeback(mockUserId, 100);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 20 } },
      });
    });

    it('should credit rakeback correctly for GOLD tier (30%)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 10000,
      });

      await service.creditRakeback(mockUserId, 100);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 30 } },
      });
    });

    it('should floor the rakeback amount (e.g., 33.33 -> 3)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 500,
      });

      await service.creditRakeback(mockUserId, 33);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 3 } },
      });
    });

    it('should not credit if rakeAmount is 0', async () => {
      await service.creditRakeback(mockUserId, 0);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should not credit if rakeAmount is negative', async () => {
      await service.creditRakeback(mockUserId, -100);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should not credit if rakebackAmount floors to 0', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 500,
      });

      // 1 * 0.1 = 0.1, floors to 0
      await service.creditRakeback(mockUserId, 1);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should accumulate rakeback balance correctly across multiple credits', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 500,
      });

      // First credit: 100 * 0.1 = 10
      await service.creditRakeback(mockUserId, 100);
      expect(prisma.user.update).toHaveBeenLastCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 10 } },
      });

      // Second credit: 200 * 0.1 = 20
      await service.creditRakeback(mockUserId, 200);
      expect(prisma.user.update).toHaveBeenLastCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 20 } },
      });

      // Total should be 30
      expect(prisma.user.update).toHaveBeenCalledTimes(2);
    });
  });
});
