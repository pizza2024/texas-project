import { getSocket as _getSocket, disconnectSocket } from "@texas/shared";
export {
  disconnectSocket,
  setForceLogoutHandler,
  setRejoinAvailableHandler,
  setDepositConfirmedHandler,
} from "@texas/shared";

const SERVER_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export const getSocket = (token: string) =>
  _getSocket(`${SERVER_URL}/ws`, token);
