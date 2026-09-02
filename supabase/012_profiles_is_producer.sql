-- Separa "rol de permisos" (admin ve Usuarios/Configuración) de "le asignan
-- trabajos de verdad" — hoy Gonzalo y Pancho son los dos `admin`, pero
-- Pancho (dueño) nunca debería aparecer en Responsable interno/Asignar a.
-- Default `true` a propósito: no cambia el comportamiento de nadie existente,
-- solo hay que apagarlo explícitamente para quien no deba ser asignable.
alter table profiles add column if not exists is_producer boolean not null default true;

update profiles set is_producer = false where email ilike 'panchobonta@gmail.com';

-- Verificación rápida:
select email, name, role, is_producer from profiles order by role;
