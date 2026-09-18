/**
 * features/evaluation/services/studentResultsService.ts
 * Resultados de estudiantes para el Dashboard del profesor (Fase 2).
 *
 * FUENTE: tablas session_students (+ conteo de preguntas), leídas con el JWT
 * del profesor. RLS garantiza que solo ve SUS sesiones. Sin mocks, sin
 * WebSockets en este MVP: la vista hace polling cada pocos segundos (§41) y
 * esta capa está lista para enchufar Realtime después sin cambiar la UI.
 */

import { supabase } from '../../../services/supabaseClient.ts';
import { SessionServiceError } from './sessionService.ts';

export type ProfessorStudentStatus = 'connected' | 'in_progress' | 'completed' | 'disconnected';

export interface SessionStudentResult {
  studentId: string;
  studentName: string;
  status: ProfessorStudentStatus;
  score: number;
  answered: number;
  totalQuestions: number;
  joinedAt: string;
  completedAt: string | null;
}

export interface SessionProgress {
  sessionId: string;
  sessionStatus: string;
  totalQuestions: number;
  students: SessionStudentResult[];
  connected: number;
  completed: number;
  inProgress: number;
  averageScore: number | null;
}

/**
 * Obtiene estudiantes + progreso de UNA sesión del profesor.
 * Lanza SessionServiceError si la sesión no existe o no le pertenece
 * (RLS la oculta → se reporta como no disponible).
 */
export async function getSessionProgress(sessionId: string): Promise<SessionProgress> {
  if (!sessionId) {
    throw new SessionServiceError('Identificador de sesión no válido.', 'VALIDATION_ERROR');
  }

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, status, evaluation_id')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new SessionServiceError(
      'La sesión no existe o ya no está disponible.',
      'SESSION_NOT_FOUND'
    );
  }

  const { data: students, error: studentsError } = await supabase
    .from('session_students')
    .select('id, student_name, status, score, answered_count, joined_at, completed_at')
    .eq('session_id', sessionId)
    .order('joined_at', { ascending: true });

  if (studentsError) {
    console.error('[AIRSTARK] Error al cargar estudiantes:', studentsError);
    throw new SessionServiceError('No se pudieron cargar los resultados.', 'LIST_ERROR');
  }

  let totalQuestions = 0;
  if (session.evaluation_id) {
    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('evaluation_id', session.evaluation_id);
    totalQuestions = count ?? 0;
  }

  const rows: SessionStudentResult[] = (students ?? []).map((s: any) => ({
    studentId: s.id,
    studentName: s.student_name,
    status: s.status as ProfessorStudentStatus,
    score: s.score ?? 0,
    answered: s.answered_count ?? 0,
    totalQuestions,
    joinedAt: s.joined_at,
    completedAt: s.completed_at ?? null,
  }));

  const completed = rows.filter((r) => r.status === 'completed');
  return {
    sessionId,
    sessionStatus: (session as any).status,
    totalQuestions,
    students: rows,
    connected: rows.length,
    completed: completed.length,
    inProgress: rows.filter((r) => r.status === 'in_progress').length,
    averageScore:
      completed.length > 0
        ? completed.reduce((acc, r) => acc + r.score, 0) / completed.length
        : null,
  };
}
