-- ============================================================================
-- AIRSTARK — Migración 0004: RPC atómica para crear sesiones (rendimiento QR)
--
-- PROBLEMA RESUELTO:
--   La creación de una sesión desde el frontend requería 5–6 viajes de red
--   seriales a Supabase (idempotencia, evaluación, preguntas, opciones, sesión),
--   sumando ~1.7 s antes de poder renderizar el QR. Este lag era íntegramente
--   de red (el QR se genera en el navegador en <1 ms).
--
-- SOLUCIÓN:
--   Una función PL/pgSQL que ejecuta TODO el flujo en una sola transacción:
--     1. Idempotencia (SELECT por idempotency_key)
--     2. Resolución del modelo 3D (por asset_key)
--     3. Creación de evaluación (o reutilización de existente)
--     4. Inserción de preguntas y opciones
--     5. Inserción de sesión con triggers automáticos (expires_at, session_config)
--   Resultado: 1 RTT (~200–300 ms) en vez de 6 RTT (~1.7 s).
--
-- SEGURIDAD:
--   - SECURITY DEFINER porque inserta en tablas con RLS basado en created_by.
--     El created_by se fija a auth.uid() dentro de la función (nunca del cliente).
--   - La función valida auth.uid() al inicio y lanza excepción si es NULL.
--   - REVOKE ALL FROM PUBLIC + GRANT TO authenticated: solo usuarios
--     autenticados pueden invocarla.
--   - search_path fijado a '' para evitar hijacking de schema.
--
-- NO DESTRUCTIVA: solo CREATE FUNCTION. Sin ALTER ni DROP de objetos existentes.
-- ============================================================================

create or replace function public.create_session_atomic(
  p_name               text,
  p_description        text       default null,
  p_activation_date    timestamptz,
  p_duration_minutes   int,
  p_model_key          text       default null,
  p_questions          jsonb      default null,
  p_idempotency_key    uuid,
  p_existing_eval_id   uuid       default null,
  p_teacher_name       text       default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id    uuid;
  v_eval_id    uuid;
  v_session_id uuid;
  v_model_id   uuid;
  v_q          jsonb;
  v_q_id       uuid;
  v_q_idx      int;
  v_expires    timestamptz;
  v_status     text;
  v_existing   record;
begin
  -- ── Validar autenticación ──────────────────────────────────────────────────
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'UNAUTHORIZED: usuario no autenticado'
      using errcode = '42501';
  end if;

  -- ── Idempotencia: si ya existe, devolver inmediatamente ────────────────────
  select id, status, expires_at
    into v_existing
    from public.sessions
   where idempotency_key = p_idempotency_key
     and created_by = v_user_id;

  if found then
    return jsonb_build_object(
      'sessionId', v_existing.id,
      'status',    v_existing.status,
      'expiresAt', v_existing.expires_at
    );
  end if;

  -- ── Validación básica de entrada ───────────────────────────────────────────
  if p_name is null or trim(p_name) = '' then
    raise exception 'VALIDATION_ERROR: nombre requerido'
      using errcode = '23514';
  end if;
  if p_duration_minutes is null or p_duration_minutes < 1 or p_duration_minutes > 480 then
    raise exception 'VALIDATION_ERROR: duración fuera de rango (1–480)'
      using errcode = '23514';
  end if;

  -- ── Resolver modelo 3D ─────────────────────────────────────────────────────
  if p_model_key is not null and trim(p_model_key) <> '' then
    select id into v_model_id
      from public.models_3d
     where asset_key = p_model_key
     limit 1;
  end if;

  -- ── Resolver o crear evaluación ────────────────────────────────────────────
  if p_existing_eval_id is not null then
    -- Verificar que la evaluación existe y pertenece al usuario
    select id into v_eval_id
      from public.evaluations
     where id = p_existing_eval_id
       and created_by = v_user_id;
    if not found then
      raise exception 'EVALUATION_NOT_FOUND: la evaluación no existe o no te pertenece'
        using errcode = 'P0002';
    end if;
  else
    -- Crear evaluación nueva
    insert into public.evaluations (name, description, created_by, status)
    values (p_name, p_description, v_user_id, 'published')
    returning id into v_eval_id;

    -- Insertar preguntas y opciones
    if p_questions is not null and jsonb_array_length(p_questions) > 0 then
      v_q_idx := 0;
      for v_q in select value from jsonb_array_elements(p_questions)
      loop
        insert into public.questions (evaluation_id, question_text, question_order)
        values (v_eval_id, v_q->>'prompt', v_q_idx)
        returning id into v_q_id;

        insert into public.options (question_id, option_text, option_order, is_correct)
        select v_q_id,
               o->>'text',
               (row_number() over () - 1)::int,
               coalesce((o->>'isCorrect')::boolean, false)
          from jsonb_array_elements(v_q->'options') as o;

        v_q_idx := v_q_idx + 1;
      end loop;
    end if;
  end if;

  -- ── Crear sesión ───────────────────────────────────────────────────────────
  -- Los triggers existentes (compute_expires_at, ensure_session_config)
  -- se ejecutan automáticamente.
  insert into public.sessions (
    evaluation_id,
    name,
    description,
    activation_date,
    duration_minutes,
    status,
    model_3d_id,
    created_by,
    teacher_name,
    idempotency_key
  ) values (
    v_eval_id,
    p_name,
    p_description,
    p_activation_date,
    p_duration_minutes,
    'waiting',
    v_model_id,
    v_user_id,
    p_teacher_name,
    p_idempotency_key
  )
  returning id, status, expires_at
  into v_session_id, v_status, v_expires;

  return jsonb_build_object(
    'sessionId', v_session_id,
    'status',    v_status,
    'expiresAt', v_expires
  );
end;
$$;

-- Solo usuarios autenticados pueden invocar esta función.
revoke all on function public.create_session_atomic(text, text, timestamptz, int, text, jsonb, uuid, uuid, text) from public;
grant execute on function public.create_session_atomic(text, text, timestamptz, int, text, jsonb, uuid, uuid, text) to authenticated;
