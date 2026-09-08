import { StateCreator } from 'zustand';
import { AnatomicalPart } from '../../shared/types/index.ts';

export interface ExplorationSlice {
  selectedPart: AnatomicalPart | null;
  setSelectedPart: (part: AnatomicalPart | null) => void;
}

export const createExplorationSlice: StateCreator<ExplorationSlice> = (set) => ({
  selectedPart: null,
  setSelectedPart: (selectedPart) => set({ selectedPart }),
});
