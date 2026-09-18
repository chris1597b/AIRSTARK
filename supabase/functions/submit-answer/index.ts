// supabase/functions/submit-answer/index.ts
// ≈ POST /sessions/{sessionId}/answers — respuesta autenticada por studentToken.
// Despliegue: supabase functions deploy submit-answer
// Auth: Authorization: Bearer <studentToken> (también acepta studentToken en body)
// Body: { "sessionId": "<uuid>", "questionId": "<uuid>", "optionId": "<uuid>" }

import { serviceClient, jsonResponse, readBearer, readJson } from '../_shared/student-api.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'VALIDATION_ERROR', message: 'Método no permitido.', statusCode: 400 });
  }
  const body = await readJson(req);
  const token = readBearer(req) ?? (body['studentToken'] as string | undefined) ?? null;
  if (!token) {
    return jsonResponse({ ok: false, error: 'UNAUTHORIZED', message: 'Tu sesión de estudiante ya no es válida.', statusCode: 401 });
  }
  const sb = serviceClient();
  const { data, error } = await sb.rpc('student_answer', {
    p_student_token: token,
    p_session_id: body['sessionId'] ?? null,
    p_question_id: body['questionId'] ?? null,
    p_option_id: body['optionId'] ?? null,
  });
  if (error) {
    console.error('[submit-answer] RPC error (sin token):', error.code);
    return jsonResponse({ ok: false, error: 'SERVER_ERROR', message: 'Error temporal del servidor.', statusCode: 500 });
  }
  return jsonResponse(data);
});
