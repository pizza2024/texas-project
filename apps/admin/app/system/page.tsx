"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/admin-layout";
import {
  getSystemStatus,
  getAdminLogs,
  toggleMaintenance,
  sendBroadcast,
} from "@/lib/api";
import Badge from "@/components/ui/badge";

function formatUptime(seconds: number): string {
  if (!seconds) return "0秒";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}小时${m}分`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

export default function SystemPage() {
  const [status, setStatus] = useState<any>(null);
  const [logs, setLogs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastType, setBroadcastType] = useState<
    "info" | "warning" | "error"
  >("info");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSystemStatus(), getAdminLogs({ page: 1, limit: 20 })])
      .then(([s, l]) => {
        setStatus(s);
        setLogs(l);
        setMaintenance(s.maintenanceMode);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleToggleMaintenance() {
    setToggling(true);
    try {
      const res = await toggleMaintenance(!maintenance);
      setMaintenance(res.maintenanceMode);
    } finally {
      setToggling(false);
    }
  }

  async function handleBroadcast() {
    if (!broadcastMsg.trim()) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await sendBroadcast(broadcastMsg, broadcastType);
      setBroadcastResult(`广播已发送，当前在线 ${res.connectedCount} 人`);
      setBroadcastMsg("");
    } catch {
      setBroadcastResult("发送失败");
    } finally {
      setBroadcasting(false);
    }
  }

  function actionBadge(action: string) {
    const map: Record<string, any> = {
      BAN_USER: { variant: "danger", label: "封禁用户" },
      UNBAN_USER: { variant: "success", label: "解封用户" },
      ADJUST_BALANCE: { variant: "warning", label: "调整余额" },
      DELETE_ROOM: { variant: "danger", label: "删除房间" },
      KICK_USER: { variant: "danger", label: "踢出玩家" },
      MAINTENANCE: { variant: "info", label: "维护模式" },
      BROADCAST: { variant: "default", label: "广播消息" },
    };
    const a = map[action] ?? { variant: "default", label: action };
    return <Badge variant={a.variant}>{a.label}</Badge>;
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-8 text-slate-400 text-sm">加载中...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-bold text-white">系统管理</h1>

        {/* System Status */}
        <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-6">
          <h2 className="text-white font-medium mb-4">系统状态</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "运行时间", value: formatUptime(status?.uptime) },
              {
                label: "内存使用",
                value: `${status?.memoryUsed ?? 0} MB / ${status?.memoryTotal ?? 0} MB`,
              },
              { label: "Node 版本", value: status?.nodeVersion ?? "N/A" },
              { label: "平台", value: status?.platform ?? "N/A" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#0f1117] rounded-lg p-4">
                <p className="text-slate-400 text-xs mb-1">{label}</p>
                <p className="text-white font-mono text-sm">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-medium mb-1">维护模式</h2>
              <p className="text-slate-400 text-sm">
                开启后，普通玩家将无法登录或进行游戏
              </p>
            </div>
            <button
              onClick={handleToggleMaintenance}
              disabled={toggling}
              className={`relative px-6 py-3 rounded-lg font-medium text-sm transition-all ${
                maintenance
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
              } disabled:opacity-50`}
            >
              {toggling ? "切换中..." : maintenance ? "关闭维护" : "开启维护"}
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-slate-500">当前状态：</span>
            <Badge variant={maintenance ? "danger" : "success"}>
              {maintenance ? "维护中" : "正常运行"}
            </Badge>
          </div>
        </div>

        {/* Broadcast */}
        <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-6">
          <h2 className="text-white font-medium mb-4">系统广播</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                广播内容
              </label>
              <textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="输入要广播的消息内容..."
                rows={3}
                className="w-full bg-[#0f1117] border border-[#1e2535] rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                {(["info", "warning", "error"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setBroadcastType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      broadcastType === t
                        ? t === "info"
                          ? "bg-blue-500/30 text-blue-400"
                          : t === "warning"
                            ? "bg-yellow-500/30 text-yellow-400"
                            : "bg-red-500/30 text-red-400"
                        : "bg-white/5 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    {{ info: "通知", warning: "警告", error: "紧急" }[t]}
                  </button>
                ))}
              </div>
              <button
                onClick={handleBroadcast}
                disabled={broadcasting || !broadcastMsg.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {broadcasting ? "发送中..." : "发送广播"}
              </button>
            </div>
            {broadcastResult && (
              <p className="text-sm text-slate-400">{broadcastResult}</p>
            )}
          </div>
        </div>

        {/* Admin Logs */}
        <div className="bg-[#161b27] border border-[#1e2535] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e2535]">
            <h2 className="text-white font-medium">操作日志</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2535]">
                {["时间", "管理员", "操作", "对象", "详情"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-slate-400 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs?.data?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    暂无日志
                  </td>
                </tr>
              ) : (
                logs?.data?.map((log: any) => (
                  <tr
                    key={log.id}
                    className="border-b border-[#1e2535] hover:bg-white/2"
                  >
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(log.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {log.admin?.nickname ?? log.admin?.username ?? "N/A"}
                    </td>
                    <td className="px-4 py-3">{actionBadge(log.action)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {log.targetId ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {log.detail
                        ? (JSON.parse(log.detail)?.reason ??
                          JSON.stringify(JSON.parse(log.detail)))
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
