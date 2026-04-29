import { Test, TestingModule } from '@nestjs/testing';
import { ethers, Mnemonic, HDNodeWallet } from 'ethers';
import { DepositService } from './deposit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { RedisService } from '../redis/redis.service';
import { MissionService } from '../mission/mission.service';
import { WebSocketManager } from '../websocket/websocket-manager';

jest.mock('ethers');

describe('DepositService - First Deposit Bonus', () => {
  let service: DepositService;
  let module: TestingModule;
  let mockPrisma: any;
  let mockWalletService: any;
  let mockContract: any;
  let mockRedisService: any;
  let mockMissionService: any;
  let mockWsManager: any;

  const USER_ID = 'user-123';
  const ADDRESS = '0xuserdepositaddress';

  beforeEach(() => {
    // Create mock contract that can be referenced in tests
    mockContract = {
      queryFilter: jest.fn(),
      filters: {
        Transfer: () => ({}),
      },
    };

    (ethers.JsonRpcProvider as jest.Mock).mockImplementation(() => ({
      getBlockNumber: jest.fn().mockResolvedValue(12345),
    }));
    (ethers.Contract as jest.Mock).mockImplementation(() => mockContract);
    (Mnemonic.fromPhrase as jest.Mock).mockReturnValue({});
    (HDNodeWallet.fromMnemonic as jest.Mock).mockReturnValue({
      address: '0xfake',
      connect: () => ({ address: '0xfake' }),
    });

    mockPrisma = {
      $transaction: jest
        .fn()
        .mockImplementation((fn: (tx: any) => Promise<unknown>) =>
          fn(mockPrisma),
        ),
      depositAddress: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ address: ADDRESS, userId: USER_ID }]),
      },
      depositRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      depositBonus: {
        create: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      transaction: { create: jest.fn() },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      mission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'mission-1',
          key: 'P1-FIRST-DEPOSIT',
          rewardChips: 10000,
        }),
      },
      scanCursor: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'singleton', lastBlock: 0n }),
        upsert: jest.fn(),
      },
    };

    mockWalletService = {
      getBalance: jest.fn().mockResolvedValue(0),
      setBalance: jest.fn(),
    };

    mockRedisService = {
      ttl: jest.fn().mockResolvedValue(-2),
      set: jest.fn(),
    };

    mockMissionService = {
      progressMission: jest
        .fn()
        .mockResolvedValue({ completed: false, rewardChips: 0 }),
    };
    const mockWsManager = {
      emitToUser: jest.fn(),
    };
  });

  const setupModule = async () => {
    process.env.ETH_RPC_URL = 'http://localhost:8545';
    process.env.HD_WALLET_MNEMONIC =
      'test test test test test test test test test test test junk';
    process.env.USDT_CONTRACT_ADDRESS =
      '0xE660f7D9cA6eB6dF6c7eF531c5Eb91a2Eb0a64ea';

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
    return { mockWsManager };
  };

  afterEach(async () => {
    jest.restoreAllMocks();
    if (module) {
      await module.close();
    }
  });

  describe('First Deposit Bonus logic', () => {
    it('should trigger mission progress for first deposit bonus', async () => {
      await setupModule();

      // Mock user has not received bonus yet
      mockPrisma.user.findUnique.mockResolvedValue({
        id: USER_ID,
        hasReceivedFirstDepositBonus: false,
      });

      // Mock deposit event: 50 USDT (50 * 10^6)
      mockContract.queryFilter.mockResolvedValueOnce([
        {
          transactionHash: '0xdeposit1',
          blockNumber: 12345,
          args: ['0xfrom', ADDRESS, BigInt('50000000')],
        },
      ]);
      // getBalance for deposit credit
      mockWalletService.getBalance.mockResolvedValueOnce(0);

      await service.pollDeposits();

      // Verify deposit record created inside atomic tx
      expect(mockPrisma.depositRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: USER_ID,
          txHash: '0xdeposit1',
          amount: 50, // 50 USDT
          chips: 5000, // 50 * 100 chips
          status: 'CONFIRMED',
        }),
      });

      // Verify DEPOSIT transaction created inside atomic tx
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: { userId: USER_ID, amount: 5000, type: 'DEPOSIT' },
      });

      // Verify coinBalance synced inside atomic tx (via tx.user.update)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { coinBalance: 5000 },
      });

      // Verify mission was triggered for first deposit bonus
      expect(mockMissionService.progressMission).toHaveBeenCalledWith(
        USER_ID,
        'P1-FIRST-DEPOSIT',
      );

      // Verify user hasReceivedFirstDepositBonus set to true
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { hasReceivedFirstDepositBonus: true },
      });
    });

    it('should NOT trigger mission if user already received bonus', async () => {
      await setupModule();

      // User already received the bonus — return hasReceivedFirstDepositBonus=true
      // for the bonus check query inside the atomic deposit transaction
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: USER_ID,
          hasReceivedFirstDepositBonus: true,
        })
        // Second call in the bonus block also returns the same user
        .mockResolvedValueOnce({
          id: USER_ID,
          hasReceivedFirstDepositBonus: true,
        });

      // Mock deposit event
      mockContract.queryFilter.mockResolvedValueOnce([
        {
          transactionHash: '0xdeposit3',
          blockNumber: 12345,
          args: ['0xfrom', ADDRESS, BigInt('100000000')],
        },
      ]);

      await service.pollDeposits();

      // Verify deposit was processed (depositRecord created inside atomic tx)
      expect(mockPrisma.depositRecord.create).toHaveBeenCalled();

      // Verify NO mission was triggered (user already got bonus)
      expect(mockMissionService.progressMission).not.toHaveBeenCalled();

      // Verify user.update was called from atomic tx (to sync coinBalance = 10000)
      // but NOT a second time for setting hasReceivedFirstDepositBonus
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { coinBalance: 10000 },
      });
    });

    it('should not process already processed transaction', async () => {
      await setupModule();

      // Transaction already processed
      mockPrisma.depositRecord.findUnique.mockResolvedValueOnce({
        txHash: '0xdeposit1',
      });

      // Mock user has not received bonus yet
      mockPrisma.user.findUnique.mockResolvedValue({
        id: USER_ID,
        hasReceivedFirstDepositBonus: false,
      });

      // Mock deposit event
      mockContract.queryFilter.mockResolvedValueOnce([
        {
          transactionHash: '0xdeposit1',
          blockNumber: 12345,
          args: ['0xfrom', ADDRESS, BigInt('10000000')],
        },
      ]);

      await service.pollDeposits();

      // Verify no new deposit record created
      expect(mockPrisma.depositRecord.create).not.toHaveBeenCalled();

      // Verify no balance change
      expect(mockWalletService.setBalance).not.toHaveBeenCalled();
    });
  });
});
