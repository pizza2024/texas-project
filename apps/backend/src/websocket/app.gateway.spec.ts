import { AppGateway } from './app.gateway';
import { GameStage } from '../table-engine/table';

describe('AppGateway', () => {
  let tableManager: {
    getUserCurrentRoomId: jest.Mock;
    leaveCurrentRoom: jest.Mock;
    getTable: jest.Mock;
    broadcastRoomStatus: jest.Mock;
    getUserBalance: jest.Mock;
    persistTableBalances: jest.Mock;
    persistTableState: jest.Mock;
  };
  let jwtService: {
    verify: jest.Mock;
  };
  let userService: {
    getUserAvatar: jest.Mock;
  };
  let gateway: AppGateway;

  beforeEach(() => {
    tableManager = {
      getUserCurrentRoomId: jest.fn(),
      leaveCurrentRoom: jest.fn(),
      getTable: jest.fn(),
      broadcastRoomStatus: jest.fn(),
      getUserBalance: jest.fn().mockResolvedValue(10000),
      persistTableBalances: jest.fn(),
      persistTableState: jest.fn(),
    };
    jwtService = {
      verify: jest.fn().mockReturnValue({
        sub: 'user-1',
        username: 'alice',
      }),
    };
    userService = {
      getUserAvatar: jest.fn().mockResolvedValue(null),
    };

    gateway = new AppGateway(tableManager as any, jwtService as any, userService as any);
    gateway.server = {
      in: jest.fn(),
      emit: jest.fn(),
      fetchSockets: jest.fn().mockResolvedValue([]),
    } as any;
  });

  afterEach(() => {
    gateway.onModuleDestroy();
    jest.useRealTimers();
  });

  it('syncs the room state when a seated player disconnects', async () => {
    jest.useFakeTimers();
    const remainingSocket = {
      data: { user: { sub: 'user-2' } },
      emit: jest.fn(),
    };
    const table = {
      getMaskedView: jest.fn().mockReturnValue({ roomId: 'room-1' }),
    };

    (gateway.server.in as jest.Mock).mockReturnValue({
      fetchSockets: jest.fn().mockResolvedValue([remainingSocket]),
    });
    tableManager.getUserCurrentRoomId.mockReturnValue('room-1');
    tableManager.leaveCurrentRoom.mockResolvedValue({
      roomId: 'room-1',
      dissolved: false,
    });
    tableManager.getTable.mockResolvedValue(table);

    await gateway.handleDisconnect({
      id: 'socket-1',
      data: { user: { sub: 'user-1' } },
    } as any);

    expect(tableManager.leaveCurrentRoom).not.toHaveBeenCalled();

    await jest.runOnlyPendingTimersAsync();

    expect(tableManager.leaveCurrentRoom).toHaveBeenCalledWith('user-1');
    expect(tableManager.getTable).toHaveBeenCalledWith('room-1');
    expect(table.getMaskedView).toHaveBeenCalledWith('user-2');
    expect(remainingSocket.emit).toHaveBeenCalledWith('room_update', {
      roomId: 'room-1',
    });
  });

  it('does nothing when the disconnected client is not in a room', async () => {
    tableManager.getUserCurrentRoomId.mockReturnValue(null);

    await gateway.handleDisconnect({
      id: 'socket-2',
      data: { user: { sub: 'user-1' } },
    } as any);

    expect(tableManager.leaveCurrentRoom).not.toHaveBeenCalled();
    expect(tableManager.getTable).not.toHaveBeenCalled();
  });

  it('does not remove the player when another socket for the same user is still active', async () => {
    (gateway.server.fetchSockets as jest.Mock).mockResolvedValue([
      {
        id: 'socket-2',
        data: { user: { sub: 'user-1' } },
      },
    ]);
    tableManager.getUserCurrentRoomId.mockReturnValue('room-1');

    await gateway.handleDisconnect({
      id: 'socket-1',
      data: { user: { sub: 'user-1' } },
    } as any);

    expect(tableManager.leaveCurrentRoom).not.toHaveBeenCalled();
    expect(tableManager.getTable).not.toHaveBeenCalled();
  });

  it('cancels pending room cleanup when the user reconnects before the grace period ends', async () => {
    jest.useFakeTimers();
    tableManager.getUserCurrentRoomId.mockReturnValue('room-1');

    await gateway.handleDisconnect({
      id: 'socket-1',
      data: { user: { sub: 'user-1' } },
    } as any);

    await gateway.handleConnection({
      id: 'socket-2',
      handshake: { query: { token: 'token-1' } },
      data: {},
      disconnect: jest.fn(),
    } as any);

    await jest.runOnlyPendingTimersAsync();

    expect(jwtService.verify).toHaveBeenCalledWith('token-1');
    expect(tableManager.leaveCurrentRoom).not.toHaveBeenCalled();
  });

  it('runs settlement countdown, enters ready countdown, and then auto-starts the next hand', async () => {
    jest.useFakeTimers();
    const roomSocket = {
      data: { user: { sub: 'user-1' } },
      emit: jest.fn(),
    };
    const table = {
      currentStage: GameStage.PREFLOP,
      actionEndsAt: null as number | null,
      readyCountdownEndsAt: null as number | null,
      processAction: jest.fn(() => {
        table.currentStage = GameStage.SETTLEMENT;
        table.actionEndsAt = null;
        return true;
      }),
      beginActionCountdown: jest.fn((durationMs: number) => {
        table.actionEndsAt = Date.now() + durationMs;
      }),
      clearActionCountdown: jest.fn(),
      beginSettlementCountdown: jest.fn(),
      resetToWaiting: jest.fn(() => {
        table.currentStage = GameStage.WAITING;
      }),
      beginReadyCountdown: jest.fn(() => {
        table.readyCountdownEndsAt = Date.now() + 5000;
      }),
      clearReadyCountdown: jest.fn(() => {
        table.readyCountdownEndsAt = null;
      }),
      startHandIfReady: jest.fn(),
      getMaskedView: jest.fn().mockReturnValue({ roomId: 'room-1' }),
    };

    (gateway.server.in as jest.Mock).mockReturnValue({
      fetchSockets: jest.fn().mockResolvedValue([roomSocket]),
    });
    tableManager.getTable.mockResolvedValue(table);

    await gateway.handlePlayerAction(
      { data: { user: { sub: 'user-1' } } } as any,
      { action: 'call', roomId: 'room-1' },
    );

    expect(table.processAction).toHaveBeenCalledWith('user-1', 'call', 0);
    expect(tableManager.persistTableState).toHaveBeenCalledWith('room-1');
    expect(tableManager.persistTableBalances).toHaveBeenCalledWith('room-1');
    expect(table.beginSettlementCountdown).toHaveBeenCalledWith(5000);

    await jest.advanceTimersByTimeAsync(5000);

    expect(table.resetToWaiting).toHaveBeenCalled();
    expect(tableManager.persistTableState).toHaveBeenCalledWith('room-1');
    expect(tableManager.persistTableBalances).toHaveBeenCalledWith('room-1');
    expect(table.beginReadyCountdown).toHaveBeenCalledWith(5000);

    await jest.advanceTimersByTimeAsync(5000);

    expect(table.clearReadyCountdown).toHaveBeenCalled();
    expect(table.startHandIfReady).toHaveBeenCalled();
  });

  it('loads the persisted balance when a player joins a room', async () => {
    const client = {
      data: { user: { sub: 'user-1', username: 'alice' } },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
    };
    const table = {
      smallBlind: 10,
      bigBlind: 20,
      hasPlayer: jest.fn().mockReturnValue(false),
      addPlayer: jest.fn().mockReturnValue(true),
      getMaskedView: jest.fn().mockReturnValue({ roomId: 'room-1' }),
    };
    const roomSocket = {
      data: { user: { sub: 'user-1' } },
      emit: jest.fn(),
    };

    tableManager.getUserCurrentRoomId.mockReturnValue(null);
    tableManager.getTable.mockResolvedValue(table);
    (gateway.server.in as jest.Mock).mockReturnValue({
      fetchSockets: jest.fn().mockResolvedValue([roomSocket]),
    });

    await gateway.handleJoinRoom(client as any, { roomId: 'room-1' });

    expect(tableManager.getUserBalance).toHaveBeenCalledWith('user-1');
    expect(table.addPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1' }),
      10000,
    );
  });

  it('rejects joining a room when the player has no balance', async () => {
    const client = {
      data: { user: { sub: 'user-1', username: 'alice' } },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
    };
    const table = {
      smallBlind: 10,
      bigBlind: 20,
      minBuyIn: 20,
      hasPlayer: jest.fn().mockReturnValue(false),
      addPlayer: jest.fn(),
      getMaskedView: jest.fn(),
    };

    tableManager.getUserCurrentRoomId.mockReturnValue(null);
    tableManager.getUserBalance.mockResolvedValue(0);
    tableManager.getTable.mockResolvedValue(table);

    const result = await gateway.handleJoinRoom(client as any, { roomId: 'room-1' });

    expect(client.emit).toHaveBeenCalledWith('insufficient_balance', {
      roomId: 'room-1',
      balance: 0,
      minimumRequiredBalance: 20,
    });
    expect(client.join).not.toHaveBeenCalled();
    expect(table.addPlayer).not.toHaveBeenCalled();
    expect(result).toEqual({
      event: 'insufficient_balance',
      data: { roomId: 'room-1', balance: 0, minimumRequiredBalance: 20 },
    });
  });

  it('rebuilds an in-progress settlement timer from restored state', async () => {
    jest.useFakeTimers();
    const roomSocket = {
      data: { user: { sub: 'user-1' } },
      emit: jest.fn(),
    };
    const table = {
      currentStage: GameStage.SETTLEMENT,
      settlementEndsAt: Date.now() + 2000,
      readyCountdownEndsAt: null as number | null,
      smallBlind: 10,
      bigBlind: 20,
      hasPlayer: jest.fn().mockReturnValue(false),
      addPlayer: jest.fn().mockReturnValue(true),
      beginReadyCountdown: jest.fn(() => {
        table.readyCountdownEndsAt = Date.now() + 5000;
      }),
      resetToWaiting: jest.fn(() => {
        table.currentStage = GameStage.WAITING;
        table.settlementEndsAt = null;
      }),
      getMaskedView: jest.fn().mockReturnValue({ roomId: 'room-1' }),
    };
    const client = {
      data: { user: { sub: 'user-1', username: 'alice' } },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
    };

    tableManager.getUserCurrentRoomId.mockResolvedValue(null);
    tableManager.getTable.mockResolvedValue(table);
    (gateway.server.in as jest.Mock).mockReturnValue({
      fetchSockets: jest.fn().mockResolvedValue([roomSocket]),
    });

    await gateway.handleJoinRoom(client as any, { roomId: 'room-1' });
    await jest.advanceTimersByTimeAsync(2000);

    expect(table.resetToWaiting).toHaveBeenCalled();
    expect(table.beginReadyCountdown).toHaveBeenCalledWith(5000);
  });

  it('auto-checks on timeout when checking is allowed and then schedules the next action timer', async () => {
    jest.useFakeTimers();
    const roomSocket = {
      data: { user: { sub: 'user-1' } },
      emit: jest.fn(),
    };
    const table = {
      currentStage: GameStage.PREFLOP,
      actionEndsAt: null as number | null,
      beginActionCountdown: jest.fn((durationMs: number) => {
        table.actionEndsAt = Date.now() + durationMs;
      }),
      clearActionCountdown: jest.fn(),
      getTimeoutAction: jest.fn().mockReturnValue({
        playerId: 'user-1',
        action: 'check',
      }),
      processAction: jest.fn(() => true),
      getMaskedView: jest.fn().mockReturnValue({ roomId: 'room-1' }),
    };

    (gateway.server.in as jest.Mock).mockReturnValue({
      fetchSockets: jest.fn().mockResolvedValue([roomSocket]),
    });
    tableManager.getTable.mockResolvedValue(table);

    await gateway.handlePlayerAction(
      { data: { user: { sub: 'user-1' } } } as any,
      { action: 'call', roomId: 'room-1' },
    );

    expect(table.beginActionCountdown).toHaveBeenCalledWith(20000);

    await jest.advanceTimersByTimeAsync(20000);

    expect(table.getTimeoutAction).toHaveBeenCalled();
    expect(table.processAction).toHaveBeenCalledWith('user-1', 'check', 0);
  });

  it('auto-folds on timeout when checking is not allowed', async () => {
    jest.useFakeTimers();
    const roomSocket = {
      data: { user: { sub: 'user-1' } },
      emit: jest.fn(),
    };
    const table = {
      currentStage: GameStage.TURN,
      actionEndsAt: null as number | null,
      beginActionCountdown: jest.fn((durationMs: number) => {
        table.actionEndsAt = Date.now() + durationMs;
      }),
      clearActionCountdown: jest.fn(),
      getTimeoutAction: jest
        .fn()
        .mockReturnValueOnce({
          playerId: 'user-2',
          action: 'fold',
        })
        .mockReturnValue(null),
      processAction: jest.fn(() => {
        table.currentStage = GameStage.SETTLEMENT;
        return true;
      }),
      beginSettlementCountdown: jest.fn(),
      getMaskedView: jest.fn().mockReturnValue({ roomId: 'room-1' }),
    };

    (gateway.server.in as jest.Mock).mockReturnValue({
      fetchSockets: jest.fn().mockResolvedValue([roomSocket]),
    });
    tableManager.getTable.mockResolvedValue(table);

    await (gateway as any).scheduleActionTimeout('room-1', table);
    await jest.advanceTimersByTimeAsync(20000);

    expect(table.processAction).toHaveBeenCalledWith('user-2', 'fold', 0);
    expect(table.beginSettlementCountdown).toHaveBeenCalledWith(5000);
  });
});
