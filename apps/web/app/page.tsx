'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

const FEATURES = [
  {
    icon: '⚡',
    title: 'Real-Time Battles',
    desc: 'WebSocket-powered tables. Every raise, call, and bluff lands in milliseconds.',
  },
  {
    icon: '🏆',
    title: 'Fair & Transparent',
    desc: 'Open-source hand evaluator. No house edge. The best hand wins, period.',
  },
  {
    icon: '🌐',
    title: 'Web3 Spirit',
    desc: 'Permissionless, no sign-up walls. Grab a seat, stack your chips, own the table.',
  },
];

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
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at 50% 35%, #0d2818 0%, #060e10 55%, #020406 100%)' }}
      >
        <span className="text-yellow-600/60 text-sm tracking-[0.3em] animate-pulse uppercase">Loading…</span>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 20%, #0d2818 0%, #060e10 55%, #020406 100%)' }}
    >
      {/* ── Ambient suit symbols ── */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <span className="absolute top-8  left-8   text-[14rem] font-serif opacity-[0.035] text-yellow-400 -rotate-12">♠</span>
        <span className="absolute top-12 right-10  text-[16rem] font-serif opacity-[0.03]  text-yellow-400 rotate-6">♥</span>
        <span className="absolute bottom-16 left-14 text-[13rem] font-serif opacity-[0.03]  text-yellow-400 rotate-3">♦</span>
        <span className="absolute bottom-8  right-8  text-[14rem] font-serif opacity-[0.035] text-yellow-400 -rotate-6">♣</span>
        {/* center glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(234,179,8,0.05) 0%, transparent 65%)' }}
        />
      </div>

      {/* ── Nav bar ── */}
      <header
        className="relative z-10 flex items-center justify-between px-8 py-5"
        style={{ borderBottom: '1px solid rgba(234,179,8,0.1)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">♠</span>
          <span
            className="font-black text-lg tracking-[0.15em] uppercase"
            style={{
              background: 'linear-gradient(135deg, #d97706 0%, #fcd34d 50%, #d97706 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            CHIPS
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2 text-sm font-semibold tracking-wider rounded-lg transition-colors uppercase"
            style={{
              color: 'rgba(245,158,11,0.85)',
              border: '1px solid rgba(234,179,8,0.3)',
            }}
          >
            Login
          </Link>
          <Link
            href="/register"
            className="px-5 py-2 text-sm font-black tracking-wider rounded-lg transition-opacity hover:opacity-90 uppercase"
            style={{
              background: 'linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)',
              color: '#000',
              boxShadow: '0 0 20px rgba(245,158,11,0.2)',
            }}
          >
            Play Now
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pt-16 pb-10">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-[0.25em] uppercase mb-8"
          style={{
            background: 'rgba(234,179,8,0.08)',
            border: '1px solid rgba(234,179,8,0.2)',
            color: 'rgba(245,158,11,0.8)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          Tables Open · Join Now
        </div>

        {/* Main title */}
        <h1
          className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tight leading-none mb-4"
          style={{
            background: 'linear-gradient(160deg, #fbbf24 0%, #fcd34d 35%, #f59e0b 60%, #d97706 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 40px rgba(245,158,11,0.3))',
          }}
        >
          CHIPS
        </h1>

        {/* Subtitle */}
        <p className="text-xl sm:text-2xl font-light text-gray-300 mb-3 max-w-lg leading-snug">
          Texas Hold&apos;em, <span style={{ color: 'rgba(245,158,11,0.9)' }}>on-chain spirit</span>
        </p>
        <p className="text-sm text-gray-500 max-w-sm mb-12 leading-relaxed">
          Bluff big. Call smart. The pot belongs to the boldest player at the table.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link
            href="/register"
            className="px-10 py-4 text-base font-black tracking-[0.15em] uppercase rounded-xl transition-opacity hover:opacity-90 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #92400e 0%, #b45309 25%, #d97706 60%, #f59e0b 100%)',
              color: '#000',
              boxShadow: '0 0 40px rgba(245,158,11,0.3), 0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            🃏 &nbsp;Deal Me In
          </Link>
          <Link
            href="/login"
            className="px-10 py-4 text-base font-semibold tracking-[0.1em] uppercase rounded-xl transition-colors hover:bg-white/5"
            style={{
              color: 'rgba(245,158,11,0.8)',
              border: '1px solid rgba(234,179,8,0.25)',
            }}
          >
            I have an account
          </Link>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 w-full max-w-2xl mb-12">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.2))' }} />
          <span className="text-yellow-700/40 text-xs tracking-[0.3em] uppercase">Why CHIPS?</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(234,179,8,0.2), transparent)' }} />
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl px-6 py-7 text-left"
              style={{
                background: 'linear-gradient(160deg, rgba(12,22,16,0.9) 0%, rgba(6,12,9,0.95) 100%)',
                border: '1px solid rgba(234,179,8,0.15)',
                boxShadow: '0 0 0 1px rgba(234,179,8,0.05), 0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3
                className="font-black text-sm tracking-[0.1em] uppercase mb-2"
                style={{ color: 'rgba(245,158,11,0.9)' }}
              >
                {f.title}
              </h3>
              <p className="text-xs leading-relaxed text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 text-center py-5 text-xs text-gray-700 tracking-widest uppercase"
        style={{ borderTop: '1px solid rgba(234,179,8,0.07)' }}
      >
        ♠ &nbsp; ♥ &nbsp; CHIPS · Texas Hold&apos;em &nbsp; ♦ &nbsp; ♣
      </footer>
    </div>
  );
}
