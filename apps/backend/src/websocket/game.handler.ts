/**
 * Game event handlers for the WebSocket gateway.
 *
 * Each handler is a standalone async function that receives the gateway
 * instance as its first parameter, allowing access to all gateway
 * methods (withRoomLock, broadcastTableState, etc.) and injected services.
 *
 * No business logic is changed — only code movement from app.gateway.ts.
 */
import { Socket } from 'socket.io';
import * as bcrypt from 'bcrypt';
import { BlindTier, BLIND_TIERS } from '../matchmaking/matchmaking.service';
import { GameStage } from '../table-engine/table';
import { AppGateway } from './app.gateway';
import { validate } from './validate';
import {
  JoinRoomSchema,
  PlayerActionInput,
  PlayerActionSchema,
  QuickMatchSchema,
} from '@texas/shared/validation';

import {
  SOLO_READY_COUNTDOWN_MS,
  MAX_CHIP_AMOUNT,
  VALID_ACTIONS_SET,
  PlayerAction,
} from './constants';

// ---------------------------------------------------------------------------
// Handler: join_room
// ---------------------------------------------------------------------------

export async function handleJoinRoom(
  gateway: AppGateway,
  client: Socket,
  data: { roomId: string; password?: string },
) {
  const validated = validate(JoinRoomSchema, data, client, 'join_room');
  if (!validated) {
    return { event: 'error', data: 'Invalid request' };
  }
  const { roomId, password } = validated;
  const userId = client.data.user?.sub as string;

  if (!(await gateway.checkRateLimit(userId))) {
    client.emit('rate_limited', {
      message: 'Too many join attempts, please slow down',
    });
    return;
  }

  return gateway.withUserLock(userId, async () => {
    const currentRoomId =
      await gateway.tableManager.getUserCurrentRoomId(userId);
    if (currentRoomId && currentRoomId !== roomId) {
      client.emit('already_in_room', {
        roomId: currentRoomId,
        targetRoomId: roomId,
        canSwitch: true,
      });
      return {
        event: 'already_in_room',
        data: {
          roomId: currentRoomId,
          targetRoomId: roomId,
          canSwitch: true,
        },
      };
    }

    return gateway.withRoomLock(roomId, async () => {
      const verifiedCurrentRoomId =
        await gateway.tableManager.getUserCurrentRoomId(userId);
      if (verifiedCurrentRoomId && verifiedCurrentRoomId !== roomId) {
        client.emit('already_in_room', {
          roomId: verifiedCurrentRoomId,
          targetRoomId: roomId,
          canSwitch: true,
        });
        return {
          event: 'already_in_room',
          data: {
            roomId: verifiedCurrentRoomId,
            targetRoomId: roomId,
            canSwitch: true,
          },
        };
      }

      const table = await gateway.tableManager.getTable(roomId);
      if (!table) {
        return { event: 'error', data: 'Room not found' };
      }

      // Club-exclusive room: verify user is a club member
      const room = await gateway.roomService.findOne(roomId);
      if (room?.isClubOnly && room.clubId) {
        const isMember = await gateway.clubService.isClubMember(
          userId,
          room.clubId,
        );
        if (!isMember) {
          client.emit('access_denied', {
            message: 'This room is exclusive to club members',
            roomId,
          });
          return { event: 'access_denied', data: { roomId } };
        }
      }

      // Password brute-force protection — check before verifying password
      const rawIp = client.handshake?.address ?? '0.0.0.0';
      const ipHash = gateway.matchmakingService.hashIp(rawIp);
      const bruteForceResult = await gateway.checkPasswordAttemptLimit(
        ipHash,
        roomId,
      );
      if (bruteForceResult === 'banned') {
        client.emit('rate_limited', {
          message: 'Too many wrong password attempts, please try again later',
          roomId,
        });
        return { event: 'rate_limited', data: { roomId } };
      }

      // Password check for private rooms (skip if already seated — reconnect)
      const isAlreadySeated = table.hasPlayer(userId);
      if (!isAlreadySeated && table.roomPassword) {
        const passwordMatch = await bcrypt.compare(
          password ?? '',
          table.roomPassword,
        );
        if (!passwordMatch) {
          client.emit('wrong_password', { roomId });
          return { event: 'wrong_password', data: { roomId } };
        }
        // Successful password entry — clear brute-force counter
        await gateway.clearPasswordAttempts(ipHash, roomId);
      }

      await gateway.ensureRecoveredRoundFlow(roomId, table);
      const balance = isAlreadySeated
        ? null
        : await gateway.tableManager.getUserAvailableBalance(userId);
      const minimumRequiredBalance = table.minBuyIn;
      if (!isAlreadySeated && (balance ?? 0) < minimumRequiredBalance) {
        client.emit('insufficient_balance', {
          roomId,
          balance: balance ?? 0,
          minimumRequiredBalance,
        });
        return {
          event: 'insufficient_balance',
          data: {
            roomId,
            balance: balance ?? 0,
            minimumRequiredBalance,
          },
        };
      }

      // Fetch latest avatar from DB so it's always up-to-date
      const avatar = await gateway.userService.getUserAvatar(userId);
      const playerData = { ...client.data.user, avatar: avatar ?? '' };

      const joined = table.addPlayer(playerData, balance ?? 0);
      if (!joined) {
        client.emit('room_full', { roomId });
        return {
          event: 'room_full',
          data: { roomId },
        };
      }

      // Freeze entire balance while player is seated
      if (!isAlreadySeated && balance !== null) {
        await gateway.tableManager.freezePlayerBalance(userId, balance);
      }

      client.join(roomId);
      gateway.tableManager.registerPlayerRoom(userId, roomId);
      await gateway.tableManager.persistTableState(roomId);
      await gateway.broadcastTableState(roomId, table);
      await gateway.tableManager.broadcastRoomStatus(roomId);
      return {
        event: 'joined',
        data: table.getMaskedView(client.data.user?.sub),
      };
    });
  });
}

// ---------------------------------------------------------------------------
// Handler: player_ready
// ---------------------------------------------------------------------------

export async function handlePlayerReady(gateway: AppGateway, client: Socket) {
  const userId = client.data.user?.sub as string;
  const roomId = await gateway.tableManager.getUserCurrentRoomId(userId);
  if (!roomId) {
    return { event: 'error', data: 'Not in any room' };
  }

  return gateway.withRoomLock(roomId, async () => {
    const table = await gateway.tableManager.getTable(roomId);
    if (!table) {
      return { event: 'error', data: 'Room not found' };
    }

    await gateway.ensureRecoveredRoundFlow(roomId, table);

    const allReady = table.setPlayerReady(userId);

    if (table.readyCountdownEndsAt) {
      await gateway.tableManager.persistTableState(roomId);
      await gateway.broadcastTableState(roomId, table);
      return { event: 'ready_updated', data: { roomId } };
    }

    if (allReady) {
      table.startHandIfReady();
      await gateway.tableManager.persistTableBalances(roomId);
      if (gateway.isActionStage(table.currentStage)) {
        await gateway.scheduleActionTimeout(gateway.server, roomId, table);
      }
    } else {
      // Not all ready yet — start auto-start countdown
      const playable = table.players.filter((p) => p && p.stack > 0);
      if (
        playable.length === 1 &&
        playable[0]!.ready &&
        playable[0]!.id === userId
      ) {
        await gateway.scheduleAutoStart(
          gateway.server,
          roomId,
          table,
          SOLO_READY_COUNTDOWN_MS,
        );
      }
    }

    await gateway.tableManager.persistTableState(roomId);
    await gateway.broadcastTableState(roomId, table);
    return { event: 'ready_updated', data: { roomId } };
  });
}

// ---------------------------------------------------------------------------
// Handler: player_action
// ---------------------------------------------------------------------------

export async function handlePlayerAction(
  gateway: AppGateway,
  client: Socket,
  data: PlayerActionInput,
) {
  const validated = validate(PlayerActionSchema, data, client, 'player_action');
  if (!validated) {
    return { event: 'error', data: 'Invalid request' };
  }

  const userId = client.data.user?.sub as string | undefined;
  if (!userId) return;

  const action = validated.action;
  const amount = validated.amount ?? 0;
  // roomId is optional in schema - derive from user's current room if not provided
  const userCurrentRoomId =
    await gateway.tableManager.getUserCurrentRoomId(userId);
  let roomId: string | null = validated.roomId ?? null;
  if (!roomId) {
    roomId = userCurrentRoomId;
  }
  // Security: if client provides a roomId, verify they are actually in that room
  // (only check if userRooms index has been populated; null means newly joined or index not yet set)
  if (
    validated.roomId &&
    userCurrentRoomId != null &&
    validated.roomId !== userCurrentRoomId
  ) {
    return { event: 'error', data: { message: 'Invalid roomId' } };
  }

  if (!action || !roomId) {
    client.emit('error', { message: 'Invalid action or roomId' });
    return;
  }

  if (!(await gateway.checkRateLimit(userId))) {
    client.emit('rate_limited', {
      message: 'Too many actions, please slow down',
    });
    return;
  }

  return gateway.withRoomLock(roomId, async () => {
    const table = await gateway.tableManager.getTable(roomId);
    if (!table) {
      client.emit('error', {
        message: 'Table not found',
        roomId,
      });
      return;
    }

    await gateway.ensureRecoveredRoundFlow(roomId, table);
    const processed = table.processAction(userId, action, amount);
    if (!processed) {
      client.emit('action_rejected', {
        action,
        amount,
        reason: 'Invalid action for current game state',
      });
      return;
    }

    await gateway.tableManager.persistTableState(roomId);
    await gateway.tableManager.persistTableBalances(roomId);
    if (table.currentStage === GameStage.SETTLEMENT) {
      await gateway.schedulePostHandFlow(gateway.server, roomId, table);
    } else if (gateway.isActionStage(table.currentStage)) {
      await gateway.scheduleActionTimeout(gateway.server, roomId, table);
    }

    await gateway.broadcastTableState(roomId, table);
  });
}

// ---------------------------------------------------------------------------
// Handler: leave_room
// ---------------------------------------------------------------------------

export async function handleLeaveRoom(gateway: AppGateway, client: Socket) {
  const userId = client.data.user?.sub as string;
  gateway.clearPendingDisconnect(userId);

  return gateway.withUserLock(userId, async () => {
    const roomId = await gateway.tableManager.getUserCurrentRoomId(userId);
    if (!roomId) {
      return { event: 'error', data: 'Not in any room' };
    }

    return gateway.withRoomLock(roomId, async () => {
      // Leave the Socket.io room FIRST to avoid race conditions with DB state
      client.leave(roomId);

      const result = await gateway.tableManager.leaveCurrentRoom(userId);
      if (!result) {
        return { event: 'error', data: 'Not in any room' };
      }

      gateway.matchmakingService.recordPlayerLeft(roomId, userId);

      if (result.dissolved) {
        gateway.clearRoundTimers(roomId);
      } else if (result.reachedSettlement) {
        const table = await gateway.tableManager.getTable(roomId);
        if (table) {
          await gateway.schedulePostHandFlow(gateway.server, roomId, table);
          await gateway.broadcastTableState(roomId, table);
        }
      } else {
        const table = await gateway.tableManager.getTable(roomId);
        if (table) {
          if (gateway.isActionStage(table.currentStage)) {
            await gateway.scheduleActionTimeout(gateway.server, roomId, table);
          }
          await gateway.broadcastTableState(roomId, table);
        }
      }

      client.emit('left_room', { roomId, dissolved: result.dissolved });
      return {
        event: 'left_room',
        data: { roomId, dissolved: result.dissolved },
      };
    });
  });
}

// ---------------------------------------------------------------------------
// Handler: quick_match
// ---------------------------------------------------------------------------

export async function handleQuickMatch(
  gateway: AppGateway,
  client: Socket,
  data: { tier: BlindTier },
) {
  const validated = validate(QuickMatchSchema, data, client, 'quick_match');
  if (!validated) {
    return { event: 'error', data: 'Invalid request' };
  }

  const userId = client.data.user?.sub as string;
  if (!userId) return { event: 'error', data: 'Unauthorized' };

  const tier = validated.tier;
  if (!tier || !BLIND_TIERS[tier]) {
    client.emit('match_error', { message: 'Invalid tier' });
    return;
  }

  const config = BLIND_TIERS[tier];

  // Ensure player isn't already in a room
  const currentRoomId = await gateway.tableManager.getUserCurrentRoomId(userId);
  if (currentRoomId) {
    client.emit('match_error', {
      message: 'already_in_room',
      roomId: currentRoomId,
    });
    return;
  }

  // Validate available chips
  const availableChips =
    await gateway.tableManager.getUserAvailableBalance(userId);
  if (availableChips < config.minBuyIn) {
    client.emit('match_error', {
      message: 'insufficient_chips',
      required: config.minBuyIn,
    });
    return;
  }

  const playerElo = await gateway.matchmakingService.getPlayerElo(userId);
  const rawIp = client.handshake.address ?? '0.0.0.0';
  const ipHash = gateway.matchmakingService.hashIp(rawIp);

  try {
    const roomId = await gateway.matchmakingService.findOrCreateMatchmakingRoom(
      userId,
      tier,
      playerElo,
      ipHash,
    );

    gateway.matchmakingService.recordPlayerJoined(
      roomId,
      userId,
      playerElo,
      ipHash,
    );

    client.emit('match_found', { roomId, tier });
  } catch (err) {
    gateway.logger.error('quick_match error', err);
    client.emit('match_error', { message: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// Handler: show_cards
// ---------------------------------------------------------------------------

export async function handleShowCards(gateway: AppGateway, client: Socket) {
  const userId = client.data.user?.sub as string;
  if (!userId) return;

  const roomId = await gateway.tableManager.getUserCurrentRoomId(userId);
  if (!roomId) return;

  const table = await gateway.tableManager.getTable(roomId);
  if (!table) return;

  if (table.currentStage !== GameStage.SETTLEMENT || !table.isFoldWin) return;

  const isWinner =
    table.lastHandResult?.some(
      (e) => e.playerId === userId && e.winAmount > 0,
    ) ?? false;
  if (!isWinner) {
    client.emit('show_cards_result', { success: false, reason: 'not_winner' });
    return;
  }

  table.revealFoldWinnerCards();
  await gateway.tableManager.persistTableState(roomId);
  await gateway.broadcastTableState(roomId, table);
}
