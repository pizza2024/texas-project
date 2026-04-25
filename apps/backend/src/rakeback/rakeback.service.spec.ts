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
    // 5-tier system: BRONZE 15% (0-499), SILVER 22% (500-1999), GOLD 30% (2000-9999), PLATINUM 40% (10000-49999), DIAMOND 50% (50000+)

    it('should return BRONZE tier (15%) for totalRake 0', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 0,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('BRONZE');
      expect(result.rate).toBe(0.15);
    });

    it('should return BRONZE tier (15%) for totalRake 499', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 499,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('BRONZE');
      expect(result.rate).toBe(0.15);
    });

    it('should return SILVER tier (22%) for totalRake 500', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 500,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('SILVER');
      expect(result.rate).toBe(0.22);
    });

    it('should return SILVER tier (22%) for totalRake 1999', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 1999,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('SILVER');
      expect(result.rate).toBe(0.22);
    });

    it('should return GOLD tier (30%) for totalRake 2000', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 2000,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('GOLD');
      expect(result.rate).toBe(0.3);
    });

    it('should return GOLD tier (30%) for totalRake 9999', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 9999,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('GOLD');
      expect(result.rate).toBe(0.3);
    });

    it('should return PLATINUM tier (40%) for totalRake 10000', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 10000,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('PLATINUM');
      expect(result.rate).toBe(0.4);
    });

    it('should return PLATINUM tier (40%) for totalRake 49999', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 49999,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('PLATINUM');
      expect(result.rate).toBe(0.4);
    });

    it('should return DIAMOND tier (50%) for totalRake 50000', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 50000,
      });
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('DIAMOND');
      expect(result.rate).toBe(0.5);
    });

    it('should return BRONZE tier for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.getRakebackRate(mockUserId);
      expect(result.tier).toBe('BRONZE');
      expect(result.rate).toBe(0.15);
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

    // 5-tier system: BRONZE 15% (0-499), SILVER 22% (500-1999), GOLD 30% (2000-9999), PLATINUM 40% (10000-49999), DIAMOND 50% (50000+)

    it('should credit rakeback correctly for BRONZE tier (15%)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 100, // BRONZE: 0-499
      });

      await service.creditRakeback(mockUserId, 100);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 15 } }, // 100 * 0.15 = 15
      });
    });

    it('should credit rakeback correctly for SILVER tier (22%)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 1000, // SILVER: 500-1999
      });

      await service.creditRakeback(mockUserId, 100);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 22 } }, // 100 * 0.22 = 22
      });
    });

    it('should credit rakeback correctly for GOLD tier (30%)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 5000, // GOLD: 2000-9999
      });

      await service.creditRakeback(mockUserId, 100);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 30 } }, // 100 * 0.3 = 30
      });
    });

    it('should credit rakeback correctly for PLATINUM tier (40%)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 20000, // PLATINUM: 10000-49999
      });

      await service.creditRakeback(mockUserId, 100);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 40 } }, // 100 * 0.4 = 40
      });
    });

    it('should credit rakeback correctly for DIAMOND tier (50%)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 100000, // DIAMOND: 50000+
      });

      await service.creditRakeback(mockUserId, 100);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 50 } }, // 100 * 0.5 = 50
      });
    });

    it('should floor the rakeback amount (e.g., 33.33 -> 4)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 100, // BRONZE 15%
      });

      await service.creditRakeback(mockUserId, 33);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 4 } }, // floor(33 * 0.15) = floor(4.95) = 4
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
        totalRake: 100, // BRONZE 15%
      });

      // 1 * 0.15 = 0.15, floors to 0
      await service.creditRakeback(mockUserId, 1);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should accumulate rakeback balance correctly across multiple credits', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        totalRake: 100, // BRONZE 15%
      });

      // First credit: 100 * 0.15 = 15
      await service.creditRakeback(mockUserId, 100);
      expect(prisma.user.update).toHaveBeenLastCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 15 } },
      });

      // Second credit: 200 * 0.15 = 30
      await service.creditRakeback(mockUserId, 200);
      expect(prisma.user.update).toHaveBeenLastCalledWith({
        where: { id: mockUserId },
        data: { rakebackBalance: { increment: 30 } },
      });

      // Total should be 30
      expect(prisma.user.update).toHaveBeenCalledTimes(2);
    });
  });
});
