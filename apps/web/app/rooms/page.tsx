'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { disconnectSocket, getSocket } from '@/lib/socket';

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

    socket.on('room_created', onRoomCreated);
    socket.on('room_dissolved', onRoomDissolved);
    fetchRooms();

    return () => {
      socket.off('room_created', onRoomCreated);
      socket.off('room_dissolved', onRoomDissolved);
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
      alert('Failed to create room. Ensure you are logged in.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading rooms...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Texas Hold&apos;em Lobby</h1>
          <div className="flex gap-4">
            <Button onClick={handleCreateRoom}>Create New Table</Button>
            <Button variant="outline" onClick={() => {
              localStorage.removeItem('token');
              router.push('/login');
            }}>Logout</Button>
          </div>
        </header>

        {rooms.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No active tables found. Create one to start playing!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <Card key={room.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle>{room.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Blinds</span>
                      <span className="font-medium">${room.blindSmall} / ${room.blindBig}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Max Players</span>
                      <span className="font-medium">{room.maxPlayers}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Players</span>
                      <span className="font-medium">
                        {roomStatusMap[room.id]?.currentPlayers ?? 0}/{roomStatusMap[room.id]?.maxPlayers ?? room.maxPlayers}
                      </span>
                    </div>
                    <div className="pt-4">
                      {roomStatusMap[room.id]?.isFull ? (
                        <Button className="w-full" disabled>Room Full</Button>
                      ) : (
                        <Link href={`/room/${room.id}`} passHref>
                          <Button className="w-full">Join Table</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
