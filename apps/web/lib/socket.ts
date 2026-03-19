import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let socketToken: string | null = null;

export const getSocket = (token: string): Socket => {
  if (!socket || socketToken !== token) {
    if (socket) {
      socket.disconnect();
    }

    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
      query: { token },
      transports: ['websocket'],
    });
    socketToken = token;
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
};
