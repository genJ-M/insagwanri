'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Link from 'next/link';
import {
  MapPin, Phone, User, Plus, Pencil, Trash2,
  Users, ChevronRight, Building2, AlertCircle, X, CheckCircle2,
} from 'lucide-react';

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface BusinessLocation {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  managerUserId: string | null;
  isActive: boolean;
  note: string | null;
  createdAt: string;
}

interface LocationsData {
  locations: BusinessLocation[];
  quota: number;
  activeCount: number;
}

interface LocationEmployee {
  id: string;
  name: string;
  email: string;
  department: string | null;
  position: string | null;
  role: string;
  isPrimary: boolean;
  assignedAt: string;
}

interface TeamMember {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  owner: '사업주', manager: '관리자', employee: '직원',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── 지점 폼 모달 ──────────────────────────────────────────────────────────────

interface LocationFormModalProps {
  open: boolean;
  onClose: () => void;
  initial?: BusinessLocation;
  managers: TeamMember[];
  onSuccess: () => void;
}

function LocationFormModal({ open, onClose, initial, managers, onSuccess }: LocationFormModalProps) {
  const qc = useQueryClient();
  const isEdit = !!initial;

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    address: initial?.address ?? '',
    phone: initial?.phone ?? '',
    managerUserId: initial?.managerUserId ?? '',
    note: initial?.note ?? '',
    isActive: initial?.isActive ?? true,
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = {
        name: data.name,
        address: data.address || undefined,
        phone: data.phone || undefined,
        managerUserId: data.managerUserId || undefined,
        note: data.note || undefined,
        ...(isEdit ? { isActive: data.isActive } : {}),
      };
      return isEdit
        ? api.patch(`/locations/${initial!.id}`, payload)
        : api.post('/locations', payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? '지점이 수정되었습니다.' : '지점이 추가되었습니다.');
      qc.invalidateQueries({ queryKey: ['locations'] });
      onSuccess();
      onClose();
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message ?? '오류가 발생했습니다.');
    },
  });

  return (
    <Modal isOpen={open} onClose={onClose} title={isEdit ? '지점 수정' : '새 지점 추가'}>
      <div className="space-y-4">
        {/* 지점명 */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            지점명 <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="예: 강남점, 홍대점"
            value={form.name}
            onChange={set('name')}
          />
        </div>

        {/* 주소 */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">주소</label>
          <input
            className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="서울시 강남구 테헤란로 123"
            value={form.address}
            onChange={set('address')}
          />
        </div>

        {/* 전화번호 */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">전화번호</label>
          <input
            className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="02-1234-5678"
            value={form.phone}
            onChange={set('phone')}
          />
        </div>

        {/* 담당 관리자 */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">담당 관리자</label>
          <select
            className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
            value={form.managerUserId}
            onChange={set('managerUserId')}
          >
            <option value="">— 없음 —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.position ? ` · ${m.position}` : ''}{m.department ? ` (${m.department})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">메모</label>
          <textarea
            className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
            rows={3}
            placeholder="지점 관련 참고 사항"
            value={form.note}
            onChange={set('note')}
          />
        </div>

        {/* 활성 여부 (수정 모드만) */}
        {isEdit && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-primary-500"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            <span className="text-sm text-text-primary">운영 중 (비활성화하면 직원 배정 불가)</span>
          </label>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>취소</Button>
          <Button
            className="flex-1"
            onClick={() => mutation.mutate(form)}
            disabled={!form.name.trim() || mutation.isPending}
          >
            {mutation.isPending ? '저장 중...' : isEdit ? '저장' : '추가'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── 직원 배정 패널 ─────────────────────────────────────────────────────────────

interface AssignPanelProps {
  location: BusinessLocation;
  onClose: () => void;
}

function AssignPanel({ location, onClose }: AssignPanelProps) {
  const qc = useQueryClient();

  const { data: employees = [] } = useQuery<LocationEmployee[]>({
    queryKey: ['location-employees', location.id],
    queryFn: () =>
      api.get(`/locations/${location.id}/employees`).then((r) => r.data.data),
  });

  const { data: allMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['team-simple'],
    queryFn: () =>
      api.get('/users/company').then((r) =>
        (r.data.data ?? r.data).map((u: any) => ({
          id: u.id, name: u.name, department: u.department, position: u.position,
        })),
      ),
  });

  const assignedIds = new Set(employees.map((e) => e.id));
  const unassigned = allMembers.filter((m) => !assignedIds.has(m.id));

  const [selectedId, setSelectedId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const assignMut = useMutation({
    mutationFn: () =>
      api.post(`/locations/${location.id}/employees`, { userId: selectedId, isPrimary }),
    onSuccess: () => {
      toast.success('배정되었습니다.');
      qc.invalidateQueries({ queryKey: ['location-employees', location.id] });
      setSelectedId('');
      setIsPrimary(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '오류'),
  });

  const unassignMut = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/locations/${location.id}/employees/${userId}`),
    onSuccess: () => {
      toast.success('배정이 해제되었습니다.');
      qc.invalidateQueries({ queryKey: ['location-employees', location.id] });
      qc.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '오류'),
  });

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div>
          <p className="font-semibold text-text-primary text-sm">{location.name}</p>
          <p className="text-xs text-text-muted mt-0.5">직원 배정 관리</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 transition-colors">
          <X className="w-4 h-4 text-text-muted" />
        </button>
      </div>

      {/* 직원 추가 */}
      {unassigned.length > 0 && (
        <div className="px-4 py-3 border-b border-zinc-100 space-y-2">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">직원 추가</p>
          <select
            className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">직원 선택</option>
            {unassigned.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.position ? ` · ${m.position}` : ''}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-primary-500"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
            <span className="text-xs text-text-secondary">주 근무지로 설정</span>
          </label>
          <Button
            size="sm"
            className="w-full"
            disabled={!selectedId || assignMut.isPending}
            onClick={() => assignMut.mutate()}
          >
            배정
          </Button>
        </div>
      )}

      {/* 배정된 직원 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {employees.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">배정된 직원이 없습니다.</p>
        ) : (
          employees.map((emp) => (
            <div
              key={emp.id}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary-600">{emp.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-text-primary truncate">{emp.name}</p>
                  {emp.isPrimary && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary-100 text-primary-700 flex-shrink-0">주근무지</span>
                  )}
                </div>
                <p className="text-xs text-text-muted truncate">
                  {[emp.department, emp.position].filter(Boolean).join(' · ') || ROLE_LABEL[emp.role]}
                </p>
              </div>
              <button
                onClick={() => unassignMut.mutate(emp.id)}
                disabled={unassignMut.isPending}
                className="p-1 rounded-lg hover:bg-red-50 hover:text-red-500 text-text-muted transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function LocationsPage() {
  usePageTitle('지점 관리');
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const userRole = user?.role ?? 'employee';
  const isOwner = userRole === 'owner';

  const { data, isLoading } = useQuery<LocationsData>({
    queryKey: ['locations'],
    queryFn: () => api.get('/locations').then((r) => r.data.data),
  });

  const { data: managers = [] } = useQuery<TeamMember[]>({
    queryKey: ['managers-list'],
    queryFn: () =>
      api.get('/users/company').then((r) =>
        (r.data.data ?? r.data)
          .filter((u: any) => u.role === 'owner' || u.role === 'manager')
          .map((u: any) => ({ id: u.id, name: u.name, department: u.department, position: u.position })),
      ),
    enabled: isOwner,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/locations/${id}`),
    onSuccess: () => {
      toast.success('지점이 삭제되었습니다.');
      qc.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '삭제 실패'),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BusinessLocation | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<BusinessLocation | null>(null);

  const locations = data?.locations ?? [];
  const quota = data?.quota ?? 1;
  const activeCount = data?.activeCount ?? 0;
  const atQuota = activeCount >= quota;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 페이지 헤더 */}
      <div className="px-6 py-5 border-b border-zinc-100 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">지점 관리</h1>
          <p className="text-sm text-text-muted mt-0.5">
            사업장별 지점을 등록하고 직원을 배정하세요.
          </p>
        </div>
        {isOwner && (
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            disabled={atQuota}
            className="flex items-center gap-1.5 flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            지점 추가
          </Button>
        )}
      </div>

      {/* 애드온 안내 배너 */}
      {atQuota && isOwner && (
        <div className="mx-6 mt-4 flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">
              지점 한도 도달 ({activeCount}/{quota}개)
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              추가 지점 애드온(₩9,900/월·개)을 구매하면 지점을 더 등록할 수 있습니다.
            </p>
          </div>
          <Link href="/subscription?tab=addons">
            <Button size="sm" variant="outline" className="flex-shrink-0 text-amber-700 border-amber-300 hover:bg-amber-100">
              애드온 구매
            </Button>
          </Link>
        </div>
      )}

      {/* 사용량 요약 */}
      <div className="px-6 pt-4 pb-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Building2 className="w-4 h-4" />
            <span>
              <span className="font-semibold text-text-primary">{activeCount}</span>
              <span className="text-text-muted"> / {quota}개 사용</span>
            </span>
          </div>
          <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden max-w-[160px]">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                atQuota ? 'bg-amber-400' : 'bg-primary-400',
              )}
              style={{ width: `${Math.min(100, (activeCount / quota) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* 지점 목록 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Building2 className="w-10 h-10 text-zinc-300 mb-3" />
              <p className="font-medium text-text-secondary mb-1">등록된 지점이 없습니다</p>
              {isOwner && (
                <p className="text-sm text-text-muted">
                  '지점 추가' 버튼을 눌러 첫 번째 지점을 등록하세요.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => setSelectedLocation(loc.id === selectedLocation?.id ? null : loc)}
                  className={clsx(
                    'text-left p-4 rounded-2xl border transition-all duration-150',
                    selectedLocation?.id === loc.id
                      ? 'border-primary-300 bg-primary-50 shadow-sm'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm',
                    !loc.isActive && 'opacity-60',
                  )}
                >
                  {/* 카드 헤더 */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={clsx(
                        'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
                        loc.isActive ? 'bg-primary-100' : 'bg-zinc-100',
                      )}>
                        <Building2 className={clsx('w-4 h-4', loc.isActive ? 'text-primary-600' : 'text-zinc-400')} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-text-primary truncate">{loc.name}</p>
                        {!loc.isActive && (
                          <span className="text-[10px] text-zinc-400 font-medium">비활성</span>
                        )}
                      </div>
                    </div>
                    {isOwner && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditTarget(loc); }}
                          className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-text-muted hover:text-text-primary"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`'${loc.name}' 지점을 삭제할까요?`)) deleteMut.mutate(loc.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-text-muted hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 상세 정보 */}
                  <div className="space-y-1.5">
                    {loc.address && (
                      <div className="flex items-start gap-1.5 text-xs text-text-muted">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{loc.address}</span>
                      </div>
                    )}
                    {loc.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{loc.phone}</span>
                      </div>
                    )}
                    {loc.note && (
                      <p className="text-xs text-text-muted line-clamp-2 mt-1">{loc.note}</p>
                    )}
                  </div>

                  {/* 직원 배정 보기 버튼 */}
                  <div className={clsx(
                    'flex items-center gap-1 mt-3 text-xs font-medium transition-colors',
                    selectedLocation?.id === loc.id ? 'text-primary-600' : 'text-text-muted',
                  )}>
                    <Users className="w-3.5 h-3.5" />
                    <span>직원 배정 {selectedLocation?.id === loc.id ? '닫기' : '보기'}</span>
                    <ChevronRight className={clsx(
                      'w-3.5 h-3.5 transition-transform ml-auto',
                      selectedLocation?.id === loc.id && 'rotate-90',
                    )} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 직원 배정 사이드 패널 */}
        {selectedLocation && (
          <div className="w-80 flex-shrink-0 border-l border-zinc-100 bg-white overflow-hidden flex flex-col">
            <AssignPanel
              location={selectedLocation}
              onClose={() => setSelectedLocation(null)}
            />
          </div>
        )}
      </div>

      {/* 모달들 */}
      {createOpen && (
        <LocationFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          managers={managers}
          onSuccess={() => {}}
        />
      )}
      {editTarget && (
        <LocationFormModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          initial={editTarget}
          managers={managers}
          onSuccess={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
