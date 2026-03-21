import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { getStoredToken, isTokenExpired } from '../lib/auth';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function checkAuth() {
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

    checkAuth();
  }, []);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="light" />
      <Slot />
    </>
  );
}
