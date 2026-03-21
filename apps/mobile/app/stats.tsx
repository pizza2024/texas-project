import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';

interface UserStats {
  handsPlayed: number;
  handsWon: number;
  winRate: number;
  totalProfit: number;
  biggestWin: number;
  biggestLoss: number;
  recentHands: {
    id: string;
    roomName: string;
    profit: number;
    createdAt: string;
  }[];
}

export default function StatsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.get<UserStats>('/user/stats');
      setStats(res.data);
    } catch (err) {
      Alert.alert(t('common.confirm'), t('stats.loadError'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>{t('common.backToLobby')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('stats.title')}</Text>
          <View style={{ width: 50 }} />
        </View>
        <ActivityIndicator color="#4ade80" size="large" style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t('common.backToLobby')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('stats.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {stats ? (
          <>
            {/* 总览统计 */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.handsPlayed}</Text>
                <Text style={styles.statLabel}>{t('stats.handsPlayed')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.handsWon}</Text>
                <Text style={styles.statLabel}>{t('stats.handsWon')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{(stats.winRate * 100).toFixed(1)}%</Text>
                <Text style={styles.statLabel}>{t('stats.winRate')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, stats.totalProfit >= 0 ? styles.profit : styles.loss]}>
                  {stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit}
                </Text>
                <Text style={styles.statLabel}>{t('stats.totalProfit')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, styles.profit]}>+{stats.biggestWin}</Text>
                <Text style={styles.statLabel}>{t('stats.biggestWin')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, styles.loss]}>{stats.biggestLoss}</Text>
                <Text style={styles.statLabel}>{t('stats.biggestLoss')}</Text>
              </View>
            </View>

            {/* 最近记录 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('stats.recentHands')}</Text>
              {stats.recentHands.length === 0 ? (
                <Text style={styles.emptyText}>{t('stats.noHands')}</Text>
              ) : (
                stats.recentHands.map((hand) => (
                  <View key={hand.id} style={styles.handCard}>
                    <View style={styles.handRow}>
                      <Text style={styles.handRoom}>{hand.roomName}</Text>
                      <Text style={[styles.handProfit, hand.profit >= 0 ? styles.profit : styles.loss]}>
                        {hand.profit >= 0 ? '+' : ''}{hand.profit}
                      </Text>
                    </View>
                    <Text style={styles.handDate}>
                      {new Date(hand.createdAt).toLocaleString()}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : (
          <Text style={styles.errorText}>{t('stats.loadError')}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060e10' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
    backgroundColor: '#0d1f14',
    borderBottomWidth: 1,
    borderBottomColor: '#1a3a22',
  },
  backText: { color: '#4ade80', fontSize: 15 },
  headerTitle: { color: '#e5e7eb', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 16 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    backgroundColor: '#0d1f14',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    borderWidth: 1,
    borderColor: '#1a3a22',
    alignItems: 'center',
  },
  statValue: { color: '#e5e7eb', fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { color: '#9ca3af', fontSize: 12, textAlign: 'center' },
  profit: { color: '#4ade80' },
  loss: { color: '#ef4444' },
  section: {
    backgroundColor: '#0d1f14',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1a3a22',
  },
  sectionTitle: { color: '#e5e7eb', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  handCard: {
    backgroundColor: '#0d2818',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1a3a22',
  },
  handRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  handRoom: { color: '#e5e7eb', fontSize: 14, fontWeight: '600' },
  handProfit: { fontSize: 14, fontWeight: 'bold' },
  handDate: { color: '#6b7280', fontSize: 12 },
  emptyText: { color: '#6b7280', textAlign: 'center', marginTop: 12, fontSize: 14 },
  errorText: { color: '#ef4444', textAlign: 'center', marginTop: 40, fontSize: 15 },
});
