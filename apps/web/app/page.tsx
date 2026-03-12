"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const redirectIfLoggedIn = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setChecking(false);
        return;
      }

      try {
        await api.get('/auth/profile');
        const { data } = await api.get('/tables/me/current-room');
        if (data?.roomId) {
          router.replace(`/room/${data.roomId}`);
          return;
        }
        router.replace('/rooms');
      } catch {
        localStorage.removeItem('token');
        setChecking(false);
      }
    };

    redirectIfLoggedIn();
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        Checking login status...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-6xl font-bold mb-8">Texas Hold&apos;em</h1>
      <div className="flex gap-4">
        <Link href="/login">
          <Button size="lg" className="text-lg px-8">Login</Button>
        </Link>
        <Link href="/register">
          <Button size="lg" variant="outline" className="text-lg px-8 text-black bg-white hover:bg-gray-200">Register</Button>
        </Link>
      </div>
    </div>
  );
}
