import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../lib/api";
import { getStoredToken, getTokenPayload, isTokenExpired } from "../lib/auth";

interface PlayerEntry {
  id: string;
  nickname: string;
  holeCards: string[];
  finalHand: string;
  winAmount: number;
  netProfit: number;
}

interface HandHistoryEntry {
  handId: string;
  roomName: string;
  date: string;
  players: PlayerEntry[];
  communityCards: string[];
  pot: number;
  winnerId: string | null;
}

function CardDisplay({ card }: { card: string }) {
  if (!card || card === "??") {
    return (
      <View style={[styles.card, styles.cardBack]}>
        <Text style={styles.cardQuestion}>?</Text>
      </View>
    );
  }
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const isRed = suit === "h" || suit === "d";
  const suitSymbol: Record<string, string> = { h: "♥", d: "♦", s: "♠", c: "♣" };
  return (
    <View style={[styles.card, { backgroundColor: "#fff" }]}>
      <Text style={[styles.cardRank, { color: isRed ? "#dc2626" : "#1e293b" }]}>
        {rank}
      </Text>
      <Text style={[styles.cardSuit, { color: isRed ? "#dc2626" : "#1e293b" }]}>
        {suitSymbol[suit] ?? suit}
      </Text>
    </View>
  );
}

function HandCard({
  hand,
  userId,
}: {
  hand: HandHistoryEntry;
  userId: string;
}) {
  const { t } = useTranslation();
  const myPlayer = hand.players.find((p) => p.id === userId);
  const isWinner = hand.winnerId === userId;

  return (
    <View style={styles.handCard}>
      <View style={styles.handHeader}>
        <Text style={styles.handRoom}>{hand.roomName}</Text>
        <Text style={styles.handDate}>
          {new Date(hand.date).toLocaleString()}
        </Text>
      </View>

      {/* Community Cards */}
      {hand.communityCards.length > 0 && (
        <View style={styles.cardsRow}>
          <Text style={styles.cardsLabel}>{t("hands.board")}: </Text>
          <View style={styles.cardsRow}>
            {hand.communityCards.map((card, i) => (
              <CardDisplay key={i} card={card} />
            ))}
          </View>
        </View>
      )}

      {/* Pot */}
      <View style={styles.potRow}>
        <Text style={styles.potLabel}>{t("hands.pot")}: </Text>
        <Text style={styles.potValue}>{hand.pot.toLocaleString()}</Text>
      </View>

      {/* Players */}
      {hand.players.map((player) => (
        <View
          key={player.id}
          style={[
            styles.playerRow,
            player.id === userId && styles.myPlayerRow,
            hand.winnerId === player.id && styles.winnerRow,
          ]}
        >
          <View style={styles.playerInfo}>
            <Text
              style={[
                styles.playerName,
                player.id === userId && styles.myPlayerName,
              ]}
            >
              {player.nickname} {player.id === userId ? "(You)" : ""}
            </Text>
            <Text style={styles.finalHand}>{player.finalHand || "-"}</Text>
          </View>
          <View style={styles.playerCards}>
            {player.holeCards.map((card, i) => (
              <CardDisplay key={i} card={card} />
            ))}
          </View>
          <View style={styles.playerProfit}>
            <Text
              style={[
                styles.profitText,
                player.winAmount > 0
                  ? styles.profitGreen
                  : player.netProfit < 0
                    ? styles.profitRed
                    : styles.profitGray,
              ]}
            >
              {player.winAmount > 0
                ? `+${player.winAmount.toFixed(2)}`
                : player.netProfit !== 0
                  ? player.netProfit.toFixed(2)
                  : "-"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function HandsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [hands, setHands] = useState<HandHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const token = await getStoredToken();
      if (cancelled) return;
      if (!token || isTokenExpired(token, 1000)) {
        router.replace("/login");
        return;
      }
      const payload = getTokenPayload(token);
      if (cancelled) return;
      setUserId(payload?.sub ?? "");
      loadHands(0);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadHands = async (currentOffset: number) => {
    try {
      const { data } = await api.get<HandHistoryEntry[]>("/user/hands", {
        params: { limit: LIMIT, offset: currentOffset },
      });
      if (currentOffset === 0) {
        setHands(data);
      } else {
        setHands((prev) => [...prev, ...data]);
      }
      setHasMore(data.length === LIMIT);
      setOffset(currentOffset + LIMIT);
    } catch {
      setError(t("hands.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!hasMore) return;
    void loadHands(offset);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("hands.title")}</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <ActivityIndicator
          color="#4ade80"
          size="large"
          style={{ marginTop: 100 }}
        />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setError(null);
              setLoading(true);
              void loadHands(0);
            }}
          >
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : hands.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t("hands.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={hands}
          keyExtractor={(item) => item.handId}
          renderItem={({ item }) => <HandCard hand={item} userId={userId} />}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            hasMore ? (
              <ActivityIndicator
                color="#4ade80"
                style={{ marginVertical: 20 }}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#060e10" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
    backgroundColor: "#0d1f14",
    borderBottomWidth: 1,
    borderBottomColor: "#1a3a22",
  },
  backText: { color: "#4ade80", fontSize: 15 },
  headerTitle: { color: "#e5e7eb", fontSize: 18, fontWeight: "bold" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: "rgba(74,222,128,0.15)",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: "#4ade80", fontSize: 14, fontWeight: "600" },
  emptyText: {
    color: "#6b7280",
    fontSize: 15,
    textAlign: "center",
    marginTop: 40,
  },
  list: { padding: 16, gap: 12 },
  handCard: {
    backgroundColor: "#0d1f14",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1a3a22",
    marginBottom: 12,
  },
  handHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  handRoom: { color: "#e5e7eb", fontSize: 15, fontWeight: "bold" },
  handDate: { color: "#6b7280", fontSize: 12 },
  cardsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  cardsLabel: { color: "#9ca3af", fontSize: 13, marginRight: 6 },
  card: {
    width: 32,
    height: 44,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  cardBack: { backgroundColor: "rgba(255,255,255,0.08)" },
  cardQuestion: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 16,
    fontWeight: "bold",
  },
  cardRank: { fontSize: 14, fontWeight: "bold", lineHeight: 16 },
  cardSuit: { fontSize: 12, lineHeight: 14 },
  potRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  potLabel: { color: "#9ca3af", fontSize: 13 },
  potValue: { color: "#facc15", fontSize: 14, fontWeight: "bold" },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  myPlayerRow: {
    backgroundColor: "rgba(74,222,128,0.08)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.2)",
  },
  winnerRow: {
    backgroundColor: "rgba(74,222,128,0.12)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.4)",
  },
  playerInfo: { flex: 1 },
  playerName: { color: "#e5e7eb", fontSize: 13, fontWeight: "600" },
  myPlayerName: { color: "#4ade80" },
  finalHand: { color: "#9ca3af", fontSize: 11, marginTop: 2 },
  playerCards: { flexDirection: "row", marginRight: 8 },
  playerProfit: { minWidth: 60, alignItems: "flex-end" },
  profitText: { fontSize: 13, fontWeight: "bold" },
  profitGreen: { color: "#4ade80" },
  profitRed: { color: "#ef4444" },
  profitGray: { color: "#9ca3af" },
});
