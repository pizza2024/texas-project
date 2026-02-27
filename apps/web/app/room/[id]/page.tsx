'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Player {
  id: string;
  nickname: string;
  stack: number;
  bet: number;
  cards: string[];
  status: string;
}

interface TableState {
  id: string;
  pot: number;
  communityCards: string[];
  players: (Player | null)[];
}

export default function RoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const [table, setTable] = useState<TableState | null>(null);
  const [raiseAmount, setRaiseAmount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const socket = getSocket(token);

    socket.on('connect', () => {
      console.log('Connected to socket');
      socket.emit('join_room', { roomId: id });
    });

    socket.on('room_update', (data: TableState) => {
      console.log('Room update:', data);
      setTable(data);
    });

    return () => {
      disconnectSocket();
    };
  }, [id, router]);

  const handleAction = (action: string, amount?: number) => {
    const socket = getSocket(localStorage.getItem('token') || '');
    socket.emit('player_action', { roomId: id, action, amount });
  };

  if (!table) return <div>Loading table...</div>;

  return (
    <div className="min-h-screen bg-green-800 p-8 text-white relative">
      <div className="absolute top-4 left-4">
        <Button variant="outline" onClick={() => router.push('/')}>Back to Lobby</Button>
      </div>

      <div className="max-w-4xl mx-auto mt-12 bg-green-700 rounded-full border-8 border-yellow-700 aspect-[2/1] relative shadow-2xl">
        {/* Community Cards */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-2">
          {table.communityCards.map((card, i) => (
            <div key={i} className="w-12 h-16 bg-white rounded text-black flex items-center justify-center font-bold border border-gray-300">
              {card}
            </div>
          ))}
          {table.communityCards.length === 0 && <div className="text-white/50">Waiting for deal...</div>}
        </div>

        {/* Pot */}
        <div className="absolute top-[40%] left-1/2 transform -translate-x-1/2 text-yellow-300 font-bold text-xl">
          Pot: ${table.pot}
        </div>

        {/* Players */}
        {table.players.map((player, i) => {
          if (!player) return null;
          // Calculate position styles (simplified)
          const angle = (i / 9) * 2 * Math.PI;
          const radius = 45; // %
          const top = 50 + radius * Math.sin(angle);
          const left = 50 + radius * Math.cos(angle);

          return (
            <div
              key={i}
              className="absolute w-24 h-24 bg-gray-800 rounded-full border-2 border-white flex flex-col items-center justify-center -ml-12 -mt-12"
              style={{ top: `${top}%`, left: `${left}%` }}
            >
              <div className="text-xs font-bold truncate w-20 text-center">{player.nickname}</div>
              <div className="text-xs text-yellow-400">${player.stack}</div>
              <div className="flex gap-1 mt-1">
                {player.cards.map((c, ci) => (
                  <div key={ci} className="w-4 h-6 bg-white rounded text-black text-[8px] flex items-center justify-center">
                    {c}
                  </div>
                ))}
              </div>
              {player.bet > 0 && (
                <div className="absolute -bottom-6 bg-yellow-600 px-2 rounded-full text-xs">
                  ${player.bet}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-gray-900 p-4 flex justify-center gap-4 items-center">
        <Button onClick={() => handleAction('fold')} variant="destructive">Fold</Button>
        <Button onClick={() => handleAction('check')} variant="outline">Check</Button>
        <Button onClick={() => handleAction('call')} variant="default">Call</Button>
        <div className="flex items-center gap-2">
          <Input 
            type="number" 
            className="w-24 bg-white text-black" 
            value={raiseAmount} 
            onChange={(e) => setRaiseAmount(Number(e.target.value))} 
          />
          <Button onClick={() => handleAction('raise', raiseAmount)}>Raise</Button>
        </div>
      </div>
    </div>
  );
}
