import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'canceled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  assignee_name: string | null;
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: '대기', color: '#92400E', bg: '#FEF3C7' },
  in_progress: { label: '진행', color: '#1E40AF', bg: '#DBEAFE' },
  done:        { label: '완료', color: '#065F46', bg: '#D1FAE5' },
  canceled:    { label: '취소', color: '#6B7280', bg: '#F3F4F6' },
};

const PRIORITY_LABEL: Record<string, { label: string; color: string }> = {
  low:    { label: '낮음', color: '#6B7280' },
  medium: { label: '보통', color: '#D97706' },
  high:   { label: '높음', color: '#DC2626' },
  urgent: { label: '긴급', color: '#7C3AED' },
};

const FILTER_TABS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '대기' },
  { key: 'in_progress', label: '진행중' },
  { key: 'done', label: '완료' },
] as const;

export default function TasksScreen() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tasks-mobile', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?status=${filter}&limit=30` : '?limit=30';
      const res = await api.get(`/tasks${params}`);
      return res.data.data.tasks as Task[];
    },
  });

  const doneMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/tasks/${id}`, { status: 'done' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks-mobile'] });
    },
  });

  const renderTask = ({ item }: { item: Task }) => {
    const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.pending;
    const pr = PRIORITY_LABEL[item.priority] ?? PRIORITY_LABEL.medium;

    return (
      <View style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        <View style={styles.taskMeta}>
          <Text style={[styles.priorityText, { color: pr.color }]}>
            {pr.label} 우선순위
          </Text>
          {item.due_date && (
            <Text style={styles.dueDate}>
              마감: {new Date(item.due_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </Text>
          )}
          {item.assignee_name && (
            <Text style={styles.assignee}>{item.assignee_name}</Text>
          )}
        </View>

        {item.status === 'in_progress' && (
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => doneMutation.mutate(item.id)}
            disabled={doneMutation.isPending}
          >
            <Text style={styles.doneBtnText}>완료로 변경</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 필터 탭 */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setFilter(tab.key)}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#2563EB" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderTask}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>해당하는 업무가 없습니다.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterTabActive: { backgroundColor: '#2563EB' },
  filterTabText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  filterTabTextActive: { color: '#fff' },
  listContent: { padding: 16, gap: 10, paddingBottom: 32 },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 8,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  taskTitle: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  taskMeta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  priorityText: { fontSize: 12, fontWeight: '500' },
  dueDate: { fontSize: 12, color: '#6B7280' },
  assignee: { fontSize: 12, color: '#6B7280' },
  doneBtn: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 13, fontWeight: '600', color: '#065F46' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', paddingVertical: 40, fontSize: 14 },
});
