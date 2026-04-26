'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AdminLayout from '@/components/layout/admin-layout';
import Badge from '@/components/ui/badge';
import { getUserById, updateUser, getUserTransactions, banUser, unbanUser } from '@/lib/api';
import type { User, Transaction, PaginatedResponse } from '@/lib/types';
import { ArrowLeft, UserX, UserCheck } from 'lucide-react';
import Link from 'next/link';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [txs, setTxs] = useState<PaginatedResponse<Transaction> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function load() {
    setLoading(true);
    try {
      const [u, t] = await Promise.all([getUserById(id), getUserTransactions(id, { page: 1, limit: 10 })]);
      setUser(u);
      setTxs(t);
      setEditRole(u.role);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [load]);

  async function handleSaveRole() {
    setSaving(true);
    await updateUser(id, { role: editRole });
    await load();
    setSaving(false);
  }

  if (loading) return <AdminLayout><div className="p-8 text-slate-400">加载中...</div></AdminLayout>;
  if (!user) return <AdminLayout><div className="p-8 text-slate-400">用户不存在</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/users" className="text-slate-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <h1 className="text-2xl font-bold text-white">用户详情</h1>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* User Info Card */}
          <div className="xl:col-span-1 bg-[#161b27] border border-[#1e2535] rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center text-2xl">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${process.env.NEXT_PUBLIC_API_URL}${user.avatar}`} className="w-14 h-14 rounded-full object-cover" alt="" />
                ) : '👤'}
              </div>
              <div>
                <p className="text-white font-bold text-lg">{user.nickname}</p>
                <p className="text-slate-400 text-sm">@{user.username}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-[#1e2535]">
              {[
                { label: '用户ID', value: user.id, mono: true },
                { label: '状态', value: user.status },
                { label: '余额', value: user.coinBalance?.toLocaleString() },
                { label: '注册时间', value: new Date(user.createdAt).toLocaleDateString('zh-CN') },
                { label: '最后登录', value: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('zh-CN') : '-' },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label}</span>
                  <span className={`text-white ${mono ? 'font-mono text-xs' : ''} truncate max-w-[140px]`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Role edit */}
            <div className="space-y-2 pt-2 border-t border-[#1e2535]">
              <label className="text-slate-400 text-sm">修改角色</label>
              <div className="flex gap-2">
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="flex-1 bg-[#0d1117] border border-[#1e2535] rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="PLAYER">PLAYER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
                <button
                  onClick={handleSaveRole}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-lg"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>

            {/* Ban / Unban */}
            {user.role !== 'SUPER_ADMIN' && (
              <div className="pt-2 border-t border-[#1e2535]">
                {user.status === 'BANNED' ? (
                  <button
                    onClick={async () => { await unbanUser(id); load(); }}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-sm rounded-lg transition-colors"
                  >
                    <UserCheck size={15} /> 解封用户
                  </button>
                ) : (
                  <button
                    onClick={async () => { await banUser(id); load(); }}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-colors"
                  >
                    <UserX size={15} /> 封禁用户
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Transactions */}
          <div className="xl:col-span-2 bg-[#161b27] border border-[#1e2535] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1e2535]">
              <h2 className="text-white font-medium">最近资金流水</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2535]">
                  {['类型', '金额', '时间'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txs?.items.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-8 text-slate-500">暂无流水</td></tr>
                ) : (
                  txs?.items.map((tx) => (
                    <tr key={tx.id} className="border-b border-[#1e2535]">
                      <td className="px-4 py-3">
                        <Badge variant={tx.amount > 0 ? 'success' : 'danger'}>
                          {tx.type}
                        </Badge>
                      </td>
                      <td className={`px-4 py-3 font-mono ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(tx.createdAt).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
