import { TableManagerService } from './table-manager.service';
import { ROOM_STATUS_UPDATED_EVENT, roomEvents } from '../websocket/room-events';

describe('TableManagerService', () => {
  const room = {
    id: 'room-1',
    name: 'Test Room',
    maxPlayers: 2,
    blindSmall: 10,
    blindBig: 20,
  };

  let roomService: {
    findOne: jest.Mock;
    deleteRoom: jest.Mock;
  };
  let walletService: {
    getBalance: jest.Mock;
    getAvailableBalance: jest.Mock;
    setBalance: jest.Mock;
    setBalances: jest.Mock;
    freezeBalance: jest.Mock;
    unfreezeBalance: jest.Mock;
  };
  let prisma: {
    table: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
    };
    hand: { create: jest.Mock };
    settlement: { createMany: jest.Mock };
    transaction: { create: jest.Mock };
  };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let service: TableManagerService;

  beforeEach(() => {
    roomService = {
      findOne: jest.fn().mockResolvedValue(room),
      deleteRoom: jest.fn(),
    };
    walletService = {
      getBalance: jest.fn().mockResolvedValue(10000),
      getAvailableBalance: jest.fn().mockResolvedValue(10000),
      setBalance: jest.fn(),
      setBalances: jest.fn(),
      freezeBalance: jest.fn().mockResolvedValue(undefined),
      unfreezeBalance: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      table: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      hand: { create: jest.fn().mockResolvedValue({ id: 'hand-1' }) },
      settlement: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      transaction: { create: jest.fn().mockResolvedValue({}) },
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };
    service = new TableManagerService(
      roomService as any,
      walletService as any,
      prisma as any,
      redis as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('broadcasts updated room status', async () => {
    const emitSpy = jest.spyOn(roomEvents, 'emit');
    const table = await service.getTable(room.id);

    table?.addPlayer({ sub: 'user-1', username: 'alice' });

    await service.broadcastRoomStatus(room.id);

    expect(emitSpy).toHaveBeenCalledWith(ROOM_STATUS_UPDATED_EVENT, {
      roomId: room.id,
      currentPlayers: 1,
      maxPlayers: room.maxPlayers,
      isFull: false,
    });
  });

  it('broadcasts room status when a player leaves but the room remains', async () => {
    const emitSpy = jest.spyOn(roomEvents, 'emit');
    const table = await service.getTable(room.id);

    table?.addPlayer({ sub: 'user-1', username: 'alice' });
    table?.addPlayer({ sub: 'user-2', username: 'bob' });

    await service.leaveCurrentRoom('user-1');

    expect(walletService.setBalance).toHaveBeenCalledWith('user-1', 1000);
    expect(emitSpy).toHaveBeenCalledWith(ROOM_STATUS_UPDATED_EVENT, {
      roomId: room.id,
      currentPlayers: 1,
      maxPlayers: room.maxPlayers,
      isFull: false,
    });
  });

  it('restores a table from a persisted snapshot', async () => {
    prisma.table.findUnique.mockResolvedValue({
      stateSnapshot: JSON.stringify({
        id: room.id,
        roomId: room.id,
        players: [
          {
            id: 'user-1',
            nickname: 'alice',
            avatar: '',
            stack: 900,
            bet: 100,
            totalBet: 100,
            status: 'ACTIVE',
            cards: ['As', 'Kd'],
            position: 0,
            isButton: true,
            isSmallBlind: false,
            isBigBlind: false,
            hasActed: true,
            ready: false,
          },
          null,
        ],
        deck: ['2c', '3d'],
        communityCards: ['Ah', 'Kh', 'Qh'],
        pot: 150,
        currentBet: 100,
        currentStage: 'FLOP',
        activePlayerIndex: 0,
        dealerIndex: 0,
        minBet: 20,
        lastHandResult: null,
        settlementEndsAt: null,
        readyCountdownEndsAt: null,
        actionEndsAt: 123456,
      }),
    });

    const table = await service.getTable(room.id);

    expect(table?.pot).toBe(150);
    expect(table?.communityCards).toEqual(['Ah', 'Kh', 'Qh']);
    expect(table?.players[0]?.stack).toBe(900);
    expect(table?.currentStage).toBe('FLOP');
    expect(table?.actionEndsAt).toBe(123456);
  });
});
