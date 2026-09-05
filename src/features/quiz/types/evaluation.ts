/**
 * types/evaluation.ts
 * Tipos centralizados del sistema AIRSTARK — Frontend.
 *
 * SEPARACIÓN DE RESPONSABILIDADES:
 *   EvaluationDraft             → Estado interno del componente React (UI, español)
 *   CreateSessionRequest        → Contrato Frontend → Backend (camelCase)
 *   CreateSessionResponse       → Contrato Backend → Frontend
 *   AuthenticatedUser           → Usuario autenticado a través del Backend AIRSTARK
 *   AuthResponse                → Respuesta del POST /api/v1/auth/login
 *   SessionInfoForAR            → Contrato Backend → Unity (sin isCorrect)
 *   ApiErrorCode / ApiErrorResponse → Errores HTTP tipados
 *
 * REGLA:
 *   El mapper en services/evaluationMapper.ts es el ÚNICO punto de transformación
 *   entre EvaluationDraft y CreateSessionRequest.
 *   Los componentes React NUNCA construyen JSON de API directamente.
 */

// ==========================================
// 1. AUTENTICACIÓN
// ==========================================

/**
 * Usuario autenticado devuelto por el Backend AIRSTARK.
 * Proviene de POST /api/v1/auth/login.
 * NO es el usuario decodificado del JWT de Google.
 */
export interface AuthenticatedUser {
  id: string;       // UUID interno del Backend AIRSTARK
  email: string;
  name: string;
  picture: string;
  given_name?: string; // Puede no estar si el Backend no lo incluye
}

/**
 * Respuesta completa de POST /api/v1/auth/login.
 * El Frontend almacena el token AIRSTARK para todas las peticiones protegidas.
 * El JWT de Google solo se usa en el request de login; luego se descarta.
 */
export interface AuthResponse {
  token: string;          // JWT propio de AIRSTARK — usar en Authorization: Bearer
  user: AuthenticatedUser;
}

// ==========================================
// 2. ESTADO INTERNO DEL FRONTEND (UI)
// ==========================================

export interface EvaluationOption {
  id: string;
  text: string;
  isCorrect: boolean; // Solo existe en el estado interno del Frontend y en el payload al Backend
}

export interface EvaluationQuestion {
  id: string;
  prompt: string;
  options: EvaluationOption[];
}

export interface EvaluationDraft {
  nombre: string;
  descripcion: string;
  estado: 'ACTIVA' | 'DESACTIVA';
  fechaActivacion: string; // ISO date string 'YYYY-MM-DD'
  duracionMinutos: number;
  modeloSeleccionado: string; // 'heart' | 'brain' | 'lungs' | 'kidneys'
  preguntas: EvaluationQuestion[];
}

// ==========================================
// 3. CONTRATO API — FRONTEND → BACKEND
// ==========================================
// Generado por services/evaluationMapper.ts, nunca construido manualmente en componentes.
// Propiedades en camelCase.

export interface CreateSessionOptionPayload {
  id: string;
  text: string;
  isCorrect: boolean; // El Backend lo almacena en Options.is_correct. NUNCA lo devuelve a Unity.
}

export interface CreateSessionQuestionPayload {
  prompt: string;
  options: CreateSessionOptionPayload[];
}

export interface CreateSessionEvaluationPayload {
  title: string;
  description: string;
  durationMinutes: number;
  activationDate: string; // ISO date 'YYYY-MM-DD'
  modelAssetId: string;
  questions: CreateSessionQuestionPayload[];
}

/**
 * Body del POST /api/v1/sessions
 * Fase 1: consolida creación de Evaluation + Session en un solo request.
 * Fase 2: se separará en POST /api/v1/evaluations + POST /api/v1/sessions.
 */
export interface CreateSessionRequest {
  evaluation: CreateSessionEvaluationPayload;
}

// ==========================================
// 4. CONTRATO API — BACKEND → FRONTEND
// ==========================================

export type SessionStatus =
  | 'waiting'    // Sesión creada, esperando conexión AR
  | 'active'     // Al menos un estudiante conectado
  | 'completed'  // Evaluación finalizada
  | 'expired'    // Tiempo agotado
  | 'cancelled'; // Cancelada manualmente

/**
 * Respuesta del POST /api/v1/sessions.
 * El sessionId es generado EXCLUSIVAMENTE por el Backend.
 * En modo mock, se genera localmente SOLO para validar la UI (no es una sesión real).
 * El Frontend usa sessionId únicamente para renderizar el QR.
 */
export interface CreateSessionResponse {
  sessionId: string;     // UUIDv4, fuente de verdad: Backend
  status: SessionStatus;
  expiresAt: string;     // ISO-8601 — el Backend es quien controla este valor
}

// ==========================================
// 5. ERRORES DE API
// ==========================================

export type ApiErrorCode =
  | 'UNAUTHORIZED'         // 401 — token ausente o inválido
  | 'FORBIDDEN'            // 403 — autenticado pero sin permiso (ej. profesor no dueño de sesión)
  | 'SESSION_NOT_FOUND'    // 404 — sesión no existe
  | 'SESSION_EXPIRED'      // 410 — sesión expirada
  | 'SESSION_CANCELLED'    // 409 — sesión cancelada o completada
  | 'ALREADY_ANSWERED'     // 409 — respuesta duplicada (uso Unity)
  | 'VALIDATION_ERROR'     // 400 / 422
  | 'SERVER_ERROR'         // 500
  | 'NETWORK_ERROR';       // Sin conexión

/**
 * Formato canónico de error que el Backend debe devolver.
 * El Frontend lo interpreta para mostrar mensajes entendibles al usuario.
 * Ejemplo: { "error": "SESSION_EXPIRED", "message": "La sesión ha expirado.", "statusCode": 410 }
 */
export interface ApiErrorResponse {
  error: ApiErrorCode;
  message: string;
  statusCode: number;
}

// ==========================================
// 6. ENTIDADES DE SESIÓN EN TIEMPO REAL
// ==========================================

/**
 * Estado de un estudiante dentro de una sesión.
 * Recibido vía WebSocket desde el Backend.
 */
export interface Student {
  studentId: string;
  studentName: string;
  status: 'connected' | 'in_progress' | 'completed' | 'disconnected';
  score: number;
  answered: number;
  totalQuestions: number;
}

/**
 * Respuesta de un estudiante a una pregunta.
 * Enviado por Unity al Backend; el Frontend lo ve reflejado en estadísticas.
 */
export interface StudentAnswer {
  studentId: string;
  questionId: string;
  optionId: string;
  // is_correct: AUSENTE en Frontend y Unity — el Backend lo calcula internamente
}

// ==========================================
// 7. EVENTOS WEBSOCKET — RECIBIDOS POR EL FRONTEND
// ==========================================

export interface WsStudentConnectedPayload {
  studentId: string;
  studentName: string;
  joinedAt: string;
}

export interface WsStudentAnsweredPayload {
  studentId: string;
  questionId: string;
  progress: number; // 0–100, porcentaje respondido
}

export interface WsStudentCompletedPayload {
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
}

export interface WsSessionEndedPayload {
  sessionId: string;
  status: SessionStatus;
}

/**
 * Snapshot inicial que el Backend envía al Frontend al unirse a la room de WebSocket.
 * Permite reconstruir el estado aunque el profesor se haya desconectado y vuelto.
 */
export interface WsSessionStatePayload {
  sessionId: string;
  status: SessionStatus;
  students: Student[];
}

export type WsEventPayload =
  | { event: 'session_state';      data: WsSessionStatePayload }
  | { event: 'student_connected';  data: WsStudentConnectedPayload }
  | { event: 'student_answered';   data: WsStudentAnsweredPayload }
  | { event: 'student_completed';  data: WsStudentCompletedPayload }
  | { event: 'session_ended';      data: WsSessionEndedPayload };

// ==========================================
// 8. INFORMACIÓN DE SESIÓN PARA UNITY/AR
// ==========================================
// NOTA: Estos tipos documentan el contrato que Unity recibe del Backend.
// El Frontend NO construye ni consume este formato.
// El campo `isCorrect` está AUSENTE intencionalmente en todos los tipos de esta sección.

export interface SessionOptionForAR {
  id: string;
  text: string;
  // isCorrect: AUSENTE INTENCIONALMENTE
}

export interface SessionQuestionForAR {
  id: string;
  prompt: string;
  order: number;  // Orden de presentación definido por el Backend. Unity debe respetar este orden.
  options: SessionOptionForAR[];
}

export interface SessionEvaluationForAR {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  modelAssetId: string;
  questions: SessionQuestionForAR[];
}

/**
 * Respuesta del GET /api/v1/sessions/{sessionId} consumido por Unity.
 * Documentado aquí para referencia del equipo. El Frontend no lo usa directamente.
 */
export interface SessionInfoForAR {
  sessionId: string;
  status: SessionStatus;
  expiresAt: string;
  evaluation: SessionEvaluationForAR;
}
