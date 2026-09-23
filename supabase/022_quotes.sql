-- Presupuestos — sección nueva, separada de "jobs" a propósito. Un presupuesto
-- es un posible trabajo que el cliente todavía no confirmó: no tiene N° de
-- Copernico/TRB, no aparece en Trabajos/Kanban/Dashboard, no entra al flujo de
-- producción. Ver CLAUDE.md §52 para el detalle completo de la decisión.

create sequence if not exists quotes_code_seq;

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  -- Identificación interna propia, nunca un N° de trabajo real — se genera
  -- sola, nunca se carga a mano (a diferencia de jobs.code).
  code text not null unique default ('PRE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('quotes_code_seq')::text, 5, '0')),
  client_id uuid not null references clients(id) on delete restrict,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'BORRADOR'
    check (status in ('BORRADOR', 'LISTO_PARA_ENVIAR', 'ENVIADO', 'CONFIRMADO', 'RECHAZADO')),
  -- Importe: null hasta que alguien autorizado lo carga. price_includes_iva en
  -- null = todavía sin especificar (nunca se asume ninguno de los dos por default).
  price numeric,
  price_includes_iva boolean,
  created_by_user_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index if not exists idx_quotes_client on quotes(client_id);
create index if not exists idx_quotes_status on quotes(status);

-- Quién puede cargar/modificar el importe final: dueños y administración
-- (is_producer = false), nunca diseño/producción — mismo criterio que
-- lib/permissions.ts canSetQuoteValue, sin hardcodear emails/nombres acá.
create or replace function can_set_quote_price()
returns boolean as $$
  select coalesce(
    (select role in ('admin', 'coordinador') and is_producer = false from profiles where id = auth.uid()),
    false
  );
$$ language sql stable security definer;

create or replace function quotes_price_guard()
returns trigger as $$
begin
  if new.price is distinct from old.price or new.price_includes_iva is distinct from old.price_includes_iva then
    if not can_set_quote_price() then
      raise exception 'Tu rol no tiene permiso para cargar el valor del presupuesto.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_quotes_price_guard on quotes;
create trigger trg_quotes_price_guard before update on quotes for each row execute procedure quotes_price_guard();

alter table quotes enable row level security;

-- Mismo criterio de acceso que jobs_insert: solo admin/coordinador ven y
-- preparan presupuestos (produccion/instalacion no tienen ninguna necesidad
-- comercial de esta sección).
drop policy if exists quotes_select on quotes;
create policy quotes_select on quotes for select to authenticated using (is_admin_or_coordinador());
drop policy if exists quotes_insert on quotes;
create policy quotes_insert on quotes for insert to authenticated with check (is_admin_or_coordinador());
drop policy if exists quotes_update on quotes;
create policy quotes_update on quotes for update to authenticated using (is_admin_or_coordinador());
