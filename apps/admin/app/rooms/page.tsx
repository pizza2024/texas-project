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

function RoomCard({ room, onEdit, onToggle, onDelete, selectable, selected, onSelect }: {
  room: any; onEdit: () => void; onToggle: () => void; onDelete: () => void;
  selectable?: boolean; selected?: boolean; onSelect?: (id: string) => void;
}) {
  return (
    <div className={`bg-[#161b27] border rounded-xl p-4 space-y-3 transition-colors ${selectable && selected ? 'border-red-500/60 ring-1 ring-red-500/30' : 'border-[#1e2535]'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {selectable && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onSelect?.(room.id)}
              className="w-4 h-4 rounded border-slate-600 bg-[#0f1117] text-red-500 focus:ring-red-500/50 cursor-pointer"
            />
          )}
          <div>
            <Link href={`/rooms/${room.id}`} className="text-white font-medium hover:text-indigo-400">
              {room.name}
            </Link>
            {room.password && <span className="ml-2 text-xs text-yellow-500">🔒</span>}
          </div>
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
      {!selectable && (
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
      )}
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

  // Batch delete state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedRoomsMap, setSelectedRoomsMap] = useState<Map<string, any>>(new Map());
  const [batchDeleteDialog, setBatchDeleteDialog] = useState<{ open: boolean; rooms: any[] }>({ open: false, rooms: [] });
  const [selectAllConfirm, setSelectAllConfirm] = useState(false);

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

  const toggleSelect = useCallback((id: string) => {
    const room = (data?.data ?? []).find((r: any) => r.id === id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedRoomsMap(prev => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else if (room) next.set(id, room);
      return next;
    });
  }, [data?.data]);

  const selectAllCurrentPage = useCallback(() => {
    const pageRooms = data?.data ?? [];
    const pageIds = pageRooms.map((r: any) => r.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = pageIds.every((id: string) => prev.has(id));
      if (allSelected) pageIds.forEach((id: string) => next.delete(id));
      else pageIds.forEach((id: string) => next.add(id));
      return next;
    });
    setSelectedRoomsMap(prev => {
      const next = new Map(prev);
      const allSelected = pageIds.every((id: string) => prev.has(id));
      if (allSelected) pageIds.forEach((id: string) => next.delete(id));
      else pageRooms.forEach((r: any) => { if (!next.has(r.id)) next.set(r.id, r); });
      return next;
    });
  }, [data?.data]);

  const selectAllAllPages = useCallback(async () => {
    setSelectAllConfirm(true);
  }, []);

  const confirmSelectAll = useCallback(async () => {
    setSelectAllConfirm(false);
    setLoading(true);
    try {
      const allIds: string[] = [];
      const allRoomsMap = new Map<string, any>();
      let currentPage = 1;
      const limit = 20;
      while (true) {
        const res = await getRooms({ page: currentPage, limit, search: search || undefined });
        res.data.forEach((r: any) => allRoomsMap.set(r.id, r));
        allIds.push(...res.data.map((r: any) => r.id));
        if (allIds.length >= res.total) break;
        currentPage++;
        if (currentPage > 100) break;
      }
      setSelectedIds(new Set(allIds));
      setSelectedRoomsMap(allRoomsMap);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const startBatchDelete = useCallback(() => {
    const selectedRooms = Array.from(selectedRoomsMap.values());
    setBatchDeleteDialog({ open: true, rooms: selectedRooms });
  }, [selectedRoomsMap]);

  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await deleteRoom(id);
    }
    setSelectedIds(new Set());
    setSelectedRoomsMap(new Map());
    setIsSelecting(false);
    setBatchDeleteDialog({ open: false, rooms: [] });
    fetchRooms();
  }, [selectedIds, fetchRooms]);

  const exitSelectionMode = useCallback(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
    setSelectedRoomsMap(new Map());
  }, []);

  const currentPageAllSelected = data?.data?.length > 0 && (data?.data ?? []).every((r: any) => selectedIds.has(r.id));

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">房间管理</h1>
          <div className="flex items-center gap-3">
            {isSelecting ? (
              <>
                <span className="text-sm text-slate-400">已选中 <span className="text-white font-medium">{selectedIds.size}</span> 项</span>
                <button
                  onClick={exitSelectionMode}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  <X size={16} /> 取消选择
                </button>
                <button
                  onClick={startBatchDelete}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  <Trash2 size={16} /> 批量删除{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsSelecting(true)}
                  className="flex items-center gap-2 border border-red-500/60 hover:border-red-500 hover:bg-red-500/10 text-red-400 hover:text-red-300 text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  <Trash2 size={16} /> 批量删除
                </button>
                <button
                  onClick={() => setRoomModal({ open: true })}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  <Plus size={16} /> 新建房间
                </button>
              </>
            )}
          </div>
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
                selectable={isSelecting}
                selected={selectedIds.has(room.id)}
                onSelect={toggleSelect}
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
                  {isSelecting && (
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={currentPageAllSelected && (data?.data?.length ?? 0) > 0}
                          ref={el => { if (el) el.indeterminate = !currentPageAllSelected && (data?.data?.length ?? 0) > 0; }}
                          onChange={selectAllCurrentPage}
                          className="w-4 h-4 rounded border-slate-600 bg-[#0f1117] text-red-500 focus:ring-red-500/50 cursor-pointer"
                        />
                        <span className="text-xs text-slate-500">
                          {currentPageAllSelected ? '取消全选' : '全选当前页'}
                        </span>
                      </div>
                    </th>
                  )}
                  {['房间名称', '盲注', '最大人数', '最低买入', '状态', '牌桌数'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                  ))}
                  {isSelecting ? (
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">已选中 {selectedIds.size} 项</th>
                  ) : (
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">操作</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={isSelecting ? 8 : 7} className="text-center py-12 text-slate-500">加载中...</td></tr>
                ) : data?.data?.length === 0 ? (
                  <tr><td colSpan={isSelecting ? 8 : 7} className="text-center py-12 text-slate-500">暂无房间</td></tr>
                ) : (
                  data?.data?.map((room: any) => (
                    <tr key={room.id} className={`border-b border-[#1e2535] hover:bg-white/2 transition-colors ${selectedIds.has(room.id) ? 'bg-red-500/5' : ''}`}>
                      {isSelecting && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(room.id)}
                            onChange={() => toggleSelect(room.id)}
                            className="w-4 h-4 rounded border-slate-600 bg-[#0f1117] text-red-500 focus:ring-red-500/50 cursor-pointer"
                          />
                        </td>
                      )}
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
                      {isSelecting ? (
                        <td className="px-4 py-3" />
                      ) : (
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
                      )}
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
              {isSelecting && selectedIds.size > 0 && (
                <button
                  onClick={selectAllAllPages}
                  className="text-xs text-red-400 hover:text-red-300 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  全选所有页（{data?.total} 项）
                </button>
              )}
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

        {batchDeleteDialog.open && (
          <ConfirmDialog
            title="批量删除房间"
            message={`确定要删除以下 ${batchDeleteDialog.rooms.length} 个房间吗？此操作不可撤销。\n\n${batchDeleteDialog.rooms.map(r => `• ${r.name}`).join('\n')}`}
            confirmLabel={`删除 ${batchDeleteDialog.rooms.length} 个房间`}
            danger
            onConfirm={handleBatchDelete}
            onClose={() => setBatchDeleteDialog({ open: false, rooms: [] })}
          />
        )}

        {selectAllConfirm && (
          <ConfirmDialog
            title="全选所有房间"
            message={`确定要选中全部 ${data?.total} 个房间吗？这将选中所有分页中的房间。`}
            confirmLabel="确定全选"
            danger={false}
            onConfirm={confirmSelectAll}
            onClose={() => setSelectAllConfirm(false)}
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
