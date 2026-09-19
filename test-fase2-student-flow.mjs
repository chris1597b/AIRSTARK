/**
 * Test E2E — FASE 2 AIRSTARK (flujo estudiante Unity, sin Unity).
 * Uso: node test-fase2-student-flow.mjs   (desde AIRSTARK/)
 *
 * Simula EXACTAMENTE lo que hará la app Unity vía PostgREST RPC:
 *   get-session → connect (2 devices) → rotación → answers → score →
 *   dashboard del profesor. Incluye pruebas de seguridad §§50-54.
 *
 * Requisitos: migración 0005 aplicada en vivo + usuarios QA de Fase 1.
 * Si 0005 falta, las RPCs devuelven error y el script lo reporta como tal.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const anon = () =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, detectSessionInUrl: false },
  });

let failures = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures++;
}

async function rpc(sb, fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  return { data, error };
}

// ══ 0. Precondición: RPCs Fase 2 existen ═══════════════════════════════════
{
  const { data, error } = await rpc(anon(), 'student_get_session', {
    p_session_id: '00000000-0000-0000-0000-000000000000',
  });
  check('RPC student_get_session existe (0005 aplicada)', !error && data?.ok === false && data?.error === 'SESSION_NOT_FOUND', error?.message ?? JSON.stringify(data));
  if (error || data?.error !== 'SESSION_NOT_FOUND') {
    console.log('RESULT: MIGRACIÓN 0005 NO APLICADA — aplica supabase/migrations/0005_phase2_student_flow.sql y reintenta');
    process.exit(3);
  }
}

// ══ 1. Profesor crea sesión (2 preguntas) vía RPC atómica ═══════════════════
// Credenciales desde entorno/.env.qa (qa-env.mjs) — jamás hardcodeadas.
const { qaEnv } = await import('./qa-env.mjs');
const { emailA: emailQaA, emailB: emailQaB, passwordA: passQaA, passwordB: passQaB } = qaEnv();
const sbProf = anon();
const { data: logA, error: errA } = await sbProf.auth.signInWithPassword({ email: emailQaA, password: passQaA });
check('login profesor QA', !errA && !!logA?.user, errA?.message ?? '');
if (errA) process.exit(2);

async function createSession({ name, activation, duration, modelKey = 'heart' }) {
  const { data, error } = await sbProf.rpc('create_session_atomic', {
    p_name: name,
    p_description: 'Sesión E2E Fase 2',
    p_activation_date: activation,
    p_duration_minutes: duration,
    p_model_key: modelKey,
    p_questions: [
      { prompt: 'Q1 E2E: ¿2+2?', options: [{ text: '4', isCorrect: true }, { text: '5', isCorrect: false }] },
      { prompt: 'Q2 E2E: ¿capital de Francia?', options: [{ text: 'Londres', isCorrect: false }, { text: 'París', isCorrect: true }] },
    ],
    p_idempotency_key: randomUUID(),
    p_existing_eval_id: null,
    p_teacher_name: 'QA Prof',
  });
  return { data, error };
}

const now = new Date();
const { data: sess, error: sessErr } = await createSession({
  name: 'E2E Fase 2 ' + Date.now(),
  activation: now.toISOString(),
  duration: 30,
});
check('profesor crea sesión (RPC atómica)', !sessErr && !!sess?.sessionId, sessErr?.message ?? sess?.sessionId ?? '');
const SID = sess.sessionId;
const sbAnon = anon();

// ══ 2. GET session público ══════════════════════════════════════════════════
const g1 = await rpc(sbAnon, 'student_get_session', { p_session_id: SID });
check('get-session ok', g1.data?.ok === true, JSON.stringify(g1.data ?? g1.error).slice(0, 120));
const payload = g1.data?.data;
const payloadStr = JSON.stringify(payload ?? {});
for (const forbidden of ['isCorrect', 'is_correct', 'teacher', 'studentToken', 'token_hash', 'score']) {
  check(`get-session NO expone "${forbidden}"`, !payloadStr.includes(`"${forbidden}"`), '');
}
check('get-session trae 2 preguntas con opciones', payload?.evaluation?.questions?.length === 2 && payload?.evaluation?.questions?.[0]?.options?.length === 2, '');
check('get-session canStart=true (activación actual)', payload?.canStart === true && payload?.status === 'active' || payload?.status === 'waiting', `status=${payload?.status}`);
const [Q1, Q2] = payload.evaluation.questions;
const Q1_OK = Q1.options[0].id, Q1_BAD = Q1.options[1].id;
const Q2_OK = Q2.options[1].id, Q2_BAD = Q2.options[0].id;

// ══ 3. Multi-estudiante: Juan + María, mismo sessionId ══════════════════════
const devA = randomUUID(), devB = randomUUID();
const cA = await rpc(sbAnon, 'student_connect', { p_session_id: SID, p_student_name: 'Juan E2E', p_device_id: devA });
const cB = await rpc(sbAnon, 'student_connect', { p_session_id: SID, p_student_name: 'María E2E', p_device_id: devB });
check('connect Juan', cA.data?.ok === true, JSON.stringify(cA.data ?? cA.error).slice(0, 120));
check('connect María', cB.data?.ok === true, '');
if (!cA.data?.ok || !cB.data?.ok) {
  console.log('RESULT: CONNECT FALLÓ — revisar salida y esquema vivo');
  process.exit(1);
}
const tokA1 = cA.data.data.studentToken, idA = cA.data.data.studentId;
const tokB = cB.data.data.studentToken, idB = cB.data.data.studentId;
check('studentId diferentes', idA !== idB, '');
check('tokens diferentes', tokA1 !== tokB, '');
check('token opaco hex-64 (NO JWT)', /^[0-9a-f]{64}$/.test(tokA1) && !tokA1.includes('.'), tokA1.slice(0, 16) + '…');

// NOTA: la prueba de ráfaga (rate limit) va al final (§7b) para no consumir
// el presupuesto de connects de esta sesión durante las pruebas de rotación.

// ══ 4. Rotación: reconexión mismo device → mismo id, token nuevo, anterior 401
const cA2 = await rpc(sbAnon, 'student_connect', { p_session_id: SID, p_student_name: 'Juan E2E', p_device_id: devA });
check('reconnect mismo studentId', cA2.data?.ok === true && cA2.data?.data?.studentId === idA, JSON.stringify(cA2.data));
if (!cA2.data?.ok) {
  console.log('RESULT: RECONNECT FALLÓ — revisar salida');
  process.exit(1);
}
const tokA2 = cA2.data.data.studentToken;
check('reconnect emite token nuevo', tokA2 !== tokA1, '');
const stale = await rpc(sbAnon, 'student_answer', { p_student_token: tokA1, p_session_id: SID, p_question_id: Q1.id, p_option_id: Q1_OK });
check('token anterior → 401', stale.data?.ok === false && stale.data?.error === 'UNAUTHORIZED', JSON.stringify(stale.data));

// ══ 5. Respuestas: cadena de validación + score server-side ═════════════════
const a1 = await rpc(sbAnon, 'student_answer', { p_student_token: tokA2, p_session_id: SID, p_question_id: Q1.id, p_option_id: Q1_OK });
check('Q1 correcta aceptada (sin score aún)', a1.data?.ok === true && a1.data.data.completed === false && a1.data.data.score === null, JSON.stringify(a1.data?.data));
check('respuesta NO devuelve isCorrect', !JSON.stringify(a1.data).includes('isCorrect') && !JSON.stringify(a1.data).includes('is_correct'), '');
const dup = await rpc(sbAnon, 'student_answer', { p_student_token: tokA2, p_session_id: SID, p_question_id: Q1.id, p_option_id: Q1_OK });
check('duplicada → 409 ALREADY_ANSWERED', dup.data?.ok === false && dup.data?.error === 'ALREADY_ANSWERED', '');
const cross = await rpc(sbAnon, 'student_answer', { p_student_token: tokA2, p_session_id: SID, p_question_id: Q1.id, p_option_id: Q2_OK });
check('cross-question (opción de otra pregunta) rechazada', cross.data?.ok === false, JSON.stringify(cross.data));
const a2 = await rpc(sbAnon, 'student_answer', { p_student_token: tokA2, p_session_id: SID, p_question_id: Q2.id, p_option_id: Q2_BAD });
check('Q2 incorrecta completa + score=1', a2.data?.ok === true && a2.data.data.completed === true && a2.data.data.score === 1, JSON.stringify(a2.data?.data));

// ══ 6. Cross-student: token de María contra otra sesión → 401 ═══════════════
const { data: sess2 } = await createSession({ name: 'E2E Fase 2 aux ' + Date.now(), activation: now.toISOString(), duration: 30 });
const SID2 = sess2.sessionId;
const xStudent = await rpc(sbAnon, 'student_answer', { p_student_token: tokB, p_session_id: SID2, p_question_id: Q1.id, p_option_id: Q1_OK });
check('token de otra sesión → 401', xStudent.data?.ok === false && xStudent.data?.error === 'UNAUTHORIZED', JSON.stringify(xStudent.data));

// ══ 7. Manipulación: score/isCorrect contrabandeados se ignoran ═════════════

// ══ 7c. Desconexión explícita: revoca token y marca disconnected ═══════════
// Va antes de la ráfaga (§7b) para no gastar el presupuesto de connects.
const devC = randomUUID();
const cC = await rpc(sbAnon, 'student_connect', { p_session_id: SID, p_student_name: 'Pedro E2E', p_device_id: devC });
check('connect Pedro', cC.data?.ok === true, JSON.stringify(cC.data ?? cC.error).slice(0, 100));
if (cC.data?.ok) {
  const tokC = cC.data.data.studentToken;
  const dc = await rpc(sbAnon, 'student_disconnect', { p_student_token: tokC });
  check('disconnect ok', dc.data?.ok === true && dc.data.data.disconnected === true, JSON.stringify(dc.data ?? dc.error).slice(0, 120));
  if (!dc.data?.ok) {
    console.log('RESULT: DISCONNECT FALLÓ (¿0005 con student_disconnect aplicada?)');
    process.exit(1);
  }
  const postDc = await rpc(sbAnon, 'student_answer', { p_student_token: tokC, p_session_id: SID, p_question_id: Q1.id, p_option_id: Q1_OK });
  check('token revocado → 401', postDc.data?.ok === false && postDc.data?.error === 'UNAUTHORIZED', '');
  const { data: pedro } = await sbProf.from('session_students').select('status').eq('session_id', SID).eq('student_name', 'Pedro E2E').single();
  check('Pedro marcado disconnected', pedro?.status === 'disconnected', pedro?.status ?? '');
}

// ══ 7b. Rate limiting: ráfaga de connects → 429 en alguno ══════════════════
// Va aquí (no antes) para no gastar el presupuesto de la sesión en pruebas previas.
let saw429 = false;
for (let i = 0; i < 62 && !saw429; i++) {
  const r = await rpc(sbAnon, 'student_connect', { p_session_id: SID, p_student_name: 'Spam ' + i, p_device_id: randomUUID() });
  if (r.data?.ok === false && r.data?.error === 'RATE_LIMITED') saw429 = true;
}
check('rate limit connect → 429 RATE_LIMITED', saw429, '');
const smuggle = await rpc(sbAnon, 'student_answer', { p_student_token: tokB, p_session_id: SID, p_question_id: Q1.id, p_option_id: Q1_BAD, p_extra_score: 999 });
check('campo score extra no rompe ni altera (ignorado o 400)', smuggle.data?.ok === true || !!smuggle.error, JSON.stringify(smuggle.data ?? smuggle.error).slice(0, 100));

// ══ 8. Sesión futura → NOT_STARTED; expirada → EXPIRED ═══════════════════════
const future = new Date(Date.now() + 3600e3).toISOString();
const { data: sessF } = await createSession({ name: 'E2E futura ' + Date.now(), activation: future, duration: 30 });
const SIDF = sessF.sessionId;
const gf = await rpc(sbAnon, 'student_get_session', { p_session_id: SIDF });
check('futura: canStart=false', gf.data?.ok === true && gf.data.data.canStart === false, '');
const cf = await rpc(sbAnon, 'student_connect', { p_session_id: SIDF, p_student_name: 'Tardío', p_device_id: randomUUID() });
check('futura: connect → 409 NOT_STARTED', cf.data?.ok === false && cf.data?.error === 'SESSION_NOT_STARTED', JSON.stringify(cf.data));
const past = new Date(Date.now() - 120000).toISOString();
const { data: sessX } = await createSession({ name: 'E2E expirada ' + Date.now(), activation: past, duration: 1 });
const SIDX = sessX.sessionId;
const gx = await rpc(sbAnon, 'student_get_session', { p_session_id: SIDX });
check('expirada: get → 410', gx.data?.ok === false && gx.data?.error === 'SESSION_EXPIRED', JSON.stringify(gx.data));
const cx = await rpc(sbAnon, 'student_connect', { p_session_id: SIDX, p_student_name: 'Tarde', p_device_id: randomUUID() });
check('expirada: connect → 410', cx.data?.ok === false && cx.data?.error === 'SESSION_EXPIRED', '');

// ══ 9. Dashboard profesor: resultados reales + aislamiento ═══════════════════
const { data: rows } = await sbProf.from('session_students').select('student_name,status,score,answered_count').eq('session_id', SID).order('joined_at');
const juan = (rows ?? []).find((r) => r.student_name === 'Juan E2E');
const maria = (rows ?? []).find((r) => r.student_name === 'María E2E');
check('dashboard ve a Juan completed score=1', juan?.status === 'completed' && juan?.score === 1 && juan?.answered_count === 2, JSON.stringify(juan));
check('dashboard ve a María conectada (sesión sigue activa)', maria && maria.status !== 'completed', JSON.stringify(maria));
check('sesión global sigue activa tras 1 completado', (await sbProf.from('sessions').select('status').eq('id', SID).single()).data?.status === 'active', '');
const sbProfB = anon();
await sbProfB.auth.signInWithPassword({ email: emailQaB, password: passQaB });
const { data: rowsB } = await sbProfB.from('session_students').select('id').eq('session_id', SID);
check('profesor B NO ve estudiantes de A', (rowsB ?? []).length === 0, `${(rowsB ?? []).length} filas`);

// ══ 10. Limpieza (dueños; cascada borra students/answers) ════════════════════
for (const id of [SID, SID2, SIDF, SIDX]) {
  await sbProf.from('sessions').delete().eq('id', id);
}
const { data: gone } = await sbProf.from('sessions').select('id').in('id', [SID, SID2, SIDF, SIDX]);
check('limpieza completa', (gone ?? []).length === 0, `${(gone ?? []).length} restantes`);

console.log(failures === 0 ? 'RESULT: ALL PASS ✅' : `RESULT: ${failures} FALLOS ❌`);
process.exit(failures === 0 ? 0 : 1);
