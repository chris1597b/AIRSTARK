import { create } from 'zustand';
import { AuthSlice, createAuthSlice } from './slices/authSlice.ts';
import { AppModeSlice, createAppModeSlice } from './slices/appModeSlice.ts';
import { ExplorationSlice, createExplorationSlice } from './slices/explorationSlice.ts';
import { QuizSlice, createQuizSlice } from './slices/quizSlice.ts';
import { ViewerSlice, createViewerSlice } from './slices/viewerSlice.ts';
import { FeatureSupportSlice, createFeatureSupportSlice } from './slices/featureSupportSlice.ts';

export type AppState = AuthSlice & AppModeSlice & ExplorationSlice & QuizSlice & ViewerSlice & FeatureSupportSlice;

export const useAppStore = create<AppState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createAppModeSlice(...a),
  ...createExplorationSlice(...a),
  ...createQuizSlice(...a),
  ...createViewerSlice(...a),
  ...createFeatureSupportSlice(...a),
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).useAppStore = useAppStore;
}
