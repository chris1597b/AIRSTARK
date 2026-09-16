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
  /**
   * Evaluación existente del profesor que se reutiliza para esta sesión.
   * Si se omite, se crea una evaluación nueva con las preguntas del draft.
   * RLS garantiza que solo se puedan reutilizar evaluaciones propias.
   */
  existingEvaluationId?: string | null;
  /**
   * QA/UX: callback de progreso por etapas (para mostrar qué hace la app
   * mientras guarda en Supabase). Solo informativo; no afecta el contrato.
   */
  onProgress?: (stage: CreateSessionStage) => void;
}

/** Etapas observables de `createSession` (orden de ejecución). */
export type CreateSessionStage = 'auth' | 'evaluation' | 'questions' | 'session';

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

async function requireAuthenticatedUser(): Promise<{ id: string; displayName: string }> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new SessionServiceError(
      'Debes iniciar sesión para realizar esta operación.',
      'UNAUTHORIZED'
    );
  }
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  return {
    id: user.id,
    // Nombre visible para el payload Unity (sessions.teacher_name).
    displayName: str(meta['full_name']) ?? str(meta['given_name']) ?? str(user.email) ?? 'Profesor',
  };
}

// ── Función principal: crear sesión ─────────────────────────────────────────

// ── Helper: error de columna inexistente (migración aún no aplicada en vivo) ──

function isMissingColumnError(err: any, column: string): boolean {
  const msg = String(err?.message ?? '');
  return (
    err?.code === 'PGRST204' ||
    err?.code === '42703' ||
    (msg.includes(column) && /schema cache|does not exist/i.test(msg))
  );
}

/**
 * Crea una sesión de evaluación completa en Supabase.
 *
 * @param draft     Datos del formulario del profesor
 * @param options   Opciones incluyendo idempotencyKey
 * @returns         { sessionId, status, expiresAt }
 * @throws          SessionServiceError si falla la validación o la inserción
 */
// ── Validación de entrada (el servidor re-valida vía CHECKs; esto da error claro) ─

function validateDraft(draft: EvaluationDraft, existingEvaluationId?: string | null): void {
  if (!draft.nombre || !draft.nombre.trim()) {
    throw new SessionServiceError('Ponle un nombre a la sesión antes de crearla.', 'VALIDATION_ERROR');
  }
  if (!draft.fechaActivacion || Number.isNaN(Date.parse(draft.fechaActivacion))) {
    throw new SessionServiceError('La fecha de activación no es válida.', 'VALIDATION_ERROR');
  }
  // Una fecha futura NO impide crear la sesión (status = waiting). Sin restricción aquí.
  if (!Number.isInteger(draft.duracionMinutos) || draft.duracionMinutos < 1 || draft.duracionMinutos > 480) {
    throw new SessionServiceError(
      'La duración debe ser un número entero entre 1 y 480 minutos.',
      'VALIDATION_ERROR'
    );
  }
  // Al reutilizar un cuestionario existente no se necesitan preguntas del borrador.
  if (!existingEvaluationId) {
    if (!draft.preguntas || draft.preguntas.length === 0) {
      throw new SessionServiceError('Agrega al menos una pregunta al cuestionario.', 'VALIDATION_ERROR');
    }
    for (let i = 0; i < draft.preguntas.length; i++) {
      const q = draft.preguntas[i];
      if (!q.prompt || !q.prompt.trim()) {
        throw new SessionServiceError(`La pregunta ${i + 1} no tiene texto.`, 'VALIDATION_ERROR');
      }
      if (!q.options || q.options.length === 0 || q.options.some((o) => !o.text || !o.text.trim())) {
        throw new SessionServiceError(
          `Todas las opciones de la pregunta ${i + 1} deben tener texto.`,
          'VALIDATION_ERROR'
        );
      }
      if (!q.options.some((o) => o.isCorrect)) {
        throw new SessionServiceError(
          `La pregunta ${i + 1} debe tener al menos una opción correcta.`,
          'VALIDATION_ERROR'
        );
      }
    }
  }
}

export async function createSession(
  draft: EvaluationDraft,
  options: CreateSessionOptions
): Promise<CreateSessionResponse> {
  if (!options?.idempotencyKey || typeof options.idempotencyKey !== 'string') {
    throw new SessionServiceError('Falta la clave de idempotencia de la operación.', 'VALIDATION_ERROR');
  }
  const userPromise = requireAuthenticatedUser();
  validateDraft(draft, options.existingEvaluationId ?? null);
  const notify = options.onProgress ?? (() => {});

  // ── Paso 0: Idempotencia temprana ──────────────────────────────────────────
  // Si esta operación lógica ya creó una sesión (doble-click / retry / timeout),
  // devolverla SIN crear otra evaluación ni otras preguntas huérfanas.
  // La verificación de usuario y la búsqueda corren EN PARALELO (1 RTT).
  const [authUser, { data: already }] = await Promise.all([
    userPromise,
    supabase
      .from('sessions')
      .select('id, status, expires_at')
      .eq('idempotency_key', options.idempotencyKey)
      .maybeSingle(),
  ]);
  const userId = authUser.id;
  notify('auth');
  if (already) {
    console.info('[AIRSTARK] Sesión ya existente (idempotencia temprana):', already.id);
    return {
      sessionId: already.id,
      status: already.status as SessionStatus,
      expiresAt: already.expires_at ?? new Date().toISOString(),
    };
  }

  // ── Paso 1: Resolver evaluación (reutilizar existente o crear una nueva) ────
  // Evaluation = contenido académico; Session = ejecución programada.
  // Reutilizar una evaluación existente evita duplicar el cuestionario en DB.
  //
  // RENDIMIENTO: la resolución del modelo 3D es independiente de la evaluación,
  // así que se lanza EN PARALELO y se espera junto con el insert (1 RTT).
  const model3dPromise: Promise<string | null> = (async () => {
    if (!draft.modeloSeleccionado) return null;
    const { data: modelData } = await supabase
      .from('models_3d')
      .select('id')
      .eq('asset_key', draft.modeloSeleccionado)
      .maybeSingle();
    return modelData?.id ?? null;
  })();

  let evaluationId: string;
  let model3dId: string | null = null;
  notify('evaluation');

  if (options.existingEvaluationId) {
    const [{ data: existing, error: existingError }, resolvedModel] = await Promise.all([
      supabase
        .from('evaluations')
        .select('id')
        .eq('id', options.existingEvaluationId)
        .single(),
      model3dPromise,
    ]);

    // RLS garantiza que solo se resuelvan evaluaciones propias: si la fila no
    // es del dueño, PostgREST devuelve PGRST116 (0 filas), no un 403 explícito.
    if (existingError || !existing) {
      throw new SessionServiceError(
        'La evaluación seleccionada no existe o no te pertenece.',
        'EVALUATION_NOT_FOUND'
      );
    }
    evaluationId = existing.id;
    model3dId = resolvedModel;
  } else {
    const [evalResult, resolvedModel] = await Promise.all([
      supabase
        .from('evaluations')
        .insert({
          name: draft.nombre,
          description: draft.descripcion || null,
          created_by: userId,
          status: 'published',
        })
        .select('id')
        .single(),
      model3dPromise,
    ]);

    if (evalResult.error || !evalResult.data) {
      console.error('[AIRSTARK] Error al crear evaluación:', evalResult.error);
      throw new SessionServiceError(
        'No se pudo crear la evaluación. Verifica tu conexión.',
        'EVALUATION_CREATE_ERROR'
      );
    }
    evaluationId = evalResult.data.id;
    model3dId = resolvedModel;
  }

  // ── Paso 2: Insertar preguntas y opciones (SOLO al crear evaluación nueva) ───
  // Al reutilizar una evaluación existente NO se insertan las preguntas del
  // borrador: hacerlo duplicaría el cuestionario en cada sesión creada.
  // RENDIMIENTO: las preguntas son independientes entre sí → se insertan EN
  // PARALELO (cada una con sus opciones en secuencia). Para 1 pregunta el
  // coste es 2 RTT en vez de 2×N en serie.
  if (!options.existingEvaluationId) {
    notify('questions');
    await Promise.all(
      draft.preguntas.map(async (pregunta, qIndex) => {
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

        // Insertar opciones de esta pregunta
        const optionsToInsert = pregunta.options.map((opt, oIndex) => ({
          question_id: questionData.id,
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
      })
    );
  }

  // ── Paso 3: model_3d_id (ya resuelto en paralelo en el Paso 1) ───────────────
  // Sin consulta adicional: se reutiliza el valor obtenido junto con la
  // evaluación para no sumar otro viaje de ida y vuelta a Supabase.

  // ── Paso 4: Insertar sesión ────────────────────────────────────────────────
  // activation_date: combinar fecha con hora de inicio del día si solo hay fecha
  notify('session');
  const activationDate = draft.fechaActivacion.includes('T')
    ? draft.fechaActivacion
    : `${draft.fechaActivacion}T00:00:00.000Z`;

  const sessionPayload: Record<string, unknown> = {
    evaluation_id: evaluationId,
    name: draft.nombre,
    description: draft.descripcion || null,
    activation_date: activationDate,
    duration_minutes: draft.duracionMinutos,
    status: 'waiting',          // Siempre empieza en waiting según el contrato
    model_3d_id: model3dId,
    created_by: userId,          // Derivado de auth.uid(), nunca del formulario
    teacher_name: authUser.displayName, // Nombre visible (payload Unity)
    idempotency_key: options.idempotencyKey,
  };

  let sessionData: { id: string; status: SessionStatus; expires_at: string | null } | null = null;
  let sessionError: any = null;
  {
    const first = await supabase
      .from('sessions')
      .insert(sessionPayload)
      .select('id, status, expires_at')
      .single();
    sessionData = first.data as typeof sessionData;
    sessionError = first.error;
    // Compatibilidad: si la migración 0003 aún no se aplicó en vivo, la columna
    // teacher_name no existe → reintentar UNA vez sin ella (el Teacher del
    // payload Unity usa entonces el fallback de auth.users en la RPC).
    if (sessionError && isMissingColumnError(sessionError, 'teacher_name')) {
      console.warn('[AIRSTARK] teacher_name no existe en vivo; reintentando sin la columna (aplica la migración 0003).');
      delete sessionPayload.teacher_name;
      const retry = await supabase
        .from('sessions')
        .insert(sessionPayload)
        .select('id, status, expires_at')
        .single();
      sessionData = retry.data as typeof sessionData;
      sessionError = retry.error;
    }
  }

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
    // Traducir errores técnicos de PostgreSQL/RLS a mensajes comprensibles (§29).
    if (sessionError.code === '42501') {
      throw new SessionServiceError(
        'No tienes permisos para crear esta sesión. Inicia sesión de nuevo.',
        'FORBIDDEN'
      );
    }
    if (sessionError.code === '23514') {
      throw new SessionServiceError(
        'Los datos de la sesión no son válidos. Revisa la duración y el estado.',
        'VALIDATION_ERROR'
      );
    }
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

// ── Listar evaluaciones (cuestionarios) del profesor ─────────────────────────

export interface EvaluationListItem {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

/**
 * Lista las evaluaciones (cuestionarios) del profesor autenticado.
 * RLS garantiza que solo ve SUS evaluaciones.
 * Se usa para que el profesor pueda reutilizar un cuestionario existente
 * al crear una sesión, en lugar de duplicarlo.
 */
export async function listEvaluations(): Promise<EvaluationListItem[]> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('id, name, description, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[AIRSTARK] Error al listar evaluaciones:', error);
    throw new SessionServiceError('No se pudieron cargar las evaluaciones.', 'LIST_ERROR');
  }

  return data ?? [];
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
