// supabase/functions/_shared/student-api.ts
// Helpers compartidos de las Edge Functions de estudiantes (Fase 2).
//
// La autoridad real vive en las RPCs de PostgreSQL (migración 0005):
//   student_get_session / student_connect / student_answer.
// Estas funciones solo: validan transporte, invocan la RPC con la service_role
// (SOLO server-side, jamás en cliente) y mapean el sobre {ok,error,...} a HTTP
// real según el contrato. Unity no cambia cuando migremos a NestJS.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type StudentErrorCode =
  | 'UNAUTHORIZED' | 'FORBIDDEN' | 'SESSION_NOT_FOUND' | 'SESSION_CANCELLED'
  | 'SESSION_COMPLETED' | 'SESSION_EXPIRED' | 'SESSION_NOT_STARTED' | 'SESSION_FULL'
  | 'ALREADY_ANSWERED' | 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'NETWORK_ERROR'
  | 'SERVER_ERROR';

export interface RpcEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: StudentErrorCode;
  message?: string;
  statusCode?: number;
}

export function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function jsonResponse(envelope: RpcEnvelope<unknown>): Response {
  const status = envelope.ok ? 200 : (envelope.statusCode ?? 500);
  return new Response(JSON.stringify(envelope.ok ? envelope.data : envelope), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // §8.4: nada sensible debe cachearse.
      'Cache-Control': 'no-store',
    },
  });
}

export function readBearer(req: Request): string | null {
  const h = req.headers.get('Authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice('Bearer '.length).trim() || null;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
