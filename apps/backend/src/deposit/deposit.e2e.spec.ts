import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

jest.mock('ethers');

import { ethers, Mnemonic, HDNodeWallet } from 'ethers';
import { DepositService } from './deposit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { RedisService } from '../redis/redis.service';
import { MissionService } from '../mission/mission.service';
import { WebSocketManager } from '../websocket/websocket-manager';

describe('DepositService E2E', () => {
  let service: DepositService;
  let module: TestingModule;
  let mockPrisma: any;
  let mockWalletService: any;
  let mockMint: jest.Mock;
  let mockWait: jest.Mock;
  let mockRedisService: any;
  let mockMissionService: any;
  let mockWsManager: any;

  beforeEach(() => {
    mockMint = jest.fn();
    mockWait = jest.fn();

    // Reset ethers mocks
    (ethers.JsonRpcProvider as jest.Mock).mockReset();
    (ethers.JsonRpcProvider as jest.Mock).mockImplementation(() => ({
      getBlockNumber: jest.fn().mockResolvedValue(12345),
    }));
    (ethers.Contract as jest.Mock).mockReset();
    (ethers.Contract as jest.Mock).mockImplementation(() => ({
      mint: mockMint.mockResolvedValue({
        wait: mockWait.mockResolvedValue(undefined),
        hash: '0xtxhash0000000000000000000000000000000000000000000000000000000',
      }),
      queryFilter: jest.fn().mockResolvedValue([]),
    }));
    (Mnemonic.fromPhrase as jest.Mock).mockReset();
    (Mnemonic.fromPhrase as jest.Mock).mockReturnValue({
      address: '0xfake0000000000000000000000000000000000000',
    });
    (HDNodeWallet.fromMnemonic as jest.Mock).mockReset();
    (HDNodeWallet.fromMnemonic as jest.Mock).mockReturnValue({
      address: '0xfake0000000000000000000000000000000000000',
      connect: (provider: unknown) => ({
        address: '0xfake0000000000000000000000000000000000000',
        provider,
      }),
    });

    mockPrisma = {
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => Promise<unknown>) => {
          return cb(mockPrisma);
        }),
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      depositAddress: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { index: 0 } }),
      },
      depositRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      transaction: { create: jest.fn() },
    };

    mockWalletService = {
      getBalance: jest.fn().mockResolvedValue(1000),
      setBalance: jest.fn(),
    };

    // Redis mock — return -2 (key absent) to exercise in-memory fallback path
    mockRedisService = {
      ttl: jest.fn().mockResolvedValue(-2),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      incr: jest.fn().mockResolvedValue(null),
    };

    mockMissionService = {
      progressMission: jest
        .fn()
        .mockResolvedValue({ completed: false, rewardChips: 0 }),
    };
    mockWsManager = { emitToUser: jest.fn() };
  });

  const setupModule = async (overrides: Record<string, string> = {}) => {
    // Set env vars before constructing service
    process.env.FAUCET_ENABLED = overrides.FAUCET_ENABLED ?? 'true';
    process.env.HD_WALLET_MNEMONIC =
      overrides.HD_WALLET_MNEMONIC ??
      'test test test test test test test test test test test junk';
    process.env.ETH_RPC_URL = overrides.ETH_RPC_URL ?? 'http://localhost:8545';
    process.env.FAUCET_AMOUNT_USDT = overrides.FAUCET_AMOUNT_USDT ?? '100';
    process.env.USDT_CONTRACT_ADDRESS =
      overrides.USDT_CONTRACT_ADDRESS ??
      '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';

    module = await Test.createTestingModule({
      providers: [
        DepositService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WalletService, useValue: mockWalletService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: MissionService, useValue: mockMissionService },
        { provide: WebSocketManager, useValue: mockWsManager },
      ],
    }).compile();

    service = module.get<DepositService>(DepositService);
    (service as any).faucetCooldowns.clear();
  };

  afterEach(async () => {
    jest.clearAllMocks();
    if (module) {
      await module.close();
    }
  });

  describe('faucet', () => {
    it('throws ForbiddenException when FAUCET_ENABLED is not true', async () => {
      await setupModule({ FAUCET_ENABLED: 'false' });
      await expect(service.faucet('user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws Error when HD_WALLET_MNEMONIC is missing', async () => {
      await setupModule({ HD_WALLET_MNEMONIC: '' });
      await expect(service.faucet('user-1')).rejects.toThrow(
        /HD_WALLET_MNEMONIC.*not set/i,
      );
    });

    it('throws ForbiddenException when ETH_RPC_URL is missing', async () => {
      await setupModule({ ETH_RPC_URL: '' });
      await expect(service.faucet('user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when faucet is called within cooldown period', async () => {
      await setupModule();
      // Force Redis TTL to throw → triggers in-memory fallback path
      mockRedisService.ttl = jest
        .fn()
        .mockRejectedValue(new Error('Redis unavailable'));
      (service as any).faucetCooldowns.set('user-1', Date.now() - 30_000);
      await expect(service.faucet('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException with remaining time when called during cooldown', async () => {
      await setupModule();
      // Force Redis TTL to throw → triggers in-memory fallback path
      mockRedisService.ttl = jest
        .fn()
        .mockRejectedValue(new Error('Redis unavailable'));
      (service as any).faucetCooldowns.set('user-1', Date.now() - 50_000);
      try {
        await service.faucet('user-1');
        fail('Expected BadRequestException');
      } catch (e: unknown) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect((e as BadRequestException).message).toContain('请等待');
      }
    });

    it('succeeds when no cooldown is active and returns txHash and amount', async () => {
      await setupModule();
      mockPrisma.depositAddress.findUnique.mockResolvedValue({
        userId: 'user-1',
        address: '0xuserdeposit',
        index: 1,
      });

      const result = await service.faucet('user-1');

      expect(result.txHash).toBe(
        '0xtxhash0000000000000000000000000000000000000000000000000000000',
      );
      expect(result.amount).toBe(100);
      expect(ethers.Contract as jest.Mock).toHaveBeenCalled();
    });

    it('mints with correct USDT amount (6 decimals) to user deposit address', async () => {
      await setupModule();
      mockPrisma.depositAddress.findFirst.mockResolvedValue({
        userId: 'user-1',
        address: '0xuserdeposit',
        index: 1,
        isDefault: true,
      });

      await service.faucet('user-1');

      // 100 USDT × 10^6 = 100_000_000
      expect(mockMint).toHaveBeenCalledWith(
        '0xuserdeposit',
        BigInt('100000000'),
      );
    });

    it('creates deposit address for new user', async () => {
      await setupModule();
      // Fast path: no existing default address
      mockPrisma.depositAddress.findFirst
        .mockResolvedValueOnce(null) // fast path
        .mockResolvedValueOnce(null); // re-check inside tx
      // Return the created record after create
      mockPrisma.depositAddress.findUnique.mockResolvedValueOnce({
        userId: 'user-1',
        address: '0xnewaddress',
        index: 1,
        isDefault: true,
      });
      mockPrisma.depositAddress.create.mockResolvedValue({
        userId: 'user-1',
        address: '0xnewaddress',
        index: 1,
      });
      mockPrisma.depositAddress.aggregate.mockResolvedValue({
        _max: { index: 0 },
      });

      await service.faucet('user-1');

      expect(mockPrisma.depositAddress.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          address: expect.any(String),
          index: 1,
          isDefault: true,
        },
      });
    });

    it('sets cooldown after successful faucet', async () => {
      await setupModule();
      mockPrisma.depositAddress.findUnique.mockResolvedValue({
        userId: 'user-1',
        address: '0xuserdeposit',
        index: 1,
      });

      const before = Date.now();
      await service.faucet('user-1');
      const after = Date.now();

      const cooldown = (service as any).faucetCooldowns.get('user-1');
      expect(cooldown).toBeGreaterThanOrEqual(before);
      expect(cooldown).toBeLessThanOrEqual(after);
    });

    it('second faucet call within 60 seconds throws BadRequestException', async () => {
      await setupModule();
      mockPrisma.depositAddress.findUnique.mockResolvedValue({
        userId: 'user-1',
        address: '0xuserdeposit',
        index: 1,
      });

      // First call succeeds (Redis reports no active key)
      await service.faucet('user-1');

      // Second call: Redis reports 59s remaining on cooldown key
      jest.spyOn(mockRedisService, 'ttl').mockResolvedValue(59);
      await expect(service.faucet('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('uses FAUCET_AMOUNT_USDT env var for the minted amount', async () => {
      await setupModule({ FAUCET_AMOUNT_USDT: '50' });
      mockPrisma.depositAddress.findFirst.mockResolvedValue({
        userId: 'user-1',
        address: '0xuserdeposit',
        index: 1,
        isDefault: true,
      });

      const result = await service.faucet('user-1');

      expect(result.amount).toBe(50);
      expect(mockMint).toHaveBeenCalledWith(
        '0xuserdeposit',
        BigInt('50000000'),
      );
    });
  });

  describe('getOrCreateDepositAddress', () => {
    it('returns existing address for returning user without creating', async () => {
      await setupModule();
      // Fast path: findFirst finds the default address — no transaction needed.
      mockPrisma.depositAddress.findFirst.mockResolvedValue({
        userId: 'user-1',
        address: '0xexisting',
        index: 5,
      });

      const address = await service.getOrCreateDepositAddress('user-1');

      expect(address).toBe('0xexisting');
      // Fast path: no transaction needed, so neither create nor createMany is called
      expect(mockPrisma.depositAddress.create).not.toHaveBeenCalled();
      expect(mockPrisma.depositAddress.createMany).not.toHaveBeenCalled();
    });

    it('creates new address for new user with correct HD wallet index', async () => {
      await setupModule();
      // Make HDNodeWallet.fromMnemonic return the expected address so the function uses it
      (HDNodeWallet.fromMnemonic as jest.Mock).mockReturnValueOnce({
        address: '0xderivedaddress1',
        connect: (provider: unknown) => ({
          address: '0xderivedaddress1',
          provider,
        }),
      });
      // Fast path: no existing address
      mockPrisma.depositAddress.findFirst
        .mockResolvedValueOnce(null) // fast path
        .mockResolvedValueOnce(null); // re-check inside tx
      // Final findUnique after createMany — returns the created record
      mockPrisma.depositAddress.findUnique.mockResolvedValueOnce({
        userId: 'user-1',
        address: '0xderivedaddress1',
        index: 1,
      });
      mockPrisma.depositAddress.aggregate.mockReset();
      mockPrisma.depositAddress.aggregate.mockResolvedValue({
        _max: { index: null },
      });
      mockPrisma.depositAddress.create.mockResolvedValue({
        userId: 'user-1',
        address: '0xderivedaddress1',
        index: 1,
      });

      const address = await service.getOrCreateDepositAddress('user-1');

      expect(address).toBe('0xderivedaddress1');
      expect(mockPrisma.depositAddress.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          address: '0xderivedaddress1',
          index: 1,
          isDefault: true,
        },
      });
    });

    it('user addresses start at index 1 (index 0 reserved for owner wallet)', async () => {
      await setupModule();
      // Fast path: no existing address
      mockPrisma.depositAddress.findFirst
        .mockResolvedValueOnce(null) // fast path
        .mockResolvedValueOnce(null); // re-check inside tx
      // Final findUnique after create — returns the created record
      mockPrisma.depositAddress.findUnique.mockResolvedValueOnce({
        userId: 'user-1',
        address: '0xnewaddress11',
        index: 11,
      });
      mockPrisma.depositAddress.aggregate.mockReset();
      mockPrisma.depositAddress.aggregate.mockResolvedValue({
        _max: { index: 10 },
      });
      mockPrisma.depositAddress.create.mockResolvedValue({
        userId: 'user-1',
        address: '0xnewaddress11',
        index: 11,
      });

      await service.getOrCreateDepositAddress('user-1');

      // Owner wallet is at index 0; next available is 11
      expect(mockPrisma.depositAddress.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          address: expect.any(String),
          index: 11,
          isDefault: true,
        },
      });
    });

    // TODO(P2): Service no longer does findUnique after create — it returns the generated
    // address directly. Rewrite this test to verify the race-handling behavior of the
    // current implementation (aggregate-based index reservation).
    it.skip('returns correct address when another request inserted first', async () => {
      await setupModule();
      // Fast path: no existing default address
      mockPrisma.depositAddress.findFirst.mockResolvedValue(null);
      // Inside tx: re-check returns null, create skips (another request committed
      // a row with the same userId already), final findUnique returns winner's record
      mockPrisma.depositAddress.findUnique.mockResolvedValueOnce({
        // final findUnique after create — winner's record
        userId: 'user-1',
        address: '0xraceaddress',
        index: 1,
        isDefault: true,
      });
      mockPrisma.depositAddress.create.mockResolvedValue({ count: 0 }); // skipped

      const address = await service.getOrCreateDepositAddress('user-1');

      expect(address).toBe('0xraceaddress');
    });
  });

  describe('getDepositHistory', () => {
    it('returns deposit records ordered by createdAt descending with limit 20', async () => {
      await setupModule();
      const mockRecords = [
        {
          id: '1',
          userId: 'user-1',
          txHash: 'tx1',
          amount: 100,
          createdAt: new Date(),
        },
        {
          id: '2',
          userId: 'user-1',
          txHash: 'tx2',
          amount: 200,
          createdAt: new Date(),
        },
      ];
      mockPrisma.depositRecord.findMany = jest
        .fn()
        .mockResolvedValue(mockRecords);

      const history = await service.getDepositHistory('user-1');

      expect(mockPrisma.depositRecord.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      expect(history).toHaveLength(2);
    });
  });
});
