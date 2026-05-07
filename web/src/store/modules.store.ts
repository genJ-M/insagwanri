'use client';
import { create } from 'zustand';
import { BASE_MODULE_IDS } from '@/types/modules';

interface ModulesState {
  activeModuleIds: Set<string>;
  hydrated: boolean;
  setActiveModules: (ids: string[]) => void;
  isModuleActive: (moduleId: string) => boolean;
  reset: () => void;
}

export const useModulesStore = create<ModulesState>((set, get) => ({
  activeModuleIds: new Set(),
  hydrated: false,

  setActiveModules: (ids: string[]) =>
    set({ activeModuleIds: new Set(ids), hydrated: true }),

  isModuleActive: (moduleId: string): boolean => {
    // BASE 모듈은 항상 활성
    if ((BASE_MODULE_IDS as readonly string[]).includes(moduleId)) return true;
    // 아직 fetch 안 됐으면 낙관적으로 허용 (깜빡임 방지)
    if (!get().hydrated) return true;
    return get().activeModuleIds.has(moduleId);
  },

  reset: () => set({ activeModuleIds: new Set(), hydrated: false }),
}));
