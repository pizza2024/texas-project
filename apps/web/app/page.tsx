'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import UserTour from '@/components/tour/user-tour';

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
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<{ online: number }>('/user/stats/online')
      .then((r) => setOnlineCount(r.data.online))
      .catch(() => {/* silent — badge stays as fallback */});
  }, []);

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
          {onlineCount != null
            ? `${onlineCount.toLocaleString()} Players Online · Join Now`
            : 'Tables Open · Join Now'}
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

        {/* Game Preview — live table snapshot */}
        <div
          className="relative w-full max-w-3xl mb-16 rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, rgba(10,20,14,0.95) 0%, rgba(5,12,8,0.98) 100%)',
            border: '1px solid rgba(234,179,8,0.2)',
            boxShadow: '0 0 60px rgba(0,0,0,0.8), inset 0 0 40px rgba(234,179,8,0.03)',
          }}
        >
          {/* Preview header */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '1px solid rgba(234,179,8,0.12)' }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(245,158,11,0.7)' }}>
                Live Table · NL Hold&apos;em
              </span>
            </div>
            <span className="text-xs text-gray-600 tracking-widest">♠ Micro Stakes</span>
          </div>

          {/* Table surface */}
          <div className="relative px-8 py-10">
            {/* Felt table outline */}
            <div
              className="relative rounded-[3rem] overflow-hidden py-12 px-6"
              style={{
                background: 'radial-gradient(ellipse at 50% 40%, #1a3d2a 0%, #0f2318 60%, #0a1810 100%)',
                border: '3px solid rgba(234,179,8,0.35)',
                boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6), 0 0 20px rgba(234,179,8,0.1)',
              }}
            >
              {/* Community cards row */}
              <div className="flex justify-center gap-3 mb-8">
                {/* Card 1 */}
                <div
                  className="w-14 h-20 rounded-lg flex items-center justify-center font-serif text-2xl font-black"
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #f5f0e8 100%)',
                    boxShadow: '2px 3px 8px rgba(0,0,0,0.5)',
                    color: '#1a1a1a',
                  }}
                >
                  <span className="text-red-500">♥</span><span className="text-red-500 font-black">Q</span>
                </div>
                {/* Card 2 */}
                <div
                  className="w-14 h-20 rounded-lg flex items-center justify-center font-serif text-2xl font-black"
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #f5f0e8 100%)',
                    boxShadow: '2px 3px 8px rgba(0,0,0,0.5)',
                    color: '#1a1a1a',
                  }}
                >
                  <span className="text-black">♠</span><span className="text-black font-black">J</span>
                </div>
                {/* Card 3 (flop) */}
                <div
                  className="w-14 h-20 rounded-lg flex items-center justify-center font-serif text-2xl font-black"
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #f5f0e8 100%)',
                    boxShadow: '2px 3px 8px rgba(0,0,0,0.5)',
                    color: '#1a1a1a',
                  }}
                >
                  <span className="text-black">♣</span><span className="text-black font-black">9</span>
                </div>
                {/* Card 4 */}
                <div
                  className="w-14 h-20 rounded-lg flex items-center justify-center font-serif text-2xl font-black"
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #f5f0e8 100%)',
                    boxShadow: '2px 3px 8px rgba(0,0,0,0.5)',
                    color: '#1a1a1a',
                  }}
                >
                  <span className="text-black">♦</span><span className="text-black font-black">7</span>
                </div>
                {/* Card 5 (turn) — face down */}
                <div
                  className="w-14 h-20 rounded-lg"
                  style={{
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #152a45 100%)',
                    boxShadow: '2px 3px 8px rgba(0,0,0,0.5)',
                    border: '2px solid rgba(234,179,8,0.3)',
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-yellow-400/40 text-2xl">?</span>
                  </div>
                </div>
              </div>

              {/* Pot indicator */}
              <div className="text-center mb-6">
                <span className="text-xs tracking-[0.25em] uppercase text-gray-500 mb-1 block">Pot</span>
                <span
                  className="text-2xl font-black tracking-wider"
                  style={{ color: 'rgba(245,158,11,0.9)', textShadow: '0 0 20px rgba(245,158,11,0.4)' }}
                >
                  $247.50
                </span>
              </div>

              {/* Seats row */}
              <div className="flex justify-between items-end px-2">
                {/* Player 1 — you */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="flex gap-0.5"
                  >
                    <div
                      className="w-9 h-12 rounded flex items-center justify-center font-serif text-sm font-black"
                      style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #f5f0e8 100%)',
                        boxShadow: '1px 2px 5px rgba(0,0,0,0.4)',
                        color: '#1a1a1a',
                      }}
                    >
                      <span className="text-red-500">♥</span><span className="text-red-500 text-xs font-black">A</span>
                    </div>
                    <div
                      className="w-9 h-12 rounded flex items-center justify-center font-serif text-sm font-black"
                      style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #f5f0e8 100%)',
                        boxShadow: '1px 2px 5px rgba(0,0,0,0.4)',
                        color: '#1a1a1a',
                      }}
                    >
                      <span className="text-black">♠</span><span className="text-black text-xs font-black">K</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-yellow-400/80">You</div>
                    <div className="text-xs text-gray-500">$1,240</div>
                  </div>
                </div>

                {/* Player 2 */}
                <div className="flex flex-col items-center gap-1 opacity-60">
                  <div className="w-8 h-10 rounded bg-gray-800 border border-gray-700 flex items-center justify-center">
                    <span className="text-gray-500 text-xs">??</span>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400">Fish_99</div>
                    <div className="text-xs text-gray-600">$580</div>
                  </div>
                </div>

                {/* Player 3 */}
                <div className="flex flex-col items-center gap-1 opacity-60">
                  <div className="w-8 h-10 rounded bg-gray-800 border border-gray-700 flex items-center justify-center">
                    <span className="text-gray-500 text-xs">??</span>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400">BlufferX</div>
                    <div className="text-xs text-gray-600">$2,100</div>
                  </div>
                </div>

                {/* Player 4 */}
                <div className="flex flex-col items-center gap-1 opacity-60">
                  <div className="w-8 h-10 rounded bg-gray-800 border border-gray-700 flex items-center justify-center">
                    <span className="text-gray-500 text-xs">??</span>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400">NutsOrNothing</div>
                    <div className="text-xs text-gray-600">$890</div>
                  </div>
                </div>

                {/* Action indicator */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-full animate-pulse"
                    style={{ background: 'rgba(234,179,8,0.7)', boxShadow: '0 0 8px rgba(234,179,8,0.5)' }}
                  />
                  <div className="text-center">
                    <div className="text-xs text-gray-400">Your turn</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

      <UserTour />
    </div>
  );
}
