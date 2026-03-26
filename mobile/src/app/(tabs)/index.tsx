import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
  ImageBackground,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useLocation } from '@/hooks/useLocation';
import api from '@/lib/api';

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface TodayAttendance {
  id: string | null;
  checkIn: string | null;
  checkOut: string | null;
  status: 'none' | 'checked_in' | 'checked_out';
  gps_flagged: boolean;
}

interface VacationBalance {
  totalDays: number;
  usedDays: number;
  adjustDays: number;
}

interface Anniversary {
  id: string;
  name: string;
  years: number;
}

// ─── 서브 컴포넌트 ───────────────────────────────────────────────────────────

function QuickCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.quickCard, style]}>{children}</View>;
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const { locating, getCoords } = useLocation();
  const [clock, setClock] = useState(new Date());

  // 실시간 시계
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: today, isLoading: attendLoading, refetch: refetchAll } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: () => api.get('/attendance/today').then(r => r.data.data as TodayAttendance),
    refetchInterval: 60000,
  });

  const { data: myProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then(r => r.data.data ?? r.data).catch(() => null),
    staleTime: 1000 * 60,
  });

  const { data: workspace } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api.get('/workspace/settings').then(r => r.data.data ?? r.data).catch(() => null),
    staleTime: 1000 * 60,
  });

  // 3-tier cover: personal > company > null (기본 그라디언트)
  const coverUrl: string | null =
    myProfile?.coverImageMobileUrl ??
    myProfile?.coverImageUrl ??
    workspace?.coverImageMobileUrl ??
    workspace?.coverImageUrl ??
    null;

  const { data: balance } = useQuery({
    queryKey: ['vacation-balance-home'],
    queryFn: () =>
      api.get('/vacations/balance').then(r => r.data.data as VacationBalance).catch(() => null),
  });

  const { data: teamUsers } = useQuery({
    queryKey: ['team-users-home'],
    queryFn: () => api.get('/users').then(r => r.data.data as any[]).catch(() => []),
  });

  const { data: pendingTasks } = useQuery({
    queryKey: ['pending-tasks-count'],
    queryFn: () =>
      api.get('/tasks?status=pending&limit=1')
        .then(r => (r.data.data?.total ?? 0) as number)
        .catch(() => 0),
  });

  // 이번 달 입사기념일 계산
  const anniversaries: Anniversary[] = (teamUsers ?? [])
    .filter((u: any) => {
      if (!u.joinedAt || u.id === user?.id) return false;
      const joined = new Date(u.joinedAt);
      const now = new Date();
      return (
        joined.getMonth() === now.getMonth() &&
        joined.getDate() === now.getDate() &&
        joined.getFullYear() < now.getFullYear()
      );
    })
    .map((u: any) => ({
      id: u.id,
      name: u.name,
      years: new Date().getFullYear() - new Date(u.joinedAt).getFullYear(),
    }));

  const checkInMut = useMutation({
    mutationFn: (coords: object) => api.post('/attendance/check-in', coords),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-today'] });
      qc.invalidateQueries({ queryKey: ['attendance-recent'] });
    },
    onError: (e: any) => Alert.alert('오류', e.response?.data?.message ?? '출근 처리 중 오류가 발생했습니다.'),
  });

  const checkOutMut = useMutation({
    mutationFn: (coords: object) => api.post('/attendance/check-out', coords),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-today'] });
      qc.invalidateQueries({ queryKey: ['attendance-recent'] });
    },
    onError: (e: any) => Alert.alert('오류', e.response?.data?.message ?? '퇴근 처리 중 오류가 발생했습니다.'),
  });

  const handleAttendance = async () => {
    const coords = await getCoords();
    if (!coords) return;
    if (!today || today.status === 'none') {
      checkInMut.mutate(coords);
    } else if (today.status === 'checked_in') {
      checkOutMut.mutate(coords);
    }
  };

  const isBusy = locating || checkInMut.isPending || checkOutMut.isPending;
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const remaining = balance
    ? Math.max(0, balance.totalDays + (balance.adjustDays ?? 0) - balance.usedDays)
    : null;

  const greeting =
    clock.getHours() < 12 ? '좋은 아침이에요' :
    clock.getHours() < 18 ? '안녕하세요' : '수고 많으셨어요';

  const todayStr = clock.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetchAll} />}
    >
      {/* ── 그리팅 카드 ── */}
      <View style={[styles.greetingCard, coverUrl ? styles.greetingCardCover : null]}>
      {coverUrl && (
        <ImageBackground
          source={{ uri: coverUrl }}
          style={StyleSheet.absoluteFillObject}
          imageStyle={{ borderRadius: 20, opacity: 0.85 }}
          resizeMode="cover"
        >
          <View style={[StyleSheet.absoluteFillObject, styles.coverOverlay, { borderRadius: 20 }]} />
        </ImageBackground>
      )}
      <View style={{ position: 'relative' }}>
        <View style={styles.greetingTop}>
          <View>
            <Text style={styles.greetingTime}>
              {clock.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
            <Text style={styles.greetingName}>{greeting}, {user?.name}님 👋</Text>
            <Text style={styles.greetingDate}>{todayStr}</Text>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{user?.name?.[0] ?? '?'}</Text>
          </View>
        </View>

        {/* 출퇴근 버튼 */}
        {attendLoading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
        ) : today?.status === 'checked_out' ? (
          <View style={styles.completedBanner}>
            <Text style={styles.completedText}>✅ 오늘 근무 완료</Text>
            <Text style={styles.completedSub}>
              {today.checkIn ? formatTime(today.checkIn) : '—'}
              {' → '}
              {today.checkOut ? formatTime(today.checkOut) : '—'}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.attendanceBtn,
              today?.status === 'checked_in' ? styles.checkOutColor : styles.checkInColor,
              isBusy && styles.btnDisabled,
            ]}
            onPress={handleAttendance}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.attendanceBtnIcon}>
                  {today?.status === 'checked_in' ? '🏃' : '☀️'}
                </Text>
                <Text style={styles.attendanceBtnText}>
                  {today?.status === 'checked_in' ? '퇴근하기' : '출근하기'}
                </Text>
                {today?.checkIn && (
                  <Text style={styles.attendanceBtnSub}>출근 {formatTime(today.checkIn)}</Text>
                )}
              </>
            )}
          </TouchableOpacity>
        )}

        {today?.gps_flagged && (
          <View style={styles.gpsFlagBanner}>
            <Text style={styles.gpsFlagText}>⚠️ 사업장 반경 외 위치에서 기록됨</Text>
          </View>
        )}
      </View>{/* /relative inner */}
      </View>{/* /greetingCard */}

      {/* ── 요약 카드 그리드 ── */}
      <View style={styles.cardGrid}>
        {/* 잔여 연차 */}
        <QuickCard style={styles.vacationCard}>
          <Text style={styles.quickCardIcon}>🌴</Text>
          <Text style={styles.quickCardValue}>
            {remaining !== null ? `${remaining}일` : '—'}
          </Text>
          <Text style={styles.quickCardLabel}>잔여 연차</Text>
          {balance && (
            <Text style={styles.quickCardSub}>{balance.usedDays}/{balance.totalDays + (balance.adjustDays ?? 0)}일 사용</Text>
          )}
        </QuickCard>

        {/* 미완료 업무 */}
        <QuickCard style={styles.taskCard}>
          <Text style={styles.quickCardIcon}>📋</Text>
          <Text style={styles.quickCardValue}>{pendingTasks ?? '—'}</Text>
          <Text style={styles.quickCardLabel}>미완료 업무</Text>
          <Text style={styles.quickCardSub}>처리 필요</Text>
        </QuickCard>
      </View>

      {/* ── 이번 달 입사기념일 ── */}
      {anniversaries.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="🎂 오늘의 입사기념일" />
          {anniversaries.map(a => (
            <View key={a.id} style={styles.anniversaryItem}>
              <View style={styles.anniversaryAvatar}>
                <Text style={styles.anniversaryAvatarText}>{a.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.anniversaryName}>{a.name}</Text>
                <Text style={styles.anniversarySub}>입사 {a.years}주년 🎉</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── 이번 달 입사기념일 (다가오는 7일 내) ── */}
      {(() => {
        const upcoming = (teamUsers ?? []).filter((u: any) => {
          if (!u.joinedAt || u.id === user?.id) return false;
          const joined = new Date(u.joinedAt);
          const now = new Date();
          const thisYear = new Date(now.getFullYear(), joined.getMonth(), joined.getDate());
          const diff = (thisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          return diff > 0 && diff <= 7 && joined.getFullYear() < now.getFullYear();
        });

        if (!upcoming.length) return null;
        return (
          <View style={styles.section}>
            <SectionHeader title="🗓 다가오는 기념일 (7일 내)" />
            {upcoming.map((u: any) => {
              const joined = new Date(u.joinedAt);
              const dDay = new Date(new Date().getFullYear(), joined.getMonth(), joined.getDate());
              const diff = Math.ceil((dDay.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              const years = new Date().getFullYear() - joined.getFullYear();
              return (
                <View key={u.id} style={styles.anniversaryItem}>
                  <View style={[styles.anniversaryAvatar, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.anniversaryAvatarText, { color: '#B45309' }]}>{u.name[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.anniversaryName}>{u.name}</Text>
                    <Text style={styles.anniversarySub}>입사 {years}주년 · D-{diff}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })()}
    </ScrollView>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },

  // 그리팅 카드
  greetingCard: {
    backgroundColor: '#2563EB',
    borderRadius: 20,
    padding: 20,
    gap: 12,
    overflow: 'hidden',
  },
  greetingCardCover: {
    backgroundColor: '#1E293B',
  },
  coverOverlay: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  greetingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingTime: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  greetingName: { fontSize: 16, fontWeight: '600', color: '#DBEAFE', marginTop: 4 },
  greetingDate: { fontSize: 12, color: '#93C5FD', marginTop: 2 },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#fff' },

  // 출퇴근 버튼
  attendanceBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 2,
  },
  checkInColor: { backgroundColor: 'rgba(255,255,255,0.25)' },
  checkOutColor: { backgroundColor: 'rgba(239,68,68,0.8)' },
  btnDisabled: { opacity: 0.6 },
  attendanceBtnIcon: { fontSize: 22 },
  attendanceBtnText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  attendanceBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  completedBanner: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  completedText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  completedSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  gpsFlagBanner: {
    backgroundColor: 'rgba(251,191,36,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  gpsFlagText: { fontSize: 12, color: '#FEF3C7' },

  // 카드 그리드
  cardGrid: { flexDirection: 'row', gap: 12 },
  quickCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 2,
  },
  vacationCard: { borderTopWidth: 3, borderTopColor: '#10B981' },
  taskCard: { borderTopWidth: 3, borderTopColor: '#F59E0B' },
  quickCardIcon: { fontSize: 24, marginBottom: 4 },
  quickCardValue: { fontSize: 26, fontWeight: '800', color: '#111827' },
  quickCardLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginTop: 2 },
  quickCardSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },

  // 섹션
  section: { gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 2 },

  // 기념일
  anniversaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  anniversaryAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  anniversaryAvatarText: { fontSize: 16, fontWeight: '700', color: '#7C3AED' },
  anniversaryName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  anniversarySub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
