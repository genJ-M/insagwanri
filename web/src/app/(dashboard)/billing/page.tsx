'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  Users, Building2, CreditCard, Calendar, AlertCircle,
  Plus, Minus, Sparkles, ShieldCheck, Clock, X, UserPlus, UserCheck,
} from 'lucide-react';
import api from '@/lib/api';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/store/auth.store';
import { usePageTitle } from '@/hooks/usePageTitle';
import { loadLandingIntent, clearLandingIntent } from '@/lib/landing-intent';
import BillingTabs from '@/components/billing/BillingTabs';

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface Subscription {
  id: string;
  status: string;
  plan_id: string;
  plan_name: 'free' | 'basic' | 'pro' | 'enterprise';
  plan_display_name: string;
  billing_cycle: 'monthly' | 'yearly';
  seat_count: number;
  extra_locations: number;
  max_employees: number;
  current_period_start: string;
  current_period_end: string;
  next_billing_at: string | null;
  last_billed_amount_krw: string | number | null;
  trial_end_at: string | null;
  pending_seat_count: number | null;
  pending_extra_locations: number | null;
  pending_changes_apply_at: string | null;
}

interface PaymentMethod {
  id: string;
  card_number_masked: string;
  card_issuer: string;
  card_brand: string;
  card_expiry_year: string;
  card_expiry_month: string;
  is_default: boolean;
}

type SeatPreview =
  | { type: 'noop'; currentSeatCount: number; newSeatCount: number; message: string }
  | { type: 'decrease'; currentSeatCount: number; newSeatCount: number; removedSeats: number; applyAt: string; message: string }
  | {
      type: 'increase';
      currentSeatCount: number;
      newSeatCount: number;
      addedSeats: number;
      monthlyDeltaKrw: number;
      prorationFactor: number;
      totalDays: number;
      daysRemaining: number;
      supplyAmountKrw: number;
      taxAmountKrw: number;
      totalAmountKrw: number;
      periodStart: string;
      periodEnd: string;
    };

type LocationPreview =
  | { type: 'noop'; currentExtraLocations: number; newExtraLocations: number; message: string }
  | { type: 'decrease'; currentExtraLocations: number; newExtraLocations: number; removedLocations: number; applyAt: string; message: string }
  | {
      type: 'increase';
      currentExtraLocations: number;
      newExtraLocations: number;
      addedLocations: number;
      unitPriceKrw: number;
      monthlyDeltaKrw: number;
      prorationFactor: number;
      totalDays: number;
      daysRemaining: number;
      supplyAmountKrw: number;
      taxAmountKrw: number;
      totalAmountKrw: number;
    };

const fmt = (n: number | string | null | undefined) =>
  `₩${Number(n ?? 0).toLocaleString('ko-KR')}`;

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('ko-KR') : '-';

// ────────────────────────────────────────────────────────────────────────────
// 인원 추가 위젯
// ────────────────────────────────────────────────────────────────────────────

function SeatAdjuster({
  sub,
  paymentMethods,
  selectedPaymentMethodId,
  initialTarget,
}: {
  sub: Subscription;
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodId: string | null;
  initialTarget?: number;
}) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<number>(initialTarget ?? sub.seat_count);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const canAdjust = sub.plan_name === 'basic' || sub.plan_name === 'pro';
  const max = Math.min(Number(sub.max_employees) || 100, 100);
  const showPreview = target !== sub.seat_count && canAdjust;

  const previewQuery = useQuery<SeatPreview>({
    queryKey: ['seat-preview', target],
    queryFn: () => api.post('/subscriptions/seats/preview', { newSeatCount: target }).then((r) => r.data.data ?? r.data),
    enabled: showPreview,
    retry: false,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['subscription-plans'] });
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: ['billing-subscription'] });
  };

  const addMutation = useMutation({
    mutationFn: () => api.post('/subscriptions/seats/add', {
      newSeatCount: target,
      paymentMethodId: selectedPaymentMethodId,
    }),
    onSuccess: (res) => {
      const d = res.data.data ?? res.data;
      toast.success(
        d.charged
          ? `인원 ${d.addedSeats}명 추가 완료! ${fmt(d.totalAmountKrw)} 결제`
          : `인원 ${d.addedSeats}명 추가 완료 (일할 비용 0원)`,
      );
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '인원 추가 실패'),
  });

  const decreaseMutation = useMutation({
    mutationFn: () => api.post('/subscriptions/seats/schedule-decrease', { newSeatCount: target }),
    onSuccess: (res) => {
      const d = res.data.data ?? res.data;
      const at = new Date(d.applyAt).toLocaleDateString('ko-KR');
      toast.success(`${at}부터 ${d.newSeatCount}명으로 변경 예약되었습니다 (-${d.removedSeats}명)`);
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '감소 예약 실패'),
  });

  const commit = () => {
    const v = parseInt(inputVal, 10);
    if (!isNaN(v) && v >= 1 && v <= max) setTarget(v);
    setEditing(false);
  };

  return (
    <Card>
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
          <Users className="w-5 h-5 text-primary-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-text-primary">인원 추가</h3>
          <p className="text-xs text-text-muted mt-0.5">
            현재 {sub.seat_count}명 → 추가는 일할 계산으로 즉시 결제됩니다.
          </p>
        </div>
      </div>

      {!canAdjust ? (
        <p className="text-sm text-text-muted bg-zinc-50 rounded-xl px-4 py-3 text-center">
          현재 플랜({sub.plan_display_name})은 인원 변경 기능이 적용되지 않습니다.
        </p>
      ) : (
        <>
          {/* 감소 예약 안내 (이미 예약된 경우) */}
          {sub.pending_seat_count != null && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-amber-800">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                다음 청구주기({formatDate(sub.pending_changes_apply_at)})부터{' '}
                <strong>{sub.pending_seat_count}명</strong>으로 변경 예약됨
              </span>
            </div>
          )}

          {/* 슬라이더 + 숫자 */}
          <div className="flex items-end justify-between mb-2">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">목표 인원</span>
            <div className="flex items-baseline gap-1">
              {editing ? (
                <input
                  type="number"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
                  autoFocus
                  min={1}
                  max={max}
                  className="w-24 text-4xl font-black text-primary-600 tabular-nums leading-none
                             bg-transparent border-b-2 border-primary-500 outline-none text-right
                             [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                             [&::-webkit-inner-spin-button]:appearance-none"
                />
              ) : (
                <button
                  onClick={() => { setInputVal(String(target)); setEditing(true); }}
                  className="text-4xl font-black text-text-primary tabular-nums leading-none hover:text-primary-600 transition-colors"
                  title="클릭해서 직접 입력"
                >
                  {target}
                </button>
              )}
              <span className="text-base font-semibold text-text-muted">명</span>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={max}
            value={target}
            onChange={(e) => { setTarget(Number(e.target.value)); setEditing(false); }}
            className="w-full h-2 rounded-full accent-primary-500 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-text-muted mt-2">
            <span>1명</span>
            <span className="font-semibold text-primary-600">현재 {sub.seat_count}명</span>
            <span>{max}명 (한도)</span>
          </div>

          {/* 미리보기 — 증가/감소 케이스 분기 */}
          {showPreview && previewQuery.data?.type === 'increase' && (
            <div className="mt-5 bg-primary-50 border border-primary-100 rounded-xl px-4 py-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-primary-700 font-semibold">+{previewQuery.data.addedSeats}명 추가 시</span>
                <span className="text-xs text-primary-600 bg-white px-2 py-0.5 rounded-full">
                  {previewQuery.data.daysRemaining}/{previewQuery.data.totalDays}일 비례
                </span>
              </div>
              <div className="text-xs text-primary-600 space-y-1">
                <div className="flex justify-between">
                  <span>월 추가분</span>
                  <span className="tabular-nums">{fmt(previewQuery.data.monthlyDeltaKrw)}</span>
                </div>
                <div className="flex justify-between">
                  <span>일할 비용 (공급가)</span>
                  <span className="tabular-nums">{fmt(previewQuery.data.supplyAmountKrw)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT 10%</span>
                  <span className="tabular-nums">{fmt(previewQuery.data.taxAmountKrw)}</span>
                </div>
              </div>
              <div className="border-t border-primary-200 pt-2 flex justify-between items-baseline">
                <span className="text-sm font-bold text-primary-800">즉시 결제 금액</span>
                <span className="text-xl font-black text-primary-700 tabular-nums">
                  {fmt(previewQuery.data.totalAmountKrw)}
                </span>
              </div>
            </div>
          )}

          {showPreview && previewQuery.data?.type === 'decrease' && (
            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold">감원 예약</p>
                  <p className="text-xs mt-1 leading-relaxed">
                    {sub.seat_count}명 → <strong>{previewQuery.data.newSeatCount}명</strong>{' '}
                    (-{previewQuery.data.removedSeats}명)<br />
                    적용 시점: <strong>{formatDate(previewQuery.data.applyAt)}</strong> (다음 청구주기)<br />
                    <span className="text-[11px] text-amber-700">
                      이번 주기까지는 현재 인원 그대로 사용 가능 · 환불 없음
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {showPreview && previewQuery.isError && (
            <div className="mt-5 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
              {(previewQuery.error as any)?.response?.data?.message ?? '미리보기 조회 실패'}
            </div>
          )}

          {/* 액션 버튼 — 미리보기 type에 따라 분기 */}
          {previewQuery.data?.type === 'decrease' ? (
            <Button
              className="w-full mt-4 justify-center"
              variant="secondary"
              disabled={decreaseMutation.isPending}
              loading={decreaseMutation.isPending}
              onClick={() => decreaseMutation.mutate()}
            >
              {target}명으로 감소 예약하기 (다음 청구주기 적용)
            </Button>
          ) : (
            <Button
              className="w-full mt-4 justify-center"
              disabled={!showPreview || !selectedPaymentMethodId || previewQuery.isLoading || addMutation.isPending}
              loading={addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {target === sub.seat_count ? '인원 변경 없음' : `+${target - sub.seat_count}명 추가하고 결제`}
            </Button>
          )}
          {paymentMethods.length === 0 && previewQuery.data?.type === 'increase' && (
            <p className="text-xs text-red-500 mt-2 text-center">
              결제 수단이 등록되어 있지 않습니다.{' '}
              <Link href="/onboarding/payment" className="underline">카드 등록</Link>
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 지점 추가 위젯
// ────────────────────────────────────────────────────────────────────────────

function LocationAdjuster({
  sub,
  paymentMethods,
  selectedPaymentMethodId,
  initialTarget,
}: {
  sub: Subscription;
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodId: string | null;
  initialTarget?: number;
}) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<number>(initialTarget ?? sub.extra_locations);

  const showPreview = target !== sub.extra_locations;

  const previewQuery = useQuery<LocationPreview>({
    queryKey: ['location-preview', target],
    queryFn: () => api.post('/subscriptions/locations/preview', { newExtraLocations: target }).then((r) => r.data.data ?? r.data),
    enabled: showPreview,
    retry: false,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['subscription-plans'] });
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: ['billing-subscription'] });
  };

  const addMutation = useMutation({
    mutationFn: () => api.post('/subscriptions/locations/add', {
      newExtraLocations: target,
      paymentMethodId: selectedPaymentMethodId,
    }),
    onSuccess: (res) => {
      const d = res.data.data ?? res.data;
      toast.success(
        d.charged
          ? `지점 ${d.addedLocations}개 추가 완료! ${fmt(d.totalAmountKrw)} 결제`
          : `지점 ${d.addedLocations}개 추가 완료 (일할 비용 0원)`,
      );
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '지점 추가 실패'),
  });

  const decreaseMutation = useMutation({
    mutationFn: () => api.post('/subscriptions/locations/schedule-decrease', { newExtraLocations: target }),
    onSuccess: (res) => {
      const d = res.data.data ?? res.data;
      const at = new Date(d.applyAt).toLocaleDateString('ko-KR');
      toast.success(`${at}부터 추가 지점 ${d.newExtraLocations}개로 변경 예약되었습니다 (-${d.removedLocations})`);
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '지점 감소 예약 실패'),
  });

  return (
    <Card>
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-text-primary">지점 추가</h3>
          <p className="text-xs text-text-muted mt-0.5">
            현재 {sub.extra_locations}개 추가 중 — 1개당 ₩9,900/월. 일할로 즉시 결제됩니다.
          </p>
        </div>
      </div>

      {/* 감소 예약 안내 */}
      {sub.pending_extra_locations != null && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-amber-800">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            다음 청구주기({formatDate(sub.pending_changes_apply_at)})부터 추가 지점{' '}
            <strong>{sub.pending_extra_locations}개</strong>로 변경 예약됨
          </span>
        </div>
      )}

      <div className="flex items-center justify-between bg-zinc-50 rounded-xl px-4 py-4">
        <span className="text-sm text-text-secondary">목표 추가 지점</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTarget((v) => Math.max(0, v - 1))}
            disabled={target === 0}
            className="w-9 h-9 rounded-xl border border-border bg-white text-text-secondary
                       hover:bg-zinc-50 hover:border-zinc-300 transition-colors flex items-center justify-center
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-10 text-center text-2xl font-black text-text-primary tabular-nums">{target}</span>
          <button
            onClick={() => setTarget((v) => Math.min(50, v + 1))}
            className="w-9 h-9 rounded-xl border border-border bg-white text-text-secondary
                       hover:bg-zinc-50 hover:border-zinc-300 transition-colors flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-text-muted text-center mt-1">현재 {sub.extra_locations}개 추가 중</p>

      {/* 미리보기 — 증가/감소 분기 */}
      {showPreview && previewQuery.data?.type === 'increase' && (
        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-amber-700 font-semibold">+{previewQuery.data.addedLocations}개 추가 시</span>
            <span className="text-xs text-amber-700 bg-white px-2 py-0.5 rounded-full">
              {previewQuery.data.daysRemaining}/{previewQuery.data.totalDays}일 비례
            </span>
          </div>
          <div className="text-xs text-amber-700 space-y-1">
            <div className="flex justify-between">
              <span>월 추가분</span>
              <span className="tabular-nums">{fmt(previewQuery.data.monthlyDeltaKrw)}</span>
            </div>
            <div className="flex justify-between">
              <span>일할 비용 (공급가)</span>
              <span className="tabular-nums">{fmt(previewQuery.data.supplyAmountKrw)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT 10%</span>
              <span className="tabular-nums">{fmt(previewQuery.data.taxAmountKrw)}</span>
            </div>
          </div>
          <div className="border-t border-amber-200 pt-2 flex justify-between items-baseline">
            <span className="text-sm font-bold text-amber-800">즉시 결제 금액</span>
            <span className="text-xl font-black text-amber-700 tabular-nums">
              {fmt(previewQuery.data.totalAmountKrw)}
            </span>
          </div>
        </div>
      )}

      {showPreview && previewQuery.data?.type === 'decrease' && (
        <div className="mt-4 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-4">
          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-zinc-700">
              <p className="font-semibold">지점 감소 예약</p>
              <p className="text-xs mt-1 leading-relaxed">
                {sub.extra_locations}개 → <strong>{previewQuery.data.newExtraLocations}개</strong>{' '}
                (-{previewQuery.data.removedLocations})<br />
                적용 시점: <strong>{formatDate(previewQuery.data.applyAt)}</strong> (다음 청구주기)<br />
                <span className="text-[11px] text-zinc-500">
                  이번 주기 끝까지 사용 가능 · 환불 없음
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      {previewQuery.data?.type === 'decrease' ? (
        <Button
          className="w-full mt-4 justify-center"
          variant="secondary"
          disabled={decreaseMutation.isPending}
          loading={decreaseMutation.isPending}
          onClick={() => decreaseMutation.mutate()}
        >
          {target}개로 감소 예약하기 (다음 청구주기 적용)
        </Button>
      ) : (
        <Button
          className="w-full mt-4 justify-center"
          disabled={!showPreview || !selectedPaymentMethodId || previewQuery.isLoading || addMutation.isPending}
          loading={addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          {target === sub.extra_locations ? '지점 변경 없음' : `+${target - sub.extra_locations}개 추가하고 결제`}
        </Button>
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 결제 위임 계정 카드
// ────────────────────────────────────────────────────────────────────────────

interface CompanyMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

function BillingDelegateCard({
  isOwner,
  delegate,
}: {
  isOwner: boolean;
  delegate: { userId: string; name: string; email: string; role: string } | null;
}) {
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');

  // 회사 내 직원 목록 (위임 후보) — owner는 조회 가능
  const { data: members = [] } = useQuery<CompanyMember[]>({
    queryKey: ['billing-delegate-candidates'],
    queryFn: async () => {
      const res = await api.get('/users');
      const list = res.data.data ?? res.data;
      // owner 본인은 제외 — 이미 결제 권한 있음
      return (list as CompanyMember[]).filter((u) => u.role !== 'owner');
    },
    enabled: isOwner && picking,
  });

  const setMutation = useMutation({
    mutationFn: (userId: string | null) =>
      api.post('/subscriptions/billing-delegate', { userId }),
    onSuccess: () => {
      toast.success('결제 위임 계정이 변경되었습니다.');
      qc.invalidateQueries({ queryKey: ['billing-delegate'] });
      setPicking(false);
      setSearch('');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '위임 변경 실패'),
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete('/subscriptions/billing-delegate'),
    onSuccess: () => {
      toast.success('결제 위임이 해제되었습니다.');
      qc.invalidateQueries({ queryKey: ['billing-delegate'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '위임 해제 실패'),
  });

  const filtered = search.trim()
    ? members.filter((m) =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase()),
      )
    : members;

  return (
    <Card>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
          {delegate ? <UserCheck className="w-5 h-5 text-emerald-600" /> : <UserPlus className="w-5 h-5 text-emerald-600" />}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-text-primary">결제 위임 계정</h3>
          <p className="text-xs text-text-muted mt-0.5">
            OWNER 외 1명에게 결제 권한을 위임할 수 있습니다 (인원/지점 추가, 카드 등록 등).
          </p>
        </div>
      </div>

      {delegate ? (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-emerald-800">{delegate.name}</p>
            <p className="text-xs text-emerald-600">{delegate.email} · {delegate.role}</p>
          </div>
          {isOwner && (
            <button
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="text-xs font-medium text-emerald-800 hover:text-emerald-900 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              위임 해제
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-muted bg-zinc-50 rounded-xl px-4 py-3 text-center">
          아직 위임된 계정이 없습니다.
        </p>
      )}

      {isOwner && (
        <>
          {!picking ? (
            <button
              onClick={() => setPicking(true)}
              className="mt-3 w-full text-sm font-medium text-emerald-700 border border-emerald-200 rounded-xl py-2.5 hover:bg-emerald-50 transition-colors"
            >
              {delegate ? '+ 다른 직원으로 변경' : '+ 위임 계정 지정'}
            </button>
          ) : (
            <div className="mt-3 border border-border rounded-xl p-3 bg-zinc-50">
              <input
                type="text"
                placeholder="이름 또는 이메일 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input mb-2 text-sm py-2"
                autoFocus
              />
              <div className="max-h-56 overflow-y-auto space-y-1.5 mb-2">
                {filtered.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-3">
                    {search ? '검색 결과 없음' : '회사 내 다른 직원이 없습니다.'}
                  </p>
                ) : (
                  filtered.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMutation.mutate(m.id)}
                      disabled={setMutation.isPending}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white border border-border hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left disabled:opacity-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-primary">{m.name}</p>
                        <p className="text-[11px] text-text-muted">{m.email} · {m.role}</p>
                      </div>
                      <span className="text-xs text-emerald-600 font-medium">선택 →</span>
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={() => { setPicking(false); setSearch(''); }}
                className="w-full text-xs text-text-muted hover:text-text-secondary py-1"
              >
                취소
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ────────────────────────────────────────────────────────────────────────────

function BillingPageContent() {
  usePageTitle('결제 관리');
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const fromOnboarding = searchParams?.get('from') === 'onboarding';

  // 랜딩 의도 — extraLocations만 prefill용으로 사용 (인원은 회원가입 시 이미 반영)
  const intentLocations = useMemo(() => loadLandingIntent()?.extraLocations ?? 0, []);

  useEffect(() => {
    if (fromOnboarding && intentLocations > 0) {
      toast.success(`랜딩에서 선택한 지점 ${intentLocations}개가 미리 채워져 있습니다. 결제하면 즉시 적용됩니다.`);
    }
    // 컴포넌트가 마운트되면 의도는 1회만 사용 — 다음 마운트엔 제거
    return () => {
      if (fromOnboarding) clearLandingIntent();
    };
  }, [fromOnboarding, intentLocations]);

  const { data: planData, isLoading } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/plans');
      return res.data.data as { currentSubscription: Subscription | null };
    },
  });

  const cancelScheduledMutation = useMutation({
    mutationFn: () => api.delete('/subscriptions/scheduled-changes'),
    onSuccess: () => {
      toast.success('예약된 변경 사항이 취소되었습니다.');
      qc.invalidateQueries({ queryKey: ['subscription-plans'] });
      qc.invalidateQueries({ queryKey: ['billing-subscription'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '예약 취소 실패'),
  });

  const downgradeToFreeMutation = useMutation({
    mutationFn: () => api.post('/subscriptions/downgrade-to-free'),
    onSuccess: () => {
      toast.success('무료 플랜으로 전환되었습니다.');
      qc.invalidateQueries({ queryKey: ['subscription-plans'] });
      qc.invalidateQueries({ queryKey: ['billing-subscription'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '무료 플랜 전환 실패'),
  });

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods'],
    queryFn: async () => (await api.get('/subscriptions/payment-methods')).data.data,
  });

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);

  useEffect(() => {
    if (paymentMethods.length > 0 && !selectedPaymentMethodId) {
      setSelectedPaymentMethodId(paymentMethods.find((p) => p.is_default)?.id ?? paymentMethods[0].id);
    }
  }, [paymentMethods, selectedPaymentMethodId]);

  // 결제 위임 계정 조회 — OWNER + 위임자 모두에게 노출
  const { data: delegateData } = useQuery({
    queryKey: ['billing-delegate'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/billing-delegate');
      return res.data.data ?? res.data as { delegate: { userId: string; name: string; email: string; role: string } | null };
    },
  });

  const isOwner = user?.role === 'owner';
  const isDelegate = !!delegateData?.delegate && delegateData.delegate.userId === user?.id;
  const canManageBilling = isOwner || isDelegate;

  // 결제 권한 체크 — OWNER 또는 위임자만 통과
  if (user && !canManageBilling) {
    return (
      <div className="flex-1 overflow-y-auto">
        <main className="p-8 max-w-3xl">
          <Card>
            <div className="flex items-center gap-3 text-text-secondary">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              <p className="text-sm">결제 관리는 사업주(OWNER) 또는 결제 위임 계정만 접근할 수 있습니다.</p>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  const sub = planData?.currentSubscription;
  if (!sub) {
    return (
      <div className="flex-1 overflow-y-auto">
        <main className="p-8 max-w-3xl">
          <Card>
            <div className="text-center py-6">
              <p className="text-text-secondary mb-4">활성 구독이 없습니다.</p>
              <Link
                href="/onboarding/plan"
                className="bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 text-sm font-medium transition-colors"
              >
                플랜 선택하기
              </Link>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="p-8 space-y-6 max-w-5xl">
        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">결제 관리</h1>
          <p className="text-sm text-text-muted mt-1">
            인원과 지점을 즉시 추가하고 일할 비용으로 결제하세요. 변경 사항은 모든 화면에 즉시 반영됩니다.
          </p>
        </div>

        <BillingTabs />

        {/* 구독 요약 카드 */}
        <Card>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">현재 플랜</p>
              <p className="text-base font-bold text-text-primary flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary-500" />
                {sub.plan_display_name}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {sub.billing_cycle === 'yearly' ? '연간 결제' : '월간 결제'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">현재 인원</p>
              <p className="text-base font-bold text-text-primary">{sub.seat_count}명</p>
              <p className="text-[11px] text-text-muted mt-0.5">한도 {sub.max_employees}명</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">추가 지점</p>
              <p className="text-base font-bold text-text-primary">{sub.extra_locations}개</p>
              <p className="text-[11px] text-text-muted mt-0.5">기본 1개 + 추가</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">다음 결제일</p>
              <p className="text-base font-bold text-text-primary flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-text-muted" />
                {formatDate(sub.next_billing_at ?? sub.current_period_end)}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                직전 청구 {fmt(sub.last_billed_amount_krw)}
              </p>
            </div>
          </div>
        </Card>

        {/* expired/trialing 안내 — 결제 또는 Free 다운그레이드 가이드 */}
        {(sub.status === 'expired' || sub.status === 'trialing') && sub.plan_name !== 'free' && (
          <div className={`rounded-xl border px-4 py-4 ${
            sub.status === 'expired'
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-start gap-3">
              <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                sub.status === 'expired' ? 'text-red-600' : 'text-blue-600'
              }`} />
              <div className="flex-1">
                <p className={`text-sm font-bold ${
                  sub.status === 'expired' ? 'text-red-800' : 'text-blue-800'
                }`}>
                  {sub.status === 'expired'
                    ? '무료 체험이 종료되어 서비스가 일시 정지되었습니다'
                    : `무료 체험 중 — ${formatDate(sub.trial_end_at)}에 종료됩니다`}
                </p>
                <p className={`text-xs mt-1 leading-relaxed ${
                  sub.status === 'expired' ? 'text-red-700' : 'text-blue-700'
                }`}>
                  {sub.status === 'expired'
                    ? '아래 인원/지점 추가 위젯에서 결제하시거나, 직원 1명 이하인 경우 무료 플랜으로 전환할 수 있습니다.'
                    : '체험 종료 시 자동결제는 진행되지 않습니다. 종료 전에 결제하거나 무료 플랜으로 전환하세요.'}
                </p>
                <button
                  onClick={() => {
                    if (confirm('무료 플랜으로 전환하시겠습니까?\n• 직원 1명까지만 사용 가능\n• 카드 등록 없이 무료\n• 일부 고급 기능 제한')) {
                      downgradeToFreeMutation.mutate();
                    }
                  }}
                  disabled={downgradeToFreeMutation.isPending}
                  className={`mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                    sub.status === 'expired'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {downgradeToFreeMutation.isPending ? '전환 중...' : '무료 플랜으로 전환 (직원 1명만)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {fromOnboarding && intentLocations > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-blue-700">
              랜딩에서 선택하신 <strong>지점 +{intentLocations}개</strong>가 아래에 미리 채워져 있습니다.
              "추가하고 결제" 버튼을 누르면 일할 비용으로 즉시 적용됩니다.
            </p>
          </div>
        )}

        {/* 예약된 감소 변경 통합 안내 + 일괄 취소 */}
        {(sub.pending_seat_count != null || sub.pending_extra_locations != null) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-800">변경 예약 — {formatDate(sub.pending_changes_apply_at)}부터 적용</p>
              <ul className="text-xs text-amber-700 mt-1 space-y-0.5">
                {sub.pending_seat_count != null && (
                  <li>• 인원: {sub.seat_count}명 → <strong>{sub.pending_seat_count}명</strong></li>
                )}
                {sub.pending_extra_locations != null && (
                  <li>• 추가 지점: {sub.extra_locations}개 → <strong>{sub.pending_extra_locations}개</strong></li>
                )}
              </ul>
            </div>
            <button
              onClick={() => cancelScheduledMutation.mutate()}
              disabled={cancelScheduledMutation.isPending}
              className="text-xs font-medium text-amber-800 hover:text-amber-900 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5 self-start disabled:opacity-50"
            >
              <X className="w-3 h-3" /> 예약 취소
            </button>
          </div>
        )}

        {/* 인원 + 지점 추가 위젯 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SeatAdjuster
            sub={sub}
            paymentMethods={paymentMethods}
            selectedPaymentMethodId={selectedPaymentMethodId}
          />
          <LocationAdjuster
            sub={sub}
            paymentMethods={paymentMethods}
            selectedPaymentMethodId={selectedPaymentMethodId}
            initialTarget={fromOnboarding ? sub.extra_locations + intentLocations : undefined}
          />
        </div>

        {/* 결제 수단 */}
        <Card>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-text-primary">결제 수단</h3>
              <p className="text-xs text-text-muted mt-0.5">인원/지점 추가 결제에 사용할 카드입니다.</p>
            </div>
            <Link
              href="/onboarding/payment"
              className="text-xs font-medium text-primary-500 hover:text-primary-600 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
            >
              + 카드 추가
            </Link>
          </div>
          {paymentMethods.length > 0 ? (
            <div className="space-y-2">
              {paymentMethods.map((pm) => (
                <label
                  key={pm.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors
                    ${selectedPaymentMethodId === pm.id ? 'border-primary-500 bg-primary-50' : 'border-border hover:bg-zinc-50'}`}
                >
                  <input
                    type="radio"
                    name="pm"
                    checked={selectedPaymentMethodId === pm.id}
                    onChange={() => setSelectedPaymentMethodId(pm.id)}
                    className="text-primary-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">{pm.card_issuer} {pm.card_number_masked}</p>
                    <p className="text-xs text-text-muted">{pm.card_expiry_year}/{pm.card_expiry_month}</p>
                  </div>
                  {pm.is_default && <span className="text-[10px] bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full">기본</span>}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-4">등록된 결제 수단이 없습니다.</p>
          )}
        </Card>

        {/* 결제 위임 계정 — OWNER만 지정 가능, 위임자에게도 노출 (조회만) */}
        <BillingDelegateCard
          isOwner={isOwner}
          delegate={delegateData?.delegate ?? null}
        />

        <div className="text-center">
          <Link href="/subscription" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
            플랜 변경 · 인보이스 · 자동결제 설정 →
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    }>
      <BillingPageContent />
    </Suspense>
  );
}
