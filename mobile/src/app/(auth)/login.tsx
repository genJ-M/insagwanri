import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ?? '';
const GOOGLE_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID ?? '';
const KAKAO_CLIENT_ID = process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID ?? '';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'kakao' | null>(null);
  const login = useAuthStore((s) => s.login);
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();

  // ── 이메일/비밀번호 로그인 ──────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? '로그인에 실패했습니다.';
      Alert.alert('로그인 실패', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── 소셜 로그인 공통 처리 ───────────────────────────────────────
  const handleSocialResult = async (
    provider: 'google' | 'kakao',
    code: string,
    redirectUri: string,
  ) => {
    const res = await api.post('/auth/social/mobile', {
      provider,
      code,
      redirect_uri: redirectUri,
    });

    const { type, access_token, refresh_token, user, pending_token, name, email: socialEmail } = res.data.data;

    if (type === 'login') {
      setUser(user, { access_token, refresh_token });
    } else {
      // 신규 유저 — 회사명 입력 화면으로
      router.push({
        pathname: '/(auth)/social-complete',
        params: { pending_token, name, email: socialEmail },
      });
    }
  };

  // ── Google 소셜 로그인 ──────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setSocialLoading('google');
    try {
      const clientId = Platform.OS === 'ios' ? GOOGLE_CLIENT_ID_IOS : GOOGLE_CLIENT_ID_ANDROID;

      const redirectUri = makeRedirectUri({ scheme: 'gwanriwang', path: 'auth/callback' });

      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
      };

      const request = new AuthSession.AuthRequest({
        clientId,
        scopes: ['openid', 'email', 'profile'],
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
      });

      const result = await request.promptAsync(discovery);

      if (result.type === 'success' && result.params.code) {
        await handleSocialResult('google', result.params.code, redirectUri);
      } else if (result.type === 'error') {
        Alert.alert('Google 로그인 실패', result.error?.message ?? '다시 시도해 주세요.');
      }
    } catch (err: any) {
      Alert.alert('오류', err.response?.data?.message ?? 'Google 로그인 중 오류가 발생했습니다.');
    } finally {
      setSocialLoading(null);
    }
  };

  // ── Kakao 소셜 로그인 ───────────────────────────────────────────
  const handleKakaoLogin = async () => {
    setSocialLoading('kakao');
    try {
      const redirectUri = makeRedirectUri({ scheme: 'gwanriwang', path: 'auth/callback' });

      const authUrl =
        `https://kauth.kakao.com/oauth/authorize` +
        `?client_id=${KAKAO_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        if (code) {
          await handleSocialResult('kakao', code, redirectUri);
        } else {
          Alert.alert('Kakao 로그인 실패', '인증 코드를 받지 못했습니다.');
        }
      }
    } catch (err: any) {
      Alert.alert('오류', err.response?.data?.message ?? 'Kakao 로그인 중 오류가 발생했습니다.');
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        {/* 로고 */}
        <View style={styles.logoArea}>
          <Text style={styles.logoText}>관리왕</Text>
          <Text style={styles.tagline}>직원 관리 플랫폼</Text>
        </View>

        {/* 이메일/비밀번호 폼 */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="이메일"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#9CA3AF"
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#9CA3AF"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>로그인</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 구분선 */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는 소셜 계정으로</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* 소셜 버튼 */}
        <View style={styles.socialButtons}>
          {/* Google */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={!!socialLoading}
          >
            {socialLoading === 'google' ? (
              <ActivityIndicator color="#374151" size="small" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleText}>Google로 로그인</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Kakao */}
          <TouchableOpacity
            style={styles.kakaoButton}
            onPress={handleKakaoLogin}
            disabled={!!socialLoading}
          >
            {socialLoading === 'kakao' ? (
              <ActivityIndicator color="#191919" size="small" />
            ) : (
              <>
                <Text style={styles.kakaoIcon}>K</Text>
                <Text style={styles.kakaoText}>Kakao로 로그인</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          계정이 없으신가요?{'\n'}관리자에게 초대 링크를 요청하세요.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoText: { fontSize: 36, fontWeight: '800', color: '#2563EB' },
  tagline: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  form: { gap: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' },
  socialButtons: { gap: 12 },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
  },
  googleIcon: { fontSize: 16, fontWeight: '700', color: '#4285F4' },
  googleText: { fontSize: 15, fontWeight: '500', color: '#374151' },
  kakaoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FEE500',
    borderRadius: 12,
    paddingVertical: 14,
  },
  kakaoIcon: { fontSize: 16, fontWeight: '700', color: '#191919' },
  kakaoText: { fontSize: 15, fontWeight: '500', color: '#191919' },
  hint: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginTop: 32, lineHeight: 20 },
});
