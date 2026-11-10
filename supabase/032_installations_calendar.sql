-- 032 — Módulo Instalaciones (calendario), 10/11/2026.
--
-- Se monta sobre la tabla `installations` que ya existe (una fila por trabajo).
-- No se crea otra tabla de instalaciones ni se duplican datos de la OT.
--
-- Agrega:
--   end_date         fin de la instalación (igual al inicio si dura un día)
--   locality         localidad
--   installer_names  quién instala, como nombres (Alejandro, Pancho, Martín):
--                    los instaladores externos no tienen cuenta en la app
--   papers_ok        papeles / permisos del lugar resueltos (sí / no)
--   rescheduled*     marca "reprogramada": se pone sola al cambiar la fecha y
--                    no se borra; guarda la fecha anterior y quién la cambió
--
-- Permisos: ver, igual que antes (can_view_job). Programar y modificar los datos
-- de agenda: admin, o coordinador que no es productor (misma regla que el valor
-- de un presupuesto). Se aplica con un trigger en la base, no solo en la pantalla.
-- Marcar "instalación completada" sigue como estaba.

alter table installations add column if not exists end_date date;
alter table installations add column if not exists locality text not null default '';
alter table installations add column if not exists installer_names text[] not null default '{}';
alter table installations add column if not exists papers_ok boolean not null default false;
alter table installations add column if not exists rescheduled boolean not null default false;
alter table installations add column if not exists rescheduled_from date;
alter table installations add column if not exists rescheduled_by uuid references profiles(id);
alter table installations add column if not exists rescheduled_at timestamptz;

update installations set end_date = install_date where end_date is null and install_date is not null;

alter table installations drop constraint if exists installations_end_after_start;
alter table installations add constraint installations_end_after_start
  check (end_date is null or install_date is null or end_date >= install_date);

create index if not exists installations_install_date_idx on installations(install_date);

-- Quién puede programar instalaciones.
create or replace function can_schedule_installations()
returns boolean as $$
  select coalesce(
    (select role = 'admin' or (role = 'coordinador' and is_producer = false) from profiles where id = auth.uid()),
    false
  );
$$ language sql stable security definer set search_path = public;

-- Guardia: los datos de agenda solo los cambia quien puede programar.
-- (El alta del trabajo desde Carga rápida sigue pudiendo crear la fila inicial.)
create or replace function installations_schedule_guard()
returns trigger as $$
begin
  if (new.install_date is distinct from old.install_date
      or new.end_date is distinct from old.end_date
      or new.install_time is distinct from old.install_time
      or new.address is distinct from old.address
      or new.locality is distinct from old.locality
      or new.contact_name is distinct from old.contact_name
      or new.contact_phone is distinct from old.contact_phone
      or new.notes is distinct from old.notes
      or new.installer_names is distinct from old.installer_names
      or new.papers_ok is distinct from old.papers_ok
      or new.rescheduled is distinct from old.rescheduled
      or new.rescheduled_from is distinct from old.rescheduled_from
      or new.rescheduled_by is distinct from old.rescheduled_by
      or new.rescheduled_at is distinct from old.rescheduled_at)
     and not can_schedule_installations() then
    raise exception 'Tu usuario no tiene permiso para programar instalaciones.' using errcode = '42501';
  end if;
  -- La marca de reprogramada no se puede sacar.
  if old.rescheduled and not new.rescheduled then
    new.rescheduled := true;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_installations_schedule_guard on installations;
create trigger trg_installations_schedule_guard before update on installations
  for each row execute procedure installations_schedule_guard();
