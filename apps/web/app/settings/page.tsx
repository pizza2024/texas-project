'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import {
  getStoredToken,
  getTokenPayload,
  handleExpiredSession,
  isTokenExpired,
} from '@/lib/auth';
import { normalizeSoundVolume } from '@/lib/sound-settings';
import { useSoundSettings } from '@/lib/use-sound-settings';
import { useTranslation } from 'react-i18next';
import i18n, { SUPPORTED_LOCALES, saveLocale, type LocaleCode } from '@/lib/i18n';
import '@/lib/i18n';

interface UserProfile {
  id: string;
  nickname: string;
  avatar: string | null;
  coinBalance: number;
}

const pageBg: React.CSSProperties = {
  background: 'radial-gradient(ellipse at 50% 20%, #0d2818 0%, #060e10 55%, #020406 100%)',
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocale, setCurrentLocale] = useState<LocaleCode>('zh-CN');
  const { soundSettings, toggleSoundSetting, handleVolumeChange } = useSoundSettings();

  useEffect(() => {
    setCurrentLocale((i18n.language ?? 'zh-CN') as LocaleCode);
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    if (isTokenExpired(token, 1000)) {
      void handleExpiredSession({
        alertMessage: t('auth.sessionExpiredSettingsMsg'),
        returnTo: '/settings',
      });
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      try {
        const { data } = await api.get('/auth/profile');
        if (!cancelled) {
          setProfile(data);
        }
      } catch {
        if (!cancelled) {
          await handleExpiredSession({
            alertMessage: t('auth.sessionExpiredSettingsMsg'),
            returnTo: '/settings',
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [router, t]);

  const username = useMemo(() => {
    const token = getStoredToken();
    if (!token) {
      return profile?.nickname ?? '—';
    }

    return getTokenPayload(token)?.username ?? profile?.nickname ?? '—';
  }, [profile]);

  const safeVolume = normalizeSoundVolume(soundSettings.volume);

  const changeLanguage = (code: LocaleCode) => {
    setCurrentLocale(code);
    saveLocale(code);
    void i18n.changeLanguage(code);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={pageBg}>
        <div className="text-center space-y-3">
          <div className="text-5xl animate-pulse">⚙️</div>
          <p
            className="text-sm tracking-[0.3em] uppercase font-semibold"
            style={{ color: 'rgba(245,158,11,0.7)' }}
          >
            {t('settings.loadingSettings')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden text-white" style={pageBg}>
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden">
        <span className="absolute top-8 left-8 text-[9rem] font-serif opacity-[0.03] text-yellow-400 -rotate-12">♠</span>
        <span className="absolute bottom-10 right-8 text-[9rem] font-serif opacity-[0.03] text-yellow-400 rotate-6">♣</span>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8 space-y-8">
        <header
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6"
          style={{ borderBottom: '1px solid rgba(234,179,8,0.15)' }}
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">⚙️</span>
              <h1
                className="text-3xl font-black tracking-[0.08em] uppercase"
                style={{
                  background: 'linear-gradient(135deg, #d97706 0%, #fcd34d 45%, #d97706 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {t('settings.title')}
              </h1>
            </div>
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'rgba(245,158,11,0.45)' }}>
              {t('settings.subtitle')}
            </p>
          </div>

          <Button
            variant="outline"
            className="font-bold tracking-widest text-xs uppercase h-10 px-5 rounded-lg transition-colors hover:bg-yellow-900/20"
            style={{
              background: 'transparent',
              border: '1px solid rgba(234,179,8,0.3)',
              color: 'rgba(245,158,11,0.7)',
            }}
            onClick={() => router.push('/rooms')}
          >
            ← {t('common.backToLobby')}
          </Button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* User Info */}
          <section
            className="rounded-3xl p-6 space-y-5"
            style={{
              background: 'linear-gradient(160deg, rgba(12,22,16,0.97) 0%, rgba(6,12,9,0.99) 100%)',
              border: '1px solid rgba(234,179,8,0.18)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
            }}
          >
            <div>
              <div className="text-[11px] font-black tracking-[0.2em] uppercase" style={{ color: '#fcd34d' }}>
                {t('settings.userInfo')}
              </div>
              <div className="text-sm mt-2" style={{ color: 'rgba(156,163,175,0.9)' }}>
                {t('settings.userInfoDesc')}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(245,158,11,0.5)' }}>
                  {t('auth.username')}
                </div>
                <div className="mt-2 text-lg font-black">{username}</div>
              </div>

              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(245,158,11,0.5)' }}>
                  {t('auth.nickname')}
                </div>
                <div className="mt-2 text-lg font-black">{profile?.nickname ?? '—'}</div>
              </div>

              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(245,158,11,0.5)' }}>
                  {t('settings.balance')}
                </div>
                <div className="mt-2 text-lg font-black" style={{ color: '#86efac' }}>
                  ${profile?.coinBalance ?? 0}
                </div>
              </div>

              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(245,158,11,0.5)' }}>
                  {t('settings.userId')}
                </div>
                <div className="mt-2 text-sm font-semibold break-all" style={{ color: 'rgba(229,231,235,0.88)' }}>
                  {profile?.id ?? '—'}
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(234,179,8,0.16)' }}>
              <div className="text-[10px] tracking-[0.2em] uppercase font-black" style={{ color: 'rgba(245,158,11,0.6)' }}>
                {t('settings.futureFeatures')}
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  t('settings.changePassword'),
                  t('settings.setAvatar'),
                  t('settings.personalProfile'),
                  t('settings.morePrefs'),
                ] as string[]).map((label) => (
                  <span
                    key={label}
                    className="px-3 h-8 rounded-full inline-flex items-center text-[11px] font-bold tracking-[0.12em] uppercase"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(156,163,175,0.78)',
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <div className="space-y-6">
            {/* Sound Settings */}
            <section
              className="rounded-3xl p-6 space-y-5"
              style={{
                background: 'linear-gradient(160deg, rgba(12,22,16,0.97) 0%, rgba(6,12,9,0.99) 100%)',
                border: '1px solid rgba(234,179,8,0.18)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
              }}
            >
              <div>
                <div className="text-[11px] font-black tracking-[0.2em] uppercase" style={{ color: '#fcd34d' }}>
                  {t('settings.systemSettings')}
                </div>
                <div className="text-sm mt-2" style={{ color: 'rgba(156,163,175,0.9)' }}>
                  {t('settings.soundDesc')}
                </div>
              </div>

              <div
                className="rounded-2xl p-4 space-y-3"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black tracking-[0.12em] uppercase" style={{ color: 'rgba(229,231,235,0.92)' }}>
                    {t('settings.masterVolume')}
                  </span>
                  <span className="text-sm font-black tabular-nums" style={{ color: safeVolume > 0 ? '#f59e0b' : 'rgba(156,163,175,0.75)' }}>
                    {Math.round(safeVolume * 100)}%
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(safeVolume * 100)}
                  onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
                  className="w-full accent-amber-500"
                  aria-label={t('settings.masterVolume')}
                />
              </div>

              <div className="grid gap-3">
                {([
                  ['deal', t('settings.soundDeal'), t('settings.soundDealDesc')],
                  ['countdown', t('settings.soundCountdown'), t('settings.soundCountdownDesc')],
                  ['winner', t('settings.soundWinner'), t('settings.soundWinnerDesc')],
                ] as const).map(([key, label, description]) => {
                  const enabled = soundSettings[key];

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSoundSetting(key)}
                      className="w-full rounded-2xl p-4 text-left transition-all"
                      style={{
                        background: enabled ? 'rgba(22,163,74,0.14)' : 'rgba(255,255,255,0.04)',
                        border: enabled
                          ? '1px solid rgba(74,222,128,0.28)'
                          : '1px solid rgba(255,255,255,0.08)',
                        boxShadow: enabled ? '0 0 18px rgba(74,222,128,0.08)' : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-black tracking-[0.08em] uppercase" style={{ color: enabled ? '#86efac' : '#e5e7eb' }}>
                            {enabled ? '🔊' : '🔇'} {label}
                          </div>
                          <div className="text-xs mt-1" style={{ color: 'rgba(156,163,175,0.85)' }}>
                            {description}
                          </div>
                        </div>
                        <span
                          className="px-3 h-8 rounded-full inline-flex items-center text-[11px] font-black tracking-[0.12em] uppercase"
                          style={{
                            background: enabled ? 'rgba(22,163,74,0.18)' : 'rgba(255,255,255,0.05)',
                            border: enabled
                              ? '1px solid rgba(74,222,128,0.28)'
                              : '1px solid rgba(255,255,255,0.08)',
                            color: enabled ? '#86efac' : 'rgba(156,163,175,0.82)',
                          }}
                        >
                          {enabled ? t('settings.soundOn') : t('settings.soundOff')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Language Settings */}
            <section
              className="rounded-3xl p-6 space-y-5"
              style={{
                background: 'linear-gradient(160deg, rgba(12,22,16,0.97) 0%, rgba(6,12,9,0.99) 100%)',
                border: '1px solid rgba(234,179,8,0.18)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
              }}
            >
              <div>
                <div className="text-[11px] font-black tracking-[0.2em] uppercase" style={{ color: '#fcd34d' }}>
                  {t('settings.language')}
                </div>
                <div className="text-sm mt-2" style={{ color: 'rgba(156,163,175,0.9)' }}>
                  {t('settings.languageDesc')}
                </div>
              </div>

              <div className="grid gap-2">
                {SUPPORTED_LOCALES.map(({ code, label }) => {
                  const isActive = currentLocale === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => changeLanguage(code as LocaleCode)}
                      className="w-full rounded-xl px-4 py-3 text-left transition-all flex items-center justify-between"
                      style={{
                        background: isActive ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)',
                        border: isActive
                          ? '1px solid rgba(245,158,11,0.45)'
                          : '1px solid rgba(255,255,255,0.08)',
                        boxShadow: isActive ? '0 0 14px rgba(245,158,11,0.1)' : 'none',
                      }}
                    >
                      <span className="text-sm font-bold" style={{ color: isActive ? '#fcd34d' : 'rgba(229,231,235,0.85)' }}>
                        {label}
                      </span>
                      {isActive && (
                        <span className="text-xs font-black" style={{ color: '#f59e0b' }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
