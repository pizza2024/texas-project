/**
 * Admin event handlers for the WebSocket gateway.
 *
 * Reserved for future admin-level events that require WebSocket delivery
 * rather than REST (e.g., real-time room management push to players).
 *
 * Currently no admin WS events are defined — admin operations use REST /admin/*.
 * Handlers are stubbed here for forward-compatibility:
 *   - handleRoomCreate   → create a room and broadcast to all players
 *   - handleRoomDelete   → delete a room and notify affected players
 *   - handleRoomEdit      → update room settings and push changes
 *   - handleAdminPauseResume → pause/resume a table
 *   - handleGetRoomSnapshot  → admin request for full room state
 */
import { AppGateway } from './app.gateway';
import { Logger } from '@nestjs/common';

/**
 * Placeholder: create a room via WebSocket and broadcast to all connected clients.
 * Admin operations currently use REST. This stub ensures the handler pattern
 * is established for future real-time admin features.
 */
export async function handleRoomCreate(
  gateway: AppGateway,
  client: any,
  payload: any,
): Promise<void> {
  const logger = gateway.logger || new Logger('AdminHandler');
  logger.warn(
    '[AdminHandler] handleRoomCreate called — use REST /admin/rooms instead',
  );
}

/**
 * Placeholder: delete a room and notify affected players via WebSocket.
 */
export async function handleRoomDelete(
  gateway: AppGateway,
  client: any,
  payload: any,
): Promise<void> {
  const logger = gateway.logger || new Logger('AdminHandler');
  logger.warn(
    '[AdminHandler] handleRoomDelete called — use REST /admin/rooms/:id instead',
  );
}

/**
 * Placeholder: edit room settings and push updates to affected clients.
 */
export async function handleRoomEdit(
  gateway: AppGateway,
  client: any,
  payload: any,
): Promise<void> {
  const logger = gateway.logger || new Logger('AdminHandler');
  logger.warn(
    '[AdminHandler] handleRoomEdit called — use REST /admin/rooms/:id instead',
  );
}

/**
 * Placeholder: pause or resume a table.
 */
export async function handleAdminPauseResume(
  gateway: AppGateway,
  client: any,
  payload: any,
): Promise<void> {
  const logger = gateway.logger || new Logger('AdminHandler');
  logger.warn(
    '[AdminHandler] handleAdminPauseResume called — use REST /admin/tables/:id instead',
  );
}

/**
 * Placeholder: return a full snapshot of a room's state to an admin.
 */
export async function handleGetRoomSnapshot(
  gateway: AppGateway,
  client: any,
  payload: any,
): Promise<void> {
  const logger = gateway.logger || new Logger('AdminHandler');
  logger.warn(
    '[AdminHandler] handleGetRoomSnapshot called — use REST /admin/rooms/:id instead',
  );
}
