import { EvaluationDraft, CreateSessionResponse } from '../types/evaluation';
import { mapDraftToCreateSessionRequest } from './evaluationMapper';
import { getStoredToken } from './googleAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Crea una sesión de evaluación comunicándose con el Backend (o el Mock).
 * Inyecta automáticamente el token de autenticación del usuario.
 */
export async function createEvaluationSession(draft: EvaluationDraft): Promise<CreateSessionResponse> {
  const token = getStoredToken();
  if (!token) {
    throw new ApiError(401, 'Usuario no autenticado.');
  }

  const payload = mapDraftToCreateSessionRequest(draft);

  if (USE_MOCK_API) {
    console.warn('⚠️ Utilizando Mock API para crear sesión (VITE_USE_MOCK_API=true)');
    return simulateBackendResponse();
  }

  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL no está definido y Mock API está desactivado.');
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new ApiError(response.status, `Error al crear la sesión: ${response.statusText}`);
  }

  const data = await response.json();
  return data as CreateSessionResponse;
}

/**
 * Simula la respuesta del Backend para desarrollo local.
 */
function simulateBackendResponse(): Promise<CreateSessionResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simula un UUID v4
      const mockSessionId = crypto.randomUUID ? crypto.randomUUID() : '550e8400-e29b-41d4-a716-446655440000';
      
      // Expira en 2 horas
      const expires = new Date();
      expires.setHours(expires.getHours() + 2);
      
      resolve({
        sessionId: mockSessionId,
        status: 'waiting',
        expiresAt: expires.toISOString(),
      });
    }, 1500); // delay simulado
  });
}
