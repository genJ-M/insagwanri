'use client';
import { useState } from 'react';
import { clsx } from 'clsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface Preset {
  id: string;
  name: string;
  icon: string;
  description: string;
  recommendedModules: string[];
}

interface PresetResult {
  activated: string[];
  skipped: string[];
}

interface IndustryPresetSelectorProps {
  presets: Preset[];
  currentPlanName: string;
}

export default function IndustryPresetSelector({
  presets,
  currentPlanName,
}: IndustryPresetSelectorProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Preset | null>(null);
  const [result, setResult] = useState<PresetResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const applyMut = useMutation({
    mutationFn: (preset: Preset) =>
      api.post('/feature-modules/apply-preset', {
        presetId: preset.id,
        currentPlanName,
      }),
    onSuccess: (res, preset) => {
      const data: PresetResult = res.data.data;
      setResult(data);
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['feature-modules'] });
      toast.success(`${preset.name} 프리셋이 적용되었습니다.`);
    },
    onError: () => {
      toast.error('프리셋 적용에 실패했습니다.');
    },
  });

  const handleSelect = (preset: Preset) => {
    setSelected(preset);
    setResult(null);
    setConfirmOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handleSelect(preset)}
            className="flex flex-col items-start gap-1.5 p-3 rounded-xl border border-border bg-white
                       hover:border-primary-300 hover:bg-primary-50 transition-all duration-150
                       text-left group"
          >
            <span className="text-2xl">{preset.icon}</span>
            <span className="text-[12px] font-semibold text-text-primary group-hover:text-primary-700">
              {preset.name}
            </span>
            <span className="text-[10px] text-text-muted leading-relaxed line-clamp-2">
              {preset.description}
            </span>
          </button>
        ))}
      </div>

      {/* 적용 결과 요약 */}
      {result && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-[12px] text-emerald-800">
          <span className="font-semibold">{result.activated.length}개 모듈</span> 활성화됨
          {result.skipped.length > 0 && (
            <span className="text-text-muted ml-2">
              ({result.skipped.length}개는 현재 플랜에서 사용 불가)
            </span>
          )}
        </div>
      )}

      {/* 확인 모달 */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`${selected?.name} 프리셋 적용`}
      >
        {selected && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              아래 모듈들이 활성화됩니다. 기존에 활성화된 모듈은 유지됩니다.
            </p>

            <div className="flex flex-wrap gap-1.5">
              {selected.recommendedModules.map((m) => (
                <span
                  key={m}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 font-medium"
                >
                  {m}
                </span>
              ))}
            </div>

            <p className="text-[11px] text-text-muted">
              현재 플랜에서 지원하지 않는 모듈은 자동으로 제외됩니다.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>
                취소
              </Button>
              <Button
                size="sm"
                loading={applyMut.isPending}
                onClick={() => selected && applyMut.mutate(selected)}
              >
                적용
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
