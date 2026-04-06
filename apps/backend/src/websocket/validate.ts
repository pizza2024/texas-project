import { ZodSchema } from 'zod';
import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

const logger = new Logger('WsValidator');

/**
 * Validate incoming message data against a Zod schema.
 * Emits 'invalid_message' to the client and returns null on failure.
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown,
  client: Socket,
  eventName: string,
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    logger.warn(
      `Invalid ${eventName} from ${client.id}: ${result.error.message}`,
    );
    client.emit('invalid_message', {
      event: eventName,
      errors: result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return null;
  }
  return result.data;
}
