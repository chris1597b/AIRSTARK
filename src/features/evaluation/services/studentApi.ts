/**
 * features/evaluation/services/studentApi.ts
 * Cliente web de la API de estudiantes (Fase 2) — Supabase como transporte.
 *
 * ENDPOINTS LÓGICOS (contrato §57, shapes estables para migrar a NestJS):
 *   get-session  → RPC student_get_session   (pública, sin isCorrect)
 *   connect      → RPC student_connect       (emite studentToken opaco)
 *   answers      → RPC student_answer        (valida y puntúa server-side)
 *
 * SOBRE DE RESPUESTA: las RPCs devuelven { ok, data } o
 * { ok:false, error, message, statusCode } con los códigos cerrados del
 * contrato (§8.4/§10). Las futuras Edge Functions mapean el sobre a HTTP real
 * sin que Unity tenga que cambiar.
 *
 * SEGURIDAD:
 *   - Sin login: usa la anon key (las RPCs son la única vía; sin SELECT directo).
 *   - El studentToken solo vive en memoria del llamador; nunca se loguea.
 */

import { supabase } from '../../../services/supabaseClient.ts';

// ── Códigos de error cerrados (§10 + SESSION_NOT_STARTED documentada) ────────

export type StudentApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_CANCELLED'
  | 'SESSION_COMPLETED'
  | 'SESSION_EXPIRED'
  | 'SESSION_NOT_STARTED'
  | 'SESSION_FULL'
  | 'ALREADY_ANSWERED'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR';

export class StudentApiError extends Error {
  public readonly code: StudentApiErrorCode;
  public readonly statusCode: number;
  constructor(code: StudentApiErrorCode, message: string, statusCode = 0) {
    super(message);
    this.name = 'StudentApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ── Tipos públicos (lo que Unity/Web reciben; SIN isCorrect) ─────────────────

export interface PublicOption {
  id: string;
  text: string;
}

export interface PublicQuestion {
  id: string;
  text: string;
  options: PublicOption[];
}

export interface PublicEvaluation {
  id: string;
  name: string;
  questions: PublicQuestion[];
}

export interface PublicModel3D {
  id: string | null;
  name: string | null;
  assetUrl: string | null;
}

export interface PublicSession {
  sessionId: string;
  name: string;
  description: string | null;
  activationDate: string;
  durationMinutes: number;
  expiresAt: string | null;
  status: string;
  /** false si aún no llega activationDate: mostrar resumen pero no iniciar. */
  canStart: boolean;
  model3D: PublicModel3D;
  evaluation: PublicEvaluation;
}

export interface ConnectResult {
  studentId: string;
  /** Token opaco (NO JWT). Viaja una sola vez; el servidor guarda solo su hash. */
  studentToken: string;
  sessionId: string;
  status: string;
  joinedAt: string;
}

export interface AnswerResult {
  accepted: boolean;
  answered: number;
  totalQuestions: number;
  completed: boolean;
  /** Solo al completar. null durante la evaluación (§29). */
  score: number | null;
  status: string;
}

// ── Núcleo RPC ───────────────────────────────────────────────────────────────

interface RpcEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: StudentApiErrorCode;
  message?: string;
  statusCode?: number;
}

async function callStudentRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  let res: { data: RpcEnvelope<T> | null; error: any };
  try {
    res = await supabase.rpc(fn, args);
  } catch {
    throw new StudentApiError(
      'NETWORK_ERROR',
      'No se pudo conectar con AIRSTARK. Verifica tu conexión.',
      0
    );
  }
  if (res.error) {
    // Error de transporte/PostgREST (p. ej. función inexistente si la
    // migración 0005 aún no se aplicó): no es un sobre de negocio.
    console.error(`[AIRSTARK] Error RPC ${fn}:`, res.error);
    throw new StudentApiError(
      'SERVER_ERROR',
      'Error temporal del servidor.',
      500
    );
  }
  const raw = res.data;
  if (!raw || raw.ok !== true || !raw.data) {
    throw new StudentApiError(
      raw?.error ?? 'SERVER_ERROR',
      raw?.message ?? 'Error temporal del servidor.',
      raw?.statusCode ?? 500
    );
  }
  return raw.data;
}

// ── API pública ──────────────────────────────────────────────────────────────

/** GET session: resumen público para iniciar. Sin auth. Sin isCorrect. */
export async function getPublicSession(sessionId: string): Promise<PublicSession> {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new StudentApiError('VALIDATION_ERROR', 'Identificador de sesión no válido.', 400);
  }
  return callStudentRpc<PublicSession>('student_get_session', { p_session_id: sessionId });
}

/** CONNECT: registra/rotan estudiante y devuelve su token (una sola vez). */
export async function connectStudent(input: {
  sessionId: string;
  studentName: string;
  deviceId: string;
}): Promise<ConnectResult> {
  return callStudentRpc<ConnectResult>('student_connect', {
    p_session_id: input.sessionId,
    p_student_name: input.studentName,
    p_device_id: input.deviceId,
  });
}

/** ANSWERS: envía una respuesta autenticada por studentToken. */
export async function submitAnswer(input: {
  studentToken: string;
  sessionId: string;
  questionId: string;
  optionId: string;
}): Promise<AnswerResult> {
  return callStudentRpc<AnswerResult>('student_answer', {
    p_student_token: input.studentToken,
    p_session_id: input.sessionId,
    p_question_id: input.questionId,
    p_option_id: input.optionId,
  });
}

/**
 * deviceId para MVP web/debug: UUID de instalación persistido localmente.
 * Unity usa su propio equivalente (PlayerPrefs). No es secreto ni identidad.
 */
const DEVICE_KEY = 'airstark_device_id';

export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `web-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return `web-ephemeral-${Date.now()}`;
  }
}

/** Mensajes de usuario por código (para UI web y referencia Unity §39). */
export function studentErrorMessage(code: StudentApiErrorCode): string {
  switch (code) {
    case 'UNAUTHORIZED': return 'Tu sesión de estudiante ya no es válida.';
    case 'SESSION_NOT_FOUND': return 'Sesión no encontrada.';
    case 'SESSION_CANCELLED': return 'Esta sesión fue cancelada.';
    case 'SESSION_COMPLETED': return 'La sesión ya fue finalizada.';
    case 'SESSION_EXPIRED': return 'La evaluación ya expiró.';
    case 'SESSION_NOT_STARTED': return 'La sesión aún no está activa. Espera la hora indicada.';
    case 'SESSION_FULL': return 'La sesión alcanzó el máximo de estudiantes.';
    case 'ALREADY_ANSWERED': return 'Esta pregunta ya fue registrada.';
    case 'VALIDATION_ERROR': return 'Datos no válidos. Revisa e inténtalo de nuevo.';
    case 'RATE_LIMITED': return 'Demasiadas solicitudes. Intenta nuevamente.';
    case 'NETWORK_ERROR': return 'No se pudo conectar con AIRSTARK.';
    default: return 'Error temporal del servidor.';
  }
}
