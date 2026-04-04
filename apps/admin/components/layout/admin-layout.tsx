"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isLoggedIn } from "@/lib/api";
import Sidebar from "@/components/layout/sidebar";
import { Menu } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      if (!isLoggedIn()) {
        router.push("/login");
      } else {
        setChecking(false);
      }
    };
    void check();
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-slate-400 text-sm">验证中...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile hamburger — only visible on screens < md */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="md:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-[#161b27] border border-[#1e2535] text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="打开菜单"
      >
        <Menu size={20} />
      </button>

      {/* Main content — full width on mobile, ml-60 on desktop */}
      <main className="flex-1 min-h-screen bg-[#0f1117] md:ml-60">
        {children}
      </main>
    </div>
  );
}
