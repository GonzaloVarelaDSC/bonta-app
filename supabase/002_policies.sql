-- Estudio Bonta — Row Level Security
-- Correr después de 001_schema.sql. También idempotente (drop + create).

-- ============ Funciones auxiliares (security definer: evitan RLS recursivo) ============
create or replace function my_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function is_admin_or_coordinador()
returns boolean as $$
  select coalesce(my_role() in ('admin','coordinador'), false);
$$ language sql stable security definer;

create or replace function can_view_job(target_job_id uuid)
returns boolean as $$
  select is_admin_or_coordinador()
    or exists (select 1 from jobs where id = target_job_id and responsible_user_id = auth.uid())
    or exists (select 1 from job_assigned_users where job_id = target_job_id and user_id = auth.uid());
$$ language sql stable security definer;

-- ============ Guardia de campos protegidos en "jobs" ============
-- Diseño/Producción/Instalación pueden actualizar el trabajo (para cambiar estado, por ejemplo)
-- pero no campos estructurales — eso queda para Coordinador/Admin, igual que en la matriz de roles.
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
  then
    raise exception 'Tu rol no tiene permiso para modificar ese campo del trabajo.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_jobs_update_guard on jobs;
create trigger trg_jobs_update_guard before update on jobs for each row execute procedure jobs_update_guard();

-- ============ Activar RLS ============
alter table profiles enable row level security;
alter table clients enable row level security;
alter table client_contacts enable row level security;
alter table job_types enable row level security;
alter table materials enable row level security;
alter table jobs enable row level security;
alter table job_assigned_users enable row level security;
alter table job_stages enable row level security;
alter table job_files enable row level security;
alter table file_versions enable row level security;
alter table comments enable row level security;
alter table activity_log enable row level security;
alter table block_records enable row level security;
alter table quality_checks enable row level security;
alter table installations enable row level security;
alter table installation_assigned_users enable row level security;
alter table notifications enable row level security;

-- ============ profiles ============
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated using (true);
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update to authenticated using (is_admin_or_coordinador());

-- ============ clients / contactos ============
drop policy if exists clients_select on clients;
create policy clients_select on clients for select to authenticated using (true);
drop policy if exists clients_write on clients;
create policy clients_write on clients for all to authenticated using (is_admin_or_coordinador()) with check (is_admin_or_coordinador());

drop policy if exists client_contacts_select on client_contacts;
create policy client_contacts_select on client_contacts for select to authenticated using (true);
drop policy if exists client_contacts_write on client_contacts;
create policy client_contacts_write on client_contacts for all to authenticated using (is_admin_or_coordinador()) with check (is_admin_or_coordinador());

-- ============ catálogos ============
drop policy if exists job_types_select on job_types;
create policy job_types_select on job_types for select to authenticated using (true);
drop policy if exists job_types_write on job_types;
create policy job_types_write on job_types for all to authenticated using (my_role() = 'admin') with check (my_role() = 'admin');

drop policy if exists materials_select on materials;
create policy materials_select on materials for select to authenticated using (true);
drop policy if exists materials_write on materials;
create policy materials_write on materials for all to authenticated using (my_role() = 'admin') with check (my_role() = 'admin');

-- ============ jobs ============
drop policy if exists jobs_select on jobs;
create policy jobs_select on jobs for select to authenticated using (can_view_job(id));
drop policy if exists jobs_insert on jobs;
create policy jobs_insert on jobs for insert to authenticated with check (is_admin_or_coordinador());
drop policy if exists jobs_update on jobs;
create policy jobs_update on jobs for update to authenticated using (can_view_job(id));

-- ============ asignaciones ============
drop policy if exists job_assigned_select on job_assigned_users;
create policy job_assigned_select on job_assigned_users for select to authenticated using (can_view_job(job_id));
drop policy if exists job_assigned_write on job_assigned_users;
create policy job_assigned_write on job_assigned_users for all to authenticated using (is_admin_or_coordinador()) with check (is_admin_or_coordinador());

-- ============ etapas ============
drop policy if exists job_stages_select on job_stages;
create policy job_stages_select on job_stages for select to authenticated using (can_view_job(job_id));
drop policy if exists job_stages_update on job_stages;
create policy job_stages_update on job_stages for update to authenticated using (can_view_job(job_id));
drop policy if exists job_stages_write on job_stages;
create policy job_stages_write on job_stages for insert to authenticated with check (is_admin_or_coordinador());
drop policy if exists job_stages_delete on job_stages;
create policy job_stages_delete on job_stages for delete to authenticated using (is_admin_or_coordinador());

-- ============ archivos ============
drop policy if exists job_files_select on job_files;
create policy job_files_select on job_files for select to authenticated using (can_view_job(job_id));
drop policy if exists job_files_write on job_files;
create policy job_files_write on job_files for insert to authenticated with check (can_view_job(job_id) and my_role() <> 'instalacion');

drop policy if exists file_versions_select on file_versions;
create policy file_versions_select on file_versions for select to authenticated
  using (exists (select 1 from job_files f where f.id = file_id and can_view_job(f.job_id)));
drop policy if exists file_versions_insert on file_versions;
create policy file_versions_insert on file_versions for insert to authenticated
  with check (exists (select 1 from job_files f where f.id = file_id and can_view_job(f.job_id) and my_role() <> 'instalacion'));
drop policy if exists file_versions_approve on file_versions;
create policy file_versions_approve on file_versions for update to authenticated
  using (exists (select 1 from job_files f where f.id = file_id and can_view_job(f.job_id)) and is_admin_or_coordinador());

-- ============ comentarios (inmutables una vez creados) ============
drop policy if exists comments_select on comments;
create policy comments_select on comments for select to authenticated using (can_view_job(job_id));
drop policy if exists comments_insert on comments;
create policy comments_insert on comments for insert to authenticated with check (can_view_job(job_id) and user_id = auth.uid());

-- ============ historial (inmutable — sin policy de update/delete) ============
drop policy if exists activity_log_select on activity_log;
create policy activity_log_select on activity_log for select to authenticated using (can_view_job(job_id));
drop policy if exists activity_log_insert on activity_log;
create policy activity_log_insert on activity_log for insert to authenticated with check (can_view_job(job_id) and user_id = auth.uid());

-- ============ bloqueos ============
drop policy if exists block_records_select on block_records;
create policy block_records_select on block_records for select to authenticated using (can_view_job(job_id));
drop policy if exists block_records_insert on block_records;
create policy block_records_insert on block_records for insert to authenticated with check (can_view_job(job_id));
drop policy if exists block_records_close on block_records;
create policy block_records_close on block_records for update to authenticated using (can_view_job(job_id) and is_admin_or_coordinador());

-- ============ control de calidad ============
drop policy if exists quality_checks_select on quality_checks;
create policy quality_checks_select on quality_checks for select to authenticated using (can_view_job(job_id));
drop policy if exists quality_checks_update on quality_checks;
create policy quality_checks_update on quality_checks for update to authenticated using (can_view_job(job_id));
drop policy if exists quality_checks_write on quality_checks;
create policy quality_checks_write on quality_checks for insert to authenticated with check (is_admin_or_coordinador());

-- ============ instalación ============
drop policy if exists installations_select on installations;
create policy installations_select on installations for select to authenticated using (can_view_job(job_id));
drop policy if exists installations_write on installations;
create policy installations_write on installations for insert to authenticated with check (is_admin_or_coordinador());
drop policy if exists installations_update on installations;
create policy installations_update on installations for update to authenticated
  using (can_view_job(job_id) and (is_admin_or_coordinador() or my_role() = 'instalacion'));

drop policy if exists install_assigned_select on installation_assigned_users;
create policy install_assigned_select on installation_assigned_users for select to authenticated using (can_view_job(job_id));
drop policy if exists install_assigned_write on installation_assigned_users;
create policy install_assigned_write on installation_assigned_users for all to authenticated using (is_admin_or_coordinador()) with check (is_admin_or_coordinador());

-- ============ notificaciones ============
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update to authenticated using (user_id = auth.uid());
drop policy if exists notifications_insert on notifications;
create policy notifications_insert on notifications for insert to authenticated with check (true);
