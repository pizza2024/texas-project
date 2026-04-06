/**
 * System event handlers for the WebSocket gateway.
 *
 * Reserved for future system-level events such as:
 *   - Ping / Pong (Socket.IO handles these automatically via heartbeat config)
 *   - AuthHeartbeat
 *
 * These handlers do not exist in the current codebase and are listed here
 * to match the target directory structure defined in the refactoring plan.
 *
 * No business logic is changed — only code movement from app.gateway.ts.
 */
import { AppGateway } from './app.gateway';

// TODO: Add system event handlers when needed
// export async function handlePing(gateway: AppGateway, ...) { ... }
// export async function handlePong(gateway: AppGateway, ...) { ... }
// export async function handleAuthHeartbeat(gateway: AppGateway, ...) { ... }
