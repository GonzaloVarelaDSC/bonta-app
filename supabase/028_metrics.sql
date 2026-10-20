-- Métricas (19/10, ver CLAUDE.md §73). Solo agrega cosas: no toca ni borra datos.
-- Acceso: SOLO rol 'admin' (hoy Gonzalo, Pancho, Martín y Claudia) — mismo
-- criterio que lib/permissions.ts canViewMetrics. Se controla en la base, no
-- solo ocultando el link del menú.
-- Idempotente: se puede correr más de una vez.

-- 1) Cronología de estados de TODOS los trabajos, en una sola consulta.
--    Security definer + chequeo de rol adentro: un coordinador que la llame
--    recibe un error de permiso aunque pueda ver las fichas una por una.
create or replace function metrics_status_events()
returns table (
  id uuid, job_id uuid, user_id uuid, action text, detail text,
  from_status text, to_status text, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.my_role(), '') <> 'admin' then
    raise exception 'Solo administradores pueden ver Métricas' using errcode = '42501';
  end if;
  return query
    select a.id, a.job_id, a.user_id, a.action, a.detail, a.from_status, a.to_status, a.created_at
    from activity_log a
    where a.action in ('crear', 'estado', 'instalacion')
    order by a.created_at, a.id;
end;
$$;
revoke all on function metrics_status_events() from public;
revoke all on function metrics_status_events() from anon;
grant execute on function metrics_status_events() to authenticated;

create index if not exists activity_log_action_created_idx on activity_log (action, created_at);

-- 2) Objetivos de mejora. Nunca se borran: se archivan (archived_at).
create table if not exists metric_goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  metric_key text not null,           -- ver GOAL_METRICS en src/lib/metrics.ts
  baseline_from date not null,        -- período de la línea de base
  baseline_to date not null,
  baseline_value numeric,             -- valor medido al crear el objetivo (queda fijo)
  baseline_n integer not null default 0,
  target_value numeric not null,
  start_date date not null,           -- período de evaluación
  end_date date not null,
  owner_user_id uuid references profiles(id),
  notes text not null default '',     -- qué cambio se implementa para lograrlo
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table metric_goals enable row level security;
drop policy if exists metric_goals_select on metric_goals;
create policy metric_goals_select on metric_goals for select to authenticated using (public.my_role() = 'admin');
drop policy if exists metric_goals_insert on metric_goals;
create policy metric_goals_insert on metric_goals for insert to authenticated with check (public.my_role() = 'admin' and created_by = auth.uid());
drop policy if exists metric_goals_update on metric_goals;
create policy metric_goals_update on metric_goals for update to authenticated using (public.my_role() = 'admin');
-- Sin policy de delete a propósito: no se borran, se archivan.
