import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { getStoredToken, isTokenExpired } from '../lib/auth';

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

interface CooldownInfo {
  canWithdraw: boolean;
  remainingMs: number;
}

const EXPLORER_URL = 'https://sepolia.etherscan.io';
const ETH_REGEX = /^0x[a-fA-F0-9]{40}$/;

function shortHash(hash: string): string {
  if (!hash || hash.length <= 12) return hash ?? '';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function statusConfig(status: WithdrawRecord['status'], t: ReturnType<typeof useTranslation>['t']) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    PENDING:   { bg: '#fbbf24', color: '#fff', label: t('withdraw.statusPending') },
    PROCESSING:{ bg: '#60a5fa', color: '#fff', label: t('withdraw.statusProcessing') },
    CONFIRMED: { bg: '#4ade80', color: '#000', label: t('withdraw.statusConfirmed') },
    FAILED:    { bg: '#ef4444', color: '#fff', label: t('withdraw.statusFailed') },
  };
  return map[status] ?? map.PENDING;
}

export default function WithdrawScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [balance, setBalance] = useState<WithdrawBalance | null>(null);
  const [history, setHistory] = useState<WithdrawRecord[]>([]);
  const [cooldown, setCooldown] = useState<CooldownInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [toAddress, setToAddress] = useState('');
  const [amountChips, setAmountChips] = useState('');
  const [addressError, setAddressError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const token = await getStoredToken();
      if (cancelled) return;
      if (!token || isTokenExpired(token, 1000)) {
        router.replace('/login');
        return;
      }
      loadData();
    }
    init();
    // Refresh cooldown every 5s
    const interval = setInterval(() => {
      api.get<CooldownInfo>('/withdraw/cooldown').then((r) => setCooldown(r.data)).catch(() => {});
    }, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!cooldown || cooldown.canWithdraw) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (!prev) return prev;
        const remaining = Math.max(0, prev.remainingMs - 1000);
        return { ...prev, remainingMs: remaining, canWithdraw: remaining === 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown?.canWithdraw]);

  const loadData = async () => {
    try {
      const [balRes, histRes, coolRes] = await Promise.all([
        api.get<WithdrawBalance>('/withdraw/balance'),
        api.get<{ data: WithdrawRecord[] }>('/withdraw/history'),
        api.get<CooldownInfo>('/withdraw/cooldown'),
      ]);
      setBalance(balRes.data);
      setHistory(histRes.data.data ?? []);
      setCooldown(coolRes.data);
    } catch {
      setError(t('withdraw.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    setAddressError('');
    setAmountError('');
    let valid = true;
    if (!ETH_REGEX.test(toAddress)) {
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

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!cooldown?.canWithdraw) return;
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await api.post<WithdrawRecord>('/withdraw/create', {
        toAddress,
        amountChips: parseFloat(amountChips),
      });
      const record = res.data;
      setSubmitMsg({ type: 'success', text: t('withdraw.submitSuccess', { chips: record.amountChips, usdt: record.amountUsdt }) });
      setToAddress('');
      setAmountChips('');
      const [histRes, coolRes] = await Promise.all([
        api.get<{ data: WithdrawRecord[] }>('/withdraw/history'),
        api.get<CooldownInfo>('/withdraw/cooldown'),
      ]);
      setHistory(histRes.data.data ?? []);
      setCooldown(coolRes.data);
      if (balance) {
        setBalance({ ...balance, availableChips: balance.availableChips - record.amountChips });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSubmitMsg({ type: 'error', text: msg ?? t('withdraw.submitError') });
    } finally {
      setSubmitting(false);
    }
  };

  const remainingSec = cooldown ? Math.ceil(cooldown.remainingMs / 1000) : 0;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('withdraw.title')}</Text>
          <View style={{ width: 50 }} />
        </View>
        <ActivityIndicator color="#ef4444" size="large" style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: '#ef4444' }]}>{t('withdraw.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setError(null); setLoading(true); void loadData(); }}
          >
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Balance Card */}
          {balance && (
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>{t('withdraw.availableBalance')}</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceValue}>{balance.availableChips.toLocaleString()}</Text>
                <Text style={styles.balanceUnit}>{t('deposit.chips')}</Text>
              </View>
              <View style={styles.balanceInfoRow}>
                <View style={styles.balanceInfoItem}>
                  <Text style={styles.balanceInfoLabel}>{t('withdraw.minWithdraw')}</Text>
                  <Text style={styles.balanceInfoValue}>≥ {balance.minWithdrawChips.toLocaleString()}</Text>
                </View>
                <View style={styles.balanceInfoItem}>
                  <Text style={styles.balanceInfoLabel}>≈ USDT</Text>
                  <Text style={styles.balanceInfoValue}>≥ {balance.minWithdrawUsdt}</Text>
                </View>
                <View style={styles.balanceInfoItem}>
                  <Text style={styles.balanceInfoLabel}>{t('deposit.rate')}</Text>
                  <Text style={[styles.balanceInfoValue, { color: '#4ade80' }]}>1 = {balance.rate}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Form */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{t('withdraw.newRequest')}</Text>

            {/* Address */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('withdraw.receiveAddress')}</Text>
              <TextInput
                style={[styles.input, styles.inputMono, addressError ? styles.inputError : null]}
                value={toAddress}
                onChangeText={(v) => { setToAddress(v); setAddressError(''); }}
                placeholder="0x..."
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {addressError ? <Text style={styles.errorHint}>{addressError}</Text> : null}
            </View>

            {/* Amount */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('withdraw.amountChips')}</Text>
              <TextInput
                style={[styles.input, styles.inputYellow, amountError ? styles.inputError : null]}
                value={amountChips}
                onChangeText={(v) => { setAmountChips(v); setAmountError(''); }}
                placeholder={balance ? `≥ ${balance.minWithdrawChips}` : '1000'}
                placeholderTextColor="#6b7280"
                keyboardType="numeric"
              />
              {amountError ? (
                <Text style={styles.errorHint}>{amountError}</Text>
              ) : amountChips && balance ? (
                <Text style={styles.usdtHint}>≈ {(parseFloat(amountChips) / balance.rate).toFixed(2)} USDT</Text>
              ) : null}
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (submitting || !cooldown?.canWithdraw) && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting || !cooldown?.canWithdraw}
            >
              {submitting ? (
                <ActivityIndicator color="#ef4444" />
              ) : !cooldown?.canWithdraw ? (
                <Text style={styles.submitBtnText}>{t('withdraw.cooldown')}: {remainingSec}s</Text>
              ) : (
                <Text style={styles.submitBtnText}>{t('withdraw.submitButton')}</Text>
              )}
            </TouchableOpacity>

            {submitMsg && (
              <Text style={[styles.submitMsg, submitMsg.type === 'success' ? styles.submitSuccess : styles.submitError]}>
                {submitMsg.text}
              </Text>
            )}
          </View>

          {/* History */}
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>{t('withdraw.history')}</Text>
            {history.length === 0 ? (
              <Text style={styles.emptyHistory}>{t('withdraw.noHistory')}</Text>
            ) : (
              history.map((record) => {
                const sc = statusConfig(record.status, t);
                return (
                  <View key={record.id} style={styles.historyItem}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyDate}>{new Date(record.createdAt).toLocaleString()}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                      </View>
                    </View>
                    <View style={styles.historyRow}>
                      <Text style={styles.historyAmount}>-{record.amountChips.toLocaleString()} {t('deposit.chips')}</Text>
                      <Text style={styles.historyAddr}>{shortHash(record.toAddress)}</Text>
                    </View>
                    {record.txHash && (
                      <View style={styles.historyTxRow}>
                        <Text style={styles.historyTxLabel}>TX:</Text>
                        <Text style={styles.historyTxHash}>{shortHash(record.txHash)}</Text>
                        <Text style={styles.historyUsdt}>≈ {record.amountUsdt} USDT</Text>
                      </View>
                    )}
                    {record.status === 'FAILED' && record.failureReason && (
                      <Text style={styles.failReason}>{t('withdraw.failedReason')}: {record.failureReason}</Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060e10' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
    backgroundColor: '#0d1a14',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239,68,68,0.2)',
  },
  backText: { color: '#ef4444', fontSize: 15 },
  headerTitle: { color: '#e5e7eb', fontSize: 18, fontWeight: 'bold' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  errorText: { color: '#ef4444', fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  content: { padding: 16, gap: 14 },
  balanceCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  balanceLabel: { color: 'rgba(239,68,68,0.7)', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 14 },
  balanceValue: { color: '#ef4444', fontSize: 36, fontWeight: 'bold' },
  balanceUnit: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginLeft: 8 },
  balanceInfoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceInfoItem: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 10, alignItems: 'center', flex: 1, marginHorizontal: 4, borderWidth: 1, borderColor: 'rgba(239,68,68,0.12)' },
  balanceInfoLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 },
  balanceInfoValue: { color: '#ef4444', fontSize: 13, fontWeight: 'bold' },
  formCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
  },
  formTitle: { color: 'rgba(239,68,68,0.8)', fontSize: 13, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  field: { marginBottom: 14 },
  fieldLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#e5e7eb',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
  },
  inputMono: { fontFamily: 'Courier', color: '#ef4444' },
  inputYellow: { color: '#facc15' },
  inputError: { borderColor: 'rgba(239,68,68,0.5)' },
  errorHint: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  usdtHint: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 },
  submitBtn: {
    backgroundColor: 'rgba(239,68,68,0.25)',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.5)',
    marginTop: 4,
  },
  submitBtnDisabled: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.15)' },
  submitBtnText: { color: '#ef4444', fontSize: 15, fontWeight: 'bold' },
  submitMsg: { textAlign: 'center', fontSize: 13, marginTop: 10 },
  submitSuccess: { color: '#4ade80' },
  submitError: { color: '#ef4444' },
  historyCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
  },
  historyTitle: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239,68,68,0.15)',
  },
  emptyHistory: { color: 'rgba(255,255,255,0.35)', textAlign: 'center', paddingVertical: 30, fontSize: 14 },
  historyItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(239,68,68,0.08)' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  historyDate: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  statusBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyAmount: { color: '#facc15', fontSize: 13, fontWeight: '600' },
  historyAddr: { color: '#60a5fa', fontSize: 12, fontFamily: 'Courier' },
  historyTxRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  historyTxLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  historyTxHash: { color: '#60a5fa', fontSize: 11, fontFamily: 'Courier' },
  historyUsdt: { color: '#facc15', fontSize: 11 },
  failReason: { color: '#ef4444', fontSize: 12, marginTop: 4 },
});
