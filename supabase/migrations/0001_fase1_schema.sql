-- ============================================================================
-- AIRSTARK — Fase 1: Esquema de base de datos (Supabase)
-- Dashboard de Evaluación + Sesiones + QR
--
-- NOTA DE PROCEDENCIA: Este esquema fue aplicado al proyecto live (2026-09-15,
-- probablemente vía dashboard/otro pasaje) y este archivo es la reconstrucción
-- versionable del mismo, derivada del contrato de `sessionService.ts` y del
-- plan de Fase 1. Verificado contra el live: las 5 tablas existen, RLS activo
-- (INSERT anónimo → 401 42501), seed de models_3d presente.
-- Si el proyecto ya tiene el esquema, este archivo sirve como referencia/
-- re-creación en un entorno nuevo (p. ej. staging). Las secciones son
-- idempotentes donde Supabase lo permite (CREATE TABLE IF NOT EXISTS).
--
-- SEGURIDAD:
--   - RLS habilitado en TODAS las tablas
--   - created_by = auth.uid() forzado por políticas (el cliente no lo manda)
--   - options.is_correct se almacena en DB pero NUNCA se expondrá a Unity
--     (Fase 2: policy de lectura anon sin is_correct / vista segura)
-- ============================================================================

-- ── Tabla: models_3d (catálogo público de modelos) ──────────────────────────
create table if not exists public.models_3d (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  asset_key text not null unique,          -- 'heart' | 'brain' | 'lungs' | 'kidneys'
  asset_url text,
  thumbnail_url text,
  description text,
  created_at timestamptz not null default now()
);

-- Lectura pública (anon + authenticated); escritura solo via dashboard/service_role
alter table public.models_3d enable row level security;

drop policy if exists "models_3d_select_public" on public.models_3d;
create policy "models_3d_select_public"
  on public.models_3d for select
  to anon, authenticated
  using (true);

-- ── Tabla: evaluations ───────────────────────────────────────────────────────
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.evaluations enable row level security;

drop policy if exists "evaluations_owner_all" on public.evaluations;
create policy "evaluations_owner_all"
  on public.evaluations for all
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- ── Tabla: questions ─────────────────────────────────────────────────────────
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  question_text text not null,
  question_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

-- Acceso derivado del ownership de la evaluación padre (subquery en la policy)
drop policy if exists "questions_owner_all" on public.questions;
create policy "questions_owner_all"
  on public.questions for all
  to authenticated
  using (exists (
    select 1 from public.evaluations e
    where e.id = questions.evaluation_id and e.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.evaluations e
    where e.id = questions.evaluation_id and e.created_by = auth.uid()
  ));

-- ── Tabla: options ───────────────────────────────────────────────────────────
create table if not exists public.options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_text text not null,
  option_order integer not null default 0,
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.options enable row level security;

drop policy if exists "options_owner_all" on public.options;
create policy "options_owner_all"
  on public.options for all
  to authenticated
  using (exists (
    select 1 from public.questions q
    join public.evaluations e on e.id = q.evaluation_id
    where q.id = options.question_id and e.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.questions q
    join public.evaluations e on e.id = q.evaluation_id
    where q.id = options.question_id and e.created_by = auth.uid()
  ));

-- ── Tabla: sessions (el id = sessionId que viaja en el QR) ───────────────────
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid references public.evaluations(id) on delete set null,
  name text not null,
  description text,
  activation_date timestamptz not null,
  duration_minutes integer not null
    check (duration_minutes > 0 and duration_minutes <= 480),
  status text not null default 'waiting'
    check (status in ('waiting','active','completed','expired','cancelled')),
  model_3d_id uuid references public.models_3d(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,                  -- calculado por trigger (server-side)
  idempotency_key uuid not null unique,    -- prevención de duplicados (doble-click)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_created_by_idx on public.sessions (created_by);
create index if not exists sessions_status_idx on public.sessions (status);

alter table public.sessions enable row level security;

drop policy if exists "sessions_owner_all" on public.sessions;
create policy "sessions_owner_all"
  on public.sessions for all
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- ── Trigger: updated_at automático ───────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

drop trigger if exists evaluations_set_updated_at on public.evaluations;
create trigger evaluations_set_updated_at
  before update on public.evaluations
  for each row execute function public.set_updated_at();

-- ── Trigger: expires_at = activation_date + duration_minutes ─────────────────
create or replace function public.compute_expires_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.expires_at := new.activation_date + make_interval(mins => new.duration_minutes);
  return new;
end;
$$;

drop trigger if exists sessions_compute_expires_at on public.sessions;
create trigger sessions_compute_expires_at
  before insert or update of activation_date, duration_minutes on public.sessions
  for each row execute function public.compute_expires_at();

-- ── Seed: catálogo de modelos 3D (idempotente por asset_key unique) ──────────
insert into public.models_3d (name, asset_key, description) values
  ('Corazón',  'heart',   'Modelo anatómico del corazón humano con estructuras internas visibles'),
  ('Cerebro',  'brain',   'Modelo anatómico del cerebro humano'),
  ('Pulmones', 'lungs',   'Modelo anatómico de los pulmones'),
  ('Riñones',  'kidneys', 'Modelo anatómico de los riñones')
on conflict (asset_key) do nothing;

-- ============================================================================
-- VERIFICACIÓN (opcional, correr en SQL Editor):
--   select tablename, rowsecurity from pg_tables
--     where schemaname = 'public'
--       and tablename in ('models_3d','evaluations','questions','options','sessions');
--   -- Todas deben tener rowsecurity = true
-- ============================================================================
