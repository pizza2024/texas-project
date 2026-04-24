'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import api from '@/lib/api';
import { getStoredToken, getTokenPayload, handleExpiredSession, isTokenExpired } from '@/lib/auth';
import { UserAvatar } from '@/components/user-avatar';

const pageBg: React.CSSProperties = {
  background: 'radial-gradient(ellipse at 50% 20%, #1a0d0d 0%, #0e0606 55%, #020202 100%)',
};

const EXPLORER_URL = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ?? 'https://sepolia.etherscan.io';

function shortTxHash(hash: string): string {
  if (!hash || hash.length <= 12) return hash ?? '';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function txUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

interface WithdrawBalance {
  availableChips: number;
  minWithdrawChips: number;
  minWithdrawUsdt: number;
  rate: number;
}

interface WithdrawRecord {
  id: string;
  amountChips: number;
  amountUsdt: number;
  toAddress: string;
  status: 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FAILED';
  txHash?: string;
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
}

interface WithdrawHistory {
  data: WithdrawRecord[];
  total: number;
  page: number;
  limit: number;
}

interface CooldownInfo {
  remainingMs: number;
  canWithdraw: boolean;
}

export default function WithdrawPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // Auth state
  const [nickname, setNickname] = useState('');
  const [userId, setUserId] = useState('');

  // Balance & form state
  const [balance, setBalance] = useState<WithdrawBalance | null>(null);
  const [history, setHistory] = useState<WithdrawRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [toAddress, setToAddress] = useState('');
  const [amountChips, setAmountChips] = useState('');
  const [addressError, setAddressError] = useState('');
  const [amountError, setAmountError] = useState('');

  // Action state
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cooldown, setCooldown] = useState<CooldownInfo | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    if (isTokenExpired(token, 1000)) {
      void handleExpiredSession({ returnTo: '/withdraw' });
      return;
    }

    const payload = getTokenPayload(token);
    setNickname(payload?.username ?? '');
    setUserId(payload?.sub ?? '');

    let cancelled = false;

    const loadData = async (retry = false) => {
      try {
        const [balRes, histRes, coolRes] = await Promise.all([
          api.get<WithdrawBalance>('/withdraw/balance'),
          api.get<WithdrawHistory>('/withdraw/history'),
          api.get<CooldownInfo>('/withdraw/cooldown'),
        ]);
        if (!cancelled) {
          setBalance(balRes.data);
          setHistory(histRes.data.data ?? []);
          setCooldown(coolRes.data);
          setLoading(false);
        }
      } catch {
        if (!retry && !cancelled) {
          setTimeout(() => { if (!cancelled) void loadData(true); }, 800);
        } else if (!cancelled) {
          setError(t('withdraw.loadError'));
          setLoading(false);
        }
      }
    };

    void loadData();
    const cooldownInterval = setInterval(async () => {
      try {
        const coolRes = await api.get<CooldownInfo>('/withdraw/cooldown');
        if (!cancelled) setCooldown(coolRes.data);
      } catch { /* ignore */ }
    }, 5000);

    return () => { cancelled = true; clearInterval(cooldownInterval); };
  }, [router, t]);

  // Cooldown countdown timer
  useEffect(() => {
    if (!cooldown || cooldown.canWithdraw) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (!prev) return prev;
        const newRemaining = Math.max(0, prev.remainingMs - 1000);
        return { ...prev, remainingMs: newRemaining, canWithdraw: newRemaining === 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const validateForm = (): boolean => {
    let valid = true;
    setAddressError('');
    setAmountError('');

    if (!ETH_ADDRESS_REGEX.test(toAddress)) {
      setAddressError(t('withdraw.invalidAddress'));
      valid = false;
    }

    const chips = parseFloat(amountChips);
    if (isNaN(chips) || chips <= 0) {
      setAmountError(t('withdraw.invalidAmount'));
      valid = false;
    } else if (balance && chips < balance.minWithdrawChips) {
      setAmountError(t('withdraw.minAmount', { chips: balance.minWithdrawChips, usdt: balance.minWithdrawUsdt }));
      valid = false;
    } else if (balance && chips > balance.availableChips) {
      setAmountError(t('withdraw.insufficientBalance', { available: balance.availableChips }));
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!cooldown?.canWithdraw) return;
    setSubmitting(true);
    setSubmitMsg(null);

    try {
      const res = await api.post<WithdrawRecord>('/withdraw/create', {
        toAddress,
        amountChips: parseFloat(amountChips),
      });
      const record = res.data;
      setSubmitMsg({
        type: 'success',
        text: t('withdraw.submitSuccess', { chips: record.amountChips, usdt: record.amountUsdt }),
      });
      setToAddress('');
      setAmountChips('');

      // Refresh history and cooldown
      const [histRes, coolRes] = await Promise.all([
        api.get<WithdrawHistory>('/withdraw/history'),
        api.get<CooldownInfo>('/withdraw/cooldown'),
      ]);
      setHistory(histRes.data.data ?? []);
      setCooldown(coolRes.data);

      if (balance) {
        setBalance({
          ...balance,
          availableChips: balance.availableChips - record.amountChips,
        });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSubmitMsg({ type: 'error', text: msg ?? t('withdraw.submitError') });
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: WithdrawRecord['status']) => {
    const configs: Record<string, { bg: string; color: string; label: string }> = {
      PENDING:   { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', label: t('withdraw.statusPending') },
      PROCESSING:{ bg: 'rgba(96,165,250,0.15)',   color: '#60a5fa', label: t('withdraw.statusProcessing') },
      CONFIRMED: { bg: 'rgba(74,222,128,0.12)',   color: '#4ade80', label: t('withdraw.statusConfirmed') },
      FAILED:    { bg: 'rgba(248,113,113,0.12)',  color: '#f87171', label: t('withdraw.statusFailed') },
    };
    const c = configs[status] ?? configs.PENDING;
    return (
      <span className="px-2 py-0.5 rounded font-bold text-xs" style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}30` }}>
        {c.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen text-white" style={pageBg}>
      {/* Nav */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(248,113,113,0.2)', background: 'rgba(0,0,0,0.4)' }}
      >
        <button
          type="button"
          onClick={() => router.push('/rooms')}
          className="text-sm font-medium transition-colors"
          style={{ color: 'rgba(248,113,113,0.8)' }}
        >
          {t('common.backToLobby')}
        </button>
        <h1 className="text-base font-bold tracking-widest uppercase" style={{ color: '#f87171' }}>
          {t('common.withdraw')}
        </h1>
        <div className="flex items-center gap-2">
          <UserAvatar userId={userId} size={28} />
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{nickname}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {loading && (
          <div className="flex items-center justify-center py-24">
            <span className="text-sm" style={{ color: 'rgba(248,113,113,0.6)' }}>{t('common.loading')}</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl p-4 text-sm text-center" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Balance Card */}
            {balance && (
              <div
                className="rounded-2xl p-5 space-y-3"
                style={{
                  background: 'linear-gradient(135deg, rgba(248,113,113,0.08) 0%, rgba(239,68,68,0.05) 100%)',
                  border: '1px solid rgba(248,113,113,0.25)',
                  boxShadow: '0 0 40px rgba(248,113,113,0.05)',
                }}
              >
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(248,113,113,0.7)' }}>
                  {t('withdraw.availableBalance')}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold" style={{ color: '#f87171' }}>
                    {balance.availableChips.toLocaleString()}
                  </span>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('deposit.chips')}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(248,113,113,0.12)' }}>
                    <p className="mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('withdraw.minWithdraw')}</p>
                    <p className="font-semibold" style={{ color: '#f87171' }}>≥ {balance.minWithdrawChips.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(248,113,113,0.12)' }}>
                    <p className="mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>≈ USDT</p>
                    <p className="font-semibold" style={{ color: '#facc15' }}>≥ {balance.minWithdrawUsdt}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(248,113,113,0.12)' }}>
                    <p className="mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('deposit.rate')}</p>
                    <p className="font-semibold" style={{ color: '#4ade80' }}>1 USDT = {balance.rate}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Withdraw Form */}
            <form
              onSubmit={(e) => { void handleSubmit(e); }}
              className="rounded-2xl p-5 space-y-4"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(248,113,113,0.15)' }}
            >
              <p className="text-sm font-semibold tracking-wide uppercase" style={{ color: 'rgba(248,113,113,0.8)' }}>
                {t('withdraw.newRequest')}
              </p>

              {/* To Address */}
              <div className="space-y-1.5">
                <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {t('withdraw.receiveAddress')}
                </label>
                <input
                  type="text"
                  value={toAddress}
                  onChange={(e) => { setToAddress(e.target.value); setAddressError(''); }}
                  placeholder="0x..."
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-mono"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: `1px solid ${addressError ? 'rgba(248,113,113,0.5)' : 'rgba(248,113,113,0.15)'}`,
                    color: '#f87171',
                    outline: 'none',
                  }}
                />
                {addressError && (
                  <p className="text-xs" style={{ color: '#f87171' }}>{addressError}</p>
                )}
              </div>

              {/* Amount in Chips */}
              <div className="space-y-1.5">
                <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {t('withdraw.amountChips')}
                </label>
                <input
                  type="number"
                  value={amountChips}
                  onChange={(e) => { setAmountChips(e.target.value); setAmountError(''); }}
                  placeholder={balance ? `≥ ${balance.minWithdrawChips}` : '1000'}
                  min={balance?.minWithdrawChips ?? 1000}
                  max={balance?.availableChips}
                  step={1}
                  className="w-full rounded-xl px-4 py-2.5 text-sm"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: `1px solid ${amountError ? 'rgba(248,113,113,0.5)' : 'rgba(248,113,113,0.15)'}`,
                    color: '#facc15',
                    outline: 'none',
                  }}
                />
                {amountError ? (
                  <p className="text-xs" style={{ color: '#f87171' }}>{amountError}</p>
                ) : (
                  amountChips && balance && (
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      ≈ {(parseFloat(amountChips) / balance.rate).toFixed(2)} USDT
                    </p>
                  )
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !cooldown?.canWithdraw}
                className="w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all"
                style={
                  submitting || !cooldown?.canWithdraw
                    ? { background: 'rgba(248,113,113,0.12)', color: 'rgba(248,113,113,0.4)', cursor: 'not-allowed', border: '1px solid rgba(248,113,113,0.15)' }
                    : { background: 'rgba(248,113,113,0.25)', color: '#f87171', cursor: 'pointer', border: '1px solid rgba(248,113,113,0.5)' }
                }
              >
                {submitting
                  ? t('withdraw.submitting')
                  : !cooldown?.canWithdraw
                  ? `${t('withdraw.cooldown')}: ${Math.ceil((cooldown?.remainingMs ?? 0) / 1000)}s`
                  : t('withdraw.submitButton')}
              </button>

              {submitMsg && (
                <div className="text-xs text-center" style={{ color: submitMsg.type === 'success' ? '#4ade80' : '#f87171' }}>
                  {submitMsg.text}
                </div>
              )}
            </form>

            {/* History */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid rgba(248,113,113,0.15)' }}
            >
              <div
                className="px-4 py-3"
                style={{ background: 'rgba(248,113,113,0.08)', borderBottom: '1px solid rgba(248,113,113,0.15)' }}
              >
                <h2 className="text-sm font-semibold tracking-wide uppercase" style={{ color: '#f87171' }}>
                  {t('withdraw.history')}
                </h2>
              </div>

              {history.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {t('withdraw.noHistory')}
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'rgba(248,113,113,0.08)' }}>
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="px-4 py-3 text-xs space-y-1"
                      style={{ background: 'rgba(0,0,0,0.15)' }}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ color: 'rgba(255,255,255,0.4)', minWidth: '120px' }}>
                          {formatDateTime(record.createdAt)}
                        </span>
                        <span style={{ color: '#facc15' }}>-{record.amountChips.toLocaleString()} {t('deposit.chips')}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>→</span>
                        <span className="font-mono" style={{ color: '#60a5fa', fontSize: '10px' }}>
                          {shortTxHash(record.toAddress)}
                        </span>
                        <span className="flex-1" />
                        {statusBadge(record.status)}
                      </div>
                      {record.txHash && (
                        <div className="flex items-center gap-2">
                          <span style={{ color: 'rgba(255,255,255,0.3)' }}>TX:</span>
                          <a
                            href={txUrl(record.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono hover:underline"
                            style={{ color: '#60a5fa', fontSize: '10px' }}
                          >
                            {shortTxHash(record.txHash)} ↗
                          </a>
                          <span style={{ color: '#facc15' }}>≈ {record.amountUsdt} USDT</span>
                        </div>
                      )}
                      {record.status === 'FAILED' && record.failureReason && (
                        <p className="text-xs" style={{ color: '#f87171' }}>
                          {t('withdraw.failedReason')}: {record.failureReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
