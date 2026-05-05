import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Server } from 'socket.io';
import { TableManagerService } from '../table-engine/table-manager.service';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { BroadcastService } from './broadcast.service';
import { GameStage } from '../table-engine/table';
import { MissionService } from '../mission/mission.service';
import { BadBeatJackpotService } from '../table-engine/badbeat.service';
/**
 * TimerService extracts round-timer management from AppGateway.
 * Manages three timer types: action timeouts, settlement delays, and auto-start countdowns.
 */
@Injectable()
export class TimerService implements OnModuleDestroy {
  // ── Constants (also accessible as TimerService.CONST for backward compat) ───
  static readonly DISCONNECT_GRACE_PERIOD_MS = 15_000;
  static readonly SETTLEMENT_DURATION_MS = 5_000;
  static readonly READY_COUNTDOWN_MS = 5_000;
  static readonly ACTION_DURATION_MS = 20_000;
  readonly logger = new Logger(TimerService.name);

  private readonly actionTimers = new Map<string, NodeJS.Timeout>();
  private readonly settlementTimers = new Map<string, NodeJS.Timeout>();
  private readonly autoStartTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly tableManager: TableManagerService,
    private readonly matchmakingService: MatchmakingService,
    private readonly broadcastService: BroadcastService,
    private readonly badBeatService: BadBeatJackpotService,
  ) {}

  onModuleDestroy() {
    for (const t of this.actionTimers.values()) clearTimeout(t);
    this.actionTimers.clear();
    for (const t of this.settlementTimers.values()) clearTimeout(t);
    this.settlementTimers.clear();
    for (const t of this.autoStartTimers.values()) clearTimeout(t);
    this.autoStartTimers.clear();
  }

  // ── Timer accessors for AppGateway ─────────────────────────────────────────

  clearRoundTimers(roomId: string) {
    const a = this.actionTimers.get(roomId);
    if (a) {
      clearTimeout(a);
      this.actionTimers.delete(roomId);
    }

    const s = this.settlementTimers.get(roomId);
    if (s) {
      clearTimeout(s);
      this.settlementTimers.delete(roomId);
    }

    const r = this.autoStartTimers.get(roomId);
    if (r) {
      clearTimeout(r);
      this.autoStartTimers.delete(roomId);
    }
  }

  // ── Action timeout ─────────────────────────────────────────────────────────

  async finalizeActionTimeout(
    roomId: string,
    server: import('socket.io').Server,
  ) {
    this.actionTimers.delete(roomId);
    const currentTable = await this.tableManager.getTable(roomId);
    if (!currentTable || !this.isActionStage(currentTable.currentStage)) {
      return;
    }

    if (currentTable.isCurrentPlayerSitOut()) {
      const processed = currentTable.foldSitOutPlayer();
      if (!processed) {
        // Player hit 3x consecutive timeouts and was force-sitout
        const timeoutAction = currentTable.getTimeoutAction();
        if (timeoutAction && timeoutAction.action === 'sitout') {
          server.to(roomId).emit('player_sitout', {
            playerId: timeoutAction.playerId,
            roomId,
            message: '您因连续3次超时，已被强制设为旁观状态',
          });
        }
        if (this.isActionStage(currentTable.currentStage)) {
          await this.scheduleActionTimeout(server, roomId, currentTable);
        }
        return;
      }
      const nextStage = currentTable.currentStage as GameStage;
      await this.tableManager.persistTableState(roomId);
      await this.tableManager.persistTableBalances(roomId);
      if (nextStage === GameStage.SETTLEMENT) {
        await this.schedulePostHandFlow(server, roomId, currentTable);
      } else if (this.isActionStage(nextStage)) {
        await this.scheduleActionTimeout(server, roomId, currentTable);
      }
      await this.broadcastService.broadcastTableState(
        server,
        roomId,
        currentTable,
      );
      return;
    }

    const timeoutAction = currentTable.getTimeoutAction();
    if (!timeoutAction) {
      return;
    }

    let processed = false;

    if (timeoutAction.action === 'sitout') {
      processed = currentTable.foldSitOutPlayer();
    } else {
      processed = currentTable.processAction(
        timeoutAction.playerId,
        timeoutAction.action,
        0,
      );
    }

    if (!processed) {
      if (this.isActionStage(currentTable.currentStage)) {
        await this.scheduleActionTimeout(server, roomId, currentTable);
      }
      return;
    }

    const nextStage = currentTable.currentStage as GameStage;
    await this.tableManager.persistTableState(roomId);
    await this.tableManager.persistTableBalances(roomId);
    if (nextStage === GameStage.SETTLEMENT) {
      await this.schedulePostHandFlow(server, roomId, currentTable);
      await this.broadcastService.broadcastTableState(
        server,
        roomId,
        currentTable,
      );
      return;
    }
    if (this.isActionStage(nextStage)) {
      await this.scheduleActionTimeout(server, roomId, currentTable);
    }

    await this.broadcastService.broadcastTableState(
      server,
      roomId,
      currentTable,
    );
  }

  async scheduleActionTimeout(
    server: import('socket.io').Server,
    roomId: string,
    table: import('../table-engine/table').Table,
    durationMs = TimerService.ACTION_DURATION_MS,
    reuseExistingCountdown = false,
  ) {
    const existing = this.actionTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
    }

    if (!this.isActionStage(table.currentStage)) {
      table.clearActionCountdown();
      this.actionTimers.delete(roomId);
      return;
    }

    if (!reuseExistingCountdown) {
      table.beginActionCountdown(durationMs);
      await this.tableManager.persistTableState(roomId);
    }

    const timer = setTimeout(async () => {
      try {
        await this.finalizeActionTimeout(roomId, server);
      } catch (err) {
        this.logger.error(
          `scheduleActionTimeout finalize error for room ${roomId}: ${(err as Error).message}`,
        );
      }
    }, durationMs);

    this.actionTimers.set(roomId, timer);
  }

  // ── Ready countdown ─────────────────────────────────────────────────────────

  async finalizeReadyCountdown(
    roomId: string,
    server: import('socket.io').Server,
  ) {
    this.autoStartTimers.delete(roomId);
    const currentTable = await this.tableManager.getTable(roomId);
    if (!currentTable || currentTable.currentStage !== GameStage.WAITING) {
      return;
    }

    currentTable.clearReadyCountdown();
    currentTable.startHandIfReady();
    await this.tableManager.persistTableBalances(roomId);
    if (this.isActionStage(currentTable.currentStage)) {
      await this.scheduleActionTimeout(server, roomId, currentTable);
    } else {
      await this.tableManager.persistTableState(roomId);
    }
    await this.broadcastService.broadcastTableState(
      server,
      roomId,
      currentTable,
    );
  }

  async scheduleAutoStart(
    server: import('socket.io').Server,
    roomId: string,
    table: import('../table-engine/table').Table,
    durationMs = TimerService.READY_COUNTDOWN_MS,
    reuseExistingCountdown = false,
  ) {
    const existing = this.autoStartTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
    }

    if (!reuseExistingCountdown) {
      table.beginReadyCountdown(durationMs);
      await this.tableManager.persistTableState(roomId);
    }

    const timer = setTimeout(async () => {
      try {
        await this.finalizeReadyCountdown(roomId, server);
      } catch (err) {
        this.logger.error(
          `scheduleAutoStart finalize error for room ${roomId}: ${(err as Error).message}`,
        );
      }
    }, durationMs);

    this.autoStartTimers.set(roomId, timer);
  }

  // ── Settlement ─────────────────────────────────────────────────────────────

  async finalizeSettlement(roomId: string, server: import('socket.io').Server) {
    this.settlementTimers.delete(roomId);
    const currentTable = await this.tableManager.getTable(roomId);
    if (!currentTable || currentTable.currentStage !== GameStage.SETTLEMENT) {
      return;
    }

    const handResult = currentTable.lastHandResult
      ? [...currentTable.lastHandResult]
      : [];

    // ── Bad Beat Jackpot: check and distribute before normal settlement persists ──
    const showdownEligiblePlayers = currentTable.players
      .filter(
        (p): p is import('../table-engine/player').Player =>
          p !== null && p.status !== 'FOLD',
      )
      .map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        cards: p.cards ?? [],
        status: p.status,
        totalBet: p.totalBet,
      }));

    if (showdownEligiblePlayers.length >= 2) {
      const allInPlayerIds = currentTable.players
        .filter(
          (p): p is import('../table-engine/player').Player =>
            p !== null && p.status === 'ALLIN',
        )
        .map((p) => p.id);

      const showdownHandId = `hand-${roomId}-${Date.now()}`;
      const showdownResult = {
        handId: showdownHandId,
        tableId: roomId,
        roomId,
        pot: currentTable.pot + currentTable.rakeAmount,
        communityCards: currentTable.communityCards,
        players: showdownEligiblePlayers,
        allInPlayerIds,
        winnerId:
          handResult.length > 0
            ? handResult.reduce((a, b) => (b.winAmount > a.winAmount ? b : a))
                .playerId
            : (showdownEligiblePlayers[0]?.playerId ?? ''),
      };

      const badBeatResult =
        await this.badBeatService.recordAndDistribute(showdownResult);
      if (badBeatResult?.triggered && badBeatResult.eligible) {
        const bbJackpot = await this.tableManager[
          'prisma'
        ].badBeatJackpot.findFirst({
          where: { handId: showdownHandId },
          select: { jackpotAmount: true },
        });
        const jackpotBigInt = bbJackpot?.jackpotAmount ?? 0n;
        const jackpotAmount = Number(jackpotBigInt);
        const loserPayout = (jackpotBigInt * 50n) / 100n;
        const winnerPayout = (jackpotBigInt * 25n) / 100n;

        server.to(roomId).emit('bad_beat_jackpot', {
          handId: showdownHandId,
          jackpotAmount,
          pot: showdownResult.pot,
          loser: {
            userId: badBeatResult.eligible.loserId,
            nickname:
              showdownEligiblePlayers.find(
                (p) => p.playerId === badBeatResult.eligible!.loserId,
              )?.nickname ?? '',
            hand: badBeatResult.eligible.loserHand,
            netLoss: badBeatResult.eligible.netLoss,
            payout: Number(loserPayout),
          },
          winner: {
            userId: badBeatResult.eligible.winnerId,
            nickname:
              showdownEligiblePlayers.find(
                (p) => p.playerId === badBeatResult.eligible!.winnerId,
              )?.nickname ?? '',
            hand: badBeatResult.eligible.winnerHand,
            payout: Number(winnerPayout),
          },
          tablePlayers: currentTable.players
            .filter(
              (p): p is import('../table-engine/player').Player =>
                p !== null &&
                p.id !== badBeatResult.eligible!.loserId &&
                p.id !== badBeatResult.eligible!.winnerId,
            )
            .map((p) => ({ userId: p.id, nickname: p.nickname, payout: 0 })),
          animationDurationMs: 5000,
        });
      }
    }

    await this.tableManager.persistSettlementRecords(roomId);

    if (handResult.length > 0) {
      this.matchmakingService.updateElo(handResult).catch((err) => {
        this.logger.error(`ELO update failed for room ${roomId}`, err);
      });
    }

    currentTable.resetToWaiting();
    await this.tableManager.persistTableState(roomId);
    await this.tableManager.persistTableBalances(roomId);
    await this.scheduleAutoStart(server, roomId, currentTable);
    await this.broadcastService.broadcastTableState(
      server,
      roomId,
      currentTable,
    );
  }

  async schedulePostHandFlow(
    server: import('socket.io').Server,
    roomId: string,
    table: import('../table-engine/table').Table,
    durationMs = TimerService.SETTLEMENT_DURATION_MS,
    reuseExistingCountdown = false,
  ) {
    this.clearRoundTimers(roomId);
    if (!reuseExistingCountdown) {
      table.beginSettlementCountdown(durationMs);
      await this.tableManager.persistTableState(roomId);
    }

    const timer = setTimeout(async () => {
      try {
        await this.finalizeSettlement(roomId, server);
      } catch (err) {
        this.logger.error(
          `schedulePostHandFlow settlement error for room ${roomId}: ${(err as Error).message}`,
        );
      }
    }, durationMs);

    this.settlementTimers.set(roomId, timer);
  }

  // ── Recovery helpers ────────────────────────────────────────────────────────

  isActionStage(stage: GameStage) {
    return (
      stage === GameStage.PREFLOP ||
      stage === GameStage.FLOP ||
      stage === GameStage.TURN ||
      stage === GameStage.RIVER
    );
  }

  async ensureRecoveredRoundFlow(
    server: import('socket.io').Server,
    roomId: string,
    table: import('../table-engine/table').Table,
  ) {
    if (this.isActionStage(table.currentStage)) {
      if (!table.actionEndsAt) {
        if (!this.actionTimers.has(roomId)) {
          await this.scheduleActionTimeout(server, roomId, table);
        }
        return;
      }

      const remainingMs = table.actionEndsAt - Date.now();
      if (remainingMs <= 0) {
        await this.finalizeActionTimeout(roomId, server);
        return;
      }

      if (!this.actionTimers.has(roomId)) {
        await this.scheduleActionTimeout(
          server,
          roomId,
          table,
          remainingMs,
          true,
        );
      }
      return;
    }

    if (table.currentStage === GameStage.SETTLEMENT && table.settlementEndsAt) {
      const remainingMs = table.settlementEndsAt - Date.now();
      if (remainingMs <= 0) {
        await this.finalizeSettlement(roomId, server);
        return;
      }

      if (!this.settlementTimers.has(roomId)) {
        await this.schedulePostHandFlow(
          server,
          roomId,
          table,
          remainingMs,
          true,
        );
      }
      return;
    }

    if (
      table.currentStage === GameStage.WAITING &&
      table.readyCountdownEndsAt
    ) {
      const remainingMs = table.readyCountdownEndsAt - Date.now();
      if (remainingMs <= 0) {
        await this.finalizeReadyCountdown(roomId, server);
        return;
      }

      if (!this.autoStartTimers.has(roomId)) {
        await this.scheduleAutoStart(server, roomId, table, remainingMs, true);
      }
    }
  }
}
