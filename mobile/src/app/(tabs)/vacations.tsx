import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface VacationBalance {
  totalDays: number;
  usedDays: number;
  adjustDays: number;
  year: number;
}

interface VacationRequest {
  id: string;
  vacationType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason: string | null;
  rejectReason: string | null;
  createdAt: string;
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: 'annual',       label: '연차' },
  { value: 'half_day_am',  label: '오전 반차' },
  { value: 'half_day_pm',  label: '오후 반차' },
  { value: 'sick',         label: '병가' },
  { value: 'event',        label: '경조사' },
  { value: 'other',        label: '기타' },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.map(o => [o.value, o.label])
);

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '대기중',  color: '#92400E', bg: '#FEF3C7' },
  approved:  { label: '승인',    color: '#065F46', bg: '#D1FAE5' },
  rejected:  { label: '반려',    color: '#991B1B', bg: '#FEE2E2' },
  cancelled: { label: '취소됨',  color: '#6B7280', bg: '#F3F4F6' },
};

// ─── 신청 모달 ───────────────────────────────────────────────────────────────

function RequestModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const mut = useMutation({
    mutationFn: (payload: object) => api.post('/vacations', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vacation-requests'] });
      qc.invalidateQueries({ queryKey: ['vacation-balance'] });
      qc.invalidateQueries({ queryKey: ['vacation-balance-home'] });
      setType('annual');
      setStartDate('');
      setEndDate('');
      setReason('');
      onClose();
      Alert.alert('신청 완료', '휴가 신청이 접수되었습니다.');
    },
    onError: (e: any) => Alert.alert('오류', e.response?.data?.message ?? '신청에 실패했습니다.'),
  });

  const handleSubmit = () => {
    if (!startDate) { Alert.alert('시작일을 입력해주세요.'); return; }
    const ed = ['half_day_am', 'half_day_pm'].includes(type) ? startDate : (endDate || startDate);
    mut.mutate({ vacation_type: type, start_date: startDate, end_date: ed, reason });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>휴가 신청</Text>

          {/* 유형 선택 */}
          <Text style={styles.fieldLabel}>휴가 유형</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
            {TYPE_OPTIONS.map(o => (
              <TouchableOpacity
                key={o.value}
                onPress={() => setType(o.value)}
                style={[styles.typeChip, type === o.value && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, type === o.value && styles.typeChipTextActive]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 날짜 */}
          <Text style={styles.fieldLabel}>시작일 (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 2026-04-01"
            value={startDate}
            onChangeText={setStartDate}
            keyboardType="numeric"
          />

          {!['half_day_am', 'half_day_pm'].includes(type) && (
            <>
              <Text style={styles.fieldLabel}>종료일 (비우면 당일)</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 2026-04-03"
                value={endDate}
                onChangeText={setEndDate}
                keyboardType="numeric"
              />
            </>
          )}

          {/* 사유 */}
          <Text style={styles.fieldLabel}>사유 (선택)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="휴가 사유를 입력하세요."
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, mut.isPending && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={mut.isPending}
            >
              {mut.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>신청하기</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

export default function VacationsScreen() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: balance, isLoading: balLoading } = useQuery({
    queryKey: ['vacation-balance'],
    queryFn: () => api.get('/vacations/balance').then(r => r.data.data as VacationBalance),
  });

  const { data: requests, isLoading: reqLoading, refetch } = useQuery({
    queryKey: ['vacation-requests'],
    queryFn: () => api.get('/vacations').then(r => r.data.data as VacationRequest[]),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.patch(`/vacations/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vacation-requests'] }),
    onError: (e: any) => Alert.alert('오류', e.response?.data?.message ?? '취소 실패'),
  });

  const handleCancel = (id: string) => {
    Alert.alert('신청 취소', '이 휴가 신청을 취소하시겠습니까?', [
      { text: '아니요', style: 'cancel' },
      { text: '취소', style: 'destructive', onPress: () => cancelMut.mutate(id) },
    ]);
  };

  const remaining = balance
    ? Math.max(0, balance.totalDays + (balance.adjustDays ?? 0) - balance.usedDays)
    : null;

  const isLoading = balLoading || reqLoading;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* ── 잔여 연차 카드 ── */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceTitle}>🌴 연차 현황 ({balance?.year ?? '—'})</Text>
            <TouchableOpacity style={styles.applyBtn} onPress={() => setShowModal(true)}>
              <Text style={styles.applyBtnText}>신청하기</Text>
            </TouchableOpacity>
          </View>

          {balLoading ? (
            <ActivityIndicator color="#10B981" style={{ marginVertical: 16 }} />
          ) : balance ? (
            <>
              {/* 잔여 강조 */}
              <View style={styles.remainingRow}>
                <View style={styles.remainingItem}>
                  <Text style={styles.remainingBig}>{remaining}</Text>
                  <Text style={styles.remainingLabel}>잔여</Text>
                </View>
                <View style={styles.remainingDivider} />
                <View style={styles.remainingItem}>
                  <Text style={styles.remainingSmall}>{balance.usedDays}</Text>
                  <Text style={styles.remainingLabel}>사용</Text>
                </View>
                <View style={styles.remainingDivider} />
                <View style={styles.remainingItem}>
                  <Text style={styles.remainingSmall}>{balance.totalDays + (balance.adjustDays ?? 0)}</Text>
                  <Text style={styles.remainingLabel}>총 부여</Text>
                </View>
              </View>

              {/* 프로그레스 바 */}
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, Math.round(
                        (balance.usedDays / (balance.totalDays + (balance.adjustDays ?? 0))) * 100
                      ))}%` as any,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {Math.round((balance.usedDays / (balance.totalDays + (balance.adjustDays ?? 0))) * 100)}% 사용
              </Text>
            </>
          ) : (
            <Text style={styles.noDataText}>연차 정보가 없습니다.</Text>
          )}
        </View>

        {/* ── 신청 목록 ── */}
        <Text style={styles.listTitle}>내 휴가 신청 내역</Text>

        {reqLoading ? (
          <ActivityIndicator color="#2563EB" style={{ marginTop: 20 }} />
        ) : !requests?.length ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>신청 내역이 없습니다.</Text>
          </View>
        ) : (
          requests.map(req => {
            const st = STATUS_STYLE[req.status] ?? STATUS_STYLE.pending;
            return (
              <View key={req.id} style={styles.requestCard}>
                <View style={styles.requestTop}>
                  <View>
                    <Text style={styles.requestType}>{TYPE_LABEL[req.vacationType] ?? req.vacationType}</Text>
                    <Text style={styles.requestDates}>
                      {req.startDate === req.endDate
                        ? req.startDate
                        : `${req.startDate} ~ ${req.endDate}`}
                      {' · '}
                      <Text style={styles.requestDays}>{req.days}일</Text>
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                {req.reason && (
                  <Text style={styles.requestReason}>사유: {req.reason}</Text>
                )}
                {req.rejectReason && (
                  <View style={styles.rejectReasonBox}>
                    <Text style={styles.rejectReasonText}>반려 사유: {req.rejectReason}</Text>
                  </View>
                )}

                {req.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.cancelRequestBtn}
                    onPress={() => handleCancel(req.id)}
                  >
                    <Text style={styles.cancelRequestText}>신청 취소</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <RequestModal visible={showModal} onClose={() => setShowModal(false)} />
    </View>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },

  // 잔여연차 카드
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderTopWidth: 4,
    borderTopColor: '#10B981',
    padding: 18,
    gap: 12,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  applyBtn: {
    backgroundColor: '#10B981',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  applyBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  remainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  remainingItem: { alignItems: 'center', gap: 2 },
  remainingBig: { fontSize: 40, fontWeight: '900', color: '#10B981' },
  remainingSmall: { fontSize: 28, fontWeight: '800', color: '#374151' },
  remainingLabel: { fontSize: 12, color: '#9CA3AF' },
  remainingDivider: { width: 1, height: 48, backgroundColor: '#E5E7EB' },

  progressBg: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  progressLabel: { fontSize: 11, color: '#9CA3AF', textAlign: 'right' },
  noDataText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },

  listTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },

  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },

  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 8,
  },
  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  requestType: { fontSize: 15, fontWeight: '600', color: '#111827' },
  requestDates: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  requestDays: { fontWeight: '600', color: '#2563EB' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  requestReason: { fontSize: 13, color: '#6B7280' },
  rejectReasonBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 8,
  },
  rejectReasonText: { fontSize: 12, color: '#DC2626' },
  cancelRequestBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelRequestText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  // 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  typeScroll: { marginBottom: 4 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  typeChipActive: { backgroundColor: '#2563EB' },
  typeChipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  typeChipTextActive: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, color: '#6B7280', fontWeight: '500' },
  submitBtn: {
    flex: 2,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
});
