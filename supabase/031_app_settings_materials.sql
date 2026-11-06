-- 031 — Base de materiales y máquinas editable desde la app (06/11).
-- Hasta ahora las medidas de placas/rollos y máquinas estaban fijas en el código
-- (src/data/materialsKnowledge.ts). Ahora se guardan acá, en una fila por clave
-- (clave 'materials_knowledge', valor jsonb), y se editan desde la pantalla
-- "Materiales y máquinas". La tabla es genérica para poder guardar otros ajustes
-- de la app más adelante sin otra tabla nueva.
-- Lectura: cualquier usuario logueado (las avisos al cargar productos los usa
-- todo el equipo). Escritura: admin y coordinador (espejo de canEditKnowledge).

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

alter table app_settings enable row level security;

drop policy if exists app_settings_select on app_settings;
create policy app_settings_select on app_settings
  for select to authenticated using (true);

drop policy if exists app_settings_insert on app_settings;
create policy app_settings_insert on app_settings
  for insert to authenticated with check (is_admin_or_coordinador());

drop policy if exists app_settings_update on app_settings;
create policy app_settings_update on app_settings
  for update to authenticated using (is_admin_or_coordinador()) with check (is_admin_or_coordinador());
