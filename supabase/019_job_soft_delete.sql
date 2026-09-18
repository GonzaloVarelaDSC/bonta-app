-- Fase 4 (17/09/2026): "Eliminar trabajo" pasa de borrado físico a borrado
-- lógico — Gonzalo prefiere no perder información definitivamente si se puede
-- evitar. deleteJob() ahora hace un UPDATE (deleted_at/deleted_by) en vez de un
-- DELETE; el trabajo desaparece de Dashboard/Trabajos/Kanban pero sigue entero
-- (archivos, comentarios, historial) y es consultable/restaurable desde Histórico.
alter table jobs add column if not exists deleted_at timestamptz;
alter table jobs add column if not exists deleted_by uuid references profiles(id);

-- Mismo guardia que ya protegía priority_manual/client_id/responsible_user_id/
-- committed_date/requires_installation/code (ver 002_policies.sql) — sin esto,
-- cualquier usuario con acceso de lectura al trabajo (no solo admin/coordinador)
-- podría "eliminarlo" vía UPDATE directo, porque la policy jobs_update de base
-- es bastante permisiva (using can_view_job(id)).
create or replace function jobs_update_guard()
returns trigger as $$
begin
  if is_admin_or_coordinador() then
    return new;
  end if;
  if new.priority_manual is distinct from old.priority_manual
     or new.client_id is distinct from old.client_id
     or new.responsible_user_id is distinct from old.responsible_user_id
     or new.committed_date is distinct from old.committed_date
     or new.requires_installation is distinct from old.requires_installation
     or new.code is distinct from old.code
     or new.deleted_at is distinct from old.deleted_at
     or new.deleted_by is distinct from old.deleted_by
  then
    raise exception 'Tu rol no tiene permiso para modificar ese campo del trabajo.';
  end if;
  return new;
end;
$$ language plpgsql security definer;
