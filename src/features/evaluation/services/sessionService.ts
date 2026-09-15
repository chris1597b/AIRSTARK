/**
 * features/evaluation/services/sessionService.ts
 * Servicio de sesiones de evaluación — Supabase como fuente de verdad.
 *
 * RESPONSABILIDAD:
 *   - Crear sesiones en Supabase (con idempotencia)
 *   - Listar sesiones del profesor autenticado
 *   - Obtener una sesión específica
 *
 * CONTRATO:
 *   - sessionId = sessions.id (UUID generado por PostgreSQL, NUNCA por el frontend)
 *   - created_by = auth.uid() (Supabase Auth, NUNCA enviado desde el formulario)
 *   - idempotency_key UNIQUE previene sesiones duplicadas por doble-click
 *   - expires_at calculado automáticamente por trigger en PostgreSQL
 *
 * FLUJO:
 *   1. Verificar usuario autenticado (auth.uid())
 *   2. Insertar evaluación en `evaluations`
 *   3. Insertar preguntas en `questions`
 *   4. Insertar opciones en `options`
 *   5. Insertar sesión en `sessions` con idempotency_key
 *   6. Retornar { sessionId, status, expiresAt }
 *
 * IDEMPOTENCIA:
 *   - El idempotency_key debe generarse ANTES del primer intento
 *   - Reutilizar el mismo key en reintentos de la MISMA operación lógica
 *   - Supabase devuelve error 23505 (unique_violation) si se duplica
 *   - El servicio lo intercepta y devuelve la sesión existente
 *
 * SEGURIDAD:
 *   - RLS activo: el usuario solo puede ver/editar SUS sesiones
 *   - created_by se deriva de auth.uid() en las políticas, nunca del cliente
 *   - is_correct se almacena pero no se expondrá a Unity en Fase 2
 */

import { supabase } from '../../../services/supabaseClient.ts';
import type { EvaluationDraft } from '../../quiz/types/evaluation.ts';
import type { CreateSessionResponse, SessionStatus } from '../../quiz/types/evaluation.ts';

// ── Tipos locales ────────────────────────────────────────────────────────────

export interface SessionListItem {
  id: string;
  name: string;
  description: string | null;
  activation_date: string;
  duration_minutes: number;
  status: SessionStatus;
  model_3d_id: string | null;
  model_name?: string;
  evaluation_id: string | null;
  evaluation_name?: string;
  created_at: string;
  expires_at: string | null;
}

export interface CreateSessionOptions {
  /** UUID generado por el frontend para esta operación lógica. REUTILIZAR en reintentos. */
  idempotencyKey: string;
}

// ── Error tipado ─────────────────────────────────────────────────────────────

export class SessionServiceError extends Error {
  public readonly code: string;
  constructor(message: string, code = 'SESSION_SERVICE_ERROR') {
    super(message);
    this.name = 'SessionServiceError';
    this.code = code;
  }
}

// ── Helper: verificar usuario autenticado ────────────────────────────────────

async function requireAuthenticatedUser(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new SessionServiceError(
      'Debes iniciar sesión para realizar esta operación.',
      'UNAUTHORIZED'
    );
  }
  return user.id;
}

// ── Función principal: crear sesión ─────────────────────────────────────────

/**
 * Crea una sesión de evaluación completa en Supabase.
 *
 * @param draft     Datos del formulario del profesor
 * @param options   Opciones incluyendo idempotencyKey
 * @returns         { sessionId, status, expiresAt }
 * @throws          SessionServiceError si falla la validación o la inserción
 */
export async function createSession(
  draft: EvaluationDraft,
  options: CreateSessionOptions
): Promise<CreateSessionResponse> {
  const userId = await requireAuthenticatedUser();

  // ── Paso 1: Insertar evaluación ────────────────────────────────────────────
  const { data: evaluationData, error: evalError } = await supabase
    .from('evaluations')
    .insert({
      name: draft.nombre,
      description: draft.descripcion || null,
      created_by: userId,
      status: 'published',
    })
    .select('id')
    .single();

  if (evalError || !evaluationData) {
    console.error('[AIRSTARK] Error al crear evaluación:', evalError);
    throw new SessionServiceError(
      'No se pudo crear la evaluación. Verifica tu conexión.',
      'EVALUATION_CREATE_ERROR'
    );
  }

  const evaluationId = evaluationData.id;

  // ── Paso 2: Insertar preguntas y opciones ──────────────────────────────────
  for (let qIndex = 0; qIndex < draft.preguntas.length; qIndex++) {
    const pregunta = draft.preguntas[qIndex];

    const { data: questionData, error: questionError } = await supabase
      .from('questions')
      .insert({
        evaluation_id: evaluationId,
        question_text: pregunta.prompt,
        question_order: qIndex,
      })
      .select('id')
      .single();

    if (questionError || !questionData) {
      console.error('[AIRSTARK] Error al crear pregunta:', questionError);
      throw new SessionServiceError(
        `No se pudo crear la pregunta ${qIndex + 1}.`,
        'QUESTION_CREATE_ERROR'
      );
    }

    const questionId = questionData.id;

    // Insertar opciones de esta pregunta
    const optionsToInsert = pregunta.options.map((opt, oIndex) => ({
      question_id: questionId,
      option_text: opt.text,
      option_order: oIndex,
      is_correct: opt.isCorrect,  // Se almacena en DB; NUNCA se expondrá a Unity
    }));

    const { error: optionsError } = await supabase
      .from('options')
      .insert(optionsToInsert);

    if (optionsError) {
      console.error('[AIRSTARK] Error al crear opciones:', optionsError);
      throw new SessionServiceError(
        `No se pudieron crear las opciones de la pregunta ${qIndex + 1}.`,
        'OPTIONS_CREATE_ERROR'
      );
    }
  }

  // ── Paso 3: Resolver model_3d_id ────────────────────────────────────────────
  let model3dId: string | null = null;

  if (draft.modeloSeleccionado) {
    const { data: modelData } = await supabase
      .from('models_3d')
      .select('id')
      .eq('asset_key', draft.modeloSeleccionado)
      .single();

    model3dId = modelData?.id ?? null;
  }

  // ── Paso 4: Insertar sesión ────────────────────────────────────────────────
  // activation_date: combinar fecha con hora de inicio del día si solo hay fecha
  const activationDate = draft.fechaActivacion.includes('T')
    ? draft.fechaActivacion
    : `${draft.fechaActivacion}T00:00:00.000Z`;

  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      evaluation_id: evaluationId,
      name: draft.nombre,
      description: draft.descripcion || null,
      activation_date: activationDate,
      duration_minutes: draft.duracionMinutos,
      status: 'waiting',          // Siempre empieza en waiting según el contrato
      model_3d_id: model3dId,
      created_by: userId,          // Derivado de auth.uid(), nunca del formulario
      idempotency_key: options.idempotencyKey,
    })
    .select('id, status, expires_at')
    .single();

  // ── Idempotencia: si ya existe una sesión con este key, devolver la existente ──
  if (sessionError) {
    // Código PostgreSQL 23505 = unique_violation (idempotency_key duplicado)
    if (sessionError.code === '23505') {
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('id, status, expires_at')
        .eq('idempotency_key', options.idempotencyKey)
        .single();

      if (existingSession) {
        console.info('[AIRSTARK] Sesión ya existente (idempotencia):', existingSession.id);
        return {
          sessionId: existingSession.id,
          status: existingSession.status as SessionStatus,
          expiresAt: existingSession.expires_at ?? new Date().toISOString(),
        };
      }
    }

    console.error('[AIRSTARK] Error al crear sesión:', sessionError);
    throw new SessionServiceError(
      'No se pudo crear la sesión de evaluación.',
      'SESSION_CREATE_ERROR'
    );
  }

  if (!sessionData) {
    throw new SessionServiceError('La sesión no devolvió datos.', 'SESSION_CREATE_ERROR');
  }

  return {
    sessionId: sessionData.id,
    status: sessionData.status as SessionStatus,
    expiresAt: sessionData.expires_at ?? new Date().toISOString(),
  };
}

// ── Listar sesiones del profesor ─────────────────────────────────────────────

/**
 * Lista todas las sesiones del profesor autenticado.
 * RLS garantiza que solo ve SUS sesiones.
 */
export async function listSessions(): Promise<SessionListItem[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id,
      name,
      description,
      activation_date,
      duration_minutes,
      status,
      model_3d_id,
      evaluation_id,
      created_at,
      expires_at,
      models_3d ( name )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[AIRSTARK] Error al listar sesiones:', error);
    throw new SessionServiceError('No se pudieron cargar las sesiones.', 'LIST_ERROR');
  }

  return (data ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    activation_date: s.activation_date,
    duration_minutes: s.duration_minutes,
    status: s.status as SessionStatus,
    model_3d_id: s.model_3d_id,
    model_name: s.models_3d?.name ?? null,
    evaluation_id: s.evaluation_id,
    created_at: s.created_at,
    expires_at: s.expires_at,
  }));
}

// ── Obtener sesión por ID ────────────────────────────────────────────────────

/**
 * Obtiene una sesión específica por su ID (sessionId).
 * RLS garantiza que solo el dueño puede verla.
 */
export async function getSession(sessionId: string): Promise<SessionListItem | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id,
      name,
      description,
      activation_date,
      duration_minutes,
      status,
      model_3d_id,
      evaluation_id,
      created_at,
      expires_at,
      models_3d ( name )
    `)
    .eq('id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // no rows
    console.error('[AIRSTARK] Error al obtener sesión:', error);
    throw new SessionServiceError('No se pudo obtener la sesión.', 'GET_ERROR');
  }

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    description: (data as any).description,
    activation_date: data.activation_date,
    duration_minutes: data.duration_minutes,
    status: data.status as SessionStatus,
    model_3d_id: data.model_3d_id,
    model_name: (data as any).models_3d?.name ?? null,
    evaluation_id: data.evaluation_id,
    created_at: data.created_at,
    expires_at: data.expires_at,
  };
}

// ── Listar modelos 3D disponibles ────────────────────────────────────────────

export interface Model3DItem {
  id: string;
  name: string;
  asset_key: string;
  description: string | null;
}

export async function listModels3D(): Promise<Model3DItem[]> {
  const { data, error } = await supabase
    .from('models_3d')
    .select('id, name, asset_key, description')
    .order('name');

  if (error) {
    console.error('[AIRSTARK] Error al listar modelos 3D:', error);
    return [];
  }

  return data ?? [];
}
