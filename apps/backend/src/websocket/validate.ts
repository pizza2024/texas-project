import { z } from 'zod';
import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

const logger = new Logger('WsValidator');

/**
 * Validate incoming message data against a Zod schema.
 * Emits 'invalid_message' to the client and returns null on failure.
 */
type ZodParseResult<T> =
  | { success: true; data: T; error?: undefined }
  | {
      success: false;
      data?: undefined;
      error: { issues: Array<{ path: (string | number)[]; message: string }> };
    };

export function validate<T>(
  schema: { safeParse: (data: unknown) => ZodParseResult<T> },
  data: unknown,
  client: Socket,
  eventName: string,
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issueMessages = result.error.issues.map((e) => e.message).join('; ');
    logger.warn(`Invalid ${eventName} from ${client.id}: ${issueMessages}`);
    client.emit('invalid_message', {
      event: eventName,
      errors: result.error.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return null;
  }
  return result.data;
}
