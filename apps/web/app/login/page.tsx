'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { clearAuthExpiredLock, consumePostLoginRedirect } from '@/lib/auth';
import { showSystemMessage } from '@/lib/system-message';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';

export default function LoginPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  useEffect(() => {
    clearAuthExpiredLock();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', data.access_token);
      clearAuthExpiredLock();
      router.push(consumePostLoginRedirect() ?? '/rooms');
    } catch {
      await showSystemMessage({ title: t('auth.loginFailed'), message: t('auth.loginFailedMsg') });
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #0d2818 0%, #060e10 55%, #020406 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <span className="absolute top-10 left-10 text-[9rem] font-serif opacity-[0.04] text-yellow-400 -rotate-12">♠</span>
        <span className="absolute top-16 right-14 text-[11rem] font-serif opacity-[0.04] text-yellow-400 rotate-6">♥</span>
        <span className="absolute bottom-14 left-20 text-[10rem] font-serif opacity-[0.04] text-yellow-400 rotate-3">♦</span>
        <span className="absolute bottom-10 right-10 text-[9rem] font-serif opacity-[0.04] text-yellow-400 -rotate-6">♣</span>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(234,179,8,0.04) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-[400px] rounded-2xl px-6 sm:px-10 py-8 sm:py-10 mx-4"
        style={{
          background: 'linear-gradient(160deg, rgba(12,22,16,0.97) 0%, rgba(6,12,9,0.99) 100%)',
          border: '1px solid rgba(234,179,8,0.25)',
          boxShadow: '0 0 0 1px rgba(234,179,8,0.08), 0 0 60px rgba(234,179,8,0.07), 0 25px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
        <div className="text-center mb-9">
          <div className="text-5xl mb-3 leading-none">🃏</div>
          <h1 className="text-3xl font-black tracking-[0.12em] uppercase"
            style={{ background: 'linear-gradient(135deg, #d97706 0%, #fcd34d 45%, #d97706 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Texas Hold&apos;em
          </h1>
          <p className="text-[10px] tracking-[0.35em] text-yellow-700/60 mt-2 uppercase">
            ♠ &nbsp; ♥ &nbsp; {t('auth.playToWin')} &nbsp; ♦ &nbsp; ♣
          </p>
        </div>

        <div className="flex items-center gap-3 mb-7">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.25))' }} />
          <span className="text-yellow-700/40 text-xs">◆</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(234,179,8,0.25), transparent)' }} />
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="username" className="block text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: 'rgba(245,158,11,0.7)' }}>
              {t('auth.username')}
            </label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required
              className="h-11 rounded-lg text-white placeholder:text-gray-700"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,179,8,0.2)', outline: 'none' }} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: 'rgba(245,158,11,0.7)' }}>
              {t('auth.password')}
            </label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="h-11 rounded-lg text-white placeholder:text-gray-700"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,179,8,0.2)', outline: 'none' }} />
          </div>

          <Button type="submit" className="w-full h-12 font-black tracking-[0.2em] text-sm uppercase rounded-lg mt-1 transition-opacity hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)', color: '#000', border: 'none', boxShadow: '0 0 24px rgba(245,158,11,0.25), 0 4px 12px rgba(0,0,0,0.4)' }}>
            {t('auth.loginBtn')}
          </Button>
        </form>

        <div className="flex items-center gap-3 mt-7 mb-5">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.2))' }} />
          <span className="text-yellow-800/40 text-xs">◆</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(234,179,8,0.2), transparent)' }} />
        </div>

        <p className="text-center text-sm" style={{ color: 'rgba(107,114,128,0.8)' }}>
          {t('auth.noAccount')}{' '}
          <Link href="/register" className="font-semibold transition-colors hover:text-yellow-300" style={{ color: 'rgba(245,158,11,0.85)' }}>
            {t('auth.register')}
          </Link>
        </p>
      </div>
    </div>
  );
}
