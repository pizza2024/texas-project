import { GameStage } from '../table-engine/table';

// Reproduction of "runs settlement countdown" test flow
describe('Settlement Flow Debug', () => {
  let timerMockTable: any;
  let timerMockServer: any;
  let timerRefs: {
    action: Map<string, ReturnType<typeof setTimeout>>;
    ready: Map<string, ReturnType<typeof setTimeout>>;
    settlement: Map<string, ReturnType<typeof setTimeout>>;
  };

  beforeEach(() => {
    timerMockTable = null;
    timerMockServer = null;
    timerRefs = {
      action: new Map(),
      ready: new Map(),
      settlement: new Map(),
    };
  });

  it('reproduces the full settlement→ready→auto-start flow with manual timer tracking', async () => {
    jest.useFakeTimers();

    const table = {
      currentStage: GameStage.PREFLOP,
      actionEndsAt: null as number | null,
      readyCountdownEndsAt: null as number | null,
      processAction: jest.fn((_userId: string, _action: string, _amount: number) => {
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

    const SETTLEMENT_DURATION_MS = 5000;
    const READY_COUNTDOWN_MS = 5000;
    const ACTION_DURATION_MS = 20000;

    // ---- Mock schedulePostHandFlow ----
    const mockSchedulePostHandFlow = (
      _server: any,
      _roomId: string,
      _table: any,
    ) => {
      if (_table?.beginSettlementCountdown) {
        _table.beginSettlementCountdown(SETTLEMENT_DURATION_MS);
      }
      timerMockTable = _table;
      timerMockServer = _server;
      const timer = setTimeout(() => {
        // Settlement timer fires: call resetToWaiting and scheduleAutoStart
        if (timerMockTable) {
          timerMockTable.resetToWaiting();
          timerMockTable.beginReadyCountdown(READY_COUNTDOWN_MS);
          // scheduleAutoStart should be called at end of settlement
          // For now, manually schedule the ready timer like scheduleAutoStart does
          const readyTimer = setTimeout(() => {
            if (timerMockTable) {
              timerMockTable.clearReadyCountdown();
              timerMockTable.startHandIfReady();
              if (
                timerMockTable.currentStage === GameStage.PREFLOP ||
                timerMockTable.currentStage === GameStage.FLOP ||
                timerMockTable.currentStage === GameStage.TURN ||
                timerMockTable.currentStage === GameStage.RIVER
              ) {
                timerMockTable.beginActionCountdown(ACTION_DURATION_MS);
              }
            }
          }, READY_COUNTDOWN_MS);
          timerRefs.ready.set(_roomId, readyTimer);
        }
      }, SETTLEMENT_DURATION_MS);
      timerRefs.settlement.set(_roomId, timer);
    };

    // Step 1: handlePlayerAction completes, transitions to SETTLEMENT
    table.processAction('user-1', 'call', 0);

    // Step 2: schedulePostHandFlow is called (like finalizeActionTimeout does)
    mockSchedulePostHandFlow(null, 'room-1', table);

    // First advance: settlement timer fires, ready timer is created
    await jest.advanceTimersByTimeAsync(SETTLEMENT_DURATION_MS);

    // Verify settlement phase
    expect(table.resetToWaiting).toHaveBeenCalled();
    expect(table.beginReadyCountdown).toHaveBeenCalledWith(5000);
    expect(table.clearReadyCountdown).not.toHaveBeenCalled(); // Not yet
    expect(table.startHandIfReady).not.toHaveBeenCalled(); // Not yet

    // Second advance: ready timer fires
    await jest.advanceTimersByTimeAsync(READY_COUNTDOWN_MS);

    // Verify ready phase
    expect(table.clearReadyCountdown).toHaveBeenCalled();
    expect(table.startHandIfReady).toHaveBeenCalled();
  });
});
