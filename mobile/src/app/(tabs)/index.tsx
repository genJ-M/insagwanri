import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface DashboardData {
  todayAttendance: { checkIn: string | null; checkOut: string | null; status: string } | null;
  pendingTasks: number;
  upcomingSchedules: Array<{ id: string; title: string; start_datetime: string }>;
  announcements: Array<{ id: string; title: string; created_at: string }>;
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [attendance, tasks, schedules] = await Promise.all([
        api.get('/attendance/today').catch(() => ({ data: { data: null } })),
        api.get('/tasks?status=pending&limit=1').catch(() => ({ data: { data: { total: 0 } } })),
        api.get('/schedules?upcoming=true&limit=3').catch(() => ({ data: { data: [] } })),
      ]);
      return {
        todayAttendance: attendance.data.data,
        pendingTasks: tasks.data.data?.total ?? 0,
        upcomingSchedules: schedules.data.data ?? [],
      } as DashboardData;
    },
  });

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      {/* 인사 */}
      <View style={styles.greetingCard}>
        <Text style={styles.greetingName}>{user?.name}님, 안녕하세요 👋</Text>
        <Text style={styles.greetingDate}>{today}</Text>
        <Text style={styles.greetingCompany}>{user?.companyName}</Text>
      </View>

      {/* 오늘 출퇴근 현황 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>오늘 근태</Text>
        {data?.todayAttendance ? (
          <View style={styles.attendanceCard}>
            <View style={styles.attendanceRow}>
              <Text style={styles.attendanceLabel}>출근</Text>
              <Text style={styles.attendanceTime}>
                {data.todayAttendance.checkIn
                  ? new Date(data.todayAttendance.checkIn).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.attendanceRow}>
              <Text style={styles.attendanceLabel}>퇴근</Text>
              <Text style={styles.attendanceTime}>
                {data.todayAttendance.checkOut
                  ? new Date(data.todayAttendance.checkOut).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>오늘 출근 기록이 없습니다.</Text>
          </View>
        )}
      </View>

      {/* 통계 카드 */}
      <View style={styles.statsRow}>
        <StatCard
          label="미완료 업무"
          value={String(data?.pendingTasks ?? '—')}
          color="#F59E0B"
        />
        <StatCard
          label="예정 일정"
          value={String(data?.upcomingSchedules?.length ?? '—')}
          color="#8B5CF6"
        />
      </View>

      {/* 예정 일정 */}
      {(data?.upcomingSchedules?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>다가오는 일정</Text>
          {data!.upcomingSchedules.map((s) => (
            <View key={s.id} style={styles.scheduleItem}>
              <Text style={styles.scheduleTitle}>{s.title}</Text>
              <Text style={styles.scheduleTime}>
                {new Date(s.start_datetime).toLocaleDateString('ko-KR', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  greetingCard: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    padding: 20,
  },
  greetingName: { fontSize: 20, fontWeight: '700', color: '#fff' },
  greetingDate: { fontSize: 13, color: '#BFDBFE', marginTop: 4 },
  greetingCompany: { fontSize: 12, color: '#93C5FD', marginTop: 2 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  attendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  attendanceLabel: { fontSize: 14, color: '#6B7280' },
  attendanceTime: { fontSize: 18, fontWeight: '700', color: '#111827' },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { color: '#9CA3AF', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    padding: 16,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  scheduleItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleTitle: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  scheduleTime: { fontSize: 12, color: '#6B7280', marginLeft: 8 },
});
