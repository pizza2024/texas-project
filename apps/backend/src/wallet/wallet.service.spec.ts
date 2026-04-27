import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WalletService', () => {
  let service: WalletService;

  const mockPrisma = {
    wallet: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (fn: any) => {
      // Support both array form and callback form
      if (Array.isArray(fn)) {
        // Array form: $transaction([prismaOp1, prismaOp2, ...])
        const results: unknown[] = [];
        for (const op of fn) {
          const pendingOp = op as unknown;
          if (typeof (pendingOp as Promise<unknown>)?.then === 'function') {
            results.push(await (pendingOp as Promise<unknown>));
          } else if (typeof pendingOp === 'function') {
            results.push(
              await (pendingOp as (tx: typeof mockPrisma) => unknown)(
                mockPrisma,
              ),
            );
          }
        }
        return results;
      }
      // Callback form: $transaction(async (tx) => ...)
      return await fn(mockPrisma);
    }),
  };

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  // ─── getBalance ───────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('should return wallet.chips when wallet exists', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({ chips: 5000 });

      const result = await service.getBalance('user-1');

      expect(result).toBe(5000);
      expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { chips: true },
      });
    });

    it('should fall back to user.coinBalance when wallet does not exist', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({ coinBalance: 3000 });

      const result = await service.getBalance('user-1');

      expect(result).toBe(3000);
    });

    it('should return STARTING_CHIPS when neither wallet nor user exists', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getBalance('user-1');

      expect(result).toBe(10000);
    });
  });

  // ─── freezeBalance ────────────────────────────────────────────────────────

  describe('freezeBalance', () => {
    it('should upsert wallet with frozenChips and decrement user coinBalance', async () => {
      // Provide enough available balance (chips - frozenChips >= 1000)
      mockPrisma.wallet.findUnique.mockResolvedValue({
        chips: 5000,
        frozenChips: 3000,
      });
      mockPrisma.wallet.upsert.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.freezeBalance('user-1', 1000);

      expect(mockPrisma.wallet.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: { frozenChips: 1000 },
        create: { userId: 'user-1', chips: 1000, frozenChips: 1000 },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { coinBalance: { decrement: 1000 } },
      });
    });

    it('should normalize negative amounts to zero and return early', async () => {
      await service.freezeBalance('user-1', -500);

      // Should not upsert wallet for negative amounts
      expect(mockPrisma.wallet.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when available balance is insufficient', async () => {
      // Available balance = 500 - 400 = 100 < 1000
      mockPrisma.wallet.findUnique.mockResolvedValue({
        chips: 500,
        frozenChips: 400,
      });

      await expect(service.freezeBalance('user-1', 1000)).rejects.toThrow(
        'Insufficient balance',
      );
      expect(mockPrisma.wallet.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ─── unfreezeAndAward ─────────────────────────────────────────────────────

  describe('unfreezeAndAward', () => {
    it('should calculate newBalance = (chips - frozenChips) + prizeAmount and reset frozenChips to 0', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        chips: 5000,
        frozenChips: 3000,
      });
      mockPrisma.wallet.upsert.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.transaction.create.mockResolvedValue({});

      await service.unfreezeAndAward('user-1', 1000);

      // newBalance = (5000 - 3000) + 1000 = 3000
      expect(mockPrisma.wallet.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: { chips: 3000, frozenChips: 0 },
        create: { userId: 'user-1', chips: 3000, frozenChips: 0 },
      });
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          amount: 1000,
          type: 'TOURNAMENT_PRIZE',
        },
      });
    });

    it('should handle null wallet (fallback to prize only)', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      mockPrisma.wallet.upsert.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.transaction.create.mockResolvedValue({});

      await service.unfreezeAndAward('user-1', 500);

      // newBalance = (0 - 0) + 500 = 500
      expect(mockPrisma.wallet.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: { chips: 500, frozenChips: 0 },
        create: { userId: 'user-1', chips: 500, frozenChips: 0 },
      });
    });

    it('should not award negative prize (prizeAmount larger than available)', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        chips: 2000,
        frozenChips: 5000,
      });
      mockPrisma.wallet.upsert.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.transaction.create.mockResolvedValue({});

      await service.unfreezeAndAward('user-1', 1000);

      // newBalance = Math.max(0, (2000 - 5000) + 1000) = Math.max(0, -2000) = 0
      expect(mockPrisma.wallet.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: { chips: 0, frozenChips: 0 },
        create: { userId: 'user-1', chips: 0, frozenChips: 0 },
      });
    });
  });

  // ─── exchangeBalanceToChips ────────────────────────────────────────────────

  describe('exchangeBalanceToChips', () => {
    it('should throw BadRequestException for non-positive usdtAmount', async () => {
      await expect(service.exchangeBalanceToChips('user-1', 0)).rejects.toThrow(
        'Amount must be positive',
      );
      await expect(
        service.exchangeBalanceToChips('user-1', -10),
      ).rejects.toThrow('Amount must be positive');
    });

    it('should throw BadRequestException when USDT balance is insufficient', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({ balance: 50 });

      await expect(
        service.exchangeBalanceToChips('user-1', 100),
      ).rejects.toThrow('Insufficient USDT balance');
    });

    it('should correctly exchange USDT to chips at 100:1 rate', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({ balance: 500 });
      mockPrisma.wallet.upsert.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.transaction.create.mockResolvedValue({});

      const result = await service.exchangeBalanceToChips('user-1', 10);

      expect(result).toEqual({
        chipsAdded: 1000,
        usdtDeducted: 10,
      });
      expect(mockPrisma.wallet.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: {
          balance: { decrement: 10 },
          chips: { increment: 1000 },
        },
        create: {
          userId: 'user-1',
          balance: -10,
          chips: 1000,
        },
      });
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          amount: 1000,
          type: 'EXCHANGE',
        },
      });
    });

    it('should throw BadRequestException for zero USDT balance wallet (insufficient)', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({ balance: 0 });

      await expect(service.exchangeBalanceToChips('user-1', 5)).rejects.toThrow(
        'Insufficient USDT balance',
      );
    });
  });
});
