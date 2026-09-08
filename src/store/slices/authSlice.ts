import { StateCreator } from 'zustand';
import { AuthenticatedUser } from '../../features/quiz/types/evaluation.ts';
import { getStoredUser } from '../../features/auth/services/googleAuth.ts';

export interface AuthSlice {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  isAuthChecking: boolean;
  setUser: (user: AuthenticatedUser | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setAuthChecking: (isAuthChecking: boolean) => void;
  logout: () => void;
  checkAuthOnMount: () => void;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  user: null,
  isAuthenticated: false,
  isAuthChecking: true,
  setUser: (user) => set({ user }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setAuthChecking: (isAuthChecking) => set({ isAuthChecking }),
  logout: () => set({ user: null, isAuthenticated: false }),
  checkAuthOnMount: () => {
    const stored = getStoredUser();
    if (stored) {
      set({ user: stored, isAuthenticated: true, isAuthChecking: false });
    } else {
      set({ isAuthChecking: false });
    }
  },
});
