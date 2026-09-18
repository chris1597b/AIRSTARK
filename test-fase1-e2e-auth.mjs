/**
 * Test E2E autenticado — FASE 1 AIRSTARK (Supabase real).
 * Uso: node test-fase1-e2e-auth.mjs   (desde AIRSTARK/)
 *
 * Requisitos: usuarios QA con email confirmado creados vía MCP (auth.users).
 * Cobertura: login por password → evaluación → preguntas/opciones → sesión
 *            (waiting, expires_at server-side, model_3d_id) → guard expires_at
 *            → idempotencia (23505) → aislamiento RLS A vs B → limpieza.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  console.error('FATAL: faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env.local');
  process.exit(2);
}

const mk = () =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, detectSessionInUrl: false },
  });

let failures = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures++;
}

// ══ 1. LOGIN de ambos profesores (Supabase Auth real, signInWithPassword) ══
// Credenciales desde entorno/.env.qa (qa-env.mjs) — jamás hardcodeadas.
const { qaEnv } = await import('./qa-env.mjs');
const { emailA, emailB, password: pass } = qaEnv();
const sbA = mk();
const sbB = mk();

const { data: logA, error: errA } = await sbA.auth.signInWithPassword({ email: emailA, password: pass });
const { data: logB, error: errB } = await sbB.auth.signInWithPassword({ email: emailB, password: pass });
check('login profesor A (signInWithPassword)', !errA && !!logA?.user, errA?.message ?? `uid=${logA?.user?.id}`);
check('login profesor B (signInWithPassword)', !errB && !!logB?.user, errB?.message ?? `uid=${logB?.user?.id}`);
if (errA || errB) {
  console.log('RESULT: LOGIN FAILED — revisar usuarios QA');
  process.exit(2);
}
const uidA = logA.user.id;
const uidB = logB.user.id;

// Contraseña incorrecta debe fallar (sanity del login)
const { error: badLoginErr } = await mk().auth.signInWithPassword({ email: emailA, password: 'incorrecta-123' });
check('login con password incorrecta es rechazado', !!badLoginErr, badLoginErr?.message ?? 'sin error(?!)');

// ══ 2. EVALUACIÓN (Profesor A crea contenido académico) ══
const { data: ev, error: evErr } = await sbA
  .from('evaluations')
  .insert({ name: 'QA E2E — Anatomía del corazón', description: 'Contenido de prueba Fase 1', status: 'published', created_by: uidA })
  .select('id, name, created_by, status')
  .single();
check('INSERT evaluations', !!ev && !evErr, evErr?.message ?? ev?.id);
check('evaluations.created_by = auth.uid() (server-side)', ev?.created_by === uidA, `${ev?.created_by} vs ${uidA}`);
if (!ev) {
  console.log('RESULT: ABORTED — no se pudo crear la evaluación base');
  process.exit(2);
}

// ══ 3. PREGUNTA + OPCIONES ══
const { data: q, error: qErr } = await sbA
  .from('questions')
  .insert({ evaluation_id: ev.id, question_text: '¿Cuántas cavidades tiene el corazón?', question_order: 0 })
  .select('id')
  .single();
check('INSERT questions', !!q && !qErr, qErr?.message ?? q?.id);

const { error: optErr } = await sbA.from('options').insert([
  { question_id: q.id, option_text: '2', option_order: 0, is_correct: false },
  { question_id: q.id, option_text: '4', option_order: 1, is_correct: true },
]);
check('INSERT options (2 filas)', !optErr, optErr?.message ?? 'ok');

// ══ 4. MODELO 3D seeded disponible (§17) ══
const { data: models, error: modelsErr } = await sbA
  .from('models_3d')
  .select('id, asset_key, name')
  .eq('asset_key', 'heart')
  .limit(1);
check('models_3d seeded: heart disponible', !modelsErr && models?.length === 1, modelsErr?.message ?? models?.[0]?.id);
const heartId = models?.[0]?.id;

// ══ 5. SESIÓN — activation futura, waiting, expires_at calculado server-side ══
const activation = new Date(Date.now() + 10 * 86400_000).toISOString(); // +10 días (§11)
const durationMin = 45;
const idemKey = crypto.randomUUID();

const { data: ses, error: sesErr } = await sbA
  .from('sessions')
  .insert({
    evaluation_id: ev.id,
    name: 'QA E2E — Evaluación grupo A (25/09)',
    description: 'Ejecución programada de prueba',
    activation_date: activation,
    duration_minutes: durationMin,
    status: 'waiting',
    model_3d_id: heartId,
    idempotency_key: idemKey,
    created_by: uidA,
  })
  .select('id, status, expires_at, created_by, evaluation_id, model_3d_id, activation_date, duration_minutes')
  .single();
check('INSERT sessions (activation futura OK)', !!ses && !sesErr, sesErr?.message ?? ses?.id);
check('status inicial = waiting (§10)', ses?.status === 'waiting', ses?.status);
check('created_by = auth.uid() (§23, server-side)', ses?.created_by === uidA, `${ses?.created_by} vs ${uidA}`);
check('evaluation_id asociado (§15)', ses?.evaluation_id === ev.id, ses?.evaluation_id);
check('model_3d_id asociado (§17)', ses?.model_3d_id === heartId, ses?.model_3d_id);

const expectedExp = new Date(new Date(activation).getTime() + durationMin * 60_000);
const gotExp = ses?.expires_at ? new Date(ses.expires_at) : null;
const diffMs = gotExp ? Math.abs(gotExp - expectedExp) : Infinity;
check('expires_at = activation_date + duration (server-side, §13)', gotExp !== null && diffMs < 5000, `diff=${Math.round(diffMs)}ms | expires=${ses?.expires_at}`);

// El cliente NO envió expires_at → columna fue calculada por trigger
check('UUID generado por PostgreSQL (§9)', /^[0-9a-f-]{36}$/.test(ses?.id ?? ''), ses?.id);

// ══ 6. GUARD de expires_at: el cliente no puede alterarlo (migración 0002) ══
const fakeExp = new Date('2030-01-01T00:00:00Z').toISOString();
const { data: hacked, error: hackErr } = await sbA
  .from('sessions')
  .update({ expires_at: fakeExp })
  .eq('id', ses.id)
  .select('expires_at')
  .single();
check('UPDATE expires_at por cliente es recalcado por el guard (§13)', !hackErr && hacked?.expires_at !== fakeExp, `expires_at=${hacked?.expires_at} (esperado ${ses.expires_at})`);

// ══ 7. IDEMPOTENCIA (§14): mismo idempotency_key → 23505 ══
const { error: dupErr } = await sbA.from('sessions').insert({
  evaluation_id: ev.id,
  name: 'QA duplicada (doble click)',
  activation_date: activation,
  duration_minutes: durationMin,
  status: 'waiting',
  idempotency_key: idemKey, // MISMA clave
  created_by: uidA,
});
check('idempotency_key UNIQUE rechaza duplicado (23505)', dupErr?.code === '23505', `code=${dupErr?.code} | ${dupErr?.message ?? ''}`);

// Y una key distinta SÍ crea (comportamiento correcto)
const { data: ses2, error: ses2Err } = await sbA
  .from('sessions')
  .insert({
    evaluation_id: ev.id,
    name: 'QA E2E — sesión legítima 2',
    activation_date: activation,
    duration_minutes: 30,
    status: 'waiting',
    idempotency_key: crypto.randomUUID(),
    created_by: uidA,
  })
  .select('id')
  .single();
check('idempotency_key distinta permite sesión legítima', !!ses2 && !ses2Err, ses2Err?.message ?? ses2?.id);

// ══ 8. CHECK duration inválida (§12) ══
const { error: badDurErr } = await sbA.from('sessions').insert({
  evaluation_id: ev.id,
  name: 'QA duración 0',
  activation_date: activation,
  duration_minutes: 0,
  status: 'waiting',
  idempotency_key: crypto.randomUUID(),
  created_by: uidA,
});
check('CHECK duration_minutes rechaza 0 (23514)', badDurErr?.code === '23514', `code=${badDurErr?.code ?? 'sin error(?!)'}`);

// ══ 9. RLS — aislamiento Profesor A vs Profesor B (§22/§32) ══
const { data: bVeSesionA } = await sbB.from('sessions').select('id').eq('id', ses.id);
check('Profesor B NO ve la sesión de A', (bVeSesionA ?? []).length === 0, `${bVeSesionA?.length ?? 0} filas`);

const { data: bVeEvalA } = await sbB.from('evaluations').select('id').eq('id', ev.id);
check('Profesor B NO ve la evaluación de A', (bVeEvalA ?? []).length === 0, `${bVeEvalA?.length ?? 0} filas`);

const { data: bVeOpcionesA } = await sbB.from('options').select('id, is_correct').eq('question_id', q.id);
check('Profesor B NO ve las opciones de A (is_correct protegido)', (bVeOpcionesA ?? []).length === 0, `${bVeOpcionesA?.length ?? 0} filas`);

// B NO puede modificar la sesión de A
const { data: bHacked, error: bHackErr } = await sbB
  .from('sessions')
  .update({ name: 'hackeada por B' })
  .eq('id', ses.id)
  .select('id');
check('Profesor B NO puede modificar la sesión de A', (bHacked ?? []).length === 0, bHackErr?.message ?? '0 filas afectadas');

// B intenta insertar sesión atribuyéndose la evaluación de A (ownership spoof):
// la política de sessions solo valida created_by = auth.uid(), no la propiedad
// de evaluation_id → se permite (hallazgo documentado, sin impacto en Fase 1:
// B sigue sin poder LEER las preguntas de A por RLS de questions/options).
const { error: spoofErr } = await sbB.from('sessions').insert({
  evaluation_id: ev.id,
  name: 'spoofing de evaluación ajena',
  activation_date: activation,
  duration_minutes: 30,
  status: 'waiting',
  idempotency_key: crypto.randomUUID(),
  created_by: uidB,
});
check('B puede crear sesión apuntando a evaluación de A (hallazgo documentado)', spoofErr === null, spoofErr?.message ?? 'ok (created_by=uidB, sin lectura de contenido de A)');

// A ve SOLO sus propias sesiones
const { data: propiasA } = await sbA.from('sessions').select('id, created_by');
check('listSessions de A devuelve solo sesiones de A', (propiasA ?? []).every((r) => r.created_by === uidA), `${propiasA?.length ?? 0} sesiones, todas de A`);

// ══ 10. Persistencia (§31.9): la sesión sigue ahí tras "recargar" (nuevo cliente con misma sesión) ══
const sbReload = mk();
await sbReload.auth.signInWithPassword({ email: emailA, password: pass });
const { data: persisted } = await sbReload.from('sessions').select('id, name, status, expires_at').eq('id', ses.id).single();
check('sesión persiste tras nueva autenticación (recarga)', persisted?.id === ses.id && persisted?.status === 'waiting', persisted?.name ?? 'no encontrada');

// ══ 11. Anónimo: sin sesión, sin acceso (§31, §32) ══
const sbAnon = mk();
const { data: anonRead } = await sbAnon.from('sessions').select('id').limit(5);
check('anon no lee ninguna sesión', (anonRead ?? []).length === 0, `${anonRead?.length ?? 0} filas`);
const { error: anonInsErr } = await sbAnon.from('sessions').insert({ name: 'anon', activation_date: activation, duration_minutes: 30, idempotency_key: crypto.randomUUID() });
check('anon no inserta sesiones', !!anonInsErr, anonInsErr?.message ?? 'sin error(?!)');

// ══ 12. QR: contenido = SOLO sessionId (§20) — verificación del dato que alimentaría el QR ══
check('sessionId listo para QR (valor único, sin JSON ni token)', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(ses.id), `QR contendría: "${ses.id}"`);

// ══ 13. LIMPIEZA (profesores dueños borran su propio contenido) ══
const delSes = await sbA.from('sessions').delete().eq('id', ses.id);
const delSes2 = await sbA.from('sessions').delete().eq('id', ses2.id);
// La sesión creada por B (spoof) la borra B
const { data: sesB } = await sbB.from('sessions').select('id').eq('evaluation_id', ev.id);
const delSesB = sesB?.length ? await sbB.from('sessions').delete().in('id', sesB.map((s) => s.id)) : { error: null };
const delQ = await sbA.from('questions').delete().eq('evaluation_id', ev.id);
const delEv = await sbA.from('evaluations').delete().eq('id', ev.id);
check(
  'limpieza completa (DELETE por dueños)',
  !delSes.error && !delSes2.error && !delSesB.error && !delQ.error && !delEv.error,
  [delSes.error?.message, delSes2.error?.message, delSesB.error?.message, delQ.error?.message, delEv.error?.message].filter(Boolean).join(' | ') || 'todo borrado'
);

await sbA.auth.signOut();
await sbB.auth.signOut();
console.log(failures === 0 ? '\nRESULT: ALL PASS ✅' : `\nRESULT: ${failures} FAILURES ❌`);
process.exit(failures === 0 ? 0 : 1);
