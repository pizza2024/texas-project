/**
 * web socket 封装 —— 代理到 @texas/shared 的 socket 模块。
 * mobile 可以直接使用 @texas/shared/socket，本文件仅做 web 层适配（读环境变量）。
 */
export {
  setForceLogoutHandler,
  setRejoinAvailableHandler,
  setDepositConfirmedHandler,
  setFriendStatusUpdateHandler,
  setFriendRequestReceivedHandler,
  disconnectSocket,
} from "@texas/shared";
import { getSocket as _getSocket } from "@texas/shared";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

export const getSocket = (token: string) =>
  _getSocket(`${SERVER_URL}/ws`, token);
