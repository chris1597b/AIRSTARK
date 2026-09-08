import { StateCreator } from 'zustand';
import { AppMode } from '../../shared/types/index.ts';

export interface AppModeSlice {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

export const createAppModeSlice: StateCreator<AppModeSlice> = (set) => ({
  mode: AppMode.EXPLORE,
  setMode: (mode) => set({ mode }),
});
