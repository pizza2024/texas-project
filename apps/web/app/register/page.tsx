'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { showSystemMessage } from '@/lib/system-message';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';

export default function RegisterPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', { username, nickname, password });
      await showSystemMessage({ title: t('auth.registerSuccess'), message: t('auth.registerSuccessMsg'), confirmText: t('auth.confirmGoLogin') });
      router.push('/login');
    } catch {
      await showSystemMessage({ title: t('auth.registerFailed'), message: t('auth.registerFailedMsg') });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #0d2818 0%, #060e10 55%, #020406 100%)' }}>
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <span className="absolute top-10 left-10 text-[9rem] font-serif opacity-[0.04] text-yellow-400 -rotate-12">♠</span>
        <span className="absolute top-16 right-14 text-[11rem] font-serif opacity-[0.04] text-yellow-400 rotate-6">♥</span>
        <span className="absolute bottom-14 left-20 text-[10rem] font-serif opacity-[0.04] text-yellow-400 rotate-3">♦</span>
        <span className="absolute bottom-10 right-10 text-[9rem] font-serif opacity-[0.04] text-yellow-400 -rotate-6">♣</span>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(234,179,8,0.04) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-[400px] rounded-2xl px-10 py-10"
        style={{
          background: 'linear-gradient(160deg, rgba(12,22,16,0.97) 0%, rgba(6,12,9,0.99) 100%)',
          border: '1px solid rgba(234,179,8,0.25)',
          boxShadow: '0 0 0 1px rgba(234,179,8,0.08), 0 0 60px rgba(234,179,8,0.07), 0 25px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
        <div className="text-center mb-8">
          <div className="text-5xl mb-3 leading-none">🃏</div>
          <h1 className="text-3xl font-black tracking-[0.12em] uppercase"
            style={{ background: 'linear-gradient(135deg, #d97706 0%, #fcd34d 45%, #d97706 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            CHIPS
          </h1>
          <p className="text-[10px] tracking-[0.35em] text-yellow-700/60 mt-2 uppercase">
            ♠ &nbsp; ♥ &nbsp; {t('auth.createAccountSubtitle')} &nbsp; ♦ &nbsp; ♣
          </p>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.25))' }} />
          <span className="text-yellow-700/40 text-xs">◆</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(234,179,8,0.25), transparent)' }} />
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {[
            { id: 'username', label: t('auth.username'), value: username, setter: setUsername, type: 'text' },
            { id: 'nickname', label: t('auth.nickname'), value: nickname, setter: setNickname, type: 'text' },
            { id: 'password', label: t('auth.password'), value: password, setter: setPassword, type: 'password' },
          ].map(({ id, label, value, setter, type }) => (
            <div key={id} className="space-y-1.5">
              <label htmlFor={id} className="block text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: 'rgba(245,158,11,0.7)' }}>
                {label}
              </label>
              <Input id={id} type={type} value={value} onChange={(e) => setter(e.target.value)} required
                className="h-11 rounded-lg text-white placeholder:text-gray-700"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,179,8,0.2)', outline: 'none' }} />
            </div>
          ))}

          <Button type="submit" className="w-full h-12 font-black tracking-[0.2em] text-sm uppercase rounded-lg mt-2 transition-opacity hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)', color: '#000', border: 'none', boxShadow: '0 0 24px rgba(245,158,11,0.25), 0 4px 12px rgba(0,0,0,0.4)' }}>
            {t('auth.registerBtn')}
          </Button>
        </form>

        <div className="flex items-center gap-3 mt-6 mb-4">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.2))' }} />
          <span className="text-yellow-800/40 text-xs">◆</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(234,179,8,0.2), transparent)' }} />
        </div>

        <p className="text-center text-sm" style={{ color: 'rgba(107,114,128,0.8)' }}>
          {t('auth.haveAccount')}{' '}
          <Link href="/login" className="font-semibold transition-colors hover:text-yellow-300" style={{ color: 'rgba(245,158,11,0.85)' }}>
            {t('auth.goLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
