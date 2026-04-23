"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserAvatar } from '@/components/user-avatar';

interface UserDropdownProps {
  nickname: string;
  userId: string;
  avatar: string | null;
  onLogout: () => void;
}

export function UserDropdown({
  nickname,
  userId,
  avatar,
  onLogout,
}: UserDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    { label: '👤 ' + 'Profile', href: '/profile' },
    { label: '📊 ' + 'Statistics', href: '/stats' },
    { label: '🃏 ' + 'Hand History', href: '/hands' },
    { label: '⚙️ ' + 'Settings', href: '/settings' },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all hover:bg-white/10"
      >
        <UserAvatar
          userId={nickname}
          avatar={avatar}
          size={36}
          className="ring-2 ring-amber-500/40"
        />
        <span className="text-sm font-bold text-white hidden sm:block max-w-[100px] truncate">
          {nickname}
        </span>
        <span
          className="text-xs text-gray-400 transition-transform"
          style={{ transform: showDropdown ? 'rotate(180deg)' : 'none' }}
        >
          ▼
        </span>
      </button>

      {showDropdown && (
        <div
          className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden z-50"
          style={{
            background: 'rgba(6,12,9,0.98)',
            border: '1px solid rgba(234,179,8,0.2)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          }}
        >
          {/* User info header */}
          <div
            className="px-4 py-3"
            style={{ borderBottom: '1px solid rgba(234,179,8,0.1)' }}
          >
            <p className="text-sm font-bold text-white truncate">{nickname}</p>
            <p className="text-xs text-gray-500 truncate">#{userId.slice(-8)}</p>
          </div>

          {/* Menu items */}
          <div className="py-2">
            {menuItems.map((item) => (
              <button
                key={item.href}
                onClick={() => {
                  setShowDropdown(false);
                  router.push(item.href);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Logout */}
          <div
            className="py-2"
            style={{ borderTop: '1px solid rgba(234,179,8,0.1)' }}
          >
            <button
              onClick={() => {
                setShowDropdown(false);
                onLogout();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
