-- ============================================================================
-- AIRSTARK — Fase 1.5: Payload de lectura para Unity (NO destructivo)
--
-- Propósito:
--   Servir a la app Unity, a partir del `sessionId` escaneado del QR, los tres
--   JSON que consume:
--     1. sessions.json  → metadata de la sesión (nombre, profesor, modelo…)
--     2. configs_*.json → SessionConfig + QuizConfig + ARConfig
--     3. questions_*.json → preguntas con opciones, CorrectOptionIndex,
--        FeedbackText, TargetInteractiveElementId y ARPlacementDataJson
--
-- Diseño de seguridad (sin backend intermedio todavía):
--   - El QR sigue conteniendo EXCLUSIVAMENTE el `sessionId` (UUID inaudivinable).
--   - Unity NO recibe SELECT directo sobre las tablas (eso permitiría enumerar
--     sesiones). En su lugar usa la función SECURITY DEFINER
--     `get_unity_session_payload(uuid)`, que solo devuelve LA sesión pedida.
--     El UUID actúa como capability (modelo "share link").
--   - La función se otorga solo a `anon` y `authenticated`.
--   - ENMIENDA al spec §8.4: el payload incluye `CorrectOptionIndex` porque
--     Unity debe dar feedback inmediato en el dispositivo
--     (`EnableImmediateFeedback: true`). Cuando exista backend de validación,
--     este campo podrá suprimirse del payload.
--
-- SEGURA: solo ADD COLUMN / CREATE TABLE / CREATE FUNCTION. Sin DROP de datos,
-- sin ALTER destructivo. Las columnas nuevas tienen DEFAULT, así que las
-- sesiones existentes devuelven un payload válido inmediatamente.
-- ============================================================================

-- ── 1. Columnas nuevas en questions (contenido Unity por pregunta) ───────────
alter table public.questions
  add column if not exists feedback_text text not null default '',
  add column if not exists target_element_id text,
  add column if not exists ar_placement jsonb not null default '{}'::jsonb;

-- ── 2. Columnas nuevas en sessions (metadata Unity por sesión) ───────────────
alter table public.sessions
  add column if not exists teacher_name text,
  add column if not exists version text not null default '1.0.0',
  add column if not exists allow_offline boolean not null default false,
  add column if not exists objectives jsonb not null default '[]'::jsonb;
-- objectives: [{ "Id": "obj1", "Description": "...", "IsOptional": false }]

-- ── 3. Tabla session_configs (1:1 con sessions) ──────────────────────────────
create table if not exists public.session_configs (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  -- SessionConfig
  accent_color_hex text not null default '#00E5FF',
  required_accuracy_percentage double precision not null default 80,
  enable_certificate_generation boolean not null default false,
  -- QuizConfig
  quiz_time_limit_seconds integer not null default 300,
  quiz_allow_backtrack boolean not null default false,
  quiz_shuffle_questions boolean not null default true,
  quiz_enable_immediate_feedback boolean not null default true,
  -- ARConfig
  ar_detection_mode text not null default 'HorizontalPlanes',
  ar_initial_model_scale double precision not null default 0.5,
  ar_enable_depth_sensing boolean not null default true,
  ar_show_plane_markers boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.session_configs enable row level security;

-- Ownership idéntico al de sessions: solo el profesor dueño.
drop policy if exists "session_configs_owner_all" on public.session_configs;
create policy "session_configs_owner_all"
  on public.session_configs for all
  to authenticated
  using (exists (
    select 1 from public.sessions s
    where s.id = session_configs.session_id and s.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.sessions s
    where s.id = session_configs.session_id and s.created_by = auth.uid()
  ));

drop trigger if exists session_configs_set_updated_at on public.session_configs;
create trigger session_configs_set_updated_at
  before update on public.session_configs
  for each row execute function public.set_updated_at();

-- ── 4. Auto-crear fila de config con defaults en cada sesión nueva ───────────
create or replace function public.ensure_session_config()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.session_configs (session_id)
  values (new.id)
  on conflict (session_id) do nothing;
  return new;
end;
$$;

drop trigger if exists sessions_ensure_config on public.sessions;
create trigger sessions_ensure_config
  after insert on public.sessions
  for each row execute function public.ensure_session_config();

-- Backfill: sesiones creadas antes de esta migración también quedan cubiertas.
insert into public.session_configs (session_id)
select id from public.sessions
on conflict (session_id) do nothing;

-- ── 5. RPC de lectura para Unity (una sola llamada, un solo RTT) ─────────────
create or replace function public.get_unity_session_payload(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'SessionId', s.id,
    'Status', s.status,
    'ExpiresAt', s.expires_at,
    'Session', jsonb_build_object(
      'Id', s.id,
      'Name', s.name,
      'Description', s.description,
      'Teacher', coalesce(s.teacher_name, u.display_name, ''),
      'ModelAssetId', coalesce(m.asset_key, ''),
      'ModelAssetUrl', m.asset_url,
      'DurationMinutes', s.duration_minutes,
      'Objectives', coalesce(s.objectives, '[]'::jsonb),
      'CreatedAt', s.created_at,
      'Version', s.version,
      'AllowOffline', s.allow_offline
    ),
    'SessionConfig', jsonb_build_object(
      'SessionId', s.id,
      'AccentColorHex', c.accent_color_hex,
      'RequiredAccuracyPercentage', c.required_accuracy_percentage,
      'EnableCertificateGeneration', c.enable_certificate_generation
    ),
    'QuizConfig', jsonb_build_object(
      'TimeLimitSeconds', c.quiz_time_limit_seconds,
      'AllowBacktrack', c.quiz_allow_backtrack,
      'ShuffleQuestions', c.quiz_shuffle_questions,
      'EnableImmediateFeedback', c.quiz_enable_immediate_feedback
    ),
    'ARConfig', jsonb_build_object(
      'DetectionMode', c.ar_detection_mode,
      'InitialModelScale', c.ar_initial_model_scale,
      'EnableDepthSensing', c.ar_enable_depth_sensing,
      'ShowPlaneMarkers', c.ar_show_plane_markers
    ),
    'Questions', coalesce(q.questions, '[]'::jsonb)
  )
  into result
  from public.sessions s
  left join public.models_3d m on m.id = s.model_3d_id
  left join public.session_configs c on c.session_id = s.id
  left join lateral (
    select coalesce(
      nullif(au.raw_user_meta_data->>'full_name', ''),
      nullif(au.raw_user_meta_data->>'given_name', ''),
      au.email,
      ''
    ) as display_name
    from auth.users au
    where au.id = s.created_by
  ) u on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'QuestionId', qq.id,
        'Text', qq.question_text,
        'Options', coalesce(oo.options, '[]'::jsonb),
        'CorrectOptionIndex', coalesce(oo.correct_index, -1),
        'FeedbackText', coalesce(qq.feedback_text, ''),
        'TargetInteractiveElementId', qq.target_element_id,
        'ARPlacementDataJson', qq.ar_placement::text
      )
      order by qq.question_order, qq.id
    ) as questions
    from public.questions qq
    left join lateral (
      select
        jsonb_agg(o.option_text order by o.option_order, o.id) as options,
        -- Índice 0-based de la opción correcta en el mismo orden.
        -- Se asume una sola correcta (el editor usa radio button).
        max(case when o.is_correct then o.rn - 1 end) as correct_index
      from (
        select
          opt.option_text,
          opt.is_correct,
          opt.option_order,
          opt.id,
          row_number() over (order by opt.option_order, opt.id) as rn
        from public.options opt
        where opt.question_id = qq.id
      ) o
    ) oo on true
    where qq.evaluation_id = s.evaluation_id
  ) q on true
  where s.id = p_session_id;

  -- NULL si la sesión no existe → el cliente lo mapea a SESSION_NOT_FOUND.
  return result;
end;
$$;

-- Solo anon + authenticated pueden ejecutarla (sin SELECT directo a tablas).
revoke all on function public.get_unity_session_payload(uuid) from public;
grant execute on function public.get_unity_session_payload(uuid) to anon, authenticated;

-- ============================================================================
-- VERIFICACIÓN (SQL Editor, tras aplicar):
--   select public.get_unity_session_payload('<sessionId-uuid>');
--   -- Debe devolver un JSON con SessionId/Session/SessionConfig/
--   -- QuizConfig/ARConfig/Questions. Con un UUID inexistente → null.
-- ============================================================================
