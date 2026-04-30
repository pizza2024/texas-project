import { AppGateway } from './app.gateway';
import { GameStage } from '../table-engine/table';
import { BroadcastService } from './broadcast.service';
import { TimerService } from './timer.service';

describe('AppGateway', () => {
  let tableManager: {
    getUserCurrentRoomId: jest.Mock;
    leaveCurrentRoom: jest.Mock;
    getTable: jest.Mock;
    broadcastRoomStatus: jest.Mock;
    getUserBalance: jest.Mock;
    getUserAvailableBalance: jest.Mock;
    freezePlayerBalance: jest.Mock;
    persistTableBalances: jest.Mock;
    persistTableState: jest.Mock;
    persistSettlementRecords: jest.Mock;
    registerPlayerRoom: jest.Mock;
  };
  let jwtService: {
    verify: jest.Mock;
  };
  let userService: {
    getUserAvatar: jest.Mock;
  };
  let friendService: {
    getAcceptedFriends: jest.Mock;
  };

  let gateway: AppGateway;
  let broadcastService: BroadcastService;
  // Shared state for timer mocks — allows scheduleDisconnectCleanup and
  // clearPendingDisconnect to operate on the same pendingDisconnects Map.
  let connectionState: { pendingDisconnects: Map<string, NodeJS.Timeout> };
  // Shared timer refs so setTimeout closures can clean up on afterEach.
  let timerRefs: {
    action: Map<string, ReturnType<typeof setTimeout>>;
    ready: Map<string, ReturnType<typeof setTimeout>>;
    settlement: Map<string, ReturnType<typeof setTimeout>>;
  };
  // The current table injected into timer mocks — updated each time a
  // schedule* function is called so finalize* mocks can act on it.
  let timerMockTable: any;
  // The server injected into timer mocks for broadcast calls.
  let timerMockServer: any;

  beforeEach(() => {
    connectionState = {
      pendingDisconnects: new Map<string, NodeJS.Timeout>(),
    };
    timerRefs = {
      action: new Map<string, ReturnType<typeof setTimeout>>(),
      ready: new Map<string, ReturnType<typeof setTimeout>>(),
      settlement: new Map<string, ReturnType<typeof setTimeout>>(),
    };
    timerMockTable = null;
    timerMockServer = null;
    tableManager = {
      getUserCurrentRoomId: jest.fn(),
      leaveCurrentRoom: jest.fn(),
      getTable: jest.fn(),
      broadcastRoomStatus: jest.fn(),
      getUserBalance: jest.fn().mockResolvedValue(10000),
      getUserAvailableBalance: jest.fn().mockResolvedValue(10000),
      freezePlayerBalance: jest.fn().mockResolvedValue(undefined),
      persistTableBalances: jest.fn(),
      persistTableState: jest.fn(),
      persistSettlementRecords: jest.fn().mockResolvedValue(undefined),
      registerPlayerRoom: jest.fn(),
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

    // Create a real BroadcastService so socket emission works in tests
    broadcastService = new BroadcastService();

    gateway = new AppGateway(
      tableManager as any,
      jwtService as any,
      userService as any,
      {
        getPlayerElo: jest.fn().mockResolvedValue(1000),
        hashIp: jest.fn().mockReturnValue('hash'),
        findOrCreateMatchmakingRoom: jest.fn(),
        recordPlayerJoined: jest.fn(),
        recordPlayerLeft: jest.fn(),
        updateElo: jest.fn(),
      } as any,
      {
        isAvailable: false,
        get: jest.fn().mockResolvedValue(null),
        incr: jest.fn().mockResolvedValue(null),
      } as any,
      {
        createBot: jest.fn().mockReturnValue({
          id: 'bot-1',
          nickname: '[Bot]TestBot',
          stack: 1000,
        }),
        fillTableWithBots: jest.fn(),
        removeBot: jest.fn(),
      } as any,
      { setServer: jest.fn() } as any,
      { getAcceptedFriends: jest.fn().mockResolvedValue([]) } as any,
      {
        userSockets: new Map<string, any>(),
        pendingDisconnects: new Map<string, NodeJS.Timeout>(),
        checkRateLimit: jest.fn().mockResolvedValue(true),
        checkPasswordAttemptLimit: jest.fn().mockResolvedValue('ok'),
        clearPasswordAttempts: jest.fn(),
        hasOtherActiveSocket: jest.fn().mockResolvedValue(false),
        clearPendingDisconnect: jest
          .fn()
          .mockImplementation((userId: string) => {
            const t = connectionState.pendingDisconnects.get(userId);
            if (t) {
              clearTimeout(t);
              connectionState.pendingDisconnects.delete(userId);
            }
          }),
        scheduleDisconnectCleanup: jest.fn().mockImplementation(
          (
            userId: string,
            _socketId: string,
            getUserCurrentRoomId: (uid: string) => Promise<string | null>,
            _hasOtherActiveSocketFn: any,
            withRoomLock: <T>(
              roomId: string,
              fn: () => Promise<T>,
            ) => Promise<T>,
            leaveCurrentRoom: (uid: string) => Promise<{
              roomId: string;
              dissolved: boolean;
              reachedSettlement?: boolean;
            }>,
            _getTable: any,
            _broadcastTableState: any,
            _clearRoundTimers: any,
            _schedulePostHandFlow: any,
            _isActionStage: any,
            _scheduleActionTimeout: any,
            DISCONNECT_GRACE_PERIOD_MS: number,
            _logger: any,
          ) => {
            // Clear any existing timer for this user
            const existing = connectionState.pendingDisconnects.get(userId);
            if (existing) clearTimeout(existing);
            // Store a mock timer that mirrors real scheduleDisconnectCleanup behavior
            const mockTimer = setTimeout(async () => {
              try {
                connectionState.pendingDisconnects.delete(userId);
                // Check if user reconnected while timer was pending
                if (
                  (gateway as any).connectionState.userSockets.get(userId)
                    ?.size > 0
                ) {
                  return;
                }
                const roomId = await getUserCurrentRoomId(userId);
                if (!roomId) return;
                await withRoomLock(roomId, async () => {
                  const result = await leaveCurrentRoom(userId);
                  if (!result) return;

                  if (result.dissolved) {
                    // clearRoundTimers called — nothing else to do in test
                  } else if (result.reachedSettlement) {
                    const tbl = await _getTable(roomId);
                    if (tbl) {
                      await _schedulePostHandFlow(roomId, tbl);
                      await _broadcastTableState(roomId, tbl);
                    }
                  } else {
                    const tbl = await _getTable(roomId);
                    if (tbl) {
                      if (_isActionStage(tbl.currentStage)) {
                        await _scheduleActionTimeout(roomId, tbl);
                      }
                      await _broadcastTableState(roomId, tbl);
                    }
                  }
                });
              } catch {
                // Ignore errors in mock timer path
              }
            }, DISCONNECT_GRACE_PERIOD_MS) as unknown as NodeJS.Timeout;
            connectionState.pendingDisconnects.set(userId, mockTimer);
          },
        ),
        clearAllPendingDisconnects: jest.fn(),
      } as any,
      broadcastService as any,
      {
        clearRoundTimers: jest.fn(),
        // Timer refs so tests can verify or clear timers without affecting the
        // mock implementation.
        _actionTimers: new Map<string, ReturnType<typeof setTimeout>>(),
        _readyTimers: new Map<string, ReturnType<typeof setTimeout>>(),
        _settlementTimers: new Map<string, ReturnType<typeof setTimeout>>(),
        scheduleActionTimeout: jest
          .fn()
          .mockImplementation(
            (
              _server: any,
              _roomId: string | object,
              _table: any,
              _durationMs?: number,
            ) => {
              // Handle both calling conventions:
              // 4-arg (normal): gateway.scheduleActionTimeout(server, roomId, table, durationMs?)
              // 2-arg (test direct): (gateway as any).scheduleActionTimeout(roomId, table)
              let server: any;
              let roomId: string;
              let table: any;
              let durationMs: number | undefined;
              if (
                typeof _server === 'string' &&
                _roomId &&
                typeof _roomId !== 'string'
              ) {
                // 2-arg case: _server = roomId (string), _roomId = table (object)
                server = timerMockServer ?? gateway.server;
                roomId = _server;
                table = _roomId as any;
                durationMs = _table as number | undefined;
              } else {
                // 4-arg case: _server = server, _roomId = roomId, _table = table
                server = _server;
                roomId = _roomId as string;
                table = _table;
                durationMs = _durationMs;
              }
              // Capture table/server for the timer callback
              if (table?.beginActionCountdown) {
                table.beginActionCountdown(
                  durationMs ?? TimerService.ACTION_DURATION_MS,
                );
              }
              timerMockTable = table;
              timerMockServer = server;
              // Use sync callback so jest.advanceTimersByTime* synchronously fires
              // the body — async setTimeout makes body a microtask that runs after
              // advanceTimersByTime returns, causing assertions to fire too early.
              const timer = setTimeout(() => {
                if (timerMockTable) {
                  const action = timerMockTable.getTimeoutAction();
                  if (!action) return;
                  if (action.action === 'sitout') {
                    timerMockTable.foldSitOutPlayer();
                  } else {
                    timerMockTable.processAction(
                      action.playerId,
                      action.action,
                      0,
                    );
                  }
                  if (timerMockTable.currentStage === GameStage.SETTLEMENT) {
                    timerMockTable.beginSettlementCountdown(
                      TimerService.SETTLEMENT_DURATION_MS,
                    );
                  } else if (
                    timerMockTable.currentStage === GameStage.PREFLOP ||
                    timerMockTable.currentStage === GameStage.FLOP ||
                    timerMockTable.currentStage === GameStage.TURN ||
                    timerMockTable.currentStage === GameStage.RIVER
                  ) {
                    timerMockTable.beginActionCountdown(
                      TimerService.ACTION_DURATION_MS,
                    );
                  }
                }
              }, durationMs ?? TimerService.ACTION_DURATION_MS);
              timerRefs.action.set(roomId, timer);
            },
          ),
        scheduleAutoStart: jest
          .fn()
          .mockImplementation(
            (
              _server: any,
              _roomId: string,
              table: any,
              durationMs?: number,
            ) => {
              // Capture table/server for the timer callback
              timerMockTable = table;
              timerMockServer = _server ?? gateway.server;
              // Use sync callback — async setTimeout makes body a microtask that
              // jest.advanceTimersByTimeAsync fires after the assertion runs.
              const timer = setTimeout(() => {
                if (timerMockTable) {
                  timerMockTable.clearReadyCountdown();
                  timerMockTable.startHandIfReady();
                  if (
                    timerMockTable.currentStage === GameStage.PREFLOP ||
                    timerMockTable.currentStage === GameStage.FLOP ||
                    timerMockTable.currentStage === GameStage.TURN ||
                    timerMockTable.currentStage === GameStage.RIVER
                  ) {
                    timerMockTable.beginActionCountdown(
                      TimerService.ACTION_DURATION_MS,
                    );
                  }
                }
              }, durationMs ?? TimerService.READY_COUNTDOWN_MS);
              timerRefs.ready.set(_roomId, timer);
            },
          ),
        schedulePostHandFlow: jest
          .fn()
          .mockImplementation(
            (
              _server: any,
              _roomId: string,
              table: any,
              _durationMs: number = TimerService.SETTLEMENT_DURATION_MS,
              _reuseExisting?: boolean,
            ) => {
              console.log(
                '[DEBUG schedulePostHandFlow] called with _durationMs=',
                _durationMs,
                '_reuseExisting=',
                _reuseExisting,
                'Date.now()=',
                Date.now(),
              );
              console.log(
                '[DEBUG schedulePostHandFlow] isActionStage(SETTLEMENT)=',
                (gateway as any).timerService.isActionStage(
                  GameStage.SETTLEMENT,
                ),
              );
              timerMockTable = table;
              timerMockServer = _server;
              if (!_reuseExisting && table?.beginSettlementCountdown) {
                table.beginSettlementCountdown(_durationMs);
              }
              // Use sync callback — async setTimeout makes body a microtask that
              // jest.advanceTimersByTimeAsync fires after the assertion runs.
              // The real schedulePostHandFlow's timer calls finalizeSettlement
              // which calls scheduleAutoStart. We replicate that here so the
              // ready timer (clearReadyCountdown / startHandIfReady) fires.
              // When _durationMs <= 0, call synchronously so the timer fires
              // immediately (simulates already-expired countdown in recovery tests).
              const doSettlementFlow = () => {
                console.log(
                  '[DEBUG doSettlementFlow] called, timerMockTable=',
                  !!timerMockTable,
                  'Date.now()=',
                  Date.now(),
                );
                if (timerMockTable) {
                  timerMockTable.resetToWaiting();
                  timerMockTable.beginReadyCountdown(
                    TimerService.READY_COUNTDOWN_MS,
                  );
                  gateway.scheduleAutoStart(
                    timerMockServer ?? gateway.server,
                    _roomId,
                    timerMockTable,
                    TimerService.READY_COUNTDOWN_MS,
                  );
                }
              };
              if (_durationMs <= 0) {
                console.log(
                  '[DEBUG schedulePostHandFlow] _durationMs <= 0, calling sync',
                );
                doSettlementFlow();
              } else {
                console.log(
                  '[DEBUG schedulePostHandFlow] scheduling timer for',
                  _durationMs,
                );
                const timer = setTimeout(doSettlementFlow, _durationMs);
                timerRefs.settlement.set(_roomId, timer);
              }
            },
          ),
        isActionStage: jest
          .fn()
          .mockImplementation((stage: GameStage) =>
            [
              GameStage.PREFLOP,
              GameStage.FLOP,
              GameStage.TURN,
              GameStage.RIVER,
            ].includes(stage),
          ),
        finalizeActionTimeout: jest.fn().mockResolvedValue(undefined),
        finalizeReadyCountdown: jest.fn().mockResolvedValue(undefined),
        finalizeSettlement: jest.fn().mockResolvedValue(undefined),
        ensureRecoveredRoundFlow: jest
          .fn()
          .mockImplementation((_server: any, _roomId: string, table: any) => {
            // Replicate the real TimerService.ensureRecoveredRoundFlow:
            if (
              table.currentStage === GameStage.SETTLEMENT &&
              table.settlementEndsAt
            ) {
              const remainingMs = table.settlementEndsAt - Date.now();
              if (remainingMs <= 0) {
                // Settlement timer already expired — finalize immediately
                (gateway as any).__testFinalizeSettlement(
                  _roomId,
                  timerMockServer ?? gateway.server,
                );
              } else {
                (gateway as any).schedulePostHandFlow(
                  timerMockServer ?? gateway.server,
                  _roomId,
                  table,
                  remainingMs,
                  false,
                );
              }
            }
          }),
      } as any,
      {
        startBlindTimer: jest.fn().mockResolvedValue(undefined),
        advanceBlindLevel: jest.fn().mockResolvedValue(undefined),
      } as any,
      { isClubMember: jest.fn().mockResolvedValue(true) } as any,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      {
        markRead: jest.fn(),
        markAllRead: jest.fn(),
        getNotifications: jest.fn().mockResolvedValue([]),
      } as any,
    );
    // Stable shared Maps so that in().fetchSockets() mock can be overridden
    // per-test without losing the adapter.rooms reference.
    const socketsMap = new Map<string, any>();
    const roomsMap = new Map<string, Set<string>>();

    const mockIn = jest.fn().mockReturnValue({
      fetchSockets: jest.fn().mockResolvedValue([]),
    });

    gateway.server = {
      in: mockIn,
      emit: jest.fn(),
      fetchSockets: jest.fn().mockResolvedValue([]),
      sockets: {
        sockets: socketsMap,
        adapter: { rooms: roomsMap },
      },
    } as any;

    // Expose to tests so they can populate per-test room membership:
    //   const sock = { id: 'socket-2', data: { user: { sub: 'user-2' } }, emit: jest.fn() };
    //   mockSocketsMap.set('socket-2', sock);
    //   mockRoomsMap.get('room-1').add('socket-2');
    //   (gateway.server.in as jest.Mock).mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([sock]) });
    (gateway as any)._testSocketsMap = socketsMap;
    (gateway as any)._testRoomsMap = roomsMap;
    (gateway as any)._testMockIn = mockIn;
  });

  afterEach(() => {
    gateway.onModuleDestroy();
    jest.useRealTimers();
  });

  it('syncs the room state when a seated player disconnects', async () => {
    jest.useFakeTimers();
    const remainingSocket = {
      id: 'socket-2',
      data: { user: { sub: 'user-2' } },
      emit: jest.fn(),
    };
    const table = {
      getMaskedView: jest.fn().mockReturnValue({ roomId: 'room-1' }),
    };

    // Populate the adapter.rooms map so broadcastTableState finds the socket
    const roomsMap = (gateway as any)._testRoomsMap;
    const socketsMap = (gateway as any)._testSocketsMap;
    roomsMap.set('room-1', new Set(['socket-2']));
    socketsMap.set('socket-2', remainingSocket);
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

    expect(tableManager.getUserAvailableBalance).toHaveBeenCalledWith('user-1');
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
    tableManager.getUserAvailableBalance.mockResolvedValue(0);
    tableManager.getTable.mockResolvedValue(table);

    const result = await gateway.handleJoinRoom(client as any, {
      roomId: 'room-1',
    });

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

  it('prevents the same user from joining multiple rooms concurrently', async () => {
    const client = {
      data: { user: { sub: 'user-1', username: 'alice' } },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
    };
    const roomOneTable = {
      smallBlind: 10,
      bigBlind: 20,
      minBuyIn: 20,
      hasPlayer: jest.fn().mockReturnValue(false),
      addPlayer: jest.fn().mockReturnValue(true),
      getMaskedView: jest.fn().mockReturnValue({ roomId: 'room-1' }),
    };
    const roomSocket = {
      data: { user: { sub: 'user-1' } },
      emit: jest.fn(),
    };

    let roomLookupCount = 0;
    tableManager.getUserCurrentRoomId.mockImplementation(async () => {
      roomLookupCount += 1;
      if (roomLookupCount <= 2) {
        return null;
      }
      return 'room-1';
    });
    tableManager.getTable.mockImplementation(async (roomId: string) => {
      if (roomId === 'room-1') {
        return roomOneTable;
      }
      return undefined;
    });
    (gateway.server.in as jest.Mock).mockReturnValue({
      fetchSockets: jest.fn().mockResolvedValue([roomSocket]),
    });

    const joinOne = gateway.handleJoinRoom(client as any, { roomId: 'room-1' });
    const joinTwo = gateway.handleJoinRoom(client as any, { roomId: 'room-2' });

    const [resultOne, resultTwo] = await Promise.all([joinOne, joinTwo]);

    expect(resultOne).toEqual({
      event: 'joined',
      data: { roomId: 'room-1' },
    });
    expect(resultTwo).toEqual({
      event: 'already_in_room',
      data: {
        roomId: 'room-1',
        targetRoomId: 'room-2',
        canSwitch: true,
      },
    });
    expect(client.emit).toHaveBeenCalledWith('already_in_room', {
      roomId: 'room-1',
      targetRoomId: 'room-2',
      canSwitch: true,
    });
    expect(tableManager.getTable).toHaveBeenCalledTimes(1);
    expect(tableManager.getTable).toHaveBeenCalledWith('room-1');
  });

  it('rebuilds an in-progress settlement timer from restored state', async () => {
    jest.useFakeTimers();
    const roomSocket = {
      data: { user: { sub: 'user-1' } },
      emit: jest.fn(),
    };
    const table = {
      currentStage: GameStage.SETTLEMENT,
      settlementEndsAt: (Date.now() + 2000) as number | null,
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
        table.settlementEndsAt = null as number | null;
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
      isCurrentPlayerSitOut: jest.fn().mockReturnValue(false),
      foldSitOutPlayer: jest.fn().mockReturnValue(false),
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
      isCurrentPlayerSitOut: jest.fn().mockReturnValue(false),
      foldSitOutPlayer: jest.fn().mockReturnValue(false),
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
