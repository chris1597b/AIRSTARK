/**
 * services/evaluationApi.ts
 * Capa de API centralizada — único punto de contacto con el Backend.
 *
 * FUNCIONES DISPONIBLES:
 *   loginWithGoogle(credential)    → POST /api/v1/auth/login   [IMPLEMENTADO/MOCK]
 *   createEvaluationSession(draft) → POST /api/v1/sessions     [IMPLEMENTADO/MOCK]
 *
 * PENDIENTES (cuando Backend confirme los endpoints):
 *   getSession(sessionId)          → GET  /api/v1/sessions/{id}
 *   getStatistics(sessionId)       → GET  /api/v1/sessions/{id}/statistics
 *   endSession(sessionId)          → POST /api/v1/sessions/{id}/end
 *
 * REGLAS:
 *   - Los componentes React NUNCA llaman fetch() directamente.
 *   - VITE_API_BASE_URL es la única URL del Backend (env var, no hardcodeada).
 *   - VITE_* son públicas en el navegador. No colocar secretos aquí.
 *   - El mock (VITE_USE_MOCK_API=true) respeta los mismos tipos que la API real.
 */

import {
  EvaluationDraft,
  CreateSessionResponse,
  AuthResponse,
  AuthenticatedUser,
  ApiErrorCode,
} from '../types/evaluation';
import { mapDraftToCreateSessionRequest } from './evaluationMapper';
import { getStoredToken, storeAirStarkSession, storeMockSession } from './googleAuth';

// ── Configuración desde variables de entorno ─────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

// ── Clase de error tipada ─────────────────────────────────────────────────────

/**
 * Error tipado lanzado por cualquier fallo HTTP o de red.
 * Los componentes deben capturar ApiError para mostrar mensajes al usuario
 * sin exponer información técnica innecesaria.
 */
export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;

  constructor(statusCode: number, message: string, code: ApiErrorCode = 'SERVER_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function resolveErrorCode(status: number): ApiErrorCode {
  if (status === 401 || status === 403) return 'UNAUTHORIZED';
  if (status === 404)                   return 'SESSION_NOT_FOUND';
  if (status === 410)                   return 'SESSION_EXPIRED';
  if (status === 409)                   return 'SESSION_CANCELLED';
  if (status === 422 || status === 400) return 'VALIDATION_ERROR';
  return 'SERVER_ERROR';
}

async function parseErrorBody(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return (body as { message?: string }).message ?? response.statusText;
  } catch {
    return response.statusText || `Error HTTP ${response.status}`;
  }
}

function requireApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new ApiError(
      0,
      'VITE_API_BASE_URL no está configurado. Para desarrollo sin Backend, activa VITE_USE_MOCK_API=true.',
      'SERVER_ERROR'
    );
  }
  return API_BASE_URL;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = requireApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, options);
  } catch {
    throw new ApiError(
      0,
      'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
      'NETWORK_ERROR'
    );
  }
  if (!response.ok) {
    const message = await parseErrorBody(response);
    throw new ApiError(response.status, message, resolveErrorCode(response.status));
  }
  return response.json() as Promise<T>;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Intercambia el credential de Google por un token JWT propio de AIRSTARK.
 *
 * Flujo:
 *   1. Envía el credential de Google al Backend (POST /api/v1/auth/login).
 *   2. El Backend verifica el credential criptográficamente con google-auth-library.
 *   3. El Backend devuelve { token: <AIRSTARK JWT>, user: { id, email, name, picture } }.
 *   4. Se almacenan el token AIRSTARK y el usuario en sessionStorage.
 *   5. Las siguientes peticiones usarán el token AIRSTARK, no el de Google.
 *
 * En modo mock: simula la respuesta sin llamar al Backend.
 * El JWT de Google provisional se usa como token de mock (no para producción).
 *
 * @param googleCredential  JWT de Google recibido de Google Identity Services.
 * @param googleUserHint    Datos del usuario decodificados localmente (para mock de UI).
 * @returns AuthResponse con el token AIRSTARK y el usuario autenticado.
 * @throws {ApiError} si el credential es inválido o el Backend rechaza la petición.
 */
export async function loginWithGoogle(
  googleCredential: string,
  googleUserHint?: { sub: string; name: string; email: string; picture: string; given_name: string }
): Promise<AuthResponse> {
  if (USE_MOCK_API) {
    if (import.meta.env.DEV) {
      console.warn(
        '[AIRSTARK] ⚠️ Auth en MODO MOCK (VITE_USE_MOCK_API=true)\n' +
        'Se usa el JWT de Google como token provisional.\n' +
        'En producción, el Backend emitirá su propio token AIRSTARK.'
      );
    }
    const mockUser: AuthenticatedUser = {
      id: googleUserHint?.sub ?? 'mock-user-id',
      email: googleUserHint?.email ?? 'mock@airstark.dev',
      name: googleUserHint?.name ?? 'Usuario Mock',
      picture: googleUserHint?.picture ?? '',
      given_name: googleUserHint?.given_name ?? 'Mock',
    };
    const mockResponse: AuthResponse = {
      token: googleCredential, // Provisional: se usa el JWT de Google en mock
      user: mockUser,
    };
    storeMockSession(
      { sub: mockUser.id, name: mockUser.name, email: mockUser.email, picture: mockUser.picture, given_name: mockUser.given_name ?? '' },
      googleCredential
    );
    return mockResponse;
  }

  const authResponse = await apiFetch<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: googleCredential }),
  });

  // Almacenar el token AIRSTARK para todas las peticiones siguientes
  storeAirStarkSession(authResponse.token, authResponse.user);
  return authResponse;
}

/**
 * Crea una sesión de evaluación en el Backend.
 *
 * Flujo:
 *   1. Verifica que haya un token AIRSTARK activo.
 *   2. Transforma EvaluationDraft → CreateSessionRequest via mapper.
 *   3. POST /api/v1/sessions con Authorization: Bearer <AIRSTARK token>.
 *   4. Devuelve { sessionId, status, expiresAt }.
 *
 * El sessionId es generado EXCLUSIVAMENTE por el Backend.
 * En modo mock, se genera localmente SOLO para validar la UI.
 *
 * @throws {ApiError} si no autenticado, red falla o Backend responde error.
 */
export async function createEvaluationSession(
  draft: EvaluationDraft
): Promise<CreateSessionResponse> {
  const token = getStoredToken();
  if (!token) {
    throw new ApiError(401, 'Sesión no autenticada. Por favor, inicia sesión nuevamente.', 'UNAUTHORIZED');
  }

  const payload = mapDraftToCreateSessionRequest(draft);

  if (USE_MOCK_API) {
    if (import.meta.env.DEV) {
      console.warn(
        '[AIRSTARK] ⚠️ Sesión en MODO MOCK (VITE_USE_MOCK_API=true)\n' +
        'El sessionId generado NO es una sesión real del Backend.\n' +
        'Unity NO puede recuperar datos con este ID.\n' +
        'Configura VITE_API_BASE_URL y VITE_USE_MOCK_API=false para producción.'
      );
    }
    return simulateMockSessionResponse();
  }

  return apiFetch<CreateSessionResponse>('/api/v1/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

// ── PENDIENTES — Conectar cuando el Backend confirme los endpoints ─────────────
//
// export async function getSession(sessionId: string): Promise<SessionInfoForAR> {
//   // GET /api/v1/sessions/{sessionId}
//   // Consumido por Unity; documentado en API_CONTRACT.md
// }
//
// export async function getStatistics(sessionId: string): Promise<unknown> {
//   // GET /api/v1/sessions/{sessionId}/statistics
//   // Requiere token AIRSTARK + verificación teacher_id == authenticated_user.id
// }
//
// export async function endSession(sessionId: string): Promise<void> {
//   // POST /api/v1/sessions/{sessionId}/end
//   // Propuesto para Fase 2 — ver API_CONTRACT.md §Propuestos
// }

// ── Mock interno ──────────────────────────────────────────────────────────────

function simulateMockSessionResponse(): Promise<CreateSessionResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockSessionId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : '00000000-0000-0000-0000-000000000000';

      const expires = new Date();
      expires.setHours(expires.getHours() + 2);

      resolve({
        sessionId: mockSessionId,
        status: 'waiting',
        expiresAt: expires.toISOString(),
      });
    }, 1500);
  });
}
