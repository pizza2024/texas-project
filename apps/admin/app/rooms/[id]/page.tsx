"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AdminLayout from "@/components/layout/admin-layout";
import Badge from "@/components/ui/badge";
import { getRoomById, toggleRoomMaintenance, deleteRoom } from "@/lib/api";
import type { Room, Table } from "@/lib/types";
import { ArrowLeft, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/confirm-dialog";

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function load() {
    setLoading(true);
    try {
      setRoom(await getRoomById(id));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <AdminLayout>
        <div className="p-8 text-slate-400">加载中...</div>
      </AdminLayout>
    );
  if (!room)
    return (
      <AdminLayout>
        <div className="p-8 text-slate-400">房间不存在</div>
      </AdminLayout>
    );

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/rooms" className="text-slate-400 hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-white">房间详情</h1>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Info */}
          <div className="xl:col-span-1 bg-[#161b27] border border-[#1e2535] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">{room.name}</h2>
              <Badge variant={room.status === "ACTIVE" ? "success" : "warning"}>
                {room.status === "ACTIVE" ? "正常" : "维护中"}
              </Badge>
            </div>
            {room.password && (
              <p className="text-yellow-400 text-sm">
                🔒 私有房间（已设置密码）
              </p>
            )}

            <div className="space-y-3 pt-2 border-t border-[#1e2535] text-sm">
              {[
                {
                  label: "盲注",
                  value: `${room.blindSmall} / ${room.blindBig}`,
                },
                { label: "最大人数", value: room.maxPlayers },
                { label: "最低买入", value: room.minBuyIn.toLocaleString() },
                {
                  label: "创建时间",
                  value: new Date(room.createdAt).toLocaleDateString("zh-CN"),
                },
                { label: "牌桌数量", value: room.tables?.length ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white">{value}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-[#1e2535]">
              <button
                onClick={async () => {
                  await toggleRoomMaintenance(id);
                  load();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-sm rounded-lg transition-colors"
              >
                <Wrench size={14} />
                {room.status === "MAINTENANCE" ? "恢复正常" : "切换维护模式"}
              </button>
              <button
                onClick={() => setDeleteDialog(true)}
                className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-colors"
              >
                删除房间
              </button>
            </div>
          </div>

          {/* Tables */}
          <div className="xl:col-span-2 bg-[#161b27] border border-[#1e2535] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1e2535]">
              <h2 className="text-white font-medium">牌桌列表</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2535]">
                  {["牌桌ID", "状态", "快照时间"].map((h) => (
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
                {room.tables?.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-slate-500">
                      暂无牌桌
                    </td>
                  </tr>
                ) : (
                  room.tables?.map((table: Table) => (
                    <tr key={table.id} className="border-b border-[#1e2535]">
                      <td className="px-4 py-3 text-white font-mono text-xs">
                        {table.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            table.state === "WAITING" ? "default" : "info"
                          }
                        >
                          {table.state}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {table.snapshotUpdatedAt
                          ? new Date(table.snapshotUpdatedAt).toLocaleString(
                              "zh-CN",
                            )
                          : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {deleteDialog && (
          <ConfirmDialog
            title="删除房间"
            message={`确定要删除房间 "${room.name}" 吗？此操作不可撤销。`}
            confirmLabel="删除"
            danger
            onConfirm={async () => {
              await deleteRoom(id);
              router.push("/rooms");
            }}
            onClose={() => setDeleteDialog(false)}
          />
        )}
      </div>
    </AdminLayout>
  );
}
