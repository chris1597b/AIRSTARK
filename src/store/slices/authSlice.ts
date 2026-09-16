import { StateCreator } from 'zustand';
import { AuthenticatedUser } from '../../features/quiz/types/evaluation.ts';
import { getStoredUser } from '../../features/auth/services/googleAuth.ts';
import { supabase } from '../../services/supabaseClient.ts';
import { mapSupabaseUserToAuthenticatedUser } from '../../features/auth/services/supabaseAuth.ts';

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
    // 1) Fuente preferente: sesión persistente de Supabase Auth (auth.uid()).
    // Se consulta de forma asíncrona; mientras tanto isAuthChecking sigue true
    // para no parpadear la pantalla de login en usuarios recurrentes.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        set({
          user: mapSupabaseUserToAuthenticatedUser(session.user),
          isAuthenticated: true,
          isAuthChecking: false,
        });
        return;
      }
      // 2) Fallback: sesión legacy GIS en sessionStorage (invitado/mock local).
      const stored = getStoredUser();
      if (stored) {
        set({ user: stored, isAuthenticated: true, isAuthChecking: false });
      } else {
        set({ isAuthChecking: false });
      }
    }).catch(() => {
      const stored = getStoredUser();
      if (stored) {
        set({ user: stored, isAuthenticated: true, isAuthChecking: false });
      } else {
        set({ isAuthChecking: false });
      }
    });
  },
});
