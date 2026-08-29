-- Faltaba una policy de DELETE en "jobs" — con RLS activado y ninguna policy que
-- matchee la operación, el borrado quedaba denegado por default. Todos los hijos
-- (job_assigned_users, job_stages, job_files, comments, activity_log,
-- block_records, quality_checks, installations, notifications) ya tienen
-- `on delete cascade` en 001_schema.sql, así que un solo delete acá alcanza.
drop policy if exists jobs_delete on jobs;
create policy jobs_delete on jobs for delete to authenticated using (is_admin_or_coordinador());
