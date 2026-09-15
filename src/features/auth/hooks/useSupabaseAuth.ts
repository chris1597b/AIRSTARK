/**
 * features/auth/hooks/useSupabaseAuth.ts
 * Hook para integrar Supabase Auth con el store Zustand existente.
 *
 * RESPONSABILIDAD:
 *   - Escuchar cambios de estado de Supabase Auth
 *   - Sincronizar el usuario de Supabase con el store existente
 *   - Proveer funciones de login/logout unificadas
 *
 * COEXISTENCIA:
 *   - Compatible con el flujo Google GIS existente
 *   - El store Zustand sigue siendo la fuente de verdad para la UI
 *   - Supabase Auth es la fuente de verdad para auth.uid() (RLS)
 */

import { useEffect } from 'react';
import { onSupabaseAuthStateChange, mapSupabaseUserToAuthenticatedUser, signInWithGoogleSupabase, signOutSupabase } from '../services/supabaseAuth.ts';
import { useAppStore } from '../../../store/useAppStore.ts';

export function useSupabaseAuth() {
  const setUser = useAppStore((s) => s.setUser);
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const setAuthChecking = useAppStore((s) => s.setAuthChecking);

  useEffect(() => {
    // Suscribirse a cambios de estado de Supabase Auth
    const unsubscribe = onSupabaseAuthStateChange(({ user }) => {
      if (user) {
        const mappedUser = mapSupabaseUserToAuthenticatedUser(user);
        setUser(mappedUser);
        setAuthenticated(true);
      } else {
        setUser(null);
        setAuthenticated(false);
      }
      setAuthChecking(false);
    });

    return unsubscribe;
  }, [setUser, setAuthenticated, setAuthChecking]);

  const loginWithGoogle = async () => {
    await signInWithGoogleSupabase();
  };

  const logout = async () => {
    await signOutSupabase();
    setUser(null);
    setAuthenticated(false);
  };

  return { loginWithGoogle, logout };
}
