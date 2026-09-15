/**
 * features/auth/services/supabaseAuth.ts
 * Capa de autenticación Supabase con Google OAuth.
 *
 * RESPONSABILIDAD:
 *   - Iniciar el flujo OAuth de Google via Supabase Auth
 *   - Obtener el usuario autenticado de Supabase (auth.uid())
 *   - Cerrar sesión en Supabase
 *   - Escuchar cambios de estado de autenticación
 *
 * SEPARACIÓN DE RESPONSABILIDADES:
 *   - Google GIS (googleAuth.ts) → gestiona el botón visual de Google y sessionStorage
 *   - Supabase Auth (este archivo) → gestiona auth.uid() para RLS y sesión persistente
 *   - Los dos sistemas coexisten en Fase 1
 *   - En Fase 2 se unificarán completamente
 *
 * REGLA: auth.uid() de Supabase = fuente de verdad para ownership en RLS
 */

import { supabase } from '../../../services/supabaseClient.ts';
import type { User, Session } from '@supabase/supabase-js';
import type { AuthenticatedUser } from '../../quiz/types/evaluation.ts';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface SupabaseAuthState {
  user: User | null;
  session: Session | null;
}

// ── Conversión de Supabase User → AuthenticatedUser (para el store existente) ──

export function mapSupabaseUserToAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,                                          // UUID de Supabase (auth.uid())
    email: user.email ?? '',
    name: user.user_metadata?.['full_name'] ?? user.email ?? 'Usuario',
    picture: user.user_metadata?.['avatar_url'] ?? '',
    given_name: user.user_metadata?.['given_name'] ?? '',
    role: 'teacher',                                      // En esta fase todos son profesores
  };
}

// ── Sign In con Google OAuth via Supabase ────────────────────────────────────

/**
 * Inicia el flujo OAuth de Google via Supabase.
 * Redirige al usuario a Google y luego de vuelta a la app.
 *
 * El callback URL debe estar configurado en Supabase Auth:
 *   Authentication > URL Configuration > Redirect URLs
 *   → http://localhost:5173 (desarrollo)
 *
 * En producción, agregar el dominio de producción.
 */
export async function signInWithGoogleSupabase(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      // Solicitar datos del perfil de Google
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw new Error(`Error al iniciar sesión con Google: ${error.message}`);
  }
}

// ── Obtener sesión actual ────────────────────────────────────────────────────

/**
 * Retorna el usuario autenticado actual de Supabase.
 * IMPORTANTE: Usar getUser() en lugar de getSession() para verificación segura.
 */
export async function getSupabaseCurrentUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('[AIRSTARK] Error al obtener usuario de Supabase:', error.message);
    return null;
  }
  return user;
}

/**
 * Retorna la sesión actual de Supabase (incluye access_token).
 * Usar solo cuando se necesite el token explícitamente.
 */
export async function getSupabaseSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ── Sign Out ─────────────────────────────────────────────────────────────────

export async function signOutSupabase(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('[AIRSTARK] Error al cerrar sesión en Supabase:', error.message);
  }
}

// ── Listener de cambios de estado ────────────────────────────────────────────

/**
 * Suscribe a cambios de estado de autenticación de Supabase.
 * Devuelve una función para cancelar la suscripción.
 *
 * @param callback Se llama cuando cambia el estado de auth
 * @returns Función de cleanup para cancelar la suscripción
 */
export function onSupabaseAuthStateChange(
  callback: (state: SupabaseAuthState) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      callback({
        user: session?.user ?? null,
        session,
      });
    }
  );

  return () => subscription.unsubscribe();
}
