import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import api from '@/lib/api';

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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}시간 ${m}분`;
}

async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('위치 권한 필요', '출퇴근 기록을 위해 위치 권한이 필요합니다.');
    return null;
  }
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
  };
}

export default function AttendanceScreen() {
  const queryClient = useQueryClient();
  const [locating, setLocating] = useState(false);

  const { data: today, isLoading } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: async () => {
      const res = await api.get('/attendance/today');
      return res.data.data as TodayAttendance;
    },
  });

  const { data: records } = useQuery({
    queryKey: ['attendance-recent'],
    queryFn: async () => {
      const res = await api.get('/attendance/me?limit=7');
      return res.data.data as AttendanceRecord[];
    },
  });

  const checkInMutation = useMutation({
    mutationFn: (coords: { latitude: number; longitude: number; accuracy?: number | null }) =>
      api.post('/attendance/check-in', coords),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-recent'] });
    },
    onError: (err: any) => Alert.alert('오류', err.response?.data?.message ?? '출근 처리 중 오류가 발생했습니다.'),
  });

  const checkOutMutation = useMutation({
    mutationFn: (coords: { latitude: number; longitude: number; accuracy?: number | null }) =>
      api.post('/attendance/check-out', coords),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-recent'] });
    },
    onError: (err: any) => Alert.alert('오류', err.response?.data?.message ?? '퇴근 처리 중 오류가 발생했습니다.'),
  });

  const handleCheckIn = async () => {
    setLocating(true);
    const coords = await getCurrentLocation();
    setLocating(false);
    if (!coords) return;
    checkInMutation.mutate(coords);
  };

  const handleCheckOut = async () => {
    setLocating(true);
    const coords = await getCurrentLocation();
    setLocating(false);
    if (!coords) return;
    checkOutMutation.mutate(coords);
  };

  const isBusy = locating || checkInMutation.isPending || checkOutMutation.isPending;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 오늘 출퇴근 카드 */}
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

        {/* 출근/퇴근 버튼 */}
        {today?.status === 'none' || !today ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.checkInBtn, isBusy && styles.btnDisabled]}
            onPress={handleCheckIn}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>출근하기</Text>
            )}
          </TouchableOpacity>
        ) : today.status === 'checked_in' ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.checkOutBtn, isBusy && styles.btnDisabled]}
            onPress={handleCheckOut}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>퇴근하기</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.completedBanner}>
            <Text style={styles.completedText}>✅ 오늘 근무 완료</Text>
          </View>
        )}
      </View>

      {/* 최근 출퇴근 기록 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>최근 7일 기록</Text>
        {records && records.length > 0 ? (
          records.map((rec) => (
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
        ) : (
          <Text style={styles.emptyText}>최근 기록이 없습니다.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    gap: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeItem: { flex: 1, alignItems: 'center', gap: 4 },
  timeLabel: { fontSize: 13, color: '#6B7280' },
  timeValue: { fontSize: 28, fontWeight: '800', color: '#111827' },
  timeSep: { width: 1, height: 48, backgroundColor: '#E5E7EB', marginHorizontal: 16 },
  flagBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
  },
  flagText: { fontSize: 12, color: '#92400E' },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  checkInBtn: { backgroundColor: '#2563EB' },
  checkOutBtn: { backgroundColor: '#DC2626' },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  completedBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  completedText: { fontSize: 15, fontWeight: '600', color: '#065F46' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  recordItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordDate: { fontSize: 13, fontWeight: '600', color: '#374151' },
  recordTime: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  recordDuration: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  recordFlag: { fontSize: 11, color: '#D97706', marginTop: 2 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 20 },
});
