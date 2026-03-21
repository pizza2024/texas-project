import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { getStoredToken, isTokenExpired } from '../lib/auth';
import { initI18n } from '../lib/i18n';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      // 初始化 i18n
      await initI18n();

      // 检查认证状态
      const token = await getStoredToken();
      const inAuthGroup = segments[0] === '(auth)';

      if (!token || isTokenExpired(token)) {
        if (!inAuthGroup) {
          router.replace('/login');
        }
      } else {
        if (inAuthGroup) {
          router.replace('/rooms');
        }
      }
      setReady(true);
    }

    init();
  }, []);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="light" />
      <Slot />
    </>
  );
}
