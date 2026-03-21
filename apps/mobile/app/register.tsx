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
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // 表单验证
    if (!username.trim()) {
      Alert.alert(t('common.confirm'), t('auth.inputRequired', { field: t('auth.username') }));
      return;
    }
    if (username.trim().length < 3) {
      Alert.alert(t('common.confirm'), t('auth.usernameMinLength'));
      return;
    }
    if (!nickname.trim()) {
      Alert.alert(t('common.confirm'), t('auth.inputRequired', { field: t('auth.nickname') }));
      return;
    }
    if (!password.trim()) {
      Alert.alert(t('common.confirm'), t('auth.inputRequired', { field: t('auth.password') }));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('common.confirm'), t('auth.passwordMinLength'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        username: username.trim(),
        nickname: nickname.trim(),
        password,
      });
      Alert.alert(
        t('auth.registerSuccess'),
        t('auth.registerSuccessMsg'),
        [{ text: t('auth.goLogin'), onPress: () => router.replace('/login') }]
      );
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const message = err?.response?.data?.message ?? t('auth.registerFailedMsg');
      Alert.alert(t('auth.registerFailed'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>♠ Texas Hold'em</Text>
          <Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text>

          <TextInput
            style={styles.input}
            placeholder={t('auth.usernamePlaceholder')}
            placeholderTextColor="#6b7280"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />

          <TextInput
            style={styles.input}
            placeholder={t('auth.nicknamePlaceholder')}
            placeholderTextColor="#6b7280"
            value={nickname}
            onChangeText={setNickname}
            autoCorrect={false}
            maxLength={20}
          />

          <TextInput
            style={styles.input}
            placeholder={t('auth.passwordPlaceholder')}
            placeholderTextColor="#6b7280"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            maxLength={50}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('auth.registerBtn')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.haveAccount')}</Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.footerLink}>{t('auth.goLogin')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060e10',
  },
  scrollContent: {
    flexGrow: 1,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
  },
  footerText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  footerLink: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
});
