import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Switch,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface NotificationSettings {
  chat_messages: boolean;
  task_assigned: boolean;
  attendance_reminder: boolean;
  schedule_reminder: boolean;
}

function SettingRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E5E7EB', true: '#BFDBFE' }}
        thumbColor={value ? '#2563EB' : '#9CA3AF'}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: '오너',
  ADMIN: '관리자',
  MANAGER: '매니저',
  EMPLOYEE: '직원',
};

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const { data: notiSettings, isLoading: notiLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const res = await api.get('/notifications/settings');
      return res.data.data as NotificationSettings;
    },
  });

  const handleToggleNotification = async (key: keyof NotificationSettings, value: boolean) => {
    try {
      await api.patch('/notifications/settings', { [key]: value });
    } catch {
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    }
  };

  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 프로필 카드 */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name[0] ?? '?'}</Text>
        </View>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</Text>
        </View>
      </View>

      {/* 내 정보 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>계정 정보</Text>
        <View style={styles.card}>
          <InfoRow label="이름" value={user?.name ?? '—'} />
          <View style={styles.divider} />
          <InfoRow label="이메일" value={user?.email ?? '—'} />
          <View style={styles.divider} />
          <InfoRow label="회사" value={user?.companyName ?? '—'} />
          <View style={styles.divider} />
          <InfoRow label="역할" value={ROLE_LABEL[user?.role ?? ''] ?? user?.role ?? '—'} />
        </View>
      </View>

      {/* 알림 설정 */}
      {!notiLoading && notiSettings && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>알림 설정</Text>
          <View style={styles.card}>
            <SettingRow
              label="채팅 메시지"
              value={notiSettings.chat_messages}
              onToggle={(v) => handleToggleNotification('chat_messages', v)}
            />
            <View style={styles.divider} />
            <SettingRow
              label="업무 배정"
              value={notiSettings.task_assigned}
              onToggle={(v) => handleToggleNotification('task_assigned', v)}
            />
            <View style={styles.divider} />
            <SettingRow
              label="출퇴근 리마인더"
              value={notiSettings.attendance_reminder}
              onToggle={(v) => handleToggleNotification('attendance_reminder', v)}
            />
            <View style={styles.divider} />
            <SettingRow
              label="일정 리마인더"
              value={notiSettings.schedule_reminder}
              onToggle={(v) => handleToggleNotification('schedule_reminder', v)}
            />
          </View>
        </View>
      )}

      {/* 로그아웃 */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>

      <Text style={styles.version}>관리왕 v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { fontSize: 30, fontWeight: '700', color: '#2563EB' },
  userName: { fontSize: 20, fontWeight: '700', color: '#111827' },
  userEmail: { fontSize: 14, color: '#6B7280' },
  roleBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 4,
  },
  roleText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: { fontSize: 14, fontWeight: '500', color: '#111827' },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingLabel: { fontSize: 14, color: '#374151' },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  logoutBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
  version: { textAlign: 'center', fontSize: 12, color: '#D1D5DB', marginTop: 8 },
});
