-- Catálogos — no dependen de usuarios, se puede correr apenas está el esquema.
insert into job_types (id, label, default_stages) values
  ('impresion_uv', 'Impresión UV', array['diseno','impresion','corte','control_calidad','embalaje']),
  ('bajo_acrilico', 'Bajo acrílico', array['diseno','impresion','corte','terminacion','control_calidad','embalaje']),
  ('plotter_vinilo', 'Plotter / Vinilo', array['diseno','impresion','corte','control_calidad']),
  ('vidrieras', 'Vidrieras', array['diseno','impresion','corte','instalacion']),
  ('senaletica', 'Señalética', array['diseno','impresion','corte','armado','control_calidad','instalacion']),
  ('carteleria', 'Cartelería', array['diseno','impresion','corte','armado','control_calidad','instalacion']),
  ('letras_corporeas', 'Letras corpóreas', array['diseno','corte','armado','terminacion','control_calidad','instalacion']),
  ('backlight', 'Backlight', array['diseno','impresion','corte','armado','control_calidad','instalacion']),
  ('stands', 'Stands', array['diseno','impresion','carpinteria','armado','control_calidad','instalacion']),
  ('eventos', 'Eventos', array['diseno','impresion','armado','instalacion']),
  ('ambientacion', 'Ambientación', array['diseno','impresion','corte','instalacion']),
  ('carpinteria', 'Carpintería', array['diseno','carpinteria','terminacion','control_calidad']),
  ('acrilico', 'Acrílico', array['diseno','corte','terminacion','control_calidad','embalaje']),
  ('trofeos', 'Trofeos', array['diseno','impresion','corte','terminacion','control_calidad','embalaje']),
  ('impresion_3d', 'Impresión 3D', array['diseno','impresion','terminacion','control_calidad','embalaje']),
  ('piezas_especiales', 'Piezas especiales', array['diseno','impresion','corte','armado','terminacion','control_calidad']),
  ('otro', 'Otro', array['diseno','control_calidad'])
on conflict (id) do update set label = excluded.label, default_stages = excluded.default_stages;

insert into materials (id, label) values
  ('acrilico', 'Acrílico'), ('pvc', 'PVC'), ('mdf', 'MDF'), ('madera', 'Madera'),
  ('metal', 'Metal'), ('vidrio', 'Vidrio'), ('vinilo', 'Vinilo'), ('papel', 'Papel'),
  ('tela', 'Tela'), ('otros', 'Otros')
on conflict (id) do update set label = excluded.label;
