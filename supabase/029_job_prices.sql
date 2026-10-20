-- Importe final de cada trabajo + más eventos para Métricas (19/10, CLAUDE.md §74).
-- Solo agrega cosas. Idempotente.
--
-- El importe vive en una tabla APARTE de `jobs` a propósito: las reglas de
-- acceso de Postgres son por fila, no por columna, así que una columna en `jobs`
-- la vería cualquiera que vea la ficha (Gastón, por ejemplo). Acá solo entra quien
-- ya puede cargar el valor de un presupuesto: cualquier admin, o coordinador que
-- no sea productor (misma función can_set_quote_price() de la 022/024).

create table if not exists job_prices (
  job_id uuid primary key references jobs(id) on delete cascade,
  amount_net numeric not null check (amount_net >= 0), -- importe sin IVA: es el que usan las métricas
  entered_amount numeric not null,                     -- lo que se tipeó, tal cual
  entered_with_iva boolean not null default false,     -- si lo tipeado incluía IVA
  iva_rate numeric not null default 0.21,              -- tasa usada para pasarlo a neto
  note text not null default '',
  updated_by uuid not null references profiles(id),
  updated_at timestamptz not null default now()
);

alter table job_prices enable row level security;
drop policy if exists job_prices_select on job_prices;
create policy job_prices_select on job_prices for select to authenticated using (public.can_set_quote_price());
drop policy if exists job_prices_insert on job_prices;
create policy job_prices_insert on job_prices for insert to authenticated with check (public.can_set_quote_price() and updated_by = auth.uid());
drop policy if exists job_prices_update on job_prices;
create policy job_prices_update on job_prices for update to authenticated using (public.can_set_quote_price()) with check (updated_by = auth.uid());
drop policy if exists job_prices_delete on job_prices;
create policy job_prices_delete on job_prices for delete to authenticated using (public.can_set_quote_price());

-- Métricas: la cronología ahora también trae reprogramaciones de fecha y
-- cambios de responsable (para contarlos; no cambian la etapa).
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
    where a.action in ('crear', 'estado', 'instalacion', 'fecha', 'responsable')
    order by a.created_at, a.id;
end;
$$;
revoke all on function metrics_status_events() from public;
revoke all on function metrics_status_events() from anon;
grant execute on function metrics_status_events() to authenticated;
