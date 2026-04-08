'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookmarkPlus, BookOpen, Trash2, Globe, Lock, Star, Plus, Search } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import api from '@/lib/api';
import { CustomTemplate, CustomTemplateType } from '@/types';
import { useAuthStore } from '@/store/auth.store';

interface TemplateManagerProps {
  type: CustomTemplateType;
  /** 현재 폼 데이터를 템플릿으로 저장할 때 사용 */
  currentFields?: Record<string, unknown>;
  /** 템플릿 불러오기 콜백 */
  onLoad: (fields: Record<string, unknown>) => void;
}

export function TemplateManager({ type, currentFields, onLoad }: TemplateManagerProps) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isManager = user?.role !== 'employee';

  const [showPicker, setShowPicker] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveCategory, setSaveCategory] = useState('');
  const [saveCompanyWide, setSaveCompanyWide] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: templatesRes } = useQuery({
    queryKey: ['custom-templates', type],
    queryFn:  () => api.get('/custom-templates', { params: { type } }).then((r) => r.data.data as CustomTemplate[]),
    enabled:  showPicker,
  });

  const templates = (templatesRes ?? []).filter((t) =>
    !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.category ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const saveMut = useMutation({
    mutationFn: (data: object) => api.post('/custom-templates', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-templates', type] });
      setShowSaveModal(false);
      setSaveName(''); setSaveCategory(''); setSaveCompanyWide(false);
      toast.success('템플릿이 저장되었습니다.');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/custom-templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-templates', type] });
      toast.success('템플릿이 삭제되었습니다.');
    },
  });

  const useMut = useMutation({
    mutationFn: (id: string) => api.post(`/custom-templates/${id}/use`),
  });

  const handleLoad = (tmpl: CustomTemplate) => {
    onLoad(tmpl.fields);
    useMut.mutate(tmpl.id);
    setShowPicker(false);
    toast.success(`"${tmpl.name}" 템플릿을 불러왔습니다.`);
  };

  const handleSave = () => {
    if (!saveName.trim()) return toast.error('템플릿 이름을 입력해주세요.');
    if (!currentFields) return toast.error('저장할 내용이 없습니다.');
    saveMut.mutate({
      type,
      name:            saveName,
      category:        saveCategory || undefined,
      fields:          currentFields,
      is_company_wide: saveCompanyWide,
    });
  };

  const typeLabel: Record<CustomTemplateType, string> = {
    task:     '업무',
    schedule: '일정',
    shift:    '근무',
  };

  return (
    <>
      <div className="flex gap-1.5">
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 px-2 py-1 rounded hover:bg-primary-50 transition-colors"
        >
          <BookOpen size={13}/> 템플릿 불러오기
        </button>
        {currentFields && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-surface-2 transition-colors"
          >
            <BookmarkPlus size={13}/> 템플릿으로 저장
          </button>
        )}
      </div>

      {/* ── 템플릿 선택 모달 ─────────────────────────────────────────── */}
      <Modal open={showPicker} onClose={() => setShowPicker(false)} title={`${typeLabel[type]} 템플릿`}>
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary"/>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-7 text-sm"
              placeholder="템플릿 검색..."
            />
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-6 text-sm text-text-secondary">
              저장된 템플릿이 없습니다.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start gap-2 p-3 rounded-lg border border-border hover:border-primary-300 hover:bg-primary-50/30 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-text-primary truncate">{t.name}</span>
                      {t.isCompanyWide ? (
                        <Globe size={11} className="text-blue-400 shrink-0"/>
                      ) : (
                        <Lock size={11} className="text-gray-300 shrink-0"/>
                      )}
                    </div>
                    {t.category && (
                      <span className="text-[10px] text-text-secondary bg-surface-2 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                        {t.category}
                      </span>
                    )}
                    {t.useCount > 0 && (
                      <span className="ml-1.5 text-[10px] text-amber-500">
                        <Star size={9} className="inline mb-0.5"/> {t.useCount}회 사용
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button size="sm" onClick={() => handleLoad(t)}>불러오기</Button>
                    {(t.creator.id === user?.id || user?.role !== 'employee') && (
                      <button
                        onClick={() => deleteMut.mutate(t.id)}
                        className="p-1 text-text-secondary hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 size={13}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-1">
            <button
              onClick={() => { setShowPicker(false); setShowSaveModal(true); }}
              className="text-xs text-primary-600 hover:underline flex items-center gap-1"
            >
              <Plus size={12}/> 새 템플릿 저장
            </button>
            <Button variant="ghost" size="sm" onClick={() => setShowPicker(false)}>닫기</Button>
          </div>
        </div>
      </Modal>

      {/* ── 템플릿 저장 모달 ─────────────────────────────────────────── */}
      <Modal open={showSaveModal} onClose={() => setShowSaveModal(false)} title="템플릿으로 저장">
        <div className="space-y-4">
          <div>
            <label className="label">템플릿 이름 *</label>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="input"
              placeholder="예: 주간 보고서 작성, 외근 일정"
            />
          </div>
          <div>
            <label className="label">카테고리</label>
            <input
              value={saveCategory}
              onChange={(e) => setSaveCategory(e.target.value)}
              className="input"
              placeholder="영업, 운영, 개발 등"
            />
          </div>
          {isManager && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveCompanyWide}
                onChange={(e) => setSaveCompanyWide(e.target.checked)}
                className="rounded border-border text-primary-500"
              />
              <span className="text-sm">회사 전체에 공유</span>
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowSaveModal(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saveMut.isPending}>저장</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
