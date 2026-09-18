// supabase/functions/connect-student/index.ts
// ≈ POST /sessions/{sessionId}/connect — registra/rota estudiante.
// Despliegue: supabase functions deploy connect-student
// Body: { "sessionId": "<uuid>", "studentName": "...", "deviceId": "..." }

import { serviceClient, jsonResponse, readJson } from '../_shared/student-api.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'VALIDATION_ERROR', message: 'Método no permitido.', statusCode: 400 });
  }
  const body = await readJson(req);
  const sb = serviceClient();
  // Solo se reenvían los 3 campos del contrato; cualquier extra (score,
  // isCorrect, role…) se descarta aquí mismo.
  const { data, error } = await sb.rpc('student_connect', {
    p_session_id: body['sessionId'] ?? null,
    p_student_name: body['studentName'] ?? null,
    p_device_id: body['deviceId'] ?? null,
  });
  if (error) {
    console.error('[connect-student] RPC error (sin token):', error.code);
    return jsonResponse({ ok: false, error: 'SERVER_ERROR', message: 'Error temporal del servidor.', statusCode: 500 });
  }
  // El studentToken original viaja SOLO en esta respuesta; jamás se loguea.
  return jsonResponse(data);
});
