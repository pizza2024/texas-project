'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { disconnectSocket, getSocket } from '@/lib/socket';
import { showSystemMessage } from '@/lib/system-message';

interface Room {
  id: string;
  name: string;
  blindSmall: number;
  blindBig: number;
  maxPlayers: number;
}

interface RoomStatus {
  roomId: string;
  currentPlayers: number;
  maxPlayers: number;
  isFull: boolean;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomStatusMap, setRoomStatusMap] = useState<Record<string, RoomStatus>>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchRooms = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const [currentRoomRes, roomsRes] = await Promise.all([
          api.get('/tables/me/current-room'),
          api.get('/rooms'),
        ]);

        if (currentRoomRes.data?.roomId) {
          router.replace(`/room/${currentRoomRes.data.roomId}`);
          return;
        }

        const roomList: Room[] = roomsRes.data || [];
        setRooms(roomList);

        const statusEntries = await Promise.all(
          roomList.map(async (room) => {
            const { data } = await api.get(`/tables/rooms/${room.id}/status`);
            return [room.id, data] as const;
          }),
        );

        setRoomStatusMap(Object.fromEntries(statusEntries));
      } catch {
        localStorage.removeItem('token');
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    const socket = getSocket(token);

    const onRoomCreated = (room: Room) => {
      setRooms((prevRooms) => {
        if (prevRooms.some((existingRoom) => existingRoom.id === room.id)) {
          return prevRooms;
        }
        return [room, ...prevRooms];
      });

      setRoomStatusMap((prevMap) => ({
        ...prevMap,
        [room.id]: {
          roomId: room.id,
          currentPlayers: 0,
          maxPlayers: room.maxPlayers,
          isFull: false,
        },
      }));
    };

    const onRoomDissolved = (payload: { id: string }) => {
      setRooms((prevRooms) => prevRooms.filter((r) => r.id !== payload.id));
      setRoomStatusMap((prevMap) => {
        const { [payload.id]: _, ...rest } = prevMap;
        return rest;
      });
    };

    const onRoomStatusUpdated = (status: RoomStatus) => {
      setRoomStatusMap((prevMap) => ({
        ...prevMap,
        [status.roomId]: status,
      }));
    };

    socket.on('room_created', onRoomCreated);
    socket.on('room_dissolved', onRoomDissolved);
    socket.on('room_status_updated', onRoomStatusUpdated);
    fetchRooms();

    return () => {
      socket.off('room_created', onRoomCreated);
      socket.off('room_dissolved', onRoomDissolved);
      socket.off('room_status_updated', onRoomStatusUpdated);
      disconnectSocket();
    };
  }, [router]);

  const handleCreateRoom = async () => {
    try {
      const { data } = await api.post('/rooms', {
        name: `Table ${Math.floor(Math.random() * 1000)}`,
        blindSmall: 10,
        blindBig: 20,
        maxPlayers: 9,
      });
      router.push(`/room/${data.id}`);
    } catch (error) {
      console.error('Failed to create room', error);
      await showSystemMessage({
        title: '创建房间失败',
        message: '房间创建失败，请确认当前登录状态后重试。',
      });
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at 50% 35%, #0d2818 0%, #060e10 55%, #020406 100%)' }}
      >
        <div className="text-center space-y-3">
          <div className="text-5xl animate-pulse">🃏</div>
          <p
            className="text-sm tracking-[0.3em] uppercase font-semibold"
            style={{ color: 'rgba(245,158,11,0.7)' }}
          >
            Loading Tables…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 20%, #0d2818 0%, #060e10 55%, #020406 100%)' }}
    >
      {/* Background decorative suit symbols */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden">
        <span className="absolute top-8 left-8 text-[10rem] font-serif opacity-[0.03] text-yellow-400 -rotate-12">♠</span>
        <span className="absolute top-20 right-10 text-[12rem] font-serif opacity-[0.03] text-yellow-400 rotate-6">♥</span>
        <span className="absolute bottom-16 left-16 text-[11rem] font-serif opacity-[0.03] text-yellow-400 rotate-3">♦</span>
        <span className="absolute bottom-8 right-8 text-[10rem] font-serif opacity-[0.03] text-yellow-400 -rotate-6">♣</span>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6"
          style={{ borderBottom: '1px solid rgba(234,179,8,0.15)' }}
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">🎰</span>
              <h1
                className="text-3xl font-black tracking-[0.08em] uppercase"
                style={{
                  background: 'linear-gradient(135deg, #d97706 0%, #fcd34d 45%, #d97706 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Lobby
              </h1>
            </div>
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'rgba(245,158,11,0.45)' }}>
              ♠ &nbsp; ♥ &nbsp; Texas Hold&apos;em &nbsp; ♦ &nbsp; ♣
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="font-bold tracking-widest text-xs uppercase h-10 px-5 rounded-lg transition-colors hover:bg-yellow-900/20"
              style={{
                background: 'transparent',
                border: '1px solid rgba(234,179,8,0.3)',
                color: 'rgba(245,158,11,0.7)',
              }}
              onClick={() => router.push('/settings')}
            >
              Settings
            </Button>
            <Button
              onClick={handleCreateRoom}
              className="font-bold tracking-widest text-xs uppercase h-10 px-5 rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)',
                color: '#000',
                border: 'none',
                boxShadow: '0 0 20px rgba(245,158,11,0.2), 0 4px 10px rgba(0,0,0,0.4)',
              }}
            >
              + Create New Table
            </Button>
            <Button
              variant="outline"
              className="font-bold tracking-widest text-xs uppercase h-10 px-5 rounded-lg transition-colors hover:bg-yellow-900/20"
              style={{
                background: 'transparent',
                border: '1px solid rgba(234,179,8,0.3)',
                color: 'rgba(245,158,11,0.7)',
              }}
              onClick={() => {
                localStorage.removeItem('token');
                router.push('/login');
              }}
            >
              Logout
            </Button>
          </div>
        </header>

        {/* Room list */}
        {rooms.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-6xl opacity-30">🂠</div>
            <p
              className="text-base tracking-widest uppercase font-semibold"
              style={{ color: 'rgba(245,158,11,0.4)' }}
            >
              No active tables found
            </p>
            <p className="text-sm" style={{ color: 'rgba(107,114,128,0.6)' }}>
              Create one to start playing!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rooms.map((room) => {
              const status = roomStatusMap[room.id];
              const current = status?.currentPlayers ?? 0;
              const max = status?.maxPlayers ?? room.maxPlayers;
              const isFull = status?.isFull ?? false;
              const fillPct = Math.round((current / max) * 100);

              return (
                <div
                  key={room.id}
                  className="rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:scale-[1.01]"
                  style={{
                    background: 'linear-gradient(160deg, rgba(12,22,16,0.97) 0%, rgba(6,12,9,0.99) 100%)',
                    border: isFull
                      ? '1px solid rgba(239,68,68,0.25)'
                      : '1px solid rgba(234,179,8,0.2)',
                    boxShadow: isFull
                      ? '0 0 30px rgba(239,68,68,0.05), 0 8px 30px rgba(0,0,0,0.5)'
                      : '0 0 30px rgba(234,179,8,0.05), 0 8px 30px rgba(0,0,0,0.5)',
                  }}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-black text-white tracking-wide text-base">{room.name}</h2>
                      <p className="text-[10px] tracking-[0.2em] uppercase mt-0.5" style={{ color: 'rgba(245,158,11,0.5)' }}>
                        No-Limit Hold&apos;em
                      </p>
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: isFull ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)',
                        color: isFull ? 'rgba(239,68,68,0.9)' : 'rgba(74,222,128,0.9)',
                        border: isFull ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(34,197,94,0.2)',
                      }}
                    >
                      {isFull ? 'FULL' : 'OPEN'}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="h-px" style={{ background: 'rgba(234,179,8,0.1)' }} />

                  {/* Stats */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[10px] tracking-[0.2em] uppercase font-semibold" style={{ color: 'rgba(245,158,11,0.5)' }}>
                        Blinds
                      </span>
                      <span className="font-bold text-white text-sm">
                        ${room.blindSmall} <span style={{ color: 'rgba(234,179,8,0.5)' }}>/</span> ${room.blindBig}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[10px] tracking-[0.2em] uppercase font-semibold" style={{ color: 'rgba(245,158,11,0.5)' }}>
                        Players
                      </span>
                      <span className="font-bold text-white text-sm">
                        {current}
                        <span style={{ color: 'rgba(234,179,8,0.4)' }}>/{max}</span>
                      </span>
                    </div>

                    {/* Player fill bar */}
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${fillPct}%`,
                          background: isFull
                            ? 'linear-gradient(90deg, #dc2626, #ef4444)'
                            : 'linear-gradient(90deg, #b45309, #f59e0b)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Join button */}
                  <div className="pt-1">
                    {isFull ? (
                      <Button
                        className="w-full h-10 rounded-lg font-bold tracking-widest text-xs uppercase"
                        disabled
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          color: 'rgba(239,68,68,0.5)',
                          border: '1px solid rgba(239,68,68,0.15)',
                        }}
                      >
                        Room Full
                      </Button>
                    ) : (
                      <Link href={`/room/${room.id}`} passHref>
                        <Button
                          className="w-full h-10 rounded-lg font-black tracking-widest text-xs uppercase transition-opacity hover:opacity-90 active:scale-[0.98]"
                          style={{
                            background: 'linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)',
                            color: '#000',
                            border: 'none',
                            boxShadow: '0 0 16px rgba(245,158,11,0.2)',
                          }}
                        >
                          Join Table →
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
