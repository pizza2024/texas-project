/**
 * table-events.ts
 *
 * Event publishing helpers for the Table class.
 *
 * NOTE: The Table class itself does not hold a RoomEventEmitter reference.
 *       Event emission is handled by the caller (e.g. TableManagerService) after
 *       reading the table state returned by each action method.
 *
 *       This file exists to document the event contract and can be extended
 *       if events need to be encapsulated within Table in the future.
 */

/** Placeholder for future event-emitter integration. */
export type TableEventEmitter = Record<string, (...args: any[]) => void>;

/**
 * Event names emitted by the table engine.
 * Used by TableManagerService or equivalent to publish game events.
 */
export enum TableEvent {
  PLAYER_JOINED = 'table:player:joined',
  PLAYER_LEFT = 'table:player:left',
  HAND_STARTED = 'table:hand:started',
  ACTION_TAKEN = 'table:action:taken',
  STREET_ADVANCED = 'table:street:advanced',
  SHOWDOWN_STARTED = 'table:showdown:started',
  HAND_COMPLETED = 'table:hand:completed',
  SETTLEMENT_STARTED = 'table:settlement:started',
  PLAYER_AUTO_FOLDED = 'table:player:auto-folded',
}
