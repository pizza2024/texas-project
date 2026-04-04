'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/layout/admin-layout';
import Badge from '@/components/ui/badge';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { getRooms, deleteRoom, toggleRoomMaintenance, createRoom, updateRoom } from '@/lib/api';
import { Search, ChevronLeft, ChevronRight, Trash2, Settings, Plus, X } from 'lucide-react';
import Link from 'next/link';

function RoomModal({ room, onClose, onSave }: { room?: any; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [form, setForm] = useState({
    name: room?.name ?? '',
    blindSmall: room?.blindSmall ?? 5,
    blindBig: room?.blindBig ?? 10,
    maxPlayers: room?.maxPlayers ?? 9,
    minBuyIn: room?.minBuyIn ?? 100,
    password: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      ...(form.password ? { password: form.password } : {}),
    };
    await onSave(payload);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161b27] border border-[#1e2535] rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{room ? '编辑房间' : '新建房间'}</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'name', label: '房间名称', type: 'text' },
            { key: 'blindSmall', label: '小盲注', type: 'number' },
            { key: 'blindBig', label: '大盲注', type: 'number' },
            { key: 'maxPlayers', label: '最大人数', type: 'number' },
            { key: 'minBuyIn', label: '最低买入', type: 'number' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-sm text-slate-400 mb-1">{label}</label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={(e) => setForm(f => ({ ...f, [key]: type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
                className="w-full bg-[#0f1117] border border-[#1e2535] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          ))}
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              房间密码 {room ? '(留空则保持不变)' : '(留空为公开房间)'}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-[#0f1117] border border-[#1e2535] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              autoComplete="new-password"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:bg-white/5 rounded-lg">取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoomCard({ room, onEdit, onToggle, onDelete }: { room: any; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/rooms/${room.id}`} className="text-white font-medium hover:text-indigo-400">
            {room.name}
          </Link>
          {room.password && <span className="ml-2 text-xs text-yellow-500">🔒</span>}
        </div>
        <Badge variant={room.status === 'ACTIVE' ? 'success' : 'warning'}>
          {room.status === 'ACTIVE' ? '正常' : '维护中'}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
        <div><span className="text-slate-500">盲注：</span><span className="font-mono text-white">{room.blindSmall}/{room.blindBig}</span></div>
        <div><span className="text-slate-500">人数：</span><span className="text-white">{room.maxPlayers}</span></div>
        <div><span className="text-slate-500">买入：</span><span className="font-mono text-white">{room.minBuyIn}</span></div>
      </div>
      <p className="text-slate-500 text-xs">牌桌数：{room.tables?.length ?? 0}</p>
      <div className="flex gap-2 flex-wrap">
        <button onClick={onEdit} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
          <Settings size={13} /> 编辑
        </button>
        <button onClick={onToggle} className="text-xs text-yellow-400 hover:text-yellow-300">
          {room.status === 'MAINTENANCE' ? '恢复' : '维护'}
        </button>
        <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
          <Trash2 size={13} /> 删除
        </button>
      </div>
    </div>
  );
}

export default function RoomsPage() {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<any>(null);
  const [roomModal, setRoomModal] = useState<{ open: boolean; room?: any }>({ open: false });

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRooms({ page, limit: 20, search: search || undefined });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">房间管理</h1>
          <button
            onClick={() => setRoomModal({ open: true })}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} /> 新建房间
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索房间名..."
              className="w-full bg-[#161b27] border border-[#1e2535] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2.5 rounded-lg">搜索</button>
        </form>

        {/* Mobile card list */}
        <div className="md:hidden space-y-3 mb-4">
          {loading ? (
            <div className="text-center py-12 text-slate-500">加载中...</div>
          ) : data?.data?.length === 0 ? (
            <div className="text-center py-12 text-slate-500">暂无房间</div>
          ) : (
            data?.data?.map((room: any) => (
              <RoomCard
                key={room.id}
                room={room}
                onEdit={() => setRoomModal({ open: true, room })}
                onToggle={async () => { await toggleRoomMaintenance(room.id); fetchRooms(); }}
                onDelete={() => setDeleteDialog(room)}
              />
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-[#161b27] border border-[#1e2535] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-[#1e2535]">
                  {['房间名称', '盲注', '最大人数', '最低买入', '状态', '牌桌数', '操作'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500">加载中...</td></tr>
                ) : data?.data?.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500">暂无房间</td></tr>
                ) : (
                  data?.data?.map((room: any) => (
                    <tr key={room.id} className="border-b border-[#1e2535] hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">
                        <Link href={`/rooms/${room.id}`} className="hover:text-indigo-400">{room.name}</Link>
                        {room.password && <span className="ml-2 text-xs text-yellow-500">🔒</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono">{room.blindSmall}/{room.blindBig}</td>
                      <td className="px-4 py-3 text-slate-400">{room.maxPlayers}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono">{room.minBuyIn}</td>
                      <td className="px-4 py-3">
                        <Badge variant={room.status === 'ACTIVE' ? 'success' : 'warning'}>
                          {room.status === 'ACTIVE' ? '正常' : '维护中'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{room.tables?.length ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setRoomModal({ open: true, room })}
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            <Settings size={13} /> 编辑
                          </button>
                          <button
                            onClick={async () => { await toggleRoomMaintenance(room.id); fetchRooms(); }}
                            className="text-xs text-yellow-400 hover:text-yellow-300"
                          >
                            {room.status === 'MAINTENANCE' ? '恢复' : '维护'}
                          </button>
                          <button
                            onClick={() => setDeleteDialog(room)}
                            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                          >
                            <Trash2 size={13} /> 删除
                          </button>
                        </div>
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
            <span className="text-slate-500 text-sm">第 {page} / {totalPages} 页</span>
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

        {deleteDialog && (
          <ConfirmDialog
            title="删除房间"
            message={`确定要删除房间 "${deleteDialog.name}" 吗？此操作不可撤销。`}
            confirmLabel="删除"
            danger
            onConfirm={async () => { await deleteRoom(deleteDialog.id); fetchRooms(); }}
            onClose={() => setDeleteDialog(null)}
          />
        )}

        {roomModal.open && (
          <RoomModal
            room={roomModal.room}
            onClose={() => setRoomModal({ open: false })}
            onSave={async (data) => {
              if (roomModal.room) await updateRoom(roomModal.room.id, data);
              else await createRoom(data);
              fetchRooms();
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
}
