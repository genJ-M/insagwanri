import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from '@/hooks/useLocation';
import api from '@/lib/api';

// 출퇴근 방식 타입
type AttendanceMethod = 'manual' | 'gps' | 'wifi' | 'qr' | 'face';

const METHOD_LABELS: Record<AttendanceMethod, string> = {
  manual: '📱 클릭 출퇴근',
  gps:    '📍 GPS 출퇴근',
  wifi:   '📶 WiFi 출퇴근',
  qr:     '📷 QR 스캔',
  face:   '🔐 생체 인증',
};

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string;
  check_in_at: string;
  check_out_at: string | null;
  work_minutes: number | null;
  gps_flagged: boolean;
  note: string | null;
}

interface TodayAttendance {
  id: string | null;
  checkIn: string | null;
  checkOut: string | null;
  status: 'none' | 'checked_in' | 'checked_out';
  gps_flagged: boolean;
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

// ─── 이번 달 캘린더 컴포넌트 ─────────────────────────────────────────────────

function MonthCalendar({ records }: { records: AttendanceRecord[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const firstDay = new Date(year, month, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 출석 날짜 Set
  const presentDays = new Set(
    records.map(r => {
      const d = new Date(r.check_in_at);
      return d.getDate();
    })
  );

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // 7의 배수로 패딩
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <View style={calStyles.container}>
      <Text style={calStyles.month}>
        {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 출근 기록
      </Text>

      {/* 요일 헤더 */}
      <View style={calStyles.row}>
        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
          <Text key={d} style={[calStyles.dayHeader, d === '일' && { color: '#EF4444' }, d === '토' && { color: '#3B82F6' }]}>
            {d}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={calStyles.row}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={calStyles.cell} />;
            const isToday = day === now.getDate();
            const hasRecord = presentDays.has(day);
            const isFuture = day > now.getDate();
            return (
              <View key={di} style={[calStyles.cell, isToday && calStyles.todayCell]}>
                <Text style={[
                  calStyles.dayNum,
                  isToday && calStyles.todayNum,
                  di === 0 && { color: '#EF4444' },
                  di === 6 && { color: '#3B82F6' },
                ]}>
                  {day}
                </Text>
                {hasRecord && (
                  <View style={calStyles.dot} />
                )}
                {!hasRecord && !isFuture && day < now.getDate() && (
                  <View style={calStyles.absentDot} />
                )}
              </View>
            );
          })}
        </View>
      ))}

      {/* 범례 */}
      <View style={calStyles.legend}>
        <View style={calStyles.legendItem}>
          <View style={calStyles.dot} />
          <Text style={calStyles.legendText}>출근</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={calStyles.absentDot} />
          <Text style={calStyles.legendText}>미출근</Text>
        </View>
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 6,
  },
  month: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  row: { flexDirection: 'row' },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    paddingVertical: 4,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
    gap: 2,
    minHeight: 42,
    borderRadius: 8,
  },
  todayCell: { backgroundColor: '#EFF6FF' },
  dayNum: { fontSize: 13, color: '#374151', fontWeight: '400' },
  todayNum: { fontWeight: '800', color: '#2563EB' },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  absentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FCA5A5',
  },
  legend: { flexDirection: 'row', gap: 16, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 11, color: '#9CA3AF' },
});

// ─── 메인 ────────────────────────────────────────────────────────────────────

export default function AttendanceScreen() {
  const queryClient = useQueryClient();
  const { locating, getCoords } = useLocation();
  const [activeMethod, setActiveMethod] = useState<AttendanceMethod | null>(null);

  // 오늘 근태 조회
  const { data: today, isLoading } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: async () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const res = await api.get('/attendance/me', { params: { start_date: today, end_date: today } });
      const rec = res.data.data?.records?.[0] ?? null;
      if (!rec) return null;
      return {
        id: rec.id,
        checkIn: rec.clockInAt,
        checkOut: rec.clockOutAt,
        status: rec.clockInAt ? (rec.clockOutAt ? 'checked_out' : 'checked_in') : 'none',
        gps_flagged: rec.clockInOutOfRange,
      } as TodayAttendance;
    },
  });

  // 이번 달 기록 조회 (camelCase → snake_case 매핑)
  const { data: records, refetch } = useQuery({
    queryKey: ['attendance-recent'],
    queryFn: async () => {
      const now = new Date();
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const res = await api.get('/attendance/me', { params: { start_date: from } });
      const raw: any[] = res.data.data?.records ?? [];
      return raw.map((r) => ({
        id: r.id,
        check_in_at: r.clockInAt,
        check_out_at: r.clockOutAt ?? null,
        work_minutes: r.totalWorkMinutes ?? null,
        gps_flagged: r.clockInOutOfRange ?? false,
        note: r.note ?? null,
      })) as AttendanceRecord[];
    },
  });

  // 활성 출퇴근 방식 조회
  const { data: methods } = useQuery({
    queryKey: ['attendance-methods'],
    queryFn: async () => {
      const res = await api.get('/attendance/methods');
      return res.data.data as { enabled: AttendanceMethod[]; wifi?: { ssids: string[] }; qr?: { windowMinutes: number } };
    },
  });

  const enabledMethods: AttendanceMethod[] = methods?.enabled ?? ['manual'];

  // 출근 Mutation
  const clockInMutation = useMutation({
    mutationFn: (payload: object) => api.post('/attendance/clock-in', payload),
    onSuccess: () => {
      setActiveMethod(null);
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-recent'] });
      Alert.alert('출근 완료', `${activeMethod ? METHOD_LABELS[activeMethod] : ''} 출근 처리되었습니다.`);
    },
    onError: (err: any) => Alert.alert('오류', err.response?.data?.error?.message ?? '출근 처리 중 오류가 발생했습니다.'),
  });

  // 퇴근 Mutation
  const clockOutMutation = useMutation({
    mutationFn: (payload: object) => api.post('/attendance/clock-out', payload),
    onSuccess: () => {
      setActiveMethod(null);
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-recent'] });
      Alert.alert('퇴근 완료', '퇴근 처리되었습니다.');
    },
    onError: (err: any) => Alert.alert('오류', err.response?.data?.error?.message ?? '퇴근 처리 중 오류가 발생했습니다.'),
  });

  const isBusy = locating || clockInMutation.isPending || clockOutMutation.isPending;
  const isClockIn = !today?.checkIn;
  const mutate = isClockIn ? clockInMutation.mutate : clockOutMutation.mutate;

  // ── 방식별 출퇴근 처리 ──────────────────────────────────────────────────────
  const handleMethod = async (method: AttendanceMethod) => {
    if (isBusy) return;
    setActiveMethod(method);

    switch (method) {
      case 'manual': {
        mutate({ method: 'manual' });
        break;
      }
      case 'gps': {
        const coords = await getCoords();
        mutate({ method: 'gps', latitude: coords?.latitude, longitude: coords?.longitude });
        break;
      }
      case 'wifi': {
        // expo-wifi / @react-native-community/netinfo 필요
        // 설치: npx expo install @react-native-community/netinfo
        Alert.alert(
          'WiFi 출퇴근',
          'WiFi 방식은 모바일 앱 업데이트(v1.1) 이후 사용 가능합니다.\n\n현재는 클릭 또는 GPS 방식을 이용해 주세요.',
          [{ text: '확인', onPress: () => setActiveMethod(null) }],
        );
        break;
      }
      case 'qr': {
        // expo-camera / expo-barcode-scanner 필요
        // 설치: npx expo install expo-camera
        Alert.alert(
          'QR 스캔',
          'QR 스캔은 모바일 앱 업데이트(v1.1) 이후 사용 가능합니다.\n\n관리자가 표시한 QR을 스캔하는 기능입니다.',
          [{ text: '확인', onPress: () => setActiveMethod(null) }],
        );
        break;
      }
      case 'face': {
        // expo-local-authentication 필요
        // 설치: npx expo install expo-local-authentication
        Alert.alert(
          '생체 인증',
          '생체 인증은 모바일 앱 업데이트(v1.1) 이후 사용 가능합니다.',
          [{ text: '확인', onPress: () => setActiveMethod(null) }],
        );
        break;
      }
    }
  };

  // 이번 달 기록만 필터 (월별 캘린더용)
  const now = new Date();
  const monthRecords = (records ?? []).filter(r => {
    const d = new Date(r.check_in_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const attendanceStatus: TodayAttendance['status'] = today
    ? today.status
    : 'none';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
    >
      {/* ── 오늘 출퇴근 카드 ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>오늘 근태</Text>

        {isLoading ? (
          <ActivityIndicator color="#2563EB" style={{ marginVertical: 20 }} />
        ) : (
          <>
            <View style={styles.timeRow}>
              <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>출근</Text>
                <Text style={styles.timeValue}>
                  {today?.checkIn ? formatTime(today.checkIn) : '—'}
                </Text>
              </View>
              <View style={styles.timeSep} />
              <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>퇴근</Text>
                <Text style={styles.timeValue}>
                  {today?.checkOut ? formatTime(today.checkOut) : '—'}
                </Text>
              </View>
            </View>

            {today?.gps_flagged && (
              <View style={styles.flagBanner}>
                <Text style={styles.flagText}>⚠️ 사업장 반경 외 위치에서 기록되었습니다.</Text>
              </View>
            )}
          </>
        )}

        {/* ── 출퇴근 버튼 영역 ── */}
        {attendanceStatus === 'checked_out' ? (
          <View style={styles.completedBanner}>
            <Text style={styles.completedText}>✅ 오늘 근무 완료</Text>
          </View>
        ) : (
          <View style={styles.methodList}>
            <Text style={styles.methodHint}>
              {attendanceStatus === 'none' ? '출근 방식을 선택하세요' : '퇴근 방식을 선택하세요'}
            </Text>
            {enabledMethods.map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.methodBtn,
                  attendanceStatus === 'none' ? styles.checkInBtn : styles.checkOutBtn,
                  (isBusy && activeMethod !== m) && styles.btnDisabled,
                ]}
                onPress={() => handleMethod(m)}
                disabled={isBusy}
              >
                {(isBusy && activeMethod === m) ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>{METHOD_LABELS[m]}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── 이번 달 달력 ── */}
      <MonthCalendar records={monthRecords} />

      {/* ── 최근 기록 리스트 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>이번 달 기록</Text>
        {!monthRecords.length ? (
          <Text style={styles.emptyText}>이번 달 출근 기록이 없습니다.</Text>
        ) : (
          monthRecords.slice(0, 10).map((rec) => (
            <View key={rec.id} style={styles.recordItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recordDate}>
                  {new Date(rec.check_in_at).toLocaleDateString('ko-KR', {
                    month: 'short', day: 'numeric', weekday: 'short',
                  })}
                </Text>
                <Text style={styles.recordTime}>
                  {formatTime(rec.check_in_at)}
                  {rec.check_out_at ? ` ~ ${formatTime(rec.check_out_at)}` : ' ~ 퇴근 전'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {rec.work_minutes !== null && (
                  <Text style={styles.recordDuration}>{formatDuration(rec.work_minutes)}</Text>
                )}
                {rec.gps_flagged && (
                  <Text style={styles.recordFlag}>⚠️ GPS 외</Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    gap: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeItem: { flex: 1, alignItems: 'center', gap: 4 },
  timeLabel: { fontSize: 13, color: '#6B7280' },
  timeValue: { fontSize: 30, fontWeight: '800', color: '#111827' },
  timeSep: { width: 1, height: 48, backgroundColor: '#E5E7EB', marginHorizontal: 16 },
  flagBanner: { backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10 },
  flagText: { fontSize: 12, color: '#92400E' },
  methodList: { gap: 10 },
  methodHint: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 4 },
  methodBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  actionBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  checkInBtn: { backgroundColor: '#2563EB' },
  checkOutBtn: { backgroundColor: '#DC2626' },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  completedBanner: {
    backgroundColor: '#D1FAE5', borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  completedText: { fontSize: 15, fontWeight: '600', color: '#065F46' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  recordItem: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    padding: 14, flexDirection: 'row', alignItems: 'center',
  },
  recordDate: { fontSize: 13, fontWeight: '600', color: '#374151' },
  recordTime: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  recordDuration: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  recordFlag: { fontSize: 11, color: '#D97706', marginTop: 2 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 20 },
});
