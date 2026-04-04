"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearToken } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  ArrowDownCircle,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "用户管理", icon: Users },
  { href: "/rooms", label: "房间管理", icon: DoorOpen },
  { href: "/finance", label: "财务管理", icon: Wallet },
  { href: "/withdraw", label: "提现管理", icon: ArrowDownCircle },
  { href: "/analytics", label: "数据统计", icon: BarChart3 },
  { href: "/system", label: "系统管理", icon: Settings },
];

export { navItems };

interface SidebarContentProps {
  pathname: string;
  onLinkClick?: () => void;
}

export function SidebarContent({ pathname, onLinkClick }: SidebarContentProps) {
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#1e2535]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🃏</span>
          <div>
            <p className="font-bold text-white text-sm leading-tight">
              Texas Hold&apos;em
            </p>
            <p className="text-xs text-slate-400">Admin Console</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-indigo-600/20 text-indigo-400 font-medium"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {label}
              {active && <ChevronRight size={14} className="ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-[#1e2535]">
        <button
          onClick={() => {
            handleLogout();
            onLinkClick?.();
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full"
        >
          <LogOut size={16} />
          退出登录
        </button>
      </div>
    </>
  );
}

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar — hidden on mobile, fixed on md+ */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 bg-[#161b27] border-r border-[#1e2535] flex-col z-50">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile offcanvas backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-screen w-72 bg-[#161b27] border-r border-[#1e2535] flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent pathname={pathname} onLinkClick={onClose} />
      </aside>
    </>
  );
}
