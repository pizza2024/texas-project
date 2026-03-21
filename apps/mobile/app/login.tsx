import { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../lib/api';
import { setStoredToken } from '../lib/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('提示', '请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ access_token: string }>('/auth/login', {
        username: username.trim(),
        password,
      });
      await setStoredToken(res.data.access_token);
      router.replace('/rooms');
    } catch {
      Alert.alert('登录失败', '用户名或密码错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <Text style={styles.title}>♠ Texas Hold'em</Text>
        <Text style={styles.subtitle}>登录您的账户</Text>

        <TextInput
          style={styles.input}
          placeholder="用户名"
          placeholderTextColor="#6b7280"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="密码"
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
            <Text style={styles.buttonText}>登录</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060e10',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0d1f14',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: '#1a3a22',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4ade80',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 28,
  },
  input: {
    backgroundColor: '#0d2818',
    borderWidth: 1,
    borderColor: '#1a3a22',
    borderRadius: 10,
    padding: 14,
    color: '#e5e7eb',
    fontSize: 15,
    marginBottom: 14,
  },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
