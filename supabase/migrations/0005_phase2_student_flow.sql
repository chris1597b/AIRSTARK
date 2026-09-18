-- ============================================================================
-- AIRSTARK — Fase 2: Flujo de estudiantes (Unity → sesión → respuestas → score)
--
-- NOTA DE NOMBRE: el contrato pedía `0002_phase2_student_flow.sql`, pero ese
-- nombre ya existe (guards de expires_at). Se usa 0005 para no colisionar.
--
-- ALCANCE:
--   - Tablas session_students y student_answers (+ token_hash).
--   - RLS: el profesor lee lo SUYO; Unity NO tiene acceso directo (solo RPCs).
--   - 3 RPCs SECURITY DEFINER = la API que consume Unity vía PostgREST:
--       student_get_session  (GET /sessions/{id} — pública, sin isCorrect)
--       student_connect      (POST connect — emite studentToken opaco)
--       student_answer       (POST answers — valida y puntúa server-side)
--   - Las futuras Edge Functions / NestJS reutilizan estos mismos contratos.
--
-- SEGURIDAD:
--   - studentToken: 32 bytes aleatorios (hex 64), NUNCA se almacena el original,
--     solo su SHA-256. Expira como máximo con la sesión. Rotable/revocable.
--   - Campos extra enviados por el cliente (score, isCorrect, role…) no existen
--     en las firmas: PostgREST los ignora. Imposible manipular puntaje.
--   - UNIQUE(session_id, device_id) y UNIQUE(session_student_id, question_id).
--
-- NO DESTRUCTIVA: solo CREATE TABLE / ADD POLICY / CREATE FUNCTION.
-- Requiere pgcrypto. En Supabase alojado la extensión vive en el schema
-- `extensions` (garantía de plataforma), por eso las funciones la califican
-- como `extensions.gen_random_bytes/digest` y NO como `public.*`.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ── Rate limiting a nivel de código (MVP) ────────────────────────────────────
-- Tabla solo-escritura interna: las RPCs registran cada intento por
-- (endpoint, ip) y rechazan con 429 al superar la ventana. Sin políticas RLS
-- de acceso directo: solo las funciones DEFINER la tocan. La IP sale de las
-- cabeceras PostgREST; si falta, se usa un bucket compartido 'unknown'.
create table if not exists public.student_rate_hits (
  endpoint text not null,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists student_rate_hits_endpoint_bucket_idx
  on public.student_rate_hits (endpoint, bucket, created_at);

alter table public.student_rate_hits enable row level security;

-- Devuelve true si el intento cabe en la ventana (y lo registra).
create or replace function public.student_check_rate(
  p_endpoint text,
  p_key text,
  p_max int,
  p_window_secs int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip text;
  v_bucket text;
  v_count int;
begin
  begin
    v_ip := split_part(
      coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json->>'x-forwarded-for',
      ',', 1);
  exception when others then
    v_ip := '';
  end;
  if v_ip is null or trim(v_ip) = '' then
    v_ip := 'unknown';
  else
    v_ip := trim(v_ip);
  end if;
  v_bucket := v_ip || '|' || coalesce(p_key, '-');

  delete from public.student_rate_hits
   where endpoint = p_endpoint
     and created_at < now() - make_interval(secs => p_window_secs);

  select count(*) into v_count
    from public.student_rate_hits
   where endpoint = p_endpoint and bucket = v_bucket;

  if v_count >= p_max then
    return false;
  end if;

  insert into public.student_rate_hits (endpoint, bucket)
  values (p_endpoint, v_bucket);
  return true;
end;
$$;

-- Solo uso interno (las RPCs la invocan como owner). Sin EXECUTE público:
-- invocarla directo solo permitiría ensuciar la tabla.
revoke all on function public.student_check_rate(text, text, int, int) from public;

-- ── Límite MVP de estudiantes por sesión (anti-abuso razonable) ──────────────
-- Ajustable sin migrar nada más que esta constante si se parametriza después.
-- (Rate limiting avanzado queda a nivel Edge/WAF — ver funciones en repo.)

-- ── Tabla: session_students ──────────────────────────────────────────────────
create table if not exists public.session_students (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_name text not null
    check (char_length(student_name) >= 1 and char_length(student_name) <= 80),
  device_id text not null
    check (char_length(device_id) >= 1 and char_length(device_id) <= 128),
  status text not null default 'connected'
    check (status in ('connected', 'in_progress', 'completed', 'disconnected')),
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  score integer not null default 0 check (score >= 0),
  answered_count integer not null default 0 check (answered_count >= 0),
  -- Token opaco: SOLO hash irreversible + metadatos. El original jamás se guarda.
  token_hash text,
  token_expires_at timestamptz,
  token_revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_students_session_device_unique unique (session_id, device_id)
);

create index if not exists session_students_session_idx on public.session_students (session_id);

alter table public.session_students enable row level security;

-- Profesor: SOLO lectura de estudiantes de SUS sesiones. Sin políticas de
-- escritura para anon/authenticated → Unity está obligado a usar las RPCs.
drop policy if exists "session_students_owner_select" on public.session_students;
create policy "session_students_owner_select"
  on public.session_students for select
  to authenticated
  using (exists (
    select 1 from public.sessions s
    where s.id = session_students.session_id and s.created_by = auth.uid()
  ));

drop trigger if exists session_students_set_updated_at on public.session_students;
create trigger session_students_set_updated_at
  before update on public.session_students
  for each row execute function public.set_updated_at();

-- ── Tabla: student_answers ───────────────────────────────────────────────────
create table if not exists public.student_answers (
  id uuid primary key default gen_random_uuid(),
  session_student_id uuid not null references public.session_students(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  option_id uuid not null references public.options(id) on delete cascade,
  -- Calculado EXCLUSIVAMENTE por el servidor. Unity jamás lo envía ni recibe
  -- durante la evaluación (solo el score final agregado al completar).
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint student_answers_student_question_unique unique (session_student_id, question_id)
);

create index if not exists student_answers_student_idx on public.student_answers (session_student_id);

alter table public.student_answers enable row level security;

-- Profesor: SOLO lectura de respuestas de SUS sesiones.
drop policy if exists "student_answers_owner_select" on public.student_answers;
create policy "student_answers_owner_select"
  on public.student_answers for select
  to authenticated
  using (exists (
    select 1 from public.session_students st
    join public.sessions s on s.id = st.session_id
    where st.id = student_answers.session_student_id and s.created_by = auth.uid()
  ));

-- ── Helpers de sobre de respuesta (contrato de códigos cerrado) ──────────────
-- PostgREST no permite fijar HTTP status por rama en RPCs; el sobre lleva el
-- código canónico y las Edge Functions / NestJS lo mapean a HTTP real.

-- ── RPC 1: student_get_session (≈ GET /sessions/{sessionId}) ─────────────────
-- Pública (anon): devuelve SOLO lo necesario para iniciar. NUNCA isCorrect,
-- teacher, tokens, scores ni respuestas de otros estudiantes.
create or replace function public.student_get_session(p_session_id uuid)
returns jsonb
language plpgsql
-- VOLATILE (no STABLE): marca expired al observar expiración (escribe).
volatile
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_payload jsonb;
begin
  -- Rate limit MVP: 120 lecturas/min por IP+sesión.
  if not public.student_check_rate('get-session', p_session_id::text, 120, 60) then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED',
      'message', 'Demasiadas solicitudes. Intenta nuevamente.', 'statusCode', 429);
  end if;

  select s.* into v_session
    from public.sessions s
   where s.id = p_session_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'SESSION_NOT_FOUND',
      'message', 'Sesión no encontrada.', 'statusCode', 404);
  end if;

  if v_session.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'SESSION_CANCELLED',
      'message', 'Esta sesión fue cancelada.', 'statusCode', 409);
  end if;

  if v_session.status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'SESSION_COMPLETED',
      'message', 'La sesión ya fue finalizada.', 'statusCode', 409);
  end if;

  -- Expiración: autoridad del servidor. Se marca expired al observarla.
  if v_session.expires_at is not null and v_session.expires_at <= now()
     and v_session.status in ('waiting', 'active') then
    update public.sessions set status = 'expired', updated_at = now()
     where id = v_session.id;
    v_session.status := 'expired';
  end if;

  if v_session.status = 'expired' then
    return jsonb_build_object('ok', false, 'error', 'SESSION_EXPIRED',
      'message', 'Esta sesión ha expirado.', 'statusCode', 410);
  end if;

  select jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'sessionId', v_session.id,
      'name', v_session.name,
      'description', v_session.description,
      'activationDate', v_session.activation_date,
      'durationMinutes', v_session.duration_minutes,
      'expiresAt', v_session.expires_at,
      'status', v_session.status,
      -- canStart=false si aún no llega la fecha de activación (§9/§47).
      -- La decisión final la aplica student_connect server-side.
      'canStart', (v_session.activation_date is null or v_session.activation_date <= now()),
      'model3D', jsonb_build_object(
        'id', m.id, 'name', m.name, 'assetUrl', m.asset_url
      ),
      'evaluation', jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'questions', coalesce(q.questions, '[]'::jsonb)
      )
    )
  )
  into v_payload
  from (select 1) as one
  left join public.models_3d m on m.id = v_session.model_3d_id
  left join public.evaluations e on e.id = v_session.evaluation_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', qq.id,
        'text', qq.question_text,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object('id', o.id, 'text', o.option_text)
                           order by o.option_order, o.id)
            from public.options o
           where o.question_id = qq.id
        ), '[]'::jsonb)
      )
      order by qq.question_order, qq.id
    ) as questions
    from public.questions qq
    where qq.evaluation_id = v_session.evaluation_id
  ) q on true;

  return v_payload;
end;
$$;

revoke all on function public.student_get_session(uuid) from public;
grant execute on function public.student_get_session(uuid) to anon, authenticated;

-- ── RPC 2: student_connect (≈ POST /sessions/{id}/connect) ──────────────────
-- Sin autenticación inicial. Mismo (session_id, device_id) → mismo estudiante,
-- token NUEVO, anterior revocado (rotación §17).
create or replace function public.student_connect(
  p_session_id uuid,
  p_student_name text,
  p_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_student record;
  v_token text;
  v_count int;
  v_attempt int;
  v_created boolean := false;
begin
  if p_student_name is null or char_length(trim(p_student_name)) < 1
     or char_length(p_student_name) > 80 then
    return jsonb_build_object('ok', false, 'error', 'VALIDATION_ERROR',
      'message', 'Nombre de estudiante no válido (1–80 caracteres).', 'statusCode', 400);
  end if;

  if p_device_id is null or char_length(trim(p_device_id)) < 1
     or char_length(p_device_id) > 128 then
    return jsonb_build_object('ok', false, 'error', 'VALIDATION_ERROR',
      'message', 'Identificador de dispositivo no válido.', 'statusCode', 400);
  end if;

  -- Rate limit MVP: 60 connects/min por IP+sesión (operación de escritura).
  -- Umbral holgado a propósito: un aula completa tras un mismo NAT comparte IP.
  if not public.student_check_rate('connect', p_session_id::text, 60, 60) then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED',
      'message', 'Demasiadas solicitudes. Intenta nuevamente.', 'statusCode', 429);
  end if;

  select s.* into v_session
    from public.sessions s
   where s.id = p_session_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'SESSION_NOT_FOUND',
      'message', 'Sesión no encontrada.', 'statusCode', 404);
  end if;
  if v_session.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'SESSION_CANCELLED',
      'message', 'Esta sesión fue cancelada.', 'statusCode', 409);
  end if;
  if v_session.status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'SESSION_COMPLETED',
      'message', 'La sesión ya fue finalizada.', 'statusCode', 409);
  end if;
  if v_session.expires_at is not null and v_session.expires_at <= now() then
    update public.sessions set status = 'expired', updated_at = now()
     where id = v_session.id and status in ('waiting', 'active');
    return jsonb_build_object('ok', false, 'error', 'SESSION_EXPIRED',
      'message', 'Esta sesión ha expirado.', 'statusCode', 410);
  end if;
  -- Activación futura: existe pero aún no se puede iniciar (§9/§47).
  if v_session.activation_date is not null and v_session.activation_date > now() then
    return jsonb_build_object('ok', false, 'error', 'SESSION_NOT_STARTED',
      'message', 'La sesión aún no está activa. Espera la hora indicada.', 'statusCode', 409);
  end if;

  -- Anti-abuso MVP: tope de estudiantes por sesión.
  select count(*) into v_count
    from public.session_students st
   where st.session_id = v_session.id;
  select id, status, joined_at into v_student
    from public.session_students st
   where st.session_id = v_session.id and st.device_id = p_device_id;

  if not found and v_count >= 100 then
    return jsonb_build_object('ok', false, 'error', 'SESSION_FULL',
      'message', 'La sesión alcanzó el máximo de estudiantes.', 'statusCode', 409);
  end if;

  -- Token opaco: 32 bytes aleatorios en hex. Solo se guarda su SHA-256.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  if found then
    -- Reconexión: mismo estudiante, token nuevo, anterior revocado (§17/§44).
    update public.session_students
       set token_hash = encode(extensions.digest(v_token, 'sha256'::text), 'hex'),
             token_expires_at = v_session.expires_at,
             -- El hash nuevo reemplaza al anterior (el viejo ya no coincide → 401).
             -- revoked_at queda NULL: el token vigente NO está revocado (solo lo
             -- fija un futuro endpoint de desconexión explícita).
           updated_at = now()
     where id = v_student.id
    returning id, status, joined_at into v_student;
  else
    -- Alta con protección de carrera: dos connects simultáneos del mismo
    -- device violarían el UNIQUE. Se resuelve como reconexión; si la fila
    -- rival aún no es visible (sin commit), se espera y reintenta.
    for v_attempt in 1..3 loop
      begin
        insert into public.session_students
          (session_id, student_name, device_id, status, token_hash, token_expires_at)
        values
          (v_session.id, trim(p_student_name), p_device_id, 'connected',
           encode(extensions.digest(v_token, 'sha256'::text), 'hex'), v_session.expires_at)
        returning id, status, joined_at into v_student;
        v_created := true;
        exit;
      exception when unique_violation then
        select id, status, joined_at into v_student
          from public.session_students st
         where st.session_id = v_session.id and st.device_id = p_device_id;
        if found then
          update public.session_students
             set token_hash = encode(extensions.digest(v_token, 'sha256'::text), 'hex'),
                 token_expires_at = v_session.expires_at,
                 -- Hash nuevo reemplaza al anterior (el viejo ya no coincide).
                 -- revoked_at queda NULL: el token vigente NO está revocado.
                 updated_at = now()
           where id = v_student.id
          returning id, status, joined_at into v_student;
          exit;
        end if;
        perform pg_sleep(0.05);
      end;
    end loop;

    if v_student.id is null then
      raise exception 'CONNECT_FAILED: no se pudo registrar al estudiante'
        using errcode = 'P0001';
    end if;

    -- Primera conexión real activa la sesión global (waiting → active, §45).
    if v_created and v_session.status = 'waiting' then
      update public.sessions set status = 'active', updated_at = now()
       where id = v_session.id;
    end if;
  end if;

  -- El token original viaja SOLO en esta respuesta. Jamás se persiste ni se loguea.
  -- Se devuelve el estado REAL (una reconexión de completado sigue completed).
  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'studentId', v_student.id,
      'studentToken', v_token,
      'sessionId', v_session.id,
      'status', v_student.status,
      'joinedAt', v_student.joined_at
    )
  );
end;
$$;

revoke all on function public.student_connect(uuid, text, text) from public;
grant execute on function public.student_connect(uuid, text, text) to anon, authenticated;

-- ── RPC 3: student_answer (≈ POST /sessions/{id}/answers) ───────────────────
-- Autenticación por studentToken opaco (parámetro; las Edge/NestJS lo mapearán
-- desde `Authorization: Bearer`). Toda la cadena se valida server-side (§26).
create or replace function public.student_answer(
  p_student_token text,
  p_session_id uuid,
  p_question_id uuid,
  p_option_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student record;
  v_session record;
  v_eval_id uuid;
  v_opt record;
  v_correct boolean;
  v_total int;
  v_dup boolean;
  v_answered int;
  v_score int;
begin
  if p_student_token is null or p_student_token = '' then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED',
      'message', 'Tu sesión de estudiante ya no es válida.', 'statusCode', 401);
  end if;

  -- Rate limit MVP: 60 respuestas/min por IP+estudiante.
  if not public.student_check_rate('answer', p_session_id::text, 60, 60) then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED',
      'message', 'Demasiadas solicitudes. Intenta nuevamente.', 'statusCode', 429);
  end if;

  -- 1-3. Token válido, no revocado, no expirado, pertenece al estudiante.
  select st.* into v_student
    from public.session_students st
   where st.token_hash = encode(extensions.digest(p_student_token, 'sha256'::text), 'hex')
     and st.token_revoked_at is null
     and (st.token_expires_at is null or st.token_expires_at > now());

  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED',
      'message', 'Tu sesión de estudiante ya no es válida.', 'statusCode', 401);
  end if;

  -- 4. El estudiante pertenece a la sesión indicada (anti cross-student §52).
  if v_student.session_id <> p_session_id then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED',
      'message', 'Tu sesión de estudiante ya no es válida.', 'statusCode', 401);
  end if;

  select s.* into v_session
    from public.sessions s
   where s.id = p_session_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'SESSION_NOT_FOUND',
      'message', 'Sesión no encontrada.', 'statusCode', 404);
  end if;

  -- 8-9. Sesión abierta y vigente (el backend es autoridad del tiempo §10).
  if v_session.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'SESSION_CANCELLED',
      'message', 'Esta sesión fue cancelada.', 'statusCode', 409);
  end if;
  if v_session.status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'SESSION_COMPLETED',
      'message', 'La sesión ya fue finalizada.', 'statusCode', 409);
  end if;
  if v_session.expires_at is not null and v_session.expires_at <= now() then
    update public.sessions set status = 'expired', updated_at = now()
     where id = v_session.id and status in ('waiting', 'active');
    return jsonb_build_object('ok', false, 'error', 'SESSION_EXPIRED',
      'message', 'La evaluación ya expiró.', 'statusCode', 410);
  end if;
  if v_student.status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'SESSION_COMPLETED',
      'message', 'Ya completaste esta evaluación.', 'statusCode', 409);
  end if;

  v_eval_id := v_session.evaluation_id;
  if v_eval_id is null then
    return jsonb_build_object('ok', false, 'error', 'SESSION_NOT_FOUND',
      'message', 'La sesión no tiene cuestionario asociado.', 'statusCode', 404);
  end if;

  -- 6. La pregunta pertenece a la evaluación de la sesión.
  perform 1 from public.questions q
   where q.id = p_question_id and q.evaluation_id = v_eval_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'VALIDATION_ERROR',
      'message', 'Pregunta no válida para esta sesión.', 'statusCode', 400);
  end if;

  -- 7. La opción pertenece a la pregunta (anti cross-question §53).
  select o.is_correct into v_opt
    from public.options o
   where o.id = p_option_id and o.question_id = p_question_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'VALIDATION_ERROR',
      'message', 'Opción no válida para esta pregunta.', 'statusCode', 400);
  end if;
  v_correct := v_opt.is_correct;

  -- 27. Duplicado: UNIQUE(session_student_id, question_id) + 409 sin tocar nada.
  select exists (
    select 1 from public.student_answers a
    where a.session_student_id = v_student.id and a.question_id = p_question_id
  ) into v_dup;
  if v_dup then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_ANSWERED',
      'message', 'Esta pregunta ya fue registrada.', 'statusCode', 409);
  end if;

  -- Inserción con protección de carrera: dos envíos simultáneos de la misma
  -- pregunta violarían el UNIQUE → se responde ALREADY_ANSWERED, sin tocar
  -- nada (§27) y sin filtrar mensajes internos.
  begin
    insert into public.student_answers
      (session_student_id, question_id, option_id, is_correct)
    values
      (v_student.id, p_question_id, p_option_id, v_correct);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_ANSWERED',
      'message', 'Esta pregunta ya fue registrada.', 'statusCode', 409);
  end;

  -- Progreso + score server-side (§28). 1 punto por acierto (MVP documentado).
  select count(*) into v_total
    from public.questions q
   where q.evaluation_id = v_eval_id;

  update public.session_students
     set answered_count = answered_count + 1,
         score = score + (case when v_correct then 1 else 0 end),
         status = 'in_progress',
         updated_at = now()
   where id = v_student.id
  returning answered_count, score into v_answered, v_score;

  -- 30. Finalización automática al completar todas (§30).
  if v_answered >= v_total and v_total > 0 then
    update public.session_students
       set status = 'completed', completed_at = now(), updated_at = now()
     where id = v_student.id;
    return jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'accepted', true,
        'answered', v_answered,
        'totalQuestions', v_total,
        'completed', true,
        'score', v_score,
        'status', 'completed'
      )
    );
  end if;

  -- Durante la evaluación NO se devuelve corrección ni score (§24/§29).
  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'accepted', true,
      'answered', v_answered,
      'totalQuestions', v_total,
      'completed', false,
      'score', null,
      'status', 'in_progress'
    )
  );
end;
$$;

revoke all on function public.student_answer(text, uuid, uuid, uuid) from public;
grant execute on function public.student_answer(text, uuid, uuid, uuid) to anon, authenticated;

-- ── RPC 4: student_disconnect (revocación explícita) ─────────────────────────
-- Expulsa un dispositivo: revoca su token y lo marca disconnected (salvo que
-- ya hubiera completado, estado terminal que se conserva). El token revocado
-- responde 401 desde ese momento. P1 de endurecimiento pre-producción.
create or replace function public.student_disconnect(p_student_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
begin
  if p_student_token is null or p_student_token = '' then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED',
      'message', 'Tu sesión de estudiante ya no es válida.', 'statusCode', 401);
  end if;

  -- Rate limit MVP: 30 desconexiones/min por IP.
  if not public.student_check_rate('disconnect', '-', 30, 60) then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED',
      'message', 'Demasiadas solicitudes. Intenta nuevamente.', 'statusCode', 429);
  end if;

  select st.id, st.status into v_id, v_status
    from public.session_students st
   where st.token_hash = encode(extensions.digest(p_student_token, 'sha256'::text), 'hex')
     and st.token_revoked_at is null
     and (st.token_expires_at is null or st.token_expires_at > now());

  if not found then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED',
      'message', 'Tu sesión de estudiante ya no es válida.', 'statusCode', 401);
  end if;

  update public.session_students
     set token_revoked_at = now(),
         -- completed es terminal: se conserva aunque el dispositivo se vaya.
         status = case when v_status = 'completed' then 'completed' else 'disconnected' end,
         updated_at = now()
   where id = v_id
  returning status into v_status;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('disconnected', true, 'status', v_status)
  );
end;
$$;

revoke all on function public.student_disconnect(text) from public;
grant execute on function public.student_disconnect(text) to anon, authenticated;

-- ============================================================================
-- VERIFICACIÓN (SQL Editor, tras aplicar — SOLO lecturas + RPCs públicas):
--   select public.student_get_session('00000000-0000-0000-0000-000000000000');
--     → {"ok":false,"error":"SESSION_NOT_FOUND",...}
--   Tablas: session_students, student_answers con RLS activo y SIN políticas
--   de escritura para anon/authenticated (Unity obligado a usar RPCs).
-- ============================================================================
