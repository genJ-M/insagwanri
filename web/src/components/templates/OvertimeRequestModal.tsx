'use client';
import { useState } from 'react';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import api from '@/lib/api';

interface OvertimeRequestModalProps {
  open: boolean;
  onClose: () => void;
}

export function OvertimeRequestModal({ open, onClose }: OvertimeRequestModalProps) {
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [form, setForm] = useState({
    date:       today,
    start_time: '18:00',
    end_time:   '21:00',
    reason:     '',
    task_ref:   '',
  });

  const calcHours = () => {
    const [sh, sm] = form.start_time.split(':').map(Number);
    const [eh, em] = form.end_time.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? (diff / 60).toFixed(1) : '-';
  };

  const mut = useMutation({
    mutationFn: () => {
      const hours = calcHours();
      const content = JSON.stringify({
        date:       form.date,
        start_time: form.start_time,
        end_time:   form.end_time,
        hours,
        reason:     form.reason,
        task_ref:   form.task_ref,
      }, null, 2);

      return api.post('/approvals', {
        type:    'overtime',
        title:   `초과근무 신청 — ${form.date} (${hours}시간)`,
        content,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      onClose();
      toast.success('초과근무 신청이 제출되었습니다.');
    },
  });

  const handleSubmit = () => {
    if (!form.reason.trim()) return toast.error('사유를 입력해주세요.');
    if (form.end_time <= form.start_time) return toast.error('종료 시간은 시작 시간보다 이후여야 합니다.');
    mut.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="초과근무 신청">
      <div className="space-y-4">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
          근로기준법 제53조에 따라 초과근무 시 결재 승인이 필요합니다.
        </div>

        <div>
          <label className="label">초과근무 날짜 *</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="input"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">시작 시간 *</label>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">종료 시간 *</label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="bg-surface-2 rounded p-2 text-sm text-center">
          예상 초과근무: <strong className="text-primary-600">{calcHours()}시간</strong>
        </div>

        <div>
          <label className="label">사유 *</label>
          <textarea
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className="input resize-none"
            rows={3}
            placeholder="마감 대응, 고객 요청 처리 등 구체적인 사유를 입력해주세요."
          />
        </div>

        <div>
          <label className="label">관련 업무/프로젝트 (선택)</label>
          <input
            value={form.task_ref}
            onChange={(e) => setForm({ ...form, task_ref: e.target.value })}
            className="input"
            placeholder="관련 업무명 또는 프로젝트명"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit} disabled={mut.isPending}>
            결재 신청
          </Button>
        </div>
      </div>
    </Modal>
  );
}
