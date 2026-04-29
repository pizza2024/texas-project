"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/admin-layout";
import StatCard from "@/components/ui/stat-card";
import { getOverview, getRevenue, getUserGrowth } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import type { OverviewStats, RevenueItem, GrowthItem } from "@/lib/types";

export default function DashboardPage() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [revenue, setRevenue] = useState<RevenueItem[]>([]);
  const [growth, setGrowth] = useState<GrowthItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getOverview(), getRevenue("day", 14), getUserGrowth(14)])
      .then(([ov, rev, gr]) => {
        setOverview(ov);
        setRevenue(
          rev.map((r: RevenueItem) => ({ ...r, date: r.date.slice(5) })),
        );
        setGrowth(gr.map((g: GrowthItem) => ({ ...g, date: g.date.slice(5) })));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-4 sm:p-6 lg:p-8 text-slate-400 text-sm">
          加载中...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-white mb-6">数据总览</h1>

        {/* Stat cards — 2 cols on mobile, 4 cols on sm+ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="总用户数"
            value={overview?.totalUsers ?? 0}
            icon="👥"
            color="blue"
          />
          <StatCard
            title="活跃房间"
            value={overview?.activeRooms ?? 0}
            icon="🏠"
            color="green"
          />
          <StatCard
            title="总牌局数"
            value={overview?.totalHands ?? 0}
            icon="🃏"
            color="purple"
          />
          <StatCard
            title="今日流水"
            value={`¥${(overview?.todayFlow ?? 0).toLocaleString()}`}
            icon="💰"
            color="yellow"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-4 sm:p-6">
            <h2 className="text-white font-medium mb-4">近14天流水</h2>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={revenue}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#161b27",
                    border: "1px solid #1e2535",
                    borderRadius: 8,
                    color: "#e2e8f0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#6366f1"
                  fill="url(#colorRev)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-4 sm:p-6">
            <h2 className="text-white font-medium mb-4">近14天新用户</h2>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#161b27",
                    border: "1px solid #1e2535",
                    borderRadius: 8,
                    color: "#e2e8f0",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
