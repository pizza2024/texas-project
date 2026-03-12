'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api';

interface Player {
  id: string;
  nickname: string;
  stack: number;
  bet: number;
  cards: string[];
  status: string;
  ready: boolean;
  isButton: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
}

interface TableState {
  id: string;
  pot: number;
  currentBet: number;
  communityCards: string[];
  players: (Player | null)[];
  currentStage: string;
  activePlayerIndex: number;
}

/** Format a card string like 'Ah' → rank + suit with color */
function CardDisplay({ card }: { card: string }) {
  const isHidden = card === '??';
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const isRed = suit === 'h' || suit === 'd';
  const suitSymbol: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

  if (isHidden) {
    return (
      <div className="w-8 h-12 bg-blue-700 rounded border border-blue-400 flex items-center justify-center text-blue-300 text-lg select-none">
        🂠
      </div>
    );
  }

  return (
    <div className={`w-8 h-12 bg-white rounded border border-gray-300 flex flex-col items-center justify-center select-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
      <span className="text-[11px] font-bold leading-none">{rank}</span>
      <span className="text-[13px] leading-none">{suitSymbol[suit] ?? suit}</span>
    </div>
  );
}

function getMyUserId(): string {
  try {
    const token = localStorage.getItem('token') || '';
    return JSON.parse(atob(token.split('.')[1])).sub as string;
  } catch {
    return '';
  }
}

export default function RoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const [table, setTable] = useState<TableState | null>(null);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [myUserId] = useState<string>(() => getMyUserId());

  const handleBackToLobby = () => {
    setShowLeaveConfirm(true);
  };

  const handleConfirmLeave = async () => {
    setLeaving(true);
    try {
      await api.post('/tables/me/leave-room');
    } catch {
      // Ignore and continue navigation
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
      disconnectSocket();
      router.push('/rooms');
    }
  };

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

    socket.on('already_in_room', (data: { roomId: string }) => {
      if (data?.roomId) {
        router.replace(`/room/${data.roomId}`);
      }
    });

    socket.on('room_full', () => {
      alert('Room is full. Please choose another table.');
      router.replace('/rooms');
    });

    socket.on('error', (message: string) => {
      if (message === 'Room not found') {
        alert('Room not found.');
        router.replace('/rooms');
      }
    });

    return () => {
      disconnectSocket();
    };
  }, [id, router]);

  const handleAction = (action: string, amount?: number) => {
    const socket = getSocket(localStorage.getItem('token') || '');
    socket.emit('player_action', { roomId: id, action, amount });
  };

  const handleReady = () => {
    const socket = getSocket(localStorage.getItem('token') || '');
    socket.emit('player_ready');
  };

  if (!table) return <div>Loading table...</div>;

  const isWaiting = table.currentStage === 'WAITING';
  const myPlayer = table.players.find((p) => p?.id === myUserId);
  const isReady = myPlayer?.ready ?? false;
  const seatedPlayers = table.players.filter((p) => p !== null) as Player[];
  const readyCount = seatedPlayers.filter((p) => p.ready).length;
  const activePlayer = table.activePlayerIndex >= 0 ? table.players[table.activePlayerIndex] : null;
  const isMyTurn = !isWaiting && activePlayer?.id === myUserId;

  return (
    <div className="min-h-screen bg-green-800 p-8 text-white relative">
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md bg-white text-black">
            <CardHeader>
              <CardTitle>退出房间确认</CardTitle>
            </CardHeader>
            <CardContent>
              <p>确定要退出当前房间并返回列表吗？</p>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button
                variant="destructive"
                onClick={() => setShowLeaveConfirm(false)}
                disabled={leaving}
              >
                取消
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmLeave} disabled={leaving}>
                {leaving ? '退出中...' : '确定退出'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      <div className="absolute top-4 left-4">
        <Button className='bg-black text-white' variant="outline" onClick={handleBackToLobby}>Back to Lobby</Button>
      </div>

      {/* Waiting stage status bar */}
      {isWaiting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-yellow-300 text-sm font-medium">
          等待玩家准备 ({readyCount}/{seatedPlayers.length})
        </div>
      )}

      {/* In-game: current turn indicator */}
      {!isWaiting && activePlayer && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <span className="text-yellow-300 text-sm font-medium">
            {isMyTurn ? '🟡 轮到你了！' : `⏳ 等待 ${activePlayer.nickname} 操作`}
          </span>
        </div>
      )}

      <div className="max-w-4xl mx-auto mt-12 bg-green-700 rounded-full border-8 border-yellow-700 aspect-2/1 relative shadow-2xl">
        {/* Community Cards */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-2">
          {table.communityCards.length > 0
            ? table.communityCards.map((card, i) => <CardDisplay key={i} card={card} />)
            : <div className="text-white/50 text-sm">Waiting for deal...</div>
          }
        </div>

        {/* Pot */}
        <div className="absolute top-[40%] left-1/2 transform -translate-x-1/2 text-yellow-300 font-bold text-xl">
          Pot: ${table.pot}
        </div>

        {/* Players */}
        {table.players.map((player, i) => {
          if (!player) return null;
          const angle = (i / 9) * 2 * Math.PI;
          const radius = 45; // %
          const top = 50 + radius * Math.sin(angle);
          const left = 50 + radius * Math.cos(angle);
          const isActive = table.activePlayerIndex === i;

          return (
            <div
              key={i}
              className={`absolute w-24 h-24 bg-gray-800 rounded-full flex flex-col items-center justify-center -ml-12 -mt-12 border-2 transition-colors ${
                isActive ? 'border-yellow-400 shadow-[0_0_12px_3px_rgba(250,204,21,0.7)]' : 'border-white'
              }`}
              style={{ top: `${top}%`, left: `${left}%` }}
            >
              <div className="text-xs font-bold truncate w-20 text-center">{player.nickname}</div>
              <div className="text-xs text-yellow-400">${player.stack}</div>
              {isWaiting && (
                <div className={`text-[9px] mt-0.5 font-semibold ${player.ready ? 'text-green-400' : 'text-gray-400'}`}>
                  {player.ready ? '✓ 已准备' : '未准备'}
                </div>
              )}
              {/* Hole cards (shown above the avatar circle) */}
              {player.cards.length > 0 && (
                <div className="absolute -top-14 flex gap-1">
                  {player.cards.map((c, ci) => <CardDisplay key={ci} card={c} />)}
                </div>
              )}
              {player.bet > 0 && (
                <div className="absolute -bottom-6 bg-yellow-600 px-2 rounded-full text-xs">
                  ${player.bet}
                </div>
              )}
              {/* Position badges */}
              <div className="absolute -top-2 -right-1 flex gap-0.5">
                {player.isButton && (
                  <span className="bg-white text-black text-[9px] font-bold px-1 rounded-full leading-4">D</span>
                )}
                {player.isSmallBlind && (
                  <span className="bg-blue-500 text-white text-[9px] font-bold px-1 rounded-full leading-4">SB</span>
                )}
                {player.isBigBlind && (
                  <span className="bg-red-500 text-white text-[9px] font-bold px-1 rounded-full leading-4">BB</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom bar: Ready button (WAITING) or Action bar (in-game) */}
      <div className={`fixed bottom-0 left-0 w-full p-4 flex justify-center gap-4 items-center transition-colors ${isMyTurn ? 'bg-yellow-900' : 'bg-gray-900'}`}>
        {isWaiting ? (
          <Button
            onClick={handleReady}
            className={isReady ? 'bg-gray-600 hover:bg-gray-700' : 'bg-green-600 hover:bg-green-700'}
          >
            {isReady ? '取消准备' : '准备'}
          </Button>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
