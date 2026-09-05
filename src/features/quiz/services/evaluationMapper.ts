import { EvaluationDraft, CreateSessionRequest } from '../types/evaluation.ts';

/**
 * Transforma el borrador del frontend (EvaluationDraft) 
 * en el formato requerido por la API (CreateSessionRequest).
 * 
 * NOTA: Por requerimiento, el payload JSON utiliza camelCase a menos 
 * que el Backend especifique lo contrario.
 */
export function mapDraftToCreateSessionRequest(draft: EvaluationDraft): CreateSessionRequest {
  return {
    evaluation: {
      title: draft.nombre,
      description: draft.descripcion,
      durationMinutes: draft.duracionMinutos,
      activationDate: draft.fechaActivacion,
      modelAssetId: draft.modeloSeleccionado,
      questions: draft.preguntas.map((q) => ({
        prompt: q.prompt,
        options: q.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          isCorrect: opt.isCorrect,
        })),
      })),
    }
  };
}
