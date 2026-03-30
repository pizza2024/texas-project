"use client";

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/layout/admin-layout";
import Badge from "@/components/ui/badge";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { getUsers, banUser, unbanUser, adjustBalance } from "@/lib/api";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  UserX,
  UserCheck,
  PlusCircle,
} from "lucide-react";
import Link from "next/link";
import { PaginatedResponse, User } from "@/lib/types";

interface BadgeConfig {
  variant: "success" | "info" | "default" | "danger" | "warning";
  label: string;
}

function statusBadge(status: string) {
  const map: Record<string, BadgeConfig> = {
    ONLINE: { variant: "success", label: "在线" },
    PLAYING: { variant: "info", label: "游戏中" },
    OFFLINE: { variant: "default", label: "离线" },
    BANNED: { variant: "danger", label: "已封禁" },
  };
  const s = map[status] ?? { variant: "default" as const, label: status };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function roleBadge(role: string) {
  const map: Record<string, BadgeConfig> = {
    SUPER_ADMIN: { variant: "danger", label: "超管" },
    ADMIN: { variant: "warning", label: "管理员" },
    PLAYER: { variant: "default", label: "玩家" },
  };
  const r = map[role] ?? { variant: "default" as const, label: role };
  return <Badge variant={r.variant}>{r.label}</Badge>;
}

export default function UsersPage() {
  const [data, setData] = useState<PaginatedResponse<User> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ type: string; user: User } | null>(
    null,
  );
  const [balanceAmount, setBalanceAmount] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsers({
        page,
        limit: 20,
        search: search || undefined,
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">用户管理</h1>
          <span className="text-slate-400 text-sm">
            共 {data?.total ?? 0} 名用户
          </span>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索用户名/昵称..."
              className="w-full bg-[#161b27] border border-[#1e2535] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2.5 rounded-lg transition-colors"
          >
            搜索
          </button>
        </form>

        {/* Table */}
        <div className="bg-[#161b27] border border-[#1e2535] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2535]">
                {[
                  "昵称",
                  "用户名",
                  "角色",
                  "状态",
                  "余额",
                  "注册时间",
                  "操作",
                ].map((h) => (
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
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    加载中...
                  </td>
                </tr>
              ) : data?.data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                data?.data?.map((user: any) => (
                  <tr
                    key={user.id}
                    className="border-b border-[#1e2535] hover:bg-white/2 transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-medium">
                      <Link
                        href={`/users/${user.id}`}
                        className="hover:text-indigo-400 transition-colors"
                      >
                        {user.nickname}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {user.username}
                    </td>
                    <td className="px-4 py-3">{roleBadge(user.role)}</td>
                    <td className="px-4 py-3">{statusBadge(user.status)}</td>
                    <td className="px-4 py-3 text-green-400 font-mono">
                      {user.coinBalance.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {user.status === "BANNED" ? (
                          <button
                            onClick={() => setDialog({ type: "unban", user })}
                            className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
                          >
                            <UserCheck size={13} /> 解封
                          </button>
                        ) : (
                          <button
                            onClick={() => setDialog({ type: "ban", user })}
                            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                          >
                            <UserX size={13} /> 封禁
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setBalanceAmount("");
                            setDialog({ type: "balance", user });
                          }}
                          className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300"
                        >
                          <PlusCircle size={13} /> 余额
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-slate-500 text-sm">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-[#161b27] border border-[#1e2535] text-slate-400 disabled:opacity-40 hover:bg-white/5"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-[#161b27] border border-[#1e2535] text-slate-400 disabled:opacity-40 hover:bg-white/5"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Dialogs */}
        {dialog?.type === "ban" && (
          <ConfirmDialog
            title="封禁用户"
            message={`确定要封禁用户 "${dialog.user.nickname}" 吗？封禁后该用户将无法登录。`}
            confirmLabel="封禁"
            danger
            onConfirm={async () => {
              await banUser(dialog.user.id);
              fetchUsers();
            }}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog?.type === "unban" && (
          <ConfirmDialog
            title="解封用户"
            message={`确定要解封用户 "${dialog.user.nickname}" 吗？`}
            confirmLabel="解封"
            onConfirm={async () => {
              await unbanUser(dialog.user.id);
              fetchUsers();
            }}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog?.type === "balance" && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#161b27] border border-[#1e2535] rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-white font-semibold mb-1">调整余额</h3>
              <p className="text-slate-400 text-sm mb-4">
                用户：{dialog.user.nickname}（当前余额：
                {dialog.user.coinBalance}）
              </p>
              <input
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="正数增加，负数扣减"
                className="w-full bg-[#0f1117] border border-[#1e2535] rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 mb-4"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDialog(null)}
                  className="px-4 py-2 text-sm text-slate-400 hover:bg-white/5 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    const amt = parseFloat(balanceAmount);
                    if (!isNaN(amt)) {
                      await adjustBalance(
                        dialog.user.id,
                        amt,
                        "Admin adjustment",
                      );
                      fetchUsers();
                      setDialog(null);
                    }
                  }}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  确认调整
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
