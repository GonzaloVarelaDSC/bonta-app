-- 030 — Actualización en vivo de los trabajos (28/10).
-- La app escucha los cambios de `jobs` por Realtime (canal 'jobs-changes'), pero
-- Supabase solo transmite las tablas agregadas a la publicación
-- `supabase_realtime`, y `jobs` nunca se agregó (solo notifications en la 021 y
-- activity_log en la 025). Por eso los cambios de los demás (responsable,
-- medidas, nombre, Kanban, contadores) no aparecían sin recargar.
-- Realtime respeta RLS: cada usuario recibe solo los trabajos que puede ver.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs'
  ) then
    alter publication supabase_realtime add table jobs;
  end if;
end $$;
