import { StateCreator } from 'zustand';

export interface ViewerSlice {
  isTransparent: boolean;
  setIsTransparent: (isTransparent: boolean) => void;
  toggleTransparency: () => void;
}

export const createViewerSlice: StateCreator<ViewerSlice> = (set) => ({
  isTransparent: false,
  setIsTransparent: (isTransparent) => set({ isTransparent }),
  toggleTransparency: () => set((state) => ({ isTransparent: !state.isTransparent })),
});
