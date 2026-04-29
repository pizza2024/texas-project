import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../lib/api";
import { getStoredToken, clearStoredToken } from "../lib/auth";
import { getSocket, setDepositConfirmedHandler } from "../lib/socket";
import type { Room, DepositConfirmedPayload } from "@texas/shared";

interface RoomWithStatus extends Room {
  currentPlayers: number;
  isFull: boolean;
}

export default function RoomsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<RoomWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [joinModal, setJoinModal] = useState<{
    roomId: string;
    needsPassword: boolean;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [balance, setBalance] = useState(0);
  const [depositToast, setDepositToast] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    try {
      const [roomsRes, profileRes] = await Promise.all([
        api.get<RoomWithStatus[]>("/rooms"),
        api.get<{ coinBalance: number }>("/auth/profile"),
      ]);
      setRooms(roomsRes.data);
      setBalance(profileRes.data.coinBalance);
    } catch {
      Alert.alert(t("common.confirm"), t("lobby.loadingTables"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // 充值到账 WebSocket 通知
  useEffect(() => {
    async function connectSocket() {
      const token = await getStoredToken();
      if (!token) return;
      getSocket(token); // 确保连接建立
    }
    connectSocket();

    setDepositConfirmedHandler((data: DepositConfirmedPayload) => {
      setBalance((prev) => prev + data.chips);
      setDepositToast(t("lobby.depositSuccess", { chips: data.chips }));
      setTimeout(() => setDepositToast(null), 4000);
    });

    return () => setDepositConfirmedHandler(() => {});
  }, []);

  const handleJoinRoom = (room: RoomWithStatus) => {
    if (room.isFull) {
      Alert.alert(t("common.confirm"), t("lobby.roomFull"));
      return;
    }
    setJoinModal({ roomId: room.id, needsPassword: room.isPrivate ?? false });
    setPassword("");
  };

  const confirmJoin = async () => {
    if (!joinModal) return;
    const token = await getStoredToken();
    if (!token) return;
    const socket = getSocket(token);
    socket.emit("join_room", {
      roomId: joinModal.roomId,
      password: joinModal.needsPassword ? password : undefined,
    });
    socket.once("wrong_password", () => {
      Alert.alert(t("lobby.wrongPassword"), t("lobby.wrongPasswordMsg"));
    });
    socket.once("room_full", () => {
      Alert.alert(t("common.confirm"), t("lobby.roomFull"));
    });
    socket.once("already_in_room", (data) => {
      Alert.alert(
        t("common.confirm"),
        "你已在其他房间。是否退出原房间并进入当前房间？",
        [
          {
            text: t("common.cancel"),
            style: "cancel",
            onPress: () => {
              router.push(`/room/${data.roomId}`);
            },
          },
          {
            text: t("common.confirm"),
            onPress: async () => {
              try {
                await api.post("/tables/me/leave-room");
                socket.emit("join_room", {
                  roomId: joinModal.roomId,
                  password: joinModal.needsPassword ? password : undefined,
                });
              } catch {
                Alert.alert(t("common.confirm"), "切换房间失败，请稍后重试。");
              }
            },
          },
        ],
      );
    });
    // 进入房间由 room_update 触发
    socket.once("room_update", () => {
      router.push(`/room/${joinModal.roomId}`);
    });
    setJoinModal(null);
  };

  const handleQuickMatch = async () => {
    const token = await getStoredToken();
    if (!token) return;
    setMatching(true);
    const socket = getSocket(token);
    socket.emit("quick_match", { tier: "MEDIUM" });
    socket.once("match_found", (data) => {
      setMatching(false);
      router.push(`/room/${data.roomId}`);
    });
    socket.once("match_error", (data) => {
      setMatching(false);
      Alert.alert(
        t("lobby.matchError"),
        t("lobby.matchErrorMsg", { message: data.message }),
      );
    });
  };

  const handleLogout = async () => {
    await clearStoredToken();
    router.replace("/login");
  };

  const renderRoom = ({ item }: { item: RoomWithStatus }) => (
    <TouchableOpacity
      style={[styles.roomCard, item.isFull && styles.roomFull]}
      onPress={() => handleJoinRoom(item)}
    >
      <View style={styles.roomInfo}>
        <Text style={styles.roomName}>{item.name}</Text>
        <Text style={styles.roomDetails}>
          {t("lobby.tierBlinds", {
            blinds: `${item.blindSmall}/${item.blindBig}`,
          })}{" "}
          · {t("lobby.tierMinChips", { amount: item.minBuyIn })}+
          {item.isPrivate ? " 🔒" : ""}
        </Text>
      </View>
      <View style={styles.roomRight}>
        <Text style={[styles.playerCount, item.isFull && styles.fullText]}>
          {item.currentPlayers}/{item.maxPlayers}
        </Text>
        <Text style={styles.playerLabel}>
          {item.isFull ? t("lobby.roomFull") : t("lobby.players")}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>♠ {t("lobby.title")}</Text>
          <Text style={styles.balanceText}>
            {t("lobby.balance")}：{balance.toLocaleString()}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.depositBtn}
            onPress={() => router.push("/deposit")}
          >
            <Text style={styles.depositBtnText}>{t("common.deposit")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.withdrawBtn}
            onPress={() => router.push("/withdraw")}
          >
            <Text style={styles.withdrawBtnText}>↙ {t("common.withdraw")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => router.push("/hands")}
          >
            <Text style={styles.historyBtnText}>🃏</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push("/settings")}
          >
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutText}>{t("common.logout")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 充值到账提示 */}
      {depositToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>✅ {depositToast}</Text>
        </View>
      )}

      {/* 快速匹配 */}
      <TouchableOpacity
        style={[styles.matchBtn, matching && styles.matchBtnDisabled]}
        onPress={handleQuickMatch}
        disabled={matching}
      >
        {matching ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.matchBtnText}>⚡ {t("lobby.quickMatch")}</Text>
        )}
      </TouchableOpacity>

      {/* 房间列表 */}
      {loading ? (
        <ActivityIndicator
          style={{ marginTop: 40 }}
          color="#4ade80"
          size="large"
        />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          renderItem={renderRoom}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadRooms();
              }}
              tintColor="#4ade80"
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t("lobby.noTablesHint")}</Text>
          }
        />
      )}

      {/* 加入房间弹窗 */}
      <Modal visible={!!joinModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("lobby.joinTable")}</Text>
            {joinModal?.needsPassword && (
              <TextInput
                style={styles.input}
                placeholder={t("lobby.wrongPasswordMsg")}
                placeholderTextColor="#6b7280"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setJoinModal(null)}
              >
                <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={confirmJoin}
              >
                <Text style={styles.confirmBtnText}>
                  {t("lobby.joinTable")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#060e10" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: "#0d1f14",
    borderBottomWidth: 1,
    borderBottomColor: "#1a3a22",
  },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#4ade80" },
  balanceText: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  depositBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  depositBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  withdrawBtn: {
    backgroundColor: "rgba(239,68,68,0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
  },
  withdrawBtnText: { color: "#ef4444", fontWeight: "bold", fontSize: 12 },
  historyBtn: {
    backgroundColor: "rgba(74,222,128,0.15)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  historyBtnText: { fontSize: 16 },
  settingsBtn: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  settingsBtnText: { fontSize: 16 },
  logoutText: { color: "#9ca3af", fontSize: 13 },
  toast: {
    margin: 12,
    backgroundColor: "#14532d",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#16a34a",
  },
  toastText: { color: "#4ade80", fontWeight: "bold", textAlign: "center" },
  matchBtn: {
    margin: 14,
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  matchBtnDisabled: { opacity: 0.6 },
  matchBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  list: { padding: 12 },
  roomCard: {
    backgroundColor: "#0d1f14",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1a3a22",
  },
  roomFull: { opacity: 0.5 },
  roomInfo: { flex: 1 },
  roomName: { color: "#e5e7eb", fontSize: 16, fontWeight: "600" },
  roomDetails: { color: "#9ca3af", fontSize: 13, marginTop: 3 },
  roomRight: { alignItems: "center" },
  playerCount: { color: "#4ade80", fontSize: 18, fontWeight: "bold" },
  fullText: { color: "#ef4444" },
  playerLabel: { color: "#6b7280", fontSize: 11 },
  emptyText: {
    color: "#6b7280",
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#0d1f14",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1a3a22",
  },
  modalTitle: {
    color: "#e5e7eb",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#060e10",
    borderWidth: 1,
    borderColor: "#1a3a22",
    borderRadius: 8,
    padding: 12,
    color: "#e5e7eb",
    marginBottom: 14,
  },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalBtn: { flex: 1, borderRadius: 8, padding: 12, alignItems: "center" },
  cancelBtn: { backgroundColor: "#1f2937" },
  cancelBtnText: { color: "#9ca3af", fontWeight: "bold" },
  confirmBtn: { backgroundColor: "#16a34a" },
  confirmBtnText: { color: "#fff", fontWeight: "bold" },
});
