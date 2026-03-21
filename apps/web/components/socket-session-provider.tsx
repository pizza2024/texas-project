'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setForceLogoutHandler, setRejoinAvailableHandler } from '@/lib/socket';
import { handleExpiredSession } from '@/lib/auth';

/**
 * Registers global socket event handlers for single-session enforcement and game reconnection.
 * Must be mounted inside SystemMessageProvider so that handleExpiredSession can show dialogs.
 */
export function SocketSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    setForceLogoutHandler((data) => {
      const message = data.roomId
        ? '您的账号已在其他设备登录，当前游戏已被中断。'
        : '您的账号已在其他设备登录，当前会话已失效。';
      handleExpiredSession({ alertMessage: message });
    });

    setRejoinAvailableHandler(({ roomId }) => {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith(`/room/${roomId}`)) {
        router.push(`/room/${roomId}`);
      }
    });
  }, [router]);

  return <>{children}</>;
}
