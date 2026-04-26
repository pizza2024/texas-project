'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/layout/admin-layout';
import { getRevenue, getUserGrowth, getRoomHotList, getHandsStats } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import type { RevenueItem, GrowthItem, HotRoom, HandsStats } from '@/lib/types';

const tooltipStyle = {
  contentStyle: { background: '#161b27', border: '1px solid #1e2535', borderRadius: 8, color: '#e2e8f0' },
};

export default function AnalyticsPage() {
  const [revenue, setRevenue] = useState<RevenueItem[]>([]);
  const [growth, setGrowth] = useState<GrowthItem[]>([]);
  const [hotRooms, setHotRooms] = useState<HotRoom[]>([]);
  const [handsStats, setHandsStats] = useState<HandsStats | null>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [loading, setLoading] = useState(true);

  async function loadRevenue(p: 'day' | 'week' | 'month') {
    const rev = await getRevenue(p, p === 'month' ? 12 : 30);
    setRevenue(rev.map((r: RevenueItem) => ({ ...r, date: r.date.slice(5) })));
  }

  useEffect(() => {
    Promise.all([getRevenue('day', 30), getUserGrowth(30), getRoomHotList(), getHandsStats()])
      .then(([rev, gr, rooms, hands]) => {
        setRevenue(rev.map((r: RevenueItem) => ({ ...r, date: r.date.slice(5) })));
        setGrowth(gr.map((g: GrowthItem) => ({ ...g, date: g.date.slice(5) })));
        setHotRooms(rooms);
        setHandsStats(hands);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminLayout><div className="p-4 sm:p-6 lg:p-8 text-slate-400">加载中...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <h1 className="text-2xl font-bold text-white">数据统计</h1>

        {/* Hands stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '总牌局数', value: handsStats?.total ?? 0, color: 'text-indigo-400' },
            { label: '平均底池', value: (handsStats?.avgPot ?? 0).toFixed(1), color: 'text-yellow-400' },
            { label: '总底池', value: (handsStats?.totalPot ?? 0).toLocaleString(), color: 'text-green-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#161b27] border border-[#1e2535] rounded-xl p-5">
              <p className="text-slate-400 text-sm">{label}</p>
              <p className={`text-2xl font-bold mt-1 font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Revenue Chart */}
        <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-medium">流水趋势</h2>
            <div className="flex gap-2">
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => { setPeriod(p); loadRevenue(p); }}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${period === p ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}
                >
                  {{ day: '日', week: '周', month: '月' }[p]}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" minHeight={200}>
            <AreaChart data={revenue}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="amount" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Growth Chart */}
        <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-6">
          <h2 className="text-white font-medium mb-4">用户增长（近30天）</h2>
          <ResponsiveContainer width="100%" minHeight={180}>
            <BarChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hot rooms */}
        <div className="bg-[#161b27] border border-[#1e2535] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e2535]">
            <h2 className="text-white font-medium">房间热度排行 TOP 10</h2>
          </div>
          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-[#1e2535]">
            {hotRooms.length === 0 ? (
              <div className="text-center py-8 text-slate-500">暂无数据</div>
            ) : (
              hotRooms.map((room, idx) => (
                <div key={room.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-mono text-xs">#{idx + 1}</span>
                    <span className="text-white text-sm">{room.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${room.status === 'ACTIVE' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {room.status === 'ACTIVE' ? '正常' : '维护中'}
                    </span>
                    <span className="text-indigo-400 font-mono text-sm">{room.handCount}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-[#1e2535]">
                  {['排名', '房间名称', '状态', '历史牌局数'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hotRooms.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-500">暂无数据</td></tr>
                ) : (
                  hotRooms.map((room, idx) => (
                    <tr key={room.id} className="border-b border-[#1e2535]">
                      <td className="px-4 py-3 text-slate-400 font-mono">#{idx + 1}</td>
                      <td className="px-4 py-3 text-white">{room.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${room.status === 'ACTIVE' ? 'text-green-400' : 'text-yellow-400'}`}>
                          {room.status === 'ACTIVE' ? '正常' : '维护中'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-indigo-400 font-mono">{room.handCount}</td>
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
