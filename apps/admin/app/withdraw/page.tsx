'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/layout/admin-layout';
import Badge from '@/components/ui/badge';
import { getWithdrawRequests, getWithdrawRequest, processWithdraw } from '@/lib/api';
import { ChevronLeft, ChevronRight, X, ExternalLink, RefreshCw } from 'lucide-react';

const EXPLORER_URL = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ?? 'https://sepolia.etherscan.io';

interface WithdrawRequest {
  id: string;
  userId: string;
  amountChips: number;
  amountUsdt: number;
  toAddress: string;
  fromAddress?: string;
  status: 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FAILED';
  txHash?: string;
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    nickname: string;
    avatar?: string;
  };
}

interface PaginatedData {
  data: WithdrawRequest[];
  total: number;
  page: number;
  limit: number;
}

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function txUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

function statusVariant(status: WithdrawRequest['status']): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'PENDING': return 'warning';
    case 'PROCESSING': return 'info';
    case 'CONFIRMED': return 'success';
    case 'FAILED': return 'danger';
    default: return 'default';
  }
}

function statusLabel(status: WithdrawRequest['status']): string {
  switch (status) {
    case 'PENDING': return '待处理';
    case 'PROCESSING': return '处理中';
    case 'CONFIRMED': return '已完成';
    case 'FAILED': return '已失败';
    default: return status;
  }
}

interface DetailModalProps {
  request: WithdrawRequest | null;
  onClose: () => void;
  onProcess: (id: string, action: 'APPROVE' | 'REJECT', reason?: string) => Promise<void>;
  processing: string | null;
}

function DetailModal({ request, onClose, onProcess, processing }: DetailModalProps) {
  const [action, setAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [reason, setReason] = useState('');

  if (!request) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action) return;
    await onProcess(request.id, action, reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161b27] border border-[#1e2535] rounded-2xl p-6 max-w-lg w-full">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">提现详情</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0f1117] rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">用户</p>
              <p className="text-white font-medium">{request.user?.nickname ?? request.userId}</p>
              <p className="text-slate-500 text-xs">@{request.user?.username}</p>
            </div>
            <div className="bg-[#0f1117] rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">状态</p>
              <Badge variant={statusVariant(request.status)}>{statusLabel(request.status)}</Badge>
              <p className="text-slate-500 text-xs mt-1">{formatDateTime(request.createdAt)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0f1117] rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">申请筹码</p>
              <p className="text-red-400 font-mono font-bold">{request.amountChips.toLocaleString()}</p>
            </div>
            <div className="bg-[#0f1117] rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">兑换 USDT</p>
              <p className="text-yellow-400 font-mono font-bold">{request.amountUsdt}</p>
            </div>
          </div>

          <div className="bg-[#0f1117] rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-1">收款地址</p>
            <div className="flex items-center gap-2">
              <p className="text-blue-400 font-mono text-xs break-all">{request.toAddress}</p>
              <a href={`https://sepolia.etherscan.io/address/${request.toAddress}`} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-blue-400 hover:text-blue-300">
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {request.txHash && (
            <div className="bg-[#0f1117] rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">交易哈希</p>
              <div className="flex items-center gap-2">
                <p className="text-blue-400 font-mono text-xs break-all">{request.txHash}</p>
                <a href={txUrl(request.txHash)} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 text-blue-400 hover:text-blue-300">
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}

          {request.failureReason && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-xs mb-1">失败原因</p>
              <p className="text-red-300 text-xs">{request.failureReason}</p>
            </div>
          )}
        </div>

        {request.status === 'PENDING' && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAction('APPROVE')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  action === 'APPROVE'
                    ? 'bg-green-600 text-white'
                    : 'bg-[#0f1117] text-slate-400 border border-[#1e2535] hover:bg-green-500/20'
                }`}
              >
                ✅ 批准转账
              </button>
              <button
                type="button"
                onClick={() => setAction('REJECT')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  action === 'REJECT'
                    ? 'bg-red-600 text-white'
                    : 'bg-[#0f1117] text-slate-400 border border-[#1e2535] hover:bg-red-500/20'
                }`}
              >
                ❌ 拒绝
              </button>
            </div>

            {action && (
              <div>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="备注原因（拒绝时必填）"
                  className="w-full bg-[#0f1117] border border-[#1e2535] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-slate-400 hover:bg-white/5 rounded-lg">
                取消
              </button>
              <button
                type="submit"
                disabled={!action || (action === 'REJECT' && !reason) || processing === request.id}
                className={`px-4 py-2 text-sm disabled:opacity-50 text-white rounded-lg ${
                  action === 'REJECT' ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
                }`}
              >
                {processing === request.id ? '处理中...' : action === 'APPROVE' ? '确认批准' : '确认拒绝'}
              </button>
            </div>
          </form>
        )}

        {request.status !== 'PENDING' && (
          <div className="mt-5 flex justify-end">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:bg-white/5 rounded-lg">
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WithdrawPage() {
  const [data, setData] = useState<PaginatedData | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WithdrawRequest | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getWithdrawRequests({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpen = async (id: string) => {
    try {
      const full = await getWithdrawRequest(id);
      setSelected(full);
    } catch (e) {
      console.error('Failed to load withdraw detail', e);
    }
  };

  const handleProcess = async (id: string, action: 'APPROVE' | 'REJECT', reason?: string) => {
    setProcessing(id);
    try {
      await processWithdraw(id, action, reason);
      await fetchData();
      setSelected(null);
    } finally {
      setProcessing(null);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const pendingCount = data?.data.filter(r => r.status === 'PENDING').length ?? 0;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">提现管理</h1>
            <p className="text-slate-400 text-sm">管理用户 USDT 提现请求</p>
          </div>
          <button
            onClick={() => { fetchData(); setLastRefresh(new Date()); }}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={14} />
            刷新 ({lastRefresh.toLocaleTimeString()})
          </button>
        </div>

        {/* Filter */}
        <div className="flex gap-3 mb-6">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-[#161b27] border border-[#1e2535] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500">
            <option value="">全部状态</option>
            {['PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED'].map(s => (
              <option key={s} value={s}>{statusLabel(s as any)}</option>
            ))}
          </select>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
              ⏳ {pendingCount} 个待处理请求
            </div>
          )}
        </div>

        {/* Mobile card list */}
        <div className="md:hidden space-y-3 mb-4">
          {loading ? (
            <div className="text-center py-12 text-slate-500">加载中...</div>
          ) : data?.data?.length === 0 ? (
            <div className="text-center py-12 text-slate-500">暂无提现记录</div>
          ) : (
            data?.data?.map((req) => (
              <div key={req.id} className="bg-[#161b27] border border-[#1e2535] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">{req.user?.nickname ?? '-'}</p>
                    <p className="text-slate-500 text-xs">@{req.user?.username ?? req.userId.slice(0, 8)}</p>
                  </div>
                  <Badge variant={statusVariant(req.status)}>{statusLabel(req.status)}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">筹码：</span><span className="font-mono text-red-400">-{req.amountChips.toLocaleString()}</span></div>
                  <div><span className="text-slate-500">USDT：</span><span className="font-mono text-yellow-400">≈ {req.amountUsdt}</span></div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-blue-400 font-mono text-xs">{shortAddress(req.toAddress)}</span>
                  <a href={`https://sepolia.etherscan.io/address/${req.toAddress}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                    <ExternalLink size={11} />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">{formatDateTime(req.createdAt)}</span>
                  <button onClick={() => void handleOpen(req.id)} className="text-indigo-400 hover:text-indigo-300 text-xs underline">查看</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-[#161b27] border border-[#1e2535] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-[#1e2535]">
                {['用户', '筹码', 'USDT', '收款地址', '状态', '时间', '操作'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">加载中...</td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">暂无提现记录</td></tr>
              ) : (
                data?.data?.map((req) => (
                  <tr key={req.id} className="border-b border-[#1e2535] hover:bg-white/2">
                    <td className="px-4 py-3">
                      <p className="text-white">{req.user?.nickname ?? '-'}</p>
                      <p className="text-slate-500 text-xs">@{req.user?.username ?? req.userId.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-red-400">-{req.amountChips.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-yellow-400">≈ {req.amountUsdt}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-blue-400 font-mono text-xs">{shortAddress(req.toAddress)}</span>
                        <a href={`https://sepolia.etherscan.io/address/${req.toAddress}`} target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300">
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(req.status)}>{statusLabel(req.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDateTime(req.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => void handleOpen(req.id)}
                        className="text-indigo-400 hover:text-indigo-300 text-xs underline"
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-slate-500 text-sm">第 {page} / {totalPages} 页，共 {data?.total ?? 0} 条</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-lg bg-[#161b27] border border-[#1e2535] text-slate-400 disabled:opacity-40 hover:bg-white/5">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-2 rounded-lg bg-[#161b27] border border-[#1e2535] text-slate-400 disabled:opacity-40 hover:bg-white/5">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {selected && (
          <DetailModal
            request={selected}
            onClose={() => setSelected(null)}
            onProcess={handleProcess}
            processing={processing}
          />
        )}
      </div>
    </AdminLayout>
  );
}
