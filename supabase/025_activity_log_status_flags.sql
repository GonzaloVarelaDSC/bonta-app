-- Aviso flotante de "otro usuario cambió el estado de un trabajo" (07/10, ver
-- CLAUDE.md §57): reusa el renglón de historial que `setStatus` ya inserta en
-- `activity_log` — solo le suma de dónde a dónde se cambió, y publica la tabla
-- para Realtime (mismo paso que 021 para `notifications`). La visibilidad por
-- usuario la sigue decidiendo la policy `activity_log_select` (can_view_job),
-- Realtime respeta RLS. Idempotente.
alter table activity_log add column if not exists from_status text;
alter table activity_log add column if not exists to_status text;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_log'
  ) then
    alter publication supabase_realtime add table activity_log;
  end if;
end $$;
