import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import api from "../lib/api";

interface UserProfile {
  id: string;
  username: string;
  nickname: string;
  coinBalance: number;
  avatarUrl?: string;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await api.get<UserProfile>("/auth/profile");
      setProfile(res.data);
    } catch (err) {
      Alert.alert(t("common.confirm"), t("stats.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUserId = async () => {
    if (!profile?.id) return;
    await Clipboard.setStringAsync(profile.id);
    Alert.alert(t("settings.idCopied"));
  };

  const handleUploadAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("common.confirm"), "Need camera roll permissions");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset.uri) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", {
        uri: asset.uri,
        type: asset.mimeType || "image/jpeg",
        name: "avatar.jpg",
      } as any);

      await api.post("/user/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await loadProfile();
    } catch (err) {
      Alert.alert(t("settings.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    Alert.alert(t("settings.removeAvatar"), t("common.confirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete("/user/avatar");
            await loadProfile();
          } catch (err) {
            Alert.alert(t("settings.removeError"));
          }
        },
      },
    ]);
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          color="#4ade80"
          size="large"
          style={{ marginTop: 100 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t("common.backToLobby")}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("settings.title")}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 用户信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.userInfo")}</Text>

          {/* 头像 */}
          <View style={styles.avatarSection}>
            {profile?.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {profile?.nickname?.[0]?.toUpperCase() || "?"}
                </Text>
              </View>
            )}
            <View style={styles.avatarBtns}>
              <TouchableOpacity
                style={[styles.avatarBtn, uploading && styles.btnDisabled]}
                onPress={handleUploadAvatar}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.avatarBtnText}>
                    {t("settings.uploadAvatar")}
                  </Text>
                )}
              </TouchableOpacity>
              {profile?.avatarUrl && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={handleRemoveAvatar}
                >
                  <Text style={styles.removeBtnText}>
                    {t("settings.removeAvatar")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.avatarHint}>{t("settings.avatarHint")}</Text>
          </View>

          {/* 用户信息卡片 */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("auth.username")}</Text>
              <Text style={styles.infoValue}>{profile?.username}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("auth.nickname")}</Text>
              <Text style={styles.infoValue}>{profile?.nickname}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("settings.balance")}</Text>
              <Text style={styles.infoValue}>
                {profile?.coinBalance.toLocaleString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("settings.userId")}</Text>
              <TouchableOpacity onPress={handleCopyUserId}>
                <Text style={styles.infoValueLink}>
                  {profile?.id?.substring(0, 8)}... {t("settings.copyId")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 语言设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
          <Text style={styles.sectionDesc}>{t("settings.languageDesc")}</Text>
          <View style={styles.langBtns}>
            <TouchableOpacity
              style={[
                styles.langBtn,
                i18n.language === "zh-CN" && styles.langBtnActive,
              ]}
              onPress={() => changeLanguage("zh-CN")}
            >
              <Text
                style={[
                  styles.langBtnText,
                  i18n.language === "zh-CN" && styles.langBtnTextActive,
                ]}
              >
                中文
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.langBtn,
                i18n.language === "en-US" && styles.langBtnActive,
              ]}
              onPress={() => changeLanguage("en-US")}
            >
              <Text
                style={[
                  styles.langBtnText,
                  i18n.language === "en-US" && styles.langBtnTextActive,
                ]}
              >
                English
              </Text>
            </TouchableOpacity>
          </View>
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
  section: {
    backgroundColor: "#0d1f14",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1a3a22",
  },
  sectionTitle: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  sectionDesc: { color: "#9ca3af", fontSize: 13, marginBottom: 12 },
  avatarSection: { alignItems: "center", marginBottom: 16 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    backgroundColor: "#16a34a",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "bold" },
  avatarBtns: { flexDirection: "row", gap: 10, marginBottom: 8 },
  avatarBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  avatarBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  removeBtn: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  removeBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  btnDisabled: { opacity: 0.6 },
  avatarHint: { color: "#6b7280", fontSize: 11, textAlign: "center" },
  infoCard: { gap: 12 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: { color: "#9ca3af", fontSize: 14 },
  infoValue: { color: "#e5e7eb", fontSize: 14, fontWeight: "600" },
  infoValueLink: { color: "#4ade80", fontSize: 14, fontWeight: "600" },
  langBtns: { flexDirection: "row", gap: 10 },
  langBtn: {
    flex: 1,
    backgroundColor: "#0d2818",
    borderWidth: 1,
    borderColor: "#1a3a22",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  langBtnActive: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  langBtnText: { color: "#9ca3af", fontWeight: "bold", fontSize: 14 },
  langBtnTextActive: { color: "#fff" },
});
