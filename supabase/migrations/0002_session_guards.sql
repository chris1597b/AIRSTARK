-- ============================================================================
-- AIRSTARK — Fase 1: Endurecimiento del contrato de sesiones (NO destructivo)
--
-- Propósito:
--   1. expires_at es AUTORIDAD DEL SERVIDOR (§13 del cierre de Fase 1): el
--      cliente no debe poder escribirlo. El trigger 0001 ya lo calcula; esta
--      migración añade defensa en profundidad revirtiendo cualquier UPDATE que
--      intente fijar expires_at a un valor distinto del calculado, y
--      forzando el recálculo en INSERT (ignora cualquier valor entrante).
--   2. CHECK de duration_minutes más estricto: > 0 pasa a >= 1 (idéntico para
--      enteros, pero explícito) manteniendo el tope de 480. Se reemplaza solo
--      si el constraint existente no tiene ya la forma objetivo (idempotente,
--      sin DROP destructivo: DROP CONSTRAINT de un CHECK es metadato, no dato).
--
-- SEGURA: no borra tablas, columnas, filas ni resetea nada. Reversible.
-- ============================================================================

-- ── 1. Guard de expires_at: solo el servidor calcula la expiración ───────────
create or replace function public.guard_session_expires_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- INSERT: recalcular siempre (el cliente no es autoridad del tiempo).
  -- UPDATE: si alguien intenta cambiar expires_at manualmente, revertirlo al
  --         valor previo y recalcular desde activation/duration.
  new.expires_at := new.activation_date + make_interval(mins => new.duration_minutes);
  return new;
end;
$$;

-- Reemplaza el trigger 0001 por el guard (mismo momento, misma tabla).
drop trigger if exists sessions_compute_expires_at on public.sessions;
create trigger sessions_compute_expires_at
  before insert or update of activation_date, duration_minutes, expires_at on public.sessions
  for each row execute function public.guard_session_expires_at();

-- ── 2. CHECK de duración: >= 1 y <= 480 (reemplazo idempotente) ──────────────
do $$
declare
  existing_def text;
begin
  select pg_get_constraintdef(oid)
    into existing_def
    from pg_constraint
   where conrelid = 'public.sessions'::regclass
     and contype = 'c'
     and conname like '%duration_minutes%';

  -- Solo reemplazar si el constraint actual no es ya el objetivo.
  if existing_def is null or existing_def not like '%>= 1%' then
    -- Eliminar únicamente el CHECK anterior (metadato; no afecta datos).
    if existing_def is not null then
      execute format('alter table public.sessions drop constraint %I', (
        select conname from pg_constraint
         where conrelid = 'public.sessions'::regclass
           and contype = 'c'
           and conname like '%duration_minutes%'
         limit 1
      ));
    end if;
    alter table public.sessions
      add constraint sessions_duration_minutes_range
      check (duration_minutes >= 1 and duration_minutes <= 480);
  end if;
end;
$$;

-- ============================================================================
-- VERIFICACIÓN (SQL Editor):
--   select expires_at, activation_date + make_interval(mins => duration_minutes)
--     from public.sessions;               -- columnas idénticas
--   update public.sessions set expires_at = '1970-01-01' where id = '<uuid>'
--     returning expires_at;               -- debe seguir devolviendo el valor calculado
-- ============================================================================
