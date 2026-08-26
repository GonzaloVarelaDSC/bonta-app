-- Ficha de prueba para arrastrar por todas las columnas del Kanban sin miedo a
-- romper nada real. NO es parte de la cadena de migraciones numeradas (001..008) —
-- es opcional, se corre una sola vez cuando hace falta y se puede borrar cuando
-- se quiera con el DELETE comentado al final de este archivo.
--
-- Ojo: para que se pueda arrastrar hasta "Listo" sin que el control de calidad la
-- frene, este trabajo nace con todos los ítems obligatorios ya tildados. Un trabajo
-- real nace SIN tildar (así lo carga createJob) y por diseño no deja pasar a
-- Listo/Instalación hasta completar el checklist desde la ficha — no es un bug.

do $$
declare
  responsable uuid;
  cliente_prueba uuid := '00000000-0000-0000-0000-0000000000f1';
  j uuid;
begin
  select id into responsable from profiles where email = 'gonzaa.gd@gmail.com';
  if responsable is null then
    raise exception 'No encontré tu perfil (gonzaa.gd@gmail.com) en profiles.';
  end if;

  insert into clients (id, name, company, address, notes, tier)
  values (cliente_prueba, 'Cliente de prueba', 'Cliente de prueba', '', 'Ficticio — solo para testear el Kanban.', 'estandar')
  on conflict (id) do nothing;

  insert into jobs (code, name, client_id, contact_name, responsible_user_id, created_by_user_id,
    committed_date, job_type_id, description, status, priority_manual)
  values ('PRUEBA-001', 'Ficha de prueba — arrastrame por el tablero', cliente_prueba, 'Cliente de prueba',
    responsable, responsable, now() + interval '3 days', 'carteleria',
    'Ficha de prueba para testear el Kanban. Se puede borrar cuando quieras.',
    'PENDIENTE', 'NORMAL')
  returning id into j;

  insert into quality_checks (job_id, key, label, required, checked) values
    (j,'medidas','Medidas correctas',true,true), (j,'material','Material correcto',true,true),
    (j,'color','Color correcto',true,true), (j,'impresion','Impresión correcta',true,true),
    (j,'corte','Corte correcto',false,true), (j,'terminacion','Terminación correcta',true,true),
    (j,'cantidad','Cantidad correcta',true,true), (j,'archivo','Archivo correcto (versión aprobada)',true,true),
    (j,'danos','Sin daños',true,true), (j,'embalaje','Embalaje correcto',false,true);
end $$;

-- Para borrarla cuando termines de probar (descomentar y correr):
-- delete from jobs where code = 'PRUEBA-001';
-- delete from clients where id = '00000000-0000-0000-0000-0000000000f1';
