/**
 * services/googleAuth.ts
 * Wrapper de Google Identity Services (GIS) + gestión del token AIRSTARK.
 *
 * SEPARACIÓN DE RESPONSABILIDADES:
 *
 *   Google GIS → devuelve `credential` (JWT de Google, válido ~1 hora)
 *       ↓
 *   Frontend llama POST /api/v1/auth/login con ese credential
 *       ↓
 *   Backend valida y devuelve { token (AIRSTARK JWT), user }
 *       ↓
 *   Frontend almacena AIRSTARK token en sessionStorage
 *       ↓
 *   Todas las peticiones protegidas usan: Authorization: Bearer <AIRSTARK token>
 *
 * CLAVES DE sessionStorage:
 *   'airstark_token'          → JWT emitido por el Backend AIRSTARK (usado en Authorization)
 *   'airstark_user'           → Usuario autenticado (AuthenticatedUser del Backend)
 *   'airstark_google_cred'    → Credential de Google (transitorio, solo durante el flujo de login)
 *
 * REGLAS:
 *   - El JWT de Google NO debe usarse como Bearer permanente.
 *   - El AIRSTARK token es el que viaja en Authorization: Bearer.
 *   - Las variables VITE_* son públicas; no colocar secretos aquí.
 *   - VITE_GOOGLE_CLIENT_ID es público y puede estar en el Frontend.
 */

import type { AuthenticatedUser } from '../types/evaluation';

// ── Claves de almacenamiento ─────────────────────────────────────────────────
const AIRSTARK_USER_KEY  = 'airstark_user';
const GOOGLE_CRED_KEY    = 'airstark_google_cred';

// ── Tipos ─────────────────────────────────────────────────────────────────────

/**
 * Datos del usuario decodificados del JWT de Google.
 * Se usa ÚNICAMENTE durante el flujo de login (hasta obtener el AIRSTARK token).
 * Para el resto de la sesión, usar AuthenticatedUser.
 */
export interface GoogleUser {
  sub: string;        // Google user ID único
  name: string;
  email: string;
  picture: string;
  given_name: string;
}

declare global {
  interface Window {
    google: any;
    onGoogleLibraryLoad: () => void;
  }
}

// ── Configuración ────────────────────────────────────────────────────────────
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// ── Decodificación local del JWT de Google ───────────────────────────────────

/**
 * Decodifica el JWT de Google para obtener los datos básicos del usuario.
 * NOTA: Esta decodificación es CLIENT-SIDE y NO verifica la firma.
 * El Backend debe re-verificar criptográficamente el credential con google-auth-library.
 */
function decodeGoogleJwt(token: string): GoogleUser {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  );
  return JSON.parse(json) as GoogleUser;
}

// ── Espera del SDK de Google ─────────────────────────────────────────────────

function waitForGIS(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) { resolve(); return; }
    const check = setInterval(() => {
      if (window.google?.accounts?.id) { clearInterval(check); resolve(); }
    }, 100);
  });
}

// ── Estado interno del módulo ────────────────────────────────────────────────
let isInitialized = false;
let globalCallback:      ((credential: string, user: GoogleUser) => void) | null = null;
let globalErrorCallback: ((err: Error) => void) | null = null;

// ── Inicialización de Google Auth ────────────────────────────────────────────

/**
 * Inicializa Google Identity Services.
 * Puede llamarse múltiples veces sin efecto duplicado.
 *
 * @param onCredential  Recibe el credential raw de Google (para enviarlo a POST /auth/login)
 *                      y el GoogleUser decodificado localmente (para UI inmediata mientras se hace login).
 * @param onFailure     Error de autenticación de Google.
 */
export async function initializeGoogleAuth(
  onCredential: (credential: string, user: GoogleUser) => void,
  onFailure: (err: Error) => void
): Promise<void> {
  globalCallback      = onCredential;
  globalErrorCallback = onFailure;

  if (isInitialized) return;

  if (!CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID no configurado en .env.local');
  }

  await waitForGIS();

  window.google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: (response: { credential: string; error?: string }) => {
      if (response.error) {
        if (globalErrorCallback) globalErrorCallback(new Error(response.error));
        return;
      }
      try {
        const googleUser = decodeGoogleJwt(response.credential);
        // Almacenar credential de Google de forma transitoria para el flujo de login
        sessionStorage.setItem(GOOGLE_CRED_KEY, response.credential);
        if (globalCallback) globalCallback(response.credential, googleUser);
      } catch (e: any) {
        if (globalErrorCallback) globalErrorCallback(e);
      }
    },
    use_fedcm_for_prompt: true,
  });

  isInitialized = true;
}

// ── One-Tap / prompt ─────────────────────────────────────────────────────────

export async function signInWithGoogle(
  onCredential: (credential: string, user: GoogleUser) => void,
  onFailure: (err: Error) => void
): Promise<void> {
  await initializeGoogleAuth(onCredential, onFailure);
  window.google.accounts.id.prompt((notification: any) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      if (!window.google.accounts.oauth2) {
        onFailure(new Error('Google Sign-In no disponible en este entorno'));
      }
    }
  });
}

// ── Render del botón oficial de Google ──────────────────────────────────────

export async function renderGoogleButton(container: HTMLElement): Promise<void> {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID no configurado en .env.local');
  await waitForGIS();
  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'left',
    width: 320,
  });
}

// ── Almacenamiento de la sesión AIRSTARK ─────────────────────────────────────

/**
 * Almacena el usuario autenticado recibido del Backend.
 * Debe llamarse desde evaluationApi.loginWithGoogle() después de POST /auth/login.
 * El token AIRSTARK ya no se guarda en el Frontend (se asume uso de Cookie HttpOnly).
 */
export function storeAirStarkSession(user: AuthenticatedUser): void {
  sessionStorage.setItem(AIRSTARK_USER_KEY, JSON.stringify(user));
  // Limpiar el credential de Google ya que no es necesario después del login
  sessionStorage.removeItem(GOOGLE_CRED_KEY);
}

export function storeMockSession(googleUser: GoogleUser, googleCredential: string): void {
  // Construir un AuthenticatedUser mínimo a partir del GoogleUser para compatibilidad de UI
  const mockUser: AuthenticatedUser = {
    id: googleUser.sub,
    email: googleUser.email,
    name: googleUser.name,
    picture: googleUser.picture,
    given_name: googleUser.given_name,
  };
  sessionStorage.setItem(AIRSTARK_USER_KEY, JSON.stringify(mockUser));
  sessionStorage.removeItem(GOOGLE_CRED_KEY);
}

// ── Getters ───────────────────────────────────────────────────────────────────

/**
 * @deprecated En producción, las peticiones utilizan cookies HttpOnly (credentials: 'include').
 * Esta función se mantiene solo por compatibilidad con firmas previas si fuera necesaria, 
 * pero retorna null ya que el token no debe ser accesible.
 */
export function getStoredToken(): string | null {
  return null;
}

/**
 * Devuelve el usuario autenticado almacenado.
 * En producción: usuario del Backend AIRSTARK.
 * En mock: construido a partir del GoogleUser.
 */
export function getStoredUser(): AuthenticatedUser | null {
  try {
    const raw = sessionStorage.getItem(AIRSTARK_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthenticatedUser) : null;
  } catch {
    return null;
  }
}

/**
 * Devuelve el credential de Google almacenado transitoriamente.
 * Solo disponible durante el flujo de login, antes de completar POST /auth/login.
 */
export function getGoogleCredential(): string | null {
  return sessionStorage.getItem(GOOGLE_CRED_KEY);
}

// ── Sign Out ──────────────────────────────────────────────────────────────────

export function signOut(email?: string): void {
  sessionStorage.removeItem(AIRSTARK_USER_KEY);
  sessionStorage.removeItem(GOOGLE_CRED_KEY);
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
    if (email) window.google.accounts.id.revoke(email, () => {});
  }
}
