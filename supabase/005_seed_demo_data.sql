-- Datos de prueba — clientes + 10 trabajos representativos (todas las prioridades, un bloqueo,
-- un atrasado, una instalación, archivos con versión aprobada, comentarios, control de calidad).
-- Requiere que 004_seed_profiles.sql ya se haya corrido (usa los emails de los empleados).
-- Las fechas se calculan relativas a "now()" para que el dashboard se vea vivo apenas lo abras.

insert into clients (id, name, company, address, notes, tier) values
  ('a0000000-0000-0000-0000-000000000001', 'Lacoste', 'Lacoste Argentina', 'Av. Alvear 1883, CABA', 'Cliente de marca — estándares de instalación estrictos.', 'prioritario'),
  ('a0000000-0000-0000-0000-000000000002', 'Subway', 'Subway Argentina', 'Av. Corrientes 3247, CABA', 'Rollout de cartelería en varias sucursales simultáneas.', 'prioritario'),
  ('a0000000-0000-0000-0000-000000000003', 'Banco Galicia', 'Banco Galicia', 'Tte. Gral. J. D. Perón 407, CABA', 'Requiere aprobación de marca corporativa.', 'prioritario'),
  ('a0000000-0000-0000-0000-000000000004', 'Carrefour', 'Carrefour Argentina', 'Av. Rivadavia 8620, CABA', 'Cartelería de precios e indicadores de sucursal.', 'estandar'),
  ('a0000000-0000-0000-0000-000000000005', 'Farmaplus', 'Farmaplus S.A.', 'Av. Cabildo 2140, CABA', 'Cadena de farmacias.', 'estandar'),
  ('a0000000-0000-0000-0000-000000000006', 'Sinteplast', 'Sinteplast S.A.', 'Parque Industrial, San Luis', 'Stands para exposiciones del sector.', 'estandar'),
  ('a0000000-0000-0000-0000-000000000007', 'Victoria''s Secret', 'Victoria''s Secret Argentina', 'Av. Santa Fe 3253, CABA', 'Vidrieras de temporada — fechas de cambio ajustadas.', 'prioritario')
on conflict (id) do nothing;

insert into client_contacts (client_id, name, phone, email) values
  ('a0000000-0000-0000-0000-000000000001', 'Sofía Márquez', '11-4444-1122', 'sofia.marquez@lacoste.com.ar'),
  ('a0000000-0000-0000-0000-000000000002', 'Ramiro Díaz', '11-5566-8899', 'rdiaz@subway-ar.com'),
  ('a0000000-0000-0000-0000-000000000003', 'Valentina Ríos', '11-4321-0099', 'valentina.rios@bancogalicia.com'),
  ('a0000000-0000-0000-0000-000000000004', 'Martín Acosta', '11-6677-8800', 'martin.acosta@carrefour.com.ar'),
  ('a0000000-0000-0000-0000-000000000005', 'Estela Núñez', '11-3344-5566', 'estela@farmaplus.com.ar'),
  ('a0000000-0000-0000-0000-000000000006', 'Hernán López', '266-444-5522', 'hlopez@sinteplast.com'),
  ('a0000000-0000-0000-0000-000000000007', 'Camila Suárez', '11-2233-4455', 'camila.suarez@vs-ar.com');

do $$
declare
  juan uuid; maria uuid; lucia uuid; pedro uuid; diego uuid; nahuel uuid; gonzalo uuid;
  j uuid; f uuid;
begin
  select id into juan from profiles where email = 'juan@estudiobonta.com';
  select id into maria from profiles where email = 'maria@estudiobonta.com';
  select id into lucia from profiles where email = 'lucia@estudiobonta.com';
  select id into pedro from profiles where email = 'pedro@estudiobonta.com';
  select id into diego from profiles where email = 'diego@estudiobonta.com';
  select id into nahuel from profiles where email = 'nahuel@estudiobonta.com';
  select id into gonzalo from profiles where email = 'gonzalo@estudiobonta.com';

  if juan is null then
    raise exception 'No encontré a juan@estudiobonta.com en profiles — corré 004_seed_profiles.sql primero.';
  end if;

  -- 1) Crítico, en producción, requiere instalación --------------------------------------
  insert into jobs (code, name, client_id, contact_name, responsible_user_id, created_at, requested_date,
    committed_date, job_type_id, description, quantity, measurements, material_ids, technique, finish, color,
    observations, status, priority_auto, requires_installation, client_important, last_activity_at)
  values ('TRB-2026-00458', '20 carteles de sucursal', 'a0000000-0000-0000-0000-000000000001', 'Sofía Márquez', juan,
    now() - interval '4 days', now() + interval '2 hours', now() + interval '6 hours', 'carteleria',
    '20 carteles de fachada para relanzamiento de sucursales AMBA.', '20 unidades', '150x60 cm', array['pvc','vinilo'],
    'Impresión UV + corte', 'Laminado mate', 'Verde Lacoste + blanco', 'Coordinar entrega escalonada por sucursal.',
    'EN_PRODUCCION', 'CRITICO', true, true, now() - interval '1 hour')
  returning id into j;
  insert into job_assigned_users (job_id, user_id) values (j, diego), (j, pedro);
  insert into job_stages (job_id, key, label, active, status) values
    (j,'diseno','Diseño',true,'terminado'), (j,'impresion','Impresión',true,'terminado'),
    (j,'corte','Corte',true,'en_progreso'), (j,'control_calidad','Control de calidad',true,'pendiente'),
    (j,'embalaje','Embalaje',true,'pendiente'), (j,'instalacion','Instalación',true,'pendiente');
  insert into installations (job_id, address, contact_name, contact_phone, install_date, notes)
    values (j, 'Múltiples sucursales AMBA', 'Sofía Márquez', '11-4444-1122', current_date, '');
  insert into job_files (id, job_id, logical_name, kind) values (gen_random_uuid(), j, 'archivo_final', 'PDF') returning id into f;
  insert into file_versions (file_id, version, file_name, size_kb, uploaded_by, uploaded_at, approved) values
    (f, 1, 'archivo_final_v1.pdf', 4100, maria, now() - interval '3 days', false),
    (f, 2, 'archivo_final_aprobado.pdf', 4350, juan, now() - interval '2 days', true);
  insert into comments (job_id, user_id, text, created_at) values
    (j, maria, 'Falta confirmar el color del acrílico del zócalo.', now() - interval '3 hours'),
    (j, juan, 'Confirmado: verde Lacoste estándar, ficha de marca adjunta.', now() - interval '2 hours 30 minutes'),
    (j, pedro, '@Producción arrancamos con la primera tanda de 8 carteles hoy.', now() - interval '1 hour');
  insert into activity_log (job_id, user_id, action, detail, created_at) values
    (j, juan, 'crear', 'Creó el trabajo.', now() - interval '4 days'),
    (j, juan, 'prioridad', 'Cambió prioridad de NORMAL a URGENTE.', now() - interval '3 days 12 hours'),
    (j, pedro, 'estado', 'Producción inició el trabajo.', now() - interval '2 days');

  -- 2) Bloqueado, urgente, con instalación ------------------------------------------------
  insert into jobs (code, name, client_id, contact_name, responsible_user_id, created_at, requested_date,
    committed_date, job_type_id, description, quantity, measurements, material_ids, technique, finish, color,
    status, priority_auto, requires_installation, client_important, last_activity_at)
  values ('TRB-2026-00459', 'Vidriera temporada primavera', 'a0000000-0000-0000-0000-000000000007', 'Camila Suárez', juan,
    now() - interval '1 day', now() + interval '1 hour', now() + interval '3 hours', 'vidrieras',
    'Vinilado de vidriera con nueva campaña de temporada.', '1 vidriera', '4.20 x 2.60 m', array['vinilo'],
    'Plotter + corte', 'Vinilo autoadhesivo', 'Full color', 'BLOQUEADO', 'CRITICO', true, true, now() - interval '5 hours')
  returning id into j;
  insert into job_assigned_users (job_id, user_id) values (j, maria), (j, nahuel);
  insert into job_stages (job_id, key, label, active, status) values
    (j,'diseno','Diseño',true,'terminado'), (j,'impresion','Impresión',true,'en_progreso'),
    (j,'corte','Corte',true,'pendiente'), (j,'instalacion','Instalación',true,'pendiente');
  insert into installations (job_id, address, contact_name, contact_phone, install_date)
    values (j, 'Av. Santa Fe 3253, CABA', 'Camila Suárez', '11-2233-4455', current_date);
  insert into block_records (job_id, reason, description, opened_by, opened_at) values
    (j, 'falta_aprobacion', 'Cliente todavía no aprobó el arte final de la vidriera.', nahuel, now() - interval '5 hours');
  insert into comments (job_id, user_id, text, created_at) values
    (j, nahuel, 'Quedamos bloqueados hasta que el cliente apruebe el arte.', now() - interval '5 hours'),
    (j, juan, 'Ya envié el recordatorio por WhatsApp, esperando respuesta.', now() - interval '4 hours');
  insert into activity_log (job_id, user_id, action, detail, created_at) values
    (j, juan, 'crear', 'Creó el trabajo.', now() - interval '1 day'),
    (j, nahuel, 'bloqueo', 'Bloqueó el trabajo — falta aprobación del cliente.', now() - interval '5 hours');

  -- 3) En diseño, cliente importante -------------------------------------------------------
  insert into jobs (code, name, client_id, contact_name, responsible_user_id, created_at, requested_date,
    committed_date, job_type_id, description, quantity, measurements, material_ids, technique, finish, color,
    status, priority_auto, client_important, last_activity_at)
  values ('TRB-2026-00460', 'Señalética interior sucursal Congreso', 'a0000000-0000-0000-0000-000000000003', 'Valentina Ríos', juan,
    now() - interval '6 days', now() + interval '18 hours', now() + interval '22 hours', 'senaletica',
    'Cartelería direccional y de cajeros para sucursal remodelada.', '14 piezas', 'Varias', array['acrilico','pvc'],
    'Impresión UV', 'Corte a medida', 'Paleta corporativa Galicia', 'EN_DISENO', 'CRITICO', true, now() - interval '3 hours')
  returning id into j;
  insert into job_assigned_users (job_id, user_id) values (j, lucia);
  insert into job_stages (job_id, key, label, active, status) values
    (j,'diseno','Diseño',true,'en_progreso'), (j,'impresion','Impresión',true,'pendiente'),
    (j,'corte','Corte',true,'pendiente'), (j,'armado','Armado',true,'pendiente'),
    (j,'control_calidad','Control de calidad',true,'pendiente'), (j,'instalacion','Instalación',true,'pendiente');

  -- 4) Nuevo, falta información (dispara el aviso de "faltan datos") ----------------------
  insert into jobs (code, name, client_id, contact_name, responsible_user_id, created_at, committed_date,
    job_type_id, description, status, priority_auto, last_activity_at)
  values ('TRB-2026-00473', 'Cartel MDF pintado local nuevo', 'a0000000-0000-0000-0000-000000000005', 'Estela Núñez', juan,
    now(), now() + interval '20 hours', 'carteleria', 'Pedido tomado por teléfono — falta especificar casi todo.',
    'FALTA_INFORMACION', 'EN_ESPERA', now() - interval '10 minutes')
  returning id into j;

  -- 5) Atrasado (fecha comprometida ya pasó) -----------------------------------------------
  insert into jobs (code, name, client_id, contact_name, responsible_user_id, created_at, committed_date,
    job_type_id, description, quantity, measurements, material_ids, technique, finish, color,
    status, priority_auto, last_activity_at)
  values ('TRB-2026-00466', 'Backlight cartel de local', 'a0000000-0000-0000-0000-000000000005', 'Estela Núñez', juan,
    now() - interval '8 days', now() - interval '20 hours', 'backlight', 'Cartel backlight de fachada para nueva sucursal.',
    '1 unidad', '3x1 m', array['acrilico','metal'], 'Impresión UV + armado', 'Marco de aluminio', 'Verde/blanco',
    'EN_CONTROL_CALIDAD', 'CRITICO', now() - interval '26 hours')
  returning id into j;
  insert into job_assigned_users (job_id, user_id) values (j, diego);
  insert into quality_checks (job_id, key, label, required, checked) values
    (j,'medidas','Medidas correctas',true,true), (j,'material','Material correcto',true,true),
    (j,'color','Color correcto',true,false), (j,'impresion','Impresión correcta',true,true),
    (j,'terminacion','Terminación correcta',true,false), (j,'cantidad','Cantidad correcta',true,true),
    (j,'archivo','Archivo correcto (versión aprobada)',true,true), (j,'danos','Sin daños',true,true);

  -- 6) Planificado, sin apuro -----------------------------------------------------------
  insert into jobs (code, name, client_id, contact_name, responsible_user_id, created_at, committed_date,
    job_type_id, description, quantity, measurements, material_ids, technique, finish, color, status, priority_auto, last_activity_at)
  values ('TRB-2026-00464', 'Trofeos torneo interno', 'a0000000-0000-0000-0000-000000000006', 'Hernán López', juan,
    now() - interval '3 days', now() + interval '8 days', 'trofeos', '30 trofeos termoformados con grabado de sponsor.',
    '30 unidades', '25 cm alto', array['acrilico'], 'Termoformado + grabado', 'Base metálica', 'Transparente',
    'DISENO_LISTO', 'PLANIFICADO', now() - interval '14 hours')
  returning id into j;
  insert into job_assigned_users (job_id, user_id) values (j, lucia);

  -- 7) Prioridad forzada manualmente (para ver la etiqueta "manual") -----------------------
  insert into jobs (code, name, client_id, contact_name, responsible_user_id, created_at, committed_date,
    job_type_id, description, quantity, measurements, material_ids, technique, finish, color,
    status, priority_auto, priority_manual, requires_installation, last_activity_at)
  values ('TRB-2026-00463', 'Stand feria Pinturería Expo', 'a0000000-0000-0000-0000-000000000006', 'Hernán López', gonzalo,
    now() - interval '15 days', now() + interval '9 days', 'stands', 'Stand de 6x4m para feria del sector.',
    '1 stand', '6x4 m', array['mdf','vinilo'], 'Carpintería + impresión UV', 'Pintura + gráfica adhesivada', 'Paleta Sinteplast',
    'EN_PRODUCCION', 'PLANIFICADO', 'URGENTE', true, now() - interval '8 hours')
  returning id into j;
  insert into job_assigned_users (job_id, user_id) values (j, gonzalo), (j, diego), (j, pedro);
  insert into installations (job_id, address, contact_name, contact_phone, notes)
    values (j, 'La Rural, CABA (montaje in situ)', 'Hernán López', '266-444-5522', 'Desarmable, se traslada en camión propio.');
  insert into comments (job_id, user_id, text, created_at) values
    (j, gonzalo, 'Primera propuesta de plegado lista, la subo para revisión.', now() - interval '2 hours');

  -- 8) Terminado (para ver el estado final + instalación completada) -----------------------
  insert into jobs (code, name, client_id, contact_name, responsible_user_id, created_at, committed_date, finished_at,
    job_type_id, description, quantity, measurements, material_ids, technique, finish, color,
    status, priority_auto, requires_installation, last_activity_at)
  values ('TRB-2026-00476', 'Vidriera navideña — control final', 'a0000000-0000-0000-0000-000000000001', 'Sofía Márquez', juan,
    now() - interval '9 days', now() - interval '3 days', now() - interval '3 days', 'vidrieras',
    'Últimos retoques y control de calidad antes de instalación.', '1 vidriera', '4x2.5 m', array['vinilo'],
    'Plotter + corte', 'Laminado', 'Full color', 'TERMINADO', 'PLANIFICADO', true, now() - interval '3 days')
  returning id into j;
  insert into job_assigned_users (job_id, user_id) values (j, nahuel);
  insert into installations (job_id, address, contact_name, contact_phone, completed, completed_at, completed_notes)
    values (j, 'Av. Alvear 1883, CABA', 'Sofía Márquez', '11-4444-1122', true, now() - interval '3 days', 'Instalación realizada sin observaciones.');

  -- 9) Cancelado ----------------------------------------------------------------------------
  insert into jobs (code, name, client_id, contact_name, responsible_user_id, created_at, committed_date,
    job_type_id, description, status, priority_auto, last_activity_at)
  values ('TRB-2026-00475', 'Cartel backlight cancelado por cliente', 'a0000000-0000-0000-0000-000000000003', 'Valentina Ríos', juan,
    now() - interval '20 days', now() - interval '10 days', 'backlight', 'Cliente canceló el proyecto.',
    'CANCELADO', 'PLANIFICADO', now() - interval '96 hours')
  returning id into j;

  -- 10) Normal, cliente Subway con evento a fecha fija --------------------------------------
  insert into jobs (code, name, client_id, contact_name, responsible_user_id, created_at, committed_date,
    job_type_id, description, quantity, measurements, material_ids, technique, finish, color,
    status, priority_auto, requires_installation, client_important, last_activity_at)
  values ('TRB-2026-00471', 'Gráfica evento lanzamiento', 'a0000000-0000-0000-0000-000000000002', 'Ramiro Díaz', gonzalo,
    now() - interval '3 days', now() + interval '18 hours', 'eventos',
    'Backdrop, banners y señalética para evento de lanzamiento de producto.', '1 set completo', 'Backdrop 4x3m + 6 banners',
    array['vinilo','tela'], 'Impresión + armado', 'Estructura desarmable', 'Paleta Subway',
    'EN_PRODUCCION', 'CRITICO', true, true, now() - interval '3 hours')
  returning id into j;
  insert into job_assigned_users (job_id, user_id) values (j, gonzalo), (j, nahuel);
  insert into installations (job_id, address, contact_name, contact_phone)
    values (j, 'Centro de convenciones, CABA', 'Ramiro Díaz', '11-5566-8899');

end $$;
