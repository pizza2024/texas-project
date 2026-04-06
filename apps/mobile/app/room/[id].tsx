import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSocket, disconnectSocket } from '../../lib/socket';
import { getStoredToken } from '../../lib/auth';
import type { TableState, Player } from '@texas/shared';

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS: Record<string, string> = { '♥': '#ef4444', '♦': '#ef4444', '♠': '#e5e7eb', '♣': '#e5e7eb' };

function formatCard(card: string) {
  if (!card || card === '?') return { rank: '?', suit: '', color: '#9ca3af' };
  const suit = SUITS.find((s) => card.includes(s)) ?? '';
  const rank = card.replace(suit, '');
  return { rank, suit, color: SUIT_COLORS[suit] ?? '#e5e7eb' };
}

function CardView({ card, hidden }: { card: string; hidden?: boolean }) {
  if (hidden) {
    return (
      <View style={cardStyles.card}>
        <Text style={cardStyles.hidden}>🂠</Text>
      </View>
    );
  }
  const { rank, suit, color } = formatCard(card);
  return (
    <View style={[cardStyles.card, { borderColor: color }]}>
      <Text style={[cardStyles.rank, { color }]}>{rank}</Text>
      <Text style={[cardStyles.suit, { color }]}>{suit}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: 34,
    height: 46,
    backgroundColor: '#1a2e1a',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#4ade80',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
  },
  hidden: { fontSize: 24, color: '#4b5563' },
  rank: { fontSize: 13, fontWeight: 'bold' },
  suit: { fontSize: 11 },
});

export default function RoomPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [table, setTable] = useState<TableState | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<string>('');
  const tokenRef = useRef<string | null>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  const getAuthorizedSocket = useCallback(() => {
    if (!tokenRef.current) return null;
    return getSocket(tokenRef.current);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function connect() {
      const token = await getStoredToken();
      if (!token || !mounted) return;
      tokenRef.current = token;

      // 解析用户 ID
      const parts = token.split('.');
      if (parts[1]) {
        try {
          const payload = JSON.parse(atob(parts[1])) as { sub?: string };
          setMyUserId(payload.sub ?? null);
        } catch { /* ignore */ }
      }

      socketRef.current = getSocket(token);
      const socket = socketRef.current;

      socket.on('room_update', (data) => {
        if (mounted) setTable(data);
      });

      socket.on('left_room', () => {
        if (mounted) router.replace('/rooms');
      });

      socket.emit('join_room', { roomId: id });
    }
    connect();
    return () => {
      mounted = false;
      socketRef.current?.emit('leave_room', { roomId: id });
      socketRef.current = null;
    };
  }, [id]);

  const sendAction = (action: string, amount?: number) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('player_action', { roomId: id, action, amount });
  };

  const myPlayer = table?.players.find(
    (p): p is Player => p !== null && p.id === myUserId,
  );
  const isMyTurn =
    table &&
    myPlayer &&
    table.players[table.activePlayerIndex]?.id === myUserId &&
    table.currentStage !== 'WAITING' &&
    table.currentStage !== 'SETTLEMENT';

  const callAmount = table ? table.currentBet - (myPlayer?.bet ?? 0) : 0;
  const minRaise = table ? table.currentBet + table.bigBlind : 0;
  const effectiveRaiseAmount = Math.max(Number(betAmount) || minRaise, minRaise);

  if (!table) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#4ade80" size="large" />
        <Text style={styles.loadingText}>连接中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 公共牌 */}
      <View style={styles.communityArea}>
        <Text style={styles.potText}>底池：{table.pot}</Text>
        <View style={styles.communityCards}>
          {table.communityCards.map((c, i) => (
            <CardView key={i} card={c} />
          ))}
          {Array.from({ length: Math.max(0, 5 - table.communityCards.length) }).map((_, i) => (
            <CardView key={`empty-${i}`} card="?" hidden />
          ))}
        </View>
        <Text style={styles.stageText}>{table.currentStage}</Text>
      </View>

      {/* 玩家列表 */}
      <ScrollView style={styles.players}>
        {table.players.map((player, idx) => {
          if (!player) return null;
          const isActive = table.activePlayerIndex === idx;
          const isMe = player.id === myUserId;
          return (
            <View
              key={player.id}
              style={[styles.playerRow, isActive && styles.activePlayer, isMe && styles.myPlayer]}
            >
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>
                  {isMe ? '(我) ' : ''}{player.nickname}
                  {player.isButton ? ' 🔘' : ''}
                  {player.isSmallBlind ? ' SB' : ''}
                  {player.isBigBlind ? ' BB' : ''}
                </Text>
                <Text style={styles.playerStack}>筹码 {player.stack}</Text>
                {player.bet > 0 && <Text style={styles.playerBet}>下注 {player.bet}</Text>}
              </View>
              <View style={styles.playerCards}>
                {isMe
                  ? player.cards.map((c, i) => <CardView key={i} card={c} />)
                  : player.cards.map((_, i) => <CardView key={i} card="?" hidden />)}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* 操作区 */}
      {isMyTurn && (
        <View style={styles.actions}>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.foldBtn]} onPress={() => sendAction('fold')}>
              <Text style={styles.actionText}>弃牌</Text>
            </TouchableOpacity>
            {callAmount <= 0 ? (
              <TouchableOpacity style={[styles.actionBtn, styles.checkBtn]} onPress={() => sendAction('check')}>
                <Text style={styles.actionText}>过牌</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.actionBtn, styles.callBtn]} onPress={() => sendAction('call')}>
                <Text style={styles.actionText}>跟注 {callAmount}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.actionRow}>
            <TextInput
              style={styles.betInput}
              placeholder={`最小${minRaise}`}
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={betAmount}
              onChangeText={setBetAmount}
            />
            <TouchableOpacity
              style={[styles.actionBtn, styles.raiseBtn]}
              onPress={() => sendAction('raise', effectiveRaiseAmount)}
            >
              <Text style={styles.actionText}>加注 {effectiveRaiseAmount}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.allInBtn]}
              onPress={() => sendAction('all-in')}
            >
              <Text style={styles.actionText}>全下</Text>
            </TouchableOpacity>
          </View>
          {/* 快捷金额按钮 */}
          <View style={styles.quickBetRow}>
            <TouchableOpacity
              style={styles.quickBetBtn}
              onPress={() => setBetAmount(String(minRaise))}
            >
              <Text style={styles.quickBetText}>最小加注</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBetBtn}
              onPress={() => setBetAmount(String((myPlayer?.stack ?? 0) * 2))}
            >
              <Text style={styles.quickBetText}>x2</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBetBtn}
              onPress={() => setBetAmount(String(myPlayer?.stack ?? 0))}
            >
              <Text style={styles.quickBetText}>全下</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {table.currentStage === 'WAITING' && myPlayer && !myPlayer.ready && (
        <TouchableOpacity
          style={styles.readyBtn}
          onPress={() => getAuthorizedSocket()?.emit('player_ready', { roomId: id })}
        >
          <Text style={styles.readyBtnText}>准备</Text>
        </TouchableOpacity>
      )}

      {/* 返回按钮 */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/rooms')}>
        <Text style={styles.backBtnText}>← 返回大厅</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060e10' },
  loading: { flex: 1, backgroundColor: '#060e10', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#9ca3af', marginTop: 12, fontSize: 16 },
  communityArea: {
    backgroundColor: '#0d1f14',
    padding: 16,
    paddingTop: 56,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1a3a22',
  },
  potText: { color: '#fbbf24', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  communityCards: { flexDirection: 'row', marginBottom: 6 },
  stageText: { color: '#6b7280', fontSize: 12 },
  players: { flex: 1 },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0d1f14',
  },
  activePlayer: { backgroundColor: '#0d2818' },
  myPlayer: { borderLeftWidth: 3, borderLeftColor: '#4ade80' },
  playerInfo: { flex: 1 },
  playerName: { color: '#e5e7eb', fontSize: 14, fontWeight: '600' },
  playerStack: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  playerBet: { color: '#fbbf24', fontSize: 12 },
  playerCards: { flexDirection: 'row' },
  actions: { padding: 10, backgroundColor: '#0d1f14', borderTopWidth: 1, borderTopColor: '#1a3a22' },
  betInput: {
    flex: 1,
    backgroundColor: '#1a2e1a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e5e7eb',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#374151',
    marginRight: 8,
  },
  quickBetRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  quickBetBtn: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  quickBetText: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
  },
  foldBtn: { backgroundColor: '#7f1d1d' },
  checkBtn: { backgroundColor: '#1e3a5f' },
  callBtn: { backgroundColor: '#1d4ed8' },
  raiseBtn: { backgroundColor: '#92400e' },
  allInBtn: { backgroundColor: '#6b21a8' },
  actionText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  readyBtn: {
    margin: 10,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  readyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  backBtn: { padding: 12, alignItems: 'center' },
  backBtnText: { color: '#6b7280', fontSize: 13 },
});
