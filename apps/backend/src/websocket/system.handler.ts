/**
 * System event handlers for the WebSocket gateway.
 *
 * Handles low-level system events:
 *   - ClientConnect: fires when a new client connects (logged for audit)
 *   - ClientDisconnect: fires when a client disconnects (Socket.IO automatic)
 *
 * Socket.IO handles ping/pong automatically via heartbeat config.
 * AuthHeartbeat is handled inline in the gateway's @SubscribeMessage decorators.
 */
import { AppGateway } from './app.gateway';
import { Logger } from '@nestjs/common';

/**
 * Called by app.gateway.ts OnGatewayConnection hook.
 * Logs new WebSocket connections for monitoring/audit purposes.
 */
export function handleClientConnect(gateway: AppGateway, client: any): void {
  const logger = gateway.logger || new Logger('WebSocket');
  gateway.logger.debug(`Client connected: ${client.id}`);
}

/**
 * Called by app.gateway.ts OnGatewayDisconnect hook.
 * Logs disconnections for audit and debugging.
 */
export function handleClientDisconnect(gateway: AppGateway, client: any): void {
  gateway.logger.debug(`Client disconnected: ${client.id}`);
}
