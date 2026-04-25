import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * Custom decorator to inject the Socket.io server instance.
 * Usage: @InjectServer() server: Server
 */
export const InjectServer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Server => {
    const request = ctx.switchToHttp().getRequest();
    // The server is attached to the request by middleware or globally
    return request.ioServer;
  },
);
