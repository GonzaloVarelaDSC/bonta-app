-- Correr DESPUÉS de crear los 8 usuarios en Authentication → Users (ver supabase/README.md).
-- El trigger de 001_schema.sql ya creó una fila en "profiles" para cada uno con datos mínimos;
-- esto completa nombre, rol, sector y color de avatar.

update profiles set name = 'Marcela Bonta', role = 'admin', sector = 'Dirección', avatar_color = '#0f4c3a' where email = 'marcela@estudiobonta.com';
update profiles set name = 'Juan Pérez', role = 'coordinador', sector = 'Coordinación', avatar_color = '#146b52' where email = 'juan@estudiobonta.com';
update profiles set name = 'María Gómez', role = 'diseno', sector = 'Diseño', avatar_color = '#7c3aed' where email = 'maria@estudiobonta.com';
update profiles set name = 'Lucía Fernández', role = 'diseno', sector = 'Diseño', avatar_color = '#9333ea' where email = 'lucia@estudiobonta.com';
update profiles set name = 'Pedro Ramírez', role = 'produccion', sector = 'Producción', avatar_color = '#c2410c' where email = 'pedro@estudiobonta.com';
update profiles set name = 'Diego Sosa', role = 'produccion', sector = 'Producción', avatar_color = '#b45309' where email = 'diego@estudiobonta.com';
update profiles set name = 'Nahuel Torres', role = 'instalacion', sector = 'Instalación', avatar_color = '#0369a1' where email = 'nahuel@estudiobonta.com';
update profiles set name = 'Gonzalo Varela', role = 'coordinador', sector = 'Diseño Industrial / Producción', avatar_color = '#0f4c3a' where email = 'gonzalo@estudiobonta.com';

-- Verificación rápida — tiene que devolver 8 filas con role correcto:
select email, name, role from profiles order by role;
