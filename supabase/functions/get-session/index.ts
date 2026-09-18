// supabase/functions/get-session/index.ts
// ≈ GET /sessions/{sessionId} — resumen público para Unity. Sin auth.
// Despliegue: supabase functions deploy get-session
// Uso: GET /functions/v1/get-session?sessionId=<uuid>

import { serviceClient, jsonResponse } from '../_shared/student-api.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'VALIDATION_ERROR', message: 'Método no permitido.', statusCode: 400 });
  }
  const sessionId = new URL(req.url).searchParams.get('sessionId') ?? '';
  const sb = serviceClient();
  const { data, error } = await sb.rpc('student_get_session', { p_session_id: sessionId });
  if (error) {
    console.error('[get-session] RPC error (sin token):', error.code);
    return jsonResponse({ ok: false, error: 'SERVER_ERROR', message: 'Error temporal del servidor.', statusCode: 500 });
  }
  return jsonResponse(data);
});
