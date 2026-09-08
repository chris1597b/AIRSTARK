import { create } from 'zustand';
import { AuthSlice, createAuthSlice } from './slices/authSlice.ts';
import { AppModeSlice, createAppModeSlice } from './slices/appModeSlice.ts';
import { ExplorationSlice, createExplorationSlice } from './slices/explorationSlice.ts';
import { QuizSlice, createQuizSlice } from './slices/quizSlice.ts';
import { ViewerSlice, createViewerSlice } from './slices/viewerSlice.ts';

export type AppState = AuthSlice & AppModeSlice & ExplorationSlice & QuizSlice & ViewerSlice;

export const useAppStore = create<AppState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createAppModeSlice(...a),
  ...createExplorationSlice(...a),
  ...createQuizSlice(...a),
  ...createViewerSlice(...a),
}));
