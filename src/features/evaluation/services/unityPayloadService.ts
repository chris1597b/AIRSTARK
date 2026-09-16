/**
 * features/evaluation/services/unityPayloadService.ts
 * Lectura del payload de sesión para la app Unity — Supabase como fuente.
 *
 * FLUJO UNITY:
 *   1. Escanea el QR → obtiene EXCLUSIVAMENTE el `sessionId` (UUID).
 *   2. Llama a `getUnitySessionPayload(sessionId)` (una sola petición RPC).
 *   3. Recibe Session + SessionConfig + QuizConfig + ARConfig + Questions,
 *      con la MISMA forma que los JSON de referencia
 *      (sessions.json / configs_sess_heart_01.json / questions_sess_heart_01.json).
 *
 * SEGURIDAD:
 *   - No requiere login (los estudiantes no tienen cuenta en Fase 1/2-inicio).
 *   - El UUID inaudivinable actúa como capability: la RPC solo devuelve LA
 *     sesión pedida; no hay SELECT directo ni forma de enumerar sesiones.
 *   - Incluye `CorrectOptionIndex` (enmienda al spec §8.4) porque Unity da
 *     feedback inmediato en el dispositivo.
 */

import { supabase } from '../../../services/supabaseClient.ts';
import { SessionServiceError } from './sessionService.ts';

// ── Tipos (claves PascalCase = forma exacta que consume Unity) ───────────────

export interface UnityObjective {
  Id: string;
  Description: string;
  IsOptional: boolean;
}

export interface UnitySessionInfo {
  Id: string;
  Name: string;
  Description: string | null;
  Teacher: string;
  ModelAssetId: string;
  ModelAssetUrl: string | null;
  DurationMinutes: number;
  Objectives: UnityObjective[];
  CreatedAt: string;
  Version: string;
  AllowOffline: boolean;
}

export interface UnitySessionConfig {
  SessionId: string;
  AccentColorHex: string;
  RequiredAccuracyPercentage: number;
  EnableCertificateGeneration: boolean;
}

export interface UnityQuizConfig {
  TimeLimitSeconds: number;
  AllowBacktrack: boolean;
  ShuffleQuestions: boolean;
  EnableImmediateFeedback: boolean;
}

export interface UnityARConfig {
  DetectionMode: string;
  InitialModelScale: number;
  EnableDepthSensing: boolean;
  ShowPlaneMarkers: boolean;
}

export interface UnityQuestion {
  QuestionId: string;
  Text: string;
  Options: string[];
  /** Índice 0-based de la opción correcta en `Options`. -1 si no hay. */
  CorrectOptionIndex: number;
  FeedbackText: string;
  TargetInteractiveElementId: string | null;
  /** JSON serializado como texto (igual que en questions_*.json). */
  ARPlacementDataJson: string;
}

export interface UnitySessionPayload {
  SessionId: string;
  Status: string;
  ExpiresAt: string | null;
  Session: UnitySessionInfo;
  SessionConfig: UnitySessionConfig;
  QuizConfig: UnityQuizConfig;
  ARConfig: UnityARConfig;
  Questions: UnityQuestion[];
}

// ── Lectura ──────────────────────────────────────────────────────────────────

/**
 * Obtiene el payload completo de una sesión para Unity.
 * Funciona SIN login (RPC otorgada a `anon`); el `sessionId` es la llave.
 *
 * @throws SessionServiceError `SESSION_NOT_FOUND` si el ID no existe.
 */
export async function getUnitySessionPayload(sessionId: string): Promise<UnitySessionPayload> {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new SessionServiceError('Identificador de sesión no válido.', 'VALIDATION_ERROR');
  }

  const { data, error } = await supabase.rpc('get_unity_session_payload', {
    p_session_id: sessionId,
  });

  if (error) {
    console.error('[AIRSTARK] Error al obtener payload Unity:', error);
    throw new SessionServiceError(
      'No se pudo cargar la sesión. Verifica tu conexión.',
      'GET_ERROR'
    );
  }

  if (!data) {
    throw new SessionServiceError(
      'La sesión no existe o ya no está disponible.',
      'SESSION_NOT_FOUND'
    );
  }

  return data as UnitySessionPayload;
}
