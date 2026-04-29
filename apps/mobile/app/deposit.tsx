import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Share,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import api from "../lib/api";
import type { DepositAddress, DepositRecord } from "@texas/shared";

const BLOCK_EXPLORER =
  process.env.EXPO_PUBLIC_BLOCK_EXPLORER_URL ?? "https://sepolia.etherscan.io";

function txUrl(hash: string) {
  return `${BLOCK_EXPLORER}/tx/${hash}`;
}

export default function DepositScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [depositAddr, setDepositAddr] = useState<DepositAddress | null>(null);
  const [records, setRecords] = useState<DepositRecord[]>([]);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState<{
    text: string;
    txHash?: string;
  } | null>(null);
  const isFaucetEnabled = process.env.EXPO_PUBLIC_FAUCET_ENABLED === "true";

  const loadData = useCallback(
    async (retry = false) => {
      try {
        const [addrRes, histRes] = await Promise.all([
          api.get<DepositAddress>("/deposit/address"),
          api.get<DepositRecord[]>("/deposit/history"),
        ]);
        setDepositAddr(addrRes.data);
        setRecords(histRes.data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t("deposit.loadError");
        if (!retry) {
          Alert.alert(t("deposit.loadError"), msg, [
            { text: t("common.confirm"), onPress: () => loadData(true) },
            { text: t("common.cancel") },
          ]);
        }
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopy = async () => {
    if (!depositAddr?.address) return;
    await Clipboard.setStringAsync(depositAddr.address);
    Alert.alert(t("deposit.copied"), t("deposit.copied"));
  };

  const handleShare = async () => {
    if (!depositAddr?.address) return;
    await Share.share({ message: depositAddr.address });
  };

  const handleFaucet = async () => {
    setFaucetLoading(true);
    setFaucetMsg(null);
    try {
      const res = await api.post<{ txHash?: string; message: string }>(
        "/deposit/faucet",
      );
      setFaucetMsg({ text: res.data.message, txHash: res.data.txHash });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("deposit.faucetError");
      Alert.alert(t("deposit.faucetError"), msg);
    } finally {
      setFaucetLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t("common.backToLobby")}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("deposit.title")}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator
            color="#4ade80"
            size="large"
            style={{ marginTop: 40 }}
          />
        ) : depositAddr ? (
          <>
            {/* 二维码 */}
            <View style={styles.qrCard}>
              <Text style={styles.sectionTitle}>
                {t("deposit.yourAddress")}
              </Text>
              <View style={styles.qrWrap}>
                <QRCode
                  value={depositAddr.address}
                  size={180}
                  color="#4ade80"
                  backgroundColor="#0d1f14"
                />
              </View>
              <Text style={styles.networkLabel}>
                {depositAddr.network} · {depositAddr.token}
              </Text>
            </View>

            {/* 地址 */}
            <View style={styles.addrCard}>
              <Text style={styles.addrLabel}>{t("deposit.addressLabel")}</Text>
              <Text style={styles.addr} selectable>
                {depositAddr.address}
              </Text>
              <View style={styles.addrBtns}>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
                  <Text style={styles.copyBtnText}>{t("deposit.copy")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                  <Text style={styles.shareBtnText}>{t("deposit.share")}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.rateText}>
                {t("deposit.rate")}：1 USDT = {depositAddr.rate}{" "}
                {t("deposit.chips")}
              </Text>
            </View>

            {/* 测试网水龙头 */}
            {isFaucetEnabled && (
              <View style={styles.faucetCard}>
                <Text style={styles.sectionTitle}>
                  {t("deposit.faucetTitle")}
                </Text>
                <Text style={styles.faucetDesc}>{t("deposit.faucetDesc")}</Text>
                <TouchableOpacity
                  style={[
                    styles.faucetBtn,
                    faucetLoading && styles.btnDisabled,
                  ]}
                  onPress={handleFaucet}
                  disabled={faucetLoading}
                >
                  {faucetLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.faucetBtnText}>
                      {t("deposit.faucetBtn")}
                    </Text>
                  )}
                </TouchableOpacity>
                {faucetMsg && (
                  <Text style={styles.faucetMsg}>{faucetMsg.text}</Text>
                )}
                {faucetMsg?.txHash && (
                  <Text style={styles.txHash} selectable>
                    交易: {txUrl(faucetMsg.txHash)}
                  </Text>
                )}
              </View>
            )}
          </>
        ) : (
          <Text style={styles.errorText}>{t("deposit.loadError")}</Text>
        )}

        {/* 充值记录 */}
        <View style={styles.recordsSection}>
          <Text style={styles.sectionTitle}>{t("deposit.history")}</Text>
          {records.length === 0 ? (
            <Text style={styles.emptyText}>{t("deposit.noHistory")}</Text>
          ) : (
            records.map((r) => (
              <View key={r.id} style={styles.recordCard}>
                <View style={styles.recordRow}>
                  <Text style={styles.recordAmount}>{r.amount} USDT</Text>
                  <Text style={styles.recordChips}>+{r.chips} 筹码</Text>
                </View>
                <Text style={styles.recordHash} selectable numberOfLines={1}>
                  {r.txHash}
                </Text>
                <View style={styles.recordRow}>
                  <Text style={styles.recordStatus}>{r.status}</Text>
                  <Text style={styles.recordDate}>
                    {new Date(r.createdAt).toLocaleString("zh-CN")}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  content: { padding: 16 },
  qrCard: {
    backgroundColor: "#0d1f14",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1a3a22",
  },
  sectionTitle: {
    color: "#e5e7eb",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 14,
  },
  qrWrap: {
    padding: 12,
    backgroundColor: "#0d1f14",
    borderRadius: 10,
    marginBottom: 10,
  },
  networkLabel: { color: "#9ca3af", fontSize: 13 },
  addrCard: {
    backgroundColor: "#0d1f14",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1a3a22",
  },
  addrLabel: { color: "#9ca3af", fontSize: 12, marginBottom: 6 },
  addr: {
    color: "#4ade80",
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 12,
  },
  addrBtns: { flexDirection: "row", gap: 10, marginBottom: 10 },
  copyBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  copyBtnText: { color: "#fff", fontWeight: "bold" },
  shareBtn: {
    flex: 1,
    backgroundColor: "#1d4ed8",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  shareBtnText: { color: "#fff", fontWeight: "bold" },
  rateText: { color: "#fbbf24", fontSize: 13, textAlign: "center" },
  faucetCard: {
    backgroundColor: "#0d1f14",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1a3a22",
  },
  faucetDesc: { color: "#9ca3af", fontSize: 13, marginBottom: 12 },
  faucetBtn: {
    backgroundColor: "#7c3aed",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  faucetBtnText: { color: "#fff", fontWeight: "bold" },
  faucetMsg: {
    color: "#4ade80",
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
  },
  txHash: { color: "#60a5fa", fontSize: 11, marginTop: 6, textAlign: "center" },
  errorText: { color: "#ef4444", textAlign: "center", marginTop: 40 },
  recordsSection: { marginTop: 6 },
  recordCard: {
    backgroundColor: "#0d1f14",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1a3a22",
  },
  recordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  recordAmount: { color: "#4ade80", fontWeight: "bold" },
  recordChips: { color: "#fbbf24", fontWeight: "bold" },
  recordHash: { color: "#6b7280", fontSize: 11, marginBottom: 4 },
  recordStatus: { color: "#9ca3af", fontSize: 12 },
  recordDate: { color: "#6b7280", fontSize: 12 },
  emptyText: { color: "#6b7280", textAlign: "center", marginTop: 12 },
});
