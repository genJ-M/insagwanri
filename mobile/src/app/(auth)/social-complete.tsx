import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

/**
 * /(auth)/social-complete
 * 소셜 신규 가입자 — 회사명 입력 후 가입 완료.
 */
export default function SocialCompleteScreen() {
  const { pending_token, name, email } = useLocalSearchParams<{
    pending_token: string;
    name: string;
    email: string;
  }>();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pending_token) router.replace('/(auth)/login');
  }, [pending_token]);

  const handleComplete = async () => {
    const trimmed = companyName.trim();
    if (trimmed.length < 2) {
      Alert.alert('입력 오류', '회사명은 2자 이상 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/social-complete', {
        pending_token,
        company_name: trimmed,
      });

      const { access_token, refresh_token, user } = res.data.data;
      setUser(user, { access_token, refresh_token });
      router.replace('/(tabs)/');
    } catch (err: any) {
      Alert.alert(
        '가입 실패',
        err.response?.data?.message ?? '가입 중 오류가 발생했습니다. 다시 시도해 주세요.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>거의 다 됐습니다!</Text>
        <Text style={styles.subtitle}>회사 정보를 입력하고 가입을 완료해 주세요.</Text>

        {/* 소셜 계정 정보 */}
        {(name || email) && (
          <View style={styles.accountInfo}>
            {name ? <Text style={styles.accountName}>{name}</Text> : null}
            {email ? <Text style={styles.accountEmail}>{email}</Text> : null}
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="회사명을 입력해주세요"
          value={companyName}
          onChangeText={setCompanyName}
          maxLength={100}
          placeholderTextColor="#9CA3AF"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>가입 완료</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.back}>
          <Text style={styles.backText}>← 로그인으로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 28 },
  accountInfo: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  accountName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  accountEmail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  back: { marginTop: 20, alignItems: 'center' },
  backText: { fontSize: 13, color: '#9CA3AF' },
});
