'use client';
import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  commandPaletteOpen: boolean;
  commandPaletteMode: 'search' | 'ai';
  openCommandPalette: (mode?: 'search' | 'ai') => void;
  closeCommandPalette: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  commandPaletteOpen: false,
  commandPaletteMode: 'search',
  openCommandPalette: (mode = 'search') => set({ commandPaletteOpen: true, commandPaletteMode: mode }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
}));
