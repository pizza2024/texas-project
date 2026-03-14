'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isLoggedIn } from '@/lib/api';
import Sidebar from '@/components/layout/sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
    }
  }, [pathname, router]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 min-h-screen bg-[#0f1117]">
        {children}
      </main>
    </div>
  );
}
