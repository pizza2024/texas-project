import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../lib/api";
import { setStoredToken } from "../lib/auth";

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert(
        t("common.tips"),
        t("auth.inputRequired", {
          field: t("auth.username") + "和" + t("auth.password"),
        }),
      );
      return;
    }
    setLoading(true);
    try {
      console.log("🔐 [Login] Attempting login:", {
        username: username.trim(),
      });
      const res = await api.post<{ access_token: string }>("/auth/login", {
        username: username.trim(),
        password,
      });
      console.log("✅ [Login] Success:", res.data);
      await setStoredToken(res.data.access_token);
      router.replace("/rooms");
    } catch (error: any) {
      console.error(
        "❌ [Login] Error:",
        error.response?.data || error.message || error,
      );
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        t("auth.loginFailedMsg");
      Alert.alert(t("auth.loginFailed"), errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        <Text style={styles.title}>♠ Texas Hold'em</Text>
        <Text style={styles.subtitle}>{t("auth.loginSubtitle")}</Text>

        <TextInput
          style={styles.input}
          placeholder={t("auth.username")}
          placeholderTextColor="#6b7280"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder={t("auth.password")}
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t("auth.loginBtn")}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("auth.noAccount")}</Text>
          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={styles.footerLink}>{t("auth.register")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#060e10",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#0d1f14",
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: "#1a3a22",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#4ade80",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 28,
  },
  input: {
    backgroundColor: "#0d2818",
    borderWidth: 1,
    borderColor: "#1a3a22",
    borderRadius: 10,
    padding: 14,
    color: "#e5e7eb",
    fontSize: 15,
    marginBottom: 14,
  },
  button: {
    backgroundColor: "#16a34a",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
    gap: 6,
  },
  footerText: {
    color: "#9ca3af",
    fontSize: 14,
  },
  footerLink: {
    color: "#4ade80",
    fontSize: 14,
    fontWeight: "600",
  },
});
