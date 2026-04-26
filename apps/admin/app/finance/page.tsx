'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/layout/admin-layout';
import Badge from '@/components/ui/badge';
import { getTransactions, getFinanceSummary, deposit, withdraw } from '@/lib/api';
import type { PaginatedTransactions, FinanceSummary, Transaction } from '@/lib/types';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type TxVariant = 'success' | 'danger' | 'info' | 'warning' | 'default';

function FinanceModal({ type, onClose, onConfirm }: { type: 'deposit' | 'withdraw'; onClose: () => void; onConfirm: (userId: string, amount: number, reason: string) => Promise<void> }) {
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onConfirm(userId, parseFloat(amount), reason);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161b27] border border-[#1e2535] rounded-2xl p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{type === 'deposit' ? '手动充值' : '手动扣款'}</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">用户ID</label>
            <input value={userId} onChange={(e) => setUserId(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#1e2535] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              placeholder="粘贴用户UUID" required />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">金额</label>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#1e2535] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              placeholder="0" required />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">备注</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#1e2535] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              placeholder="操作原因（可选）" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:bg-white/5 rounded-lg">取消</button>
            <button type="submit" disabled={saving}
              className={`px-4 py-2 text-sm disabled:opacity-50 text-white rounded-lg ${type === 'deposit' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}>
              {saving ? '处理中...' : type === 'deposit' ? '确认充值' : '确认扣款'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const [data, setData] = useState<PaginatedTransactions | null>(null);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'deposit' | 'withdraw' | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [txs, sum] = await Promise.all([
        getTransactions({ page, limit: 20, type: typeFilter || undefined }),
        getFinanceSummary(),
      ]);
      setData(txs);
      setSummary(sum);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  const txTypeVariant: Record<string, TxVariant> = {
    DEPOSIT: 'success', WITHDRAW: 'danger', GAME_WIN: 'info', GAME_LOSS: 'warning',
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-white mb-6">财务管理</h1>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: '系统总资产', value: summary?.totalAssets, color: 'text-green-400' },
            { label: '今日流水', value: summary?.dayFlow, color: 'text-blue-400' },
            { label: '本周流水', value: summary?.weekFlow, color: 'text-purple-400' },
            { label: '本月流水', value: summary?.monthFlow, color: 'text-yellow-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#161b27] border border-[#1e2535] rounded-xl p-5">
              <p className="text-slate-400 text-sm">{label}</p>
              <p className={`text-2xl font-bold mt-1 font-mono ${color}`}>
                {(value ?? 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <button onClick={() => setModal('deposit')}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2.5 rounded-lg transition-colors">
            ＋ 手动充值
          </button>
          <button onClick={() => setModal('withdraw')}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm px-4 py-2.5 rounded-lg transition-colors">
            － 手动扣款
          </button>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="bg-[#161b27] border border-[#1e2535] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 ml-auto">
            <option value="">全部类型</option>
            {['DEPOSIT', 'WITHDRAW', 'GAME_WIN', 'GAME_LOSS'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="bg-[#161b27] border border-[#1e2535] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2535]">
                {['用户', '类型', '金额', '时间'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-12 text-slate-500">加载中...</td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-slate-500">暂无记录</td></tr>
              ) : (
                data?.data?.map((tx: Transaction) => (
                  <tr key={tx.id} className="border-b border-[#1e2535] hover:bg-white/2">
                    <td className="px-4 py-3 text-white">{tx.user?.nickname ?? '-'}</td>
                    <td className="px-4 py-3"><Badge variant={txTypeVariant[tx.type] ?? 'default'}>{tx.type}</Badge></td>
                    <td className={`px-4 py-3 font-mono ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(tx.createdAt).toLocaleString('zh-CN')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-slate-500 text-sm">第 {page} / {totalPages} 页</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-lg bg-[#161b27] border border-[#1e2535] text-slate-400 disabled:opacity-40 hover:bg-white/5"><ChevronLeft size={16} /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-2 rounded-lg bg-[#161b27] border border-[#1e2535] text-slate-400 disabled:opacity-40 hover:bg-white/5"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {modal && (
          <FinanceModal
            type={modal}
            onClose={() => setModal(null)}
            onConfirm={async (userId, amount, reason) => {
              if (modal === 'deposit') await deposit(userId, amount, reason);
              else await withdraw(userId, amount, reason);
              fetchData();
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
}
