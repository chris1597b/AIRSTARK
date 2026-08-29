/**
 * Tipos centralizados para la evaluación y la sesión (Fase 1)
 */

// ==========================================
// 1. ESTADO INTERNO DEL FRONTEND
// ==========================================

export interface EvaluationOption {
  id: string;
  text: string;
  isCorrect: boolean;
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
  fechaActivacion: string;
  duracionMinutos: number;
  modeloSeleccionado: string;
  preguntas: EvaluationQuestion[];
}

// ==========================================
// 2. CONTRATO API (REQUESTS Y RESPONSES)
// ==========================================
// Las propiedades JSON utilizan camelCase según requerimiento, salvo acuerdo con el Backend.

export type SessionStatus = 
  | 'created' 
  | 'waiting' 
  | 'connected' 
  | 'active' 
  | 'completed' 
  | 'expired' 
  | 'cancelled';

export interface CreateSessionRequest {
  // En Fase 1 esto puede consolidar la creación de evaluación y sesión.
  // Idealmente, el endpoint POST /api/v1/sessions solo tomaría evaluationId.
  evaluation: {
    title: string;
    description: string;
    durationMinutes: number;
    activationDate: string;
    modelAssetId: string;
    questions: Array<{
      prompt: string;
      options: Array<{
        id: string;
        text: string;
        isCorrect: boolean;
      }>;
    }>;
  };
}

export interface CreateSessionResponse {
  sessionId: string;
  status: SessionStatus;
  expiresAt: string; // ISO-8601 date string
}
